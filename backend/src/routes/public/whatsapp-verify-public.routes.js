/**
 * API Pública - Verificação de WhatsApp (1 número)
 * Autenticação: email + senha no body
 * Controle: rodízio entre instâncias + cooldown de 10s POR INSTÂNCIA
 *
 * POST /api/public/whatsapp/verificar
 */

const express = require('express');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const router = express.Router();
const { pool } = require('../../database/connection');
const UazService = require('../../services/uazService');
const { getTenantUazapCredentials } = require('../../helpers/uaz-credentials.helper');

const COOLDOWN_MS = 10_000; // 10 segundos por instância
const MAX_ESPERA_MS = 15 * 60 * 1000; // máximo 15 min na fila

function normalizarTelefone(telefone) {
  const apenasDigitos = String(telefone).replace(/\D/g, '');

  if (apenasDigitos.startsWith('55') && apenasDigitos.length >= 12) {
    return apenasDigitos;
  }
  if (apenasDigitos.length >= 10) {
    return '55' + apenasDigitos;
  }
  return apenasDigitos;
}

function getBaseUrl(req) {
  return (
    process.env.API_BASE_URL ||
    process.env.WEBHOOK_BASE_URL ||
    `${req.protocol}://${req.get('host')}`
  ).replace(/\/$/, '');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function autenticarUsuario(email, senha) {
  const userResult = await pool.query(
    `SELECT
       u.id,
       u.tenant_id,
       u.nome,
       u.email,
       u.senha_hash,
       u.ativo,
       t.status as tenant_status,
       t.ativo as tenant_ativo
     FROM tenant_users u
     INNER JOIN tenants t ON t.id = u.tenant_id
     WHERE LOWER(u.email) = LOWER($1)`,
    [email]
  );

  if (userResult.rows.length === 0) {
    return { erro: { status: 401, mensagem: 'Email ou senha inválidos' } };
  }

  const usuario = userResult.rows[0];

  if (!usuario.ativo) {
    return { erro: { status: 403, mensagem: 'Usuário inativo. Entre em contato com o administrador.' } };
  }

  if (!usuario.tenant_ativo) {
    return { erro: { status: 403, mensagem: 'Conta suspensa. Entre em contato com o suporte.' } };
  }

  const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
  if (!senhaValida) {
    return { erro: { status: 401, mensagem: 'Email ou senha inválidos' } };
  }

  return { usuario };
}

async function buscarInstanciasConectadas(tenantId) {
  let result = await pool.query(
    `SELECT ui.id, ui.instance_token, ui.name, p.host, p.port, p.username, p.password
     FROM uaz_instances ui
     LEFT JOIN proxies p ON ui.proxy_id = p.id
     WHERE ui.tenant_id = $1 AND ui.is_active = true AND ui.status = 'connected'
       AND ui.instance_token IS NOT NULL
     ORDER BY ui.id`,
    [tenantId]
  );

  if (result.rows.length === 0) {
    result = await pool.query(
      `SELECT ui.id, ui.instance_token, ui.name, p.host, p.port, p.username, p.password
       FROM uaz_instances ui
       LEFT JOIN proxies p ON ui.proxy_id = p.id
       WHERE ui.tenant_id = $1 AND ui.is_connected = true
         AND ui.instance_token IS NOT NULL
       ORDER BY ui.id`,
      [tenantId]
    );
  }

  return result.rows;
}

// ── Controle de fila / cooldown por instância ──────────────────────────────
const rotacaoPorTenant = new Map(); // tenantId -> próximo índice
const estadoInstancia = new Map(); // `${tenantId}:${instanceId}` -> { busy, lastUsedAt }
const mutexPorTenant = new Map(); // chain de promises para claim atômico

function getEstadoInstancia(tenantId, instanceId) {
  const key = `${tenantId}:${instanceId}`;
  if (!estadoInstancia.has(key)) {
    estadoInstancia.set(key, { busy: false, lastUsedAt: 0 });
  }
  return { key, state: estadoInstancia.get(key) };
}

function runExclusive(tenantId, fn) {
  const prev = mutexPorTenant.get(tenantId) || Promise.resolve();
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  mutexPorTenant.set(
    tenantId,
    prev.then(() => gate).catch(() => {})
  );

  return prev.then(async () => {
    try {
      return await fn();
    } finally {
      release();
    }
  });
}

/**
 * Reserva uma instância disponível respeitando cooldown de 10s POR instância.
 * Com N instâncias, até N consultas podem rodar em paralelo (1 por instância).
 * Se todas estiverem em cooldown/ocupadas, espera até liberar.
 */
async function adquirirInstancia(tenantId) {
  const inicio = Date.now();

  while (true) {
    if (Date.now() - inicio > MAX_ESPERA_MS) {
      const err = new Error(
        'Tempo máximo de espera na fila excedido. Tente novamente em alguns minutos.'
      );
      err.status = 429;
      throw err;
    }

    const result = await runExclusive(tenantId, async () => {
      const instancias = await buscarInstanciasConectadas(tenantId);
      if (!instancias.length) {
        return { semInstancia: true };
      }

      const now = Date.now();
      const start = rotacaoPorTenant.get(tenantId) || 0;
      let minWait = Infinity;

      for (let i = 0; i < instancias.length; i++) {
        const idx = (start + i) % instancias.length;
        const inst = instancias[idx];
        const { key, state } = getEstadoInstancia(tenantId, inst.id);

        if (state.busy) {
          minWait = Math.min(minWait, 300);
          continue;
        }

        const wait = state.lastUsedAt
          ? Math.max(0, COOLDOWN_MS - (now - state.lastUsedAt))
          : 0;

        if (wait === 0) {
          state.busy = true;
          rotacaoPorTenant.set(tenantId, (idx + 1) % instancias.length);
          return {
            instancia: inst,
            key,
            state,
            instanciasCount: instancias.length,
            esperaMs: Date.now() - inicio,
          };
        }

        minWait = Math.min(minWait, wait);
      }

      return {
        waitMs: minWait === Infinity ? 500 : minWait,
        instanciasCount: instancias.length,
      };
    });

    if (result.semInstancia) {
      const err = new Error(
        'Nenhuma instância WhatsApp conectada neste tenant. Conecte um QR Code no disparador.'
      );
      err.status = 400;
      throw err;
    }

    if (result.instancia) {
      return result;
    }

    await sleep(Math.max(50, Math.min(result.waitMs, 1000)));
  }
}

function liberarInstancia(slot) {
  if (!slot?.state) return;
  slot.state.lastUsedAt = Date.now();
  slot.state.busy = false;
}

async function baixarFotoLocal(profilePicUrl, phoneNumber) {
  if (!profilePicUrl) return null;

  if (!profilePicUrl.includes('pps.whatsapp.net') && !profilePicUrl.startsWith('http')) {
    return profilePicUrl;
  }

  try {
    const imageResponse = await axios.get(profilePicUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
      maxRedirects: 5,
    });

    const hash = crypto.createHash('md5').update(String(phoneNumber)).digest('hex');
    const filename = `profile_${hash}_${Date.now()}.jpg`;
    const filepath = path.join(__dirname, '../../../uploads/profile-pics', filename);
    const dir = path.dirname(filepath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filepath, Buffer.from(imageResponse.data));
    return `/uploads/profile-pics/${filename}`;
  } catch (err) {
    console.error('❌ Erro ao baixar foto pública:', err.message);
    return `/api/uaz/proxy-image?url=${encodeURIComponent(profilePicUrl)}`;
  }
}

