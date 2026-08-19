/**
 * API Pública - Verificação de WhatsApp (1 número)
 * Permite que sistemas externos verifiquem se um telefone tem WhatsApp
 * e obtenham a foto de perfil (quando disponível).
 * Autenticação: email + senha no body (mesmo padrão da Lista de Restrição).
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

async function buscarInstanciaConectada(tenantId) {
  let result = await pool.query(
    `SELECT ui.id, ui.instance_token, ui.name, p.host, p.port, p.username, p.password
     FROM uaz_instances ui
     LEFT JOIN proxies p ON ui.proxy_id = p.id
     WHERE ui.tenant_id = $1 AND ui.is_active = true AND ui.status = 'connected'
     ORDER BY ui.id
     LIMIT 1`,
    [tenantId]
  );

  if (result.rows.length === 0) {
    result = await pool.query(
      `SELECT ui.id, ui.instance_token, ui.name, p.host, p.port, p.username, p.password
       FROM uaz_instances ui
       LEFT JOIN proxies p ON ui.proxy_id = p.id
       WHERE ui.tenant_id = $1 AND ui.is_connected = true
       ORDER BY ui.id
       LIMIT 1`,
      [tenantId]
    );
  }

  return result.rows[0] || null;
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
 *   telefone     (obrigatório) - ex: 5511999999999 ou 11999999999
 *   buscar_foto  (opcional)    - default true
 */
router.post('/verificar', async (req, res) => {
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

    const instancia = await buscarInstanciaConectada(tenantId);
    if (!instancia || !instancia.instance_token) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Nenhuma instância WhatsApp conectada neste tenant. Conecte um QR Code no disparador.',
      });
    }

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

    console.log(`📱 [API Pública] Verificando WhatsApp: ${telefoneNormalizado} (tenant ${tenantId}, instância ${instancia.name})`);

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
      verificado_em: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ [API Pública] Erro na verificação WhatsApp:', error);
    return res.status(500).json({
      sucesso: false,
      mensagem: error.message || 'Erro interno ao verificar WhatsApp',
    });
  }
});

module.exports = router;
