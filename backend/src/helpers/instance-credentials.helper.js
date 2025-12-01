const { pool } = require('../database/connection');
const { query } = require('../database/connection');
const { queryWithTenantId } = require('../database/tenant-query');
const UazService = require('../services/uazService');
const { getTenantUazapCredentials } = require('./uaz-credentials.helper');

/**
 * Busca uma instância UAZ com suas credenciais corretas
 * 
 * PRIORIDADE DE CREDENCIAIS:
 * 1. Credencial específica da instância (campo credential_id)
 * 2. Credencial do tenant (fallback)
 * 3. Credencial padrão do sistema (último recurso)
 * 
 * @param {number} instanceId - ID da instância
 * @param {number} tenantId - ID do tenant
 * @returns {Promise<{instance, credentials, uazService, proxyConfig}>}
 */
async function getInstanceWithCredentials(instanceId, tenantId) {
  console.log(`\n🔍 ============ BUSCAR INSTÂNCIA COM CREDENCIAIS ============`);
  console.log(`📋 Instância ID: ${instanceId}`);
  console.log(`👤 Tenant ID: ${tenantId}`);

  // Buscar instância com todas as informações (incluindo credential_id) - usando queryWithTenantId para respeitar RLS
  const instanceResult = await queryWithTenantId(tenantId, `
    SELECT 
      ui.*,
      p.host as proxy_host,
      p.port as proxy_port,
      p.username as proxy_username,
      p.password as proxy_password,
      uc.id as credential_id,
      uc.name as credential_name,
      uc.server_url as credential_url,
      uc.admin_token as credential_token
    FROM uaz_instances ui
    LEFT JOIN proxies p ON ui.proxy_id = p.id
    LEFT JOIN uazap_credentials uc ON ui.credential_id = uc.id
    WHERE ui.id = $1 AND ui.tenant_id = $2
  `, [instanceId, tenantId]);

  if (instanceResult.rows.length === 0) {
    throw new Error('Instância não encontrada');
  }

  const instance = instanceResult.rows[0];
  
  // Configurar proxy se existir
  const proxyConfig = instance.proxy_host ? {
    host: instance.proxy_host,
    port: instance.proxy_port,
    username: instance.proxy_username,
    password: instance.proxy_password
  } : null;

  // PRIORIDADE 1: Usar credencial específica da instância
  if (instance.credential_id && instance.credential_url && instance.credential_token) {
    console.log(`✅ Usando credencial DA INSTÂNCIA:`);
    console.log(`   ID: ${instance.credential_id}`);
    console.log(`   Nome: ${instance.credential_name}`);
    console.log(`   URL: ${instance.credential_url}`);
    
    const credentials = {
      serverUrl: instance.credential_url,
      adminToken: instance.credential_token,
      credentialId: instance.credential_id,
      credentialName: instance.credential_name
    };
    
    const uazService = new UazService(credentials.serverUrl, credentials.adminToken);
    
    console.log(`🎯 Credencial correta encontrada! (DA INSTÂNCIA)`);
    console.log(`============================================================\n`);
    
    return {
      instance,
      credentials,
      uazService,
      proxyConfig
    };
  }

  // PRIORIDADE 2: Usar credencial do tenant (fallback)
  console.log(`⚠️  Instância SEM credential_id específico`);
  console.log(`🔄 Usando credencial do TENANT como fallback...`);
  
  const credentials = await getTenantUazapCredentials(tenantId);
  const uazService = new UazService(credentials.serverUrl, credentials.adminToken);
  
  console.log(`⚠️  ATENÇÃO: Esta instância deveria ter credential_id!`);
  console.log(`   Recomendação: Recriar a instância para vinculá-la à credencial correta`);
  console.log(`============================================================\n`);
  
  return {
    instance,
    credentials,
    uazService,
    proxyConfig
  };
}

/**
 * Atualiza o credential_id de uma instância
 * Útil para corrigir instâncias antigas
 */
async function updateInstanceCredential(instanceId, credentialId, tenantId) {
  console.log(`🔄 Atualizando credential_id da instância ${instanceId} para ${credentialId}...`);
  
  // ✅ Usando queryWithTenantId para respeitar RLS
  await queryWithTenantId(tenantId, `
    UPDATE uaz_instances
    SET credential_id = $1,
        updated_at = NOW()
    WHERE id = $2 AND tenant_id = $3
  `, [credentialId, instanceId, tenantId]);
  
  console.log(`✅ Credential_id atualizado!`);
}

/**
 * Busca todas as instâncias de um tenant que estão sem credential_id
 */
async function findInstancesWithoutCredential(tenantId) {
  // ✅ Usando queryWithTenantId para respeitar RLS
  const result = await queryWithTenantId(tenantId, `
    SELECT 
      id,
      name,
      session_name,
      is_connected,
      created_at
    FROM uaz_instances
    WHERE tenant_id = $1 
      AND credential_id IS NULL
    ORDER BY created_at DESC
  `, [tenantId]);
  
  return result.rows;
}

/**
 * Corrige automaticamente instâncias sem credential_id
 * Atribui a credencial atual do tenant
 */
async function fixInstancesCredentials(tenantId) {
  console.log(`\n🔧 ========== CORRIGINDO CREDENCIAIS DE INSTÂNCIAS ==========`);
  console.log(`👤 Tenant ID: ${tenantId}`);
  
  // Buscar credencial atual do tenant
  const credentials = await getTenantUazapCredentials(tenantId);
  
  if (!credentials.credentialId) {
    console.log(`❌ Tenant não tem credencial específica! Usando padrão.`);
    // Buscar credencial padrão (credenciais não têm RLS, pode usar query diretamente)
    const defaultCred = await query(`
      SELECT id FROM uazap_credentials 
      WHERE is_default = true AND is_active = true 
      LIMIT 1
    `);
    
    if (defaultCred.rows.length === 0) {
      throw new Error('Nenhuma credencial padrão encontrada!');
    }
    
    credentials.credentialId = defaultCred.rows[0].id;
  }
  
  console.log(`🔑 Credencial a ser usada: ${credentials.credentialName} (ID: ${credentials.credentialId})`);
  
  // Buscar instâncias sem credential_id
  const instances = await findInstancesWithoutCredential(tenantId);
  
  console.log(`📊 Instâncias sem credential_id: ${instances.length}`);
  
  if (instances.length === 0) {
    console.log(`✅ Todas as instâncias já têm credential_id!`);
    console.log(`============================================================\n`);
    return 0;
  }
  
  // Atualizar todas - usando queryWithTenantId para respeitar RLS
  const updateResult = await queryWithTenantId(tenantId, `
    UPDATE uaz_instances
    SET credential_id = $1,
        updated_at = NOW()
    WHERE tenant_id = $2 
      AND credential_id IS NULL
  `, [credentials.credentialId, tenantId]);
  
  console.log(`✅ ${updateResult.rowCount} instâncias corrigidas!`);
  console.log(`============================================================\n`);
  
  return updateResult.rowCount;
}

module.exports = {
  getInstanceWithCredentials,
  updateInstanceCredential,
  findInstancesWithoutCredential,
  fixInstancesCredentials
};
