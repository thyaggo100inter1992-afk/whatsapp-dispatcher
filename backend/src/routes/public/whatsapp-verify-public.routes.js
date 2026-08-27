/**
 * API Pública - Verificação de WhatsApp
 * Autenticação: token do tenant (nsk_...) OU email + senha (compatibilidade)
 * Controle: rodízio entre instâncias + cooldown de 3s POR INSTÂNCIA
 *
 * POST /api/public/whatsapp/verificar       — 1 número
 * POST /api/public/whatsapp/verificar-lote  — vários números (sem limite)
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const router = express.Router();
const { pool } = require('../../database/connection');
const UazService = require('../../services/uazService');
const { getTenantUazapCredentials } = require('../../helpers/uaz-credentials.helper');
const { autenticarApiPublica } = require('../../helpers/public-api-auth.helper');

const COOLDOWN_MS = 3_000; // 3 segundos por instância
const MAX_ESPERA_MS = 30 * 60 * 1000; // máximo 30 min na fila (lotes grandes)

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

async function buscarInstanciasConectadas(tenantId, usuario) {
  const isOwner =
    !usuario || usuario.role === 'admin' || usuario.role === 'super_admin';
  const filtroUsuario = isOwner
    ? ''
    : ` AND EXISTS (
          SELECT 1 FROM user_uaz_instances uui
          WHERE uui.uaz_instance_id = ui.id
            AND uui.user_id = $2
            AND uui.tenant_id = $1
        )`;
  const params = isOwner ? [tenantId] : [tenantId, usuario.id];

  let result = await pool.query(
    `SELECT ui.id, ui.instance_token, ui.name, p.host, p.port, p.username, p.password
     FROM uaz_instances ui
     LEFT JOIN proxies p ON ui.proxy_id = p.id
     WHERE ui.tenant_id = $1 AND ui.is_active = true AND ui.status = 'connected'
       AND ui.instance_token IS NOT NULL${filtroUsuario}
     ORDER BY ui.id`,
    params
  );

  if (result.rows.length === 0) {
    result = await pool.query(
      `SELECT ui.id, ui.instance_token, ui.name, p.host, p.port, p.username, p.password
       FROM uaz_instances ui
       LEFT JOIN proxies p ON ui.proxy_id = p.id
       WHERE ui.tenant_id = $1 AND ui.is_connected = true
         AND ui.instance_token IS NOT NULL${filtroUsuario}
       ORDER BY ui.id`,
      params
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
 * Reserva uma instância disponível respeitando cooldown de 3s POR instância.
 * Com N instâncias, até N consultas podem rodar em paralelo (1 por instância).
 * Com 1 instância: uma consulta a cada 3s.
 */
async function adquirirInstancia(tenantId, usuario) {
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
      const instancias = await buscarInstanciasConectadas(tenantId, usuario);
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
          minWait = Math.min(minWait, 200);
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
        waitMs: minWait === Infinity ? 300 : minWait,
        instanciasCount: instancias.length,
      };
    });

    if (result.semInstancia) {
      const err = new Error(
        'Nenhuma instância WhatsApp conectada para este usuário. Libere um QR Code para ele no disparador.'
      );
      err.status = 400;
      throw err;
    }

    if (result.instancia) {
      return result;
    }

    await sleep(Math.max(40, Math.min(result.waitMs, 500)));
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

async function verificarUmNumero({
  tenantId,
  usuario,
  telefoneNormalizado,
  buscarFoto,
  baseUrl,
  uazService,
}) {
  let slot = null;

  try {
    slot = await adquirirInstancia(tenantId, usuario);
    const { instancia, instanciasCount, esperaMs } = slot;

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
      return {
        sucesso: false,
        telefone: telefoneNormalizado,
        tem_whatsapp: false,
        nome: null,
        foto_perfil: null,
        instancia_usada: instancia.name,
        erro: checkResult.error || 'Erro ao verificar número no WhatsApp',
        espera_fila_ms: esperaMs,
      };
    }

    const temWhatsapp = !!(checkResult.exists || checkResult.data?.isInWhatsapp);
    let fotoPerfil = null;
    let nomeWhatsapp = checkResult.data?.verifiedName || null;

    if (temWhatsapp && buscarFoto) {
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
                : `${baseUrl}${localOrProxy}`;
            }
          }
        }
      } catch (fotoErr) {
        console.error('⚠️ [API Pública] Erro ao buscar foto:', fotoErr.message);
      }
    }

    return {
      sucesso: true,
      telefone: telefoneNormalizado,
      tem_whatsapp: temWhatsapp,
      nome: nomeWhatsapp,
      foto_perfil: fotoPerfil,
      instancia_usada: instancia.name,
      instancias_disponiveis: instanciasCount,
      espera_fila_ms: esperaMs,
      verificado_em: new Date().toISOString(),
    };
  } finally {
    liberarInstancia(slot);
  }
}

/**
 * Processa itens com até `concurrency` workers em paralelo.
 * Cada worker pega o próximo índice — com N instâncias, N checks ao mesmo tempo.
 */
async function mapPool(items, concurrency, workerFn) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await workerFn(items[i], i);
    }
  }

  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length)) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

/**
 * POST /api/public/whatsapp/verificar
 *
 * Body:
 *   token / email+senha
 *   telefone     (obrigatório)
 *   buscar_foto  (opcional) - default true
 */
