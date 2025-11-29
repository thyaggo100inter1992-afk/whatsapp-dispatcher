const { query } = require('../database/connection');

/**
 * Tipos de eventos que podem ser registrados
 */
const UazLogEvent = {
  CREATED: 'created',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  DELETED: 'deleted',
  UPDATED: 'updated',
  STATUS_CHECK: 'status_check',
  QR_CODE_GENERATED: 'qr_code_generated',
  ERROR: 'error'
};

/**
 * Registra um evento no log de instâncias UAZ
 */
async function logUazInstanceEvent(params) {
  try {
    const {
      instanceId,
      instanceName,
      sessionName,
      eventType,
      eventDescription,
      oldValue = null,
      newValue = null,
      metadata = {}
    } = params;

    await query(`
      INSERT INTO uaz_instance_logs (
        instance_id,
        instance_name,
        session_name,
        event_type,
        event_description,
        old_value,
        new_value,
        metadata,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [
      instanceId,
      instanceName || null,
      sessionName || null,
      eventType,
      eventDescription,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      JSON.stringify(metadata)
    ]);

    console.log(`📝 Log registrado: [${eventType}] ${eventDescription}`);
  } catch (error) {
    console.error('❌ Erro ao registrar log:', error.message);
    // Não lança erro para não interromper o fluxo principal
  }
}

/**
 * Busca histórico completo de uma instância
 */
async function getInstanceHistory(instanceId) {
  try {
    const result = await query(`
      SELECT 
        id,
        instance_id,
        instance_name,
        session_name,
        event_type,
        event_description,
        old_value,
        new_value,
        metadata,
        created_at
      FROM uaz_instance_logs
      WHERE instance_id = $1
      ORDER BY created_at DESC
    `, [instanceId]);

    return result.rows;
  } catch (error) {
    console.error('❌ Erro ao buscar histórico:', error.message);
    return [];
  }
}

/**
 * Busca todos os logs (com limite)
 */
async function getAllLogs(limit = 100) {
  try {
    const result = await query(`
      SELECT 
        l.id,
        l.instance_id,
        l.instance_name,
        l.session_name,
        l.event_type,
        l.event_description,
        l.old_value,
        l.new_value,
        l.metadata,
        l.created_at,
        i.name as current_instance_name,
        i.is_connected as current_is_connected
      FROM uaz_instance_logs l
      LEFT JOIN uaz_instances i ON l.instance_id = i.id
      ORDER BY l.created_at DESC
      LIMIT $1
    `, [limit]);

    return result.rows;
  } catch (error) {
    console.error('❌ Erro ao buscar logs:', error.message);
    return [];
  }
}

/**
 * Helper para criar o log de criação de instância
 */
async function logInstanceCreated(instanceId, instanceData) {
  await logUazInstanceEvent({
    instanceId,
    instanceName: instanceData.name,
    sessionName: instanceData.session_name,
    eventType: UazLogEvent.CREATED,
    eventDescription: `Instância "${instanceData.name}" criada no sistema`,
    newValue: {
      name: instanceData.name,
      session_name: instanceData.session_name,
      is_active: instanceData.is_active,
      proxy_id: instanceData.proxy_id
    }
  });
}

/**
 * Helper para criar o log de conexão
 */
async function logInstanceConnected(instanceId, instanceName, phoneNumber = null) {
  await logUazInstanceEvent({
    instanceId,
    instanceName,
    eventType: UazLogEvent.CONNECTED,
    eventDescription: `Instância "${instanceName}" conectada ao WhatsApp${phoneNumber ? ` (${phoneNumber})` : ''}`,
    newValue: {
      is_connected: true,
      phone_number: phoneNumber,
      connected_at: new Date().toISOString()
    }
  });
}

/**
 * Helper para criar o log de desconexão
 */
async function logInstanceDisconnected(instanceId, instanceName, reason = null) {
  await logUazInstanceEvent({
    instanceId,
    instanceName,
    eventType: UazLogEvent.DISCONNECTED,
    eventDescription: `Instância "${instanceName}" desconectada${reason ? `: ${reason}` : ''}`,
    newValue: {
      is_connected: false,
      disconnected_at: new Date().toISOString(),
      reason: reason || 'manual'
    }
  });
}

/**
 * Helper para criar o log de exclusão
 */
async function logInstanceDeleted(instanceId, instanceName, deletedFromAPI) {
  await logUazInstanceEvent({
    instanceId,
    instanceName,
    eventType: UazLogEvent.DELETED,
    eventDescription: `Instância "${instanceName}" excluída do sistema${deletedFromAPI ? ' e da API UAZ' : ' (apenas localmente)'}`,
    metadata: {
      deleted_from_api: deletedFromAPI,
      deleted_at: new Date().toISOString()
    }
  });
}

/**
 * Helper para criar o log de atualização
 */
async function logInstanceUpdated(instanceId, instanceName, oldData, newData, updatedFields) {
  await logUazInstanceEvent({
    instanceId,
    instanceName,
    eventType: UazLogEvent.UPDATED,
    eventDescription: `Instância "${instanceName}" atualizada: ${updatedFields.join(', ')}`,
    oldValue: oldData,
    newValue: newData,
    metadata: {
      updated_fields: updatedFields
    }
  });
}

/**
 * Helper para criar o log de verificação de status
 */
async function logStatusCheck(instanceId, instanceName, status) {
  await logUazInstanceEvent({
    instanceId,
    instanceName,
    eventType: UazLogEvent.STATUS_CHECK,
    eventDescription: `Status verificado: ${status.is_connected ? 'Conectado' : 'Desconectado'}`,
    newValue: {
      is_connected: status.is_connected,
      status: status.status,
      phone_number: status.phone_number
    }
  });
}

/**
 * Helper para criar o log de QR Code gerado
 */
async function logQRCodeGenerated(instanceId, instanceName) {
  await logUazInstanceEvent({
    instanceId,
    instanceName,
    eventType: UazLogEvent.QR_CODE_GENERATED,
    eventDescription: `QR Code gerado para "${instanceName}"`,
    metadata: {
      generated_at: new Date().toISOString()
    }
  });
}

/**
 * Helper para criar o log de erro
 */
async function logInstanceError(instanceId, instanceName, error) {
  await logUazInstanceEvent({
    instanceId,
    instanceName,
    eventType: UazLogEvent.ERROR,
    eventDescription: `Erro na instância "${instanceName}": ${error}`,
    metadata: {
      error,
      error_at: new Date().toISOString()
    }
  });
}

module.exports = {
  UazLogEvent,
  logUazInstanceEvent,
  getInstanceHistory,
  getAllLogs,
  logInstanceCreated,
  logInstanceConnected,
  logInstanceDisconnected,
  logInstanceDeleted,
  logInstanceUpdated,
  logStatusCheck,
  logQRCodeGenerated,
  logInstanceError
};










