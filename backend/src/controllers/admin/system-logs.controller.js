const loggerService = require('../../services/logger.service');

/**
 * Controller para Logs do Sistema (Backend)
 */

/**
 * GET /api/admin/system-logs/backend - Obter logs do backend
 */
const getBackendLogs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 1000; // Aumentado para 1000
    const logs = loggerService.getLogs(limit);
    
    res.json({
      success: true,
      data: {
        logs,
        total: logs.length
      }
    });
  } catch (error) {
    console.error('❌ Erro ao buscar logs do backend:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar logs do backend',
      error: error.message
    });
  }
};

/**
 * DELETE /api/admin/system-logs/backend - Limpar logs do backend
 */
const clearBackendLogs = async (req, res) => {
  try {
    loggerService.clearLogs();
    
    res.json({
      success: true,
      message: 'Logs do backend limpos com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao limpar logs do backend:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao limpar logs do backend',
      error: error.message
    });
  }
};

module.exports = {
  getBackendLogs,
  clearBackendLogs
};

