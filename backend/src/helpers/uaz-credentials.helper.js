const { query } = require('../database/connection');

/**
 * Busca as credenciais UAZAP do tenant
 * Ordem de prioridade:
 * 1. Credencial específica do tenant
 * 2. Credencial padrão do sistema
 * 3. Fallback para variáveis de ambiente
 * 
 * @param {number} tenantId - ID do tenant
 * @returns {Promise<{serverUrl: string, adminToken: string, credentialName: string}>}
 */
async function getTenantUazapCredentials(tenantId) {
  try {
    console.log(`🔍 Buscando credenciais UAZAP para tenant ${tenantId}...`);

    // Buscar credencial do tenant
    const result = await query(`
      SELECT 
        uc.id,
        uc.name,
        uc.server_url,
        uc.admin_token,
        uc.is_default,
        t.nome as tenant_nome
      FROM tenants t
      LEFT JOIN uazap_credentials uc ON t.uazap_credential_id = uc.id
      WHERE t.id = $1 AND uc.is_active = true
    `, [tenantId]);

    // Se o tenant tem credencial específica, usar ela
    if (result.rows.length > 0 && result.rows[0].server_url) {
      const cred = result.rows[0];
      console.log(`✅ Usando credencial específica do tenant: "${cred.name}"`);
      console.log(`   URL: ${cred.server_url}`);
      return {
        serverUrl: cred.server_url,
        adminToken: cred.admin_token,
        credentialId: cred.id,
        credentialName: cred.name
      };
    }

    // Se não tem credencial específica, buscar a padrão
    console.log('⚠️ Tenant sem credencial específica, buscando padrão...');
    
    const defaultResult = await query(`
      SELECT id, name, server_url, admin_token
      FROM uazap_credentials
      WHERE is_default = true AND is_active = true
      LIMIT 1
    `);

    if (defaultResult.rows.length > 0) {
      const cred = defaultResult.rows[0];
      console.log(`✅ Usando credencial PADRÃO do sistema: "${cred.name}"`);
      console.log(`   URL: ${cred.server_url}`);
      return {
        serverUrl: cred.server_url,
        adminToken: cred.admin_token,
        credentialId: cred.id,
        credentialName: cred.name
      };
    }

    // Fallback para variáveis de ambiente
    console.log('⚠️ Nenhuma credencial encontrada, usando variáveis de ambiente...');
    return {
      serverUrl: process.env.UAZ_SERVER_URL || 'https://nettsistemas.uazapi.com',
      adminToken: process.env.UAZ_ADMIN_TOKEN || '',
      credentialId: null,
      credentialName: 'Variáveis de Ambiente'
    };

  } catch (error) {
    console.error('❌ Erro ao buscar credenciais UAZAP:', error);
    // Fallback em caso de erro
    return {
      serverUrl: process.env.UAZ_SERVER_URL || 'https://nettsistemas.uazapi.com',
      adminToken: process.env.UAZ_ADMIN_TOKEN || '',
      credentialId: null,
      credentialName: 'Fallback (Erro)'
    };
  }
}

/**
 * Busca credencial UAZAP padrão do sistema
 * @returns {Promise<{serverUrl: string, adminToken: string, credentialName: string}>}
 */
async function getDefaultUazapCredentials() {
  try {
    console.log('🔍 Buscando credencial UAZAP padrão do sistema...');

    const result = await query(`
      SELECT id, name, server_url, admin_token
      FROM uazap_credentials
      WHERE is_default = true AND is_active = true
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      const cred = result.rows[0];
      console.log(`✅ Credencial padrão encontrada: "${cred.name}"`);
      return {
        serverUrl: cred.server_url,
        adminToken: cred.admin_token,
        credentialId: cred.id,
        credentialName: cred.name
      };
    }

    // Fallback
    console.log('⚠️ Nenhuma credencial padrão encontrada, usando variáveis de ambiente');
    return {
      serverUrl: process.env.UAZ_SERVER_URL || 'https://nettsistemas.uazapi.com',
      adminToken: process.env.UAZ_ADMIN_TOKEN || '',
      credentialId: null,
      credentialName: 'Variáveis de Ambiente'
    };

  } catch (error) {
    console.error('❌ Erro ao buscar credencial padrão:', error);
    return {
      serverUrl: process.env.UAZ_SERVER_URL || 'https://nettsistemas.uazapi.com',
      adminToken: process.env.UAZ_ADMIN_TOKEN || '',
      credentialId: null,
      credentialName: 'Fallback (Erro)'
    };
  }
}

module.exports = {
  getTenantUazapCredentials,
  getDefaultUazapCredentials
};