/**
 * POST /api/public/whatsapp/verificar
 *
 * Body:
 *   email        (obrigatório)
 *   senha        (obrigatório)
 *   telefone     (obrigatório)
 *   buscar_foto  (opcional) - default true
 *
 * Controle automático:
 *   - Rodízio entre todas as instâncias QR conectadas
 *   - Cooldown de 10s POR instância (não global)
 *   - Com 3 instâncias: até 3 consultas em paralelo; cada uma só reutiliza após 10s
 */
router.post('/verificar', async (req, res) => {
  let slot = null;

  try {
    const { email, senha, telefone, buscar_foto = true } = req.body;

    if (!email || !senha) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Email e senha são obrigatórios',
      });
    }

    if (!telefone) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'O campo telefone é obrigatório',
      });
    }

    const auth = await autenticarUsuario(email, senha);
    if (auth.erro) {
      return res.status(auth.erro.status).json({
        sucesso: false,
        mensagem: auth.erro.mensagem,
      });
    }

    const tenantId = auth.usuario.tenant_id;
    const telefoneNormalizado = normalizarTelefone(telefone);

    if (telefoneNormalizado.length < 12) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Número de telefone inválido. Use o formato: 5511999999999',
      });
    }

    // Entra na fila: espera slot livre respeitando 10s por instância
    slot = await adquirirInstancia(tenantId);
    const { instancia, instanciasCount, esperaMs } = slot;

    const credentials = await getTenantUazapCredentials(tenantId);
    const uazService = new UazService(credentials.serverUrl, credentials.adminToken);

    const proxyConfig = instancia.host
      ? {
          host: instancia.host,
          port: instancia.port,
          username: instancia.username,
          password: instancia.password,
        }
      : null;

    console.log(
      `📱 [API Pública] Verificando: ${telefoneNormalizado} ` +
        `(tenant ${tenantId}, instância ${instancia.name}, ` +
        `${instanciasCount} conectada(s), espera fila ${esperaMs}ms, cooldown ${COOLDOWN_MS / 1000}s/instância)`
    );

    const checkResult = await uazService.checkNumber(
      instancia.instance_token,
      telefoneNormalizado,
      proxyConfig
    );

    if (!checkResult.success) {
      return res.status(500).json({
        sucesso: false,
        mensagem: checkResult.error || 'Erro ao verificar número no WhatsApp',
      });
    }

    const temWhatsapp = !!(checkResult.exists || checkResult.data?.isInWhatsapp);
    let fotoPerfil = null;
    let nomeWhatsapp = checkResult.data?.verifiedName || null;

    if (temWhatsapp && buscar_foto !== false && buscar_foto !== 'false') {
      try {
        const details = await uazService.getContactDetails(
          instancia.instance_token,
          telefoneNormalizado,
          false,
          proxyConfig
        );

        if (details.success) {
          if (details.contactName && details.contactName !== telefoneNormalizado) {
            nomeWhatsapp = details.contactName;
          }

          if (details.profilePicUrl) {
            const localOrProxy = await baixarFotoLocal(details.profilePicUrl, telefoneNormalizado);
            if (localOrProxy) {
              fotoPerfil = localOrProxy.startsWith('http')
                ? localOrProxy
                : `${getBaseUrl(req)}${localOrProxy}`;
            }
          }
        }
      } catch (fotoErr) {
        console.error('⚠️ [API Pública] Erro ao buscar foto:', fotoErr.message);
      }
    }

    return res.json({
      sucesso: true,
      telefone: telefoneNormalizado,
      tem_whatsapp: temWhatsapp,
      nome: nomeWhatsapp,
      foto_perfil: fotoPerfil,
      instancia_usada: instancia.name,
      instancias_disponiveis: instanciasCount,
      cooldown_segundos: COOLDOWN_MS / 1000,
      espera_fila_ms: esperaMs,
      verificado_em: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ [API Pública] Erro na verificação WhatsApp:', error);
    const status = error.status || 500;
    return res.status(status).json({
      sucesso: false,
      mensagem: error.message || 'Erro interno ao verificar WhatsApp',
    });
  } finally {
    liberarInstancia(slot);
  }
});

module.exports = router;