router.post('/verificar', async (req, res) => {
  try {
    const { telefone, buscar_foto = true } = req.body;

    const auth = await autenticarApiPublica(req);
    if (auth.erro) {
      return res.status(auth.erro.status).json({
        sucesso: false,
        mensagem: auth.erro.mensagem,
      });
    }

    if (!telefone) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'O campo telefone é obrigatório',
      });
    }

    const telefoneNormalizado = normalizarTelefone(telefone);
    if (telefoneNormalizado.length < 12) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Número de telefone inválido. Use o formato: 5511999999999',
      });
    }

    const credentials = await getTenantUazapCredentials(auth.tenantId);
    const uazService = new UazService(credentials.serverUrl, credentials.adminToken);
    const buscarFoto = buscar_foto !== false && buscar_foto !== 'false';

    const resultado = await verificarUmNumero({
      tenantId: auth.tenantId,
      usuario: auth.usuario,
      telefoneNormalizado,
      buscarFoto,
      baseUrl: getBaseUrl(req),
      uazService,
    });

    if (!resultado.sucesso && resultado.erro) {
      return res.status(500).json({
        sucesso: false,
        mensagem: resultado.erro,
      });
    }

    return res.json({
      ...resultado,
      cooldown_segundos: COOLDOWN_MS / 1000,
    });
  } catch (error) {
    console.error('❌ [API Pública] Erro na verificação WhatsApp:', error);
    const status = error.status || 500;
    return res.status(status).json({
      sucesso: false,
      mensagem: error.message || 'Erro interno ao verificar WhatsApp',
    });
  }
});

/**
 * POST /api/public/whatsapp/verificar-lote
 *
 * Body:
 *   token / email+senha
 *   telefones    (obrigatório) - array de números (sem limite de quantidade)
 *   buscar_foto  (opcional) - default false (mais rápido em lote)
 *
 * Comportamento:
 *   - 1 instância: verifica um a um com intervalo de 3s
 *   - N instâncias: até N verificações em paralelo; cada instância espera 3s entre usos
 */
router.post('/verificar-lote', async (req, res) => {
  const inicio = Date.now();

  try {
    const { telefones, telefone, buscar_foto = false } = req.body;

    const auth = await autenticarApiPublica(req);
    if (auth.erro) {
      return res.status(auth.erro.status).json({
        sucesso: false,
        mensagem: auth.erro.mensagem,
      });
    }

    const listaRaw = telefones ?? telefone;
    const lista = Array.isArray(listaRaw)
      ? listaRaw
      : listaRaw
        ? [listaRaw]
        : [];

    if (lista.length === 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Informe o campo telefones com um ou mais números',
      });
    }

    const instancias = await buscarInstanciasConectadas(auth.tenantId, auth.usuario);
    if (!instancias.length) {
      return res.status(400).json({
        sucesso: false,
        mensagem:
          'Nenhuma instância WhatsApp conectada para este usuário. Libere um QR Code para ele no disparador.',
      });
    }

    const credentials = await getTenantUazapCredentials(auth.tenantId);
    const uazService = new UazService(credentials.serverUrl, credentials.adminToken);
    const buscarFoto = buscar_foto === true || buscar_foto === 'true';
    const baseUrl = getBaseUrl(req);
    const concurrency = instancias.length; // paralelo = qtd de QRs; 1 QR = sequencial 3s

    console.log(
      `📦 [API Pública] Lote: ${lista.length} telefone(s), ` +
        `${concurrency} instância(s), cooldown ${COOLDOWN_MS / 1000}s, ` +
        `foto=${buscarFoto} (tenant ${auth.tenantId})`
    );

    const resultados = await mapPool(lista, concurrency, async (tel) => {
      const telefoneNormalizado = normalizarTelefone(tel);

      if (!telefoneNormalizado || telefoneNormalizado.length < 12) {
        return {
          sucesso: false,
          telefone: String(tel || ''),
          tem_whatsapp: false,
          nome: null,
          foto_perfil: null,
          instancia_usada: null,
          erro: 'Número de telefone inválido. Use o formato: 5511999999999',
        };
      }

      try {
        return await verificarUmNumero({
          tenantId: auth.tenantId,
          usuario: auth.usuario,
          telefoneNormalizado,
          buscarFoto,
          baseUrl,
          uazService,
        });
      } catch (err) {
        return {
          sucesso: false,
          telefone: telefoneNormalizado,
          tem_whatsapp: false,
          nome: null,
          foto_perfil: null,
          instancia_usada: null,
          erro: err.message || 'Erro ao verificar',
        };
      }
    });

    const comWhatsapp = resultados.filter((r) => r.tem_whatsapp).length;
    const semWhatsapp = resultados.filter((r) => r.sucesso && !r.tem_whatsapp).length;
    const comErro = resultados.filter((r) => !r.sucesso).length;

    return res.json({
      sucesso: true,
      total: resultados.length,
      com_whatsapp: comWhatsapp,
      sem_whatsapp: semWhatsapp,
      com_erro: comErro,
      instancias_disponiveis: concurrency,
      cooldown_segundos: COOLDOWN_MS / 1000,
      buscar_foto: buscarFoto,
      tempo_total_ms: Date.now() - inicio,
      resultados,
    });
  } catch (error) {
    console.error('❌ [API Pública] Erro no lote WhatsApp:', error);
    const status = error.status || 500;
    return res.status(status).json({
      sucesso: false,
      mensagem: error.message || 'Erro interno ao verificar WhatsApp em lote',
    });
  }
});

module.exports = router;
