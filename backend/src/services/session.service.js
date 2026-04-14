/**
 * Serviço de Gerenciamento de Sessões
 * Controla sessões ativas dos usuários e previne logins simultâneos
 *
 * OTIMIZAÇÕES DE PERFORMANCE:
 * - Cache in-memory para isSessionValid (TTL 60s) — evita query por request
 * - Throttle para updateLastActivity (máx 1x por minuto por sessão)
 * - Throttle para updateTenantLastAccess (máx 1x por minuto por tenant)
 */

const crypto = require('crypto');
const { pool } = require('../database/connection');

// Cache de validação de sessão: token_hash -> { valid, ts }
const _sessionValidCache = new Map();
const SESSION_VALID_TTL = 60 * 1000; // 60 segundos

// Throttle de updateLastActivity: token_hash -> timestamp último update
const _lastActivityThrottle = new Map();
const LAST_ACTIVITY_THROTTLE = 60 * 1000; // máximo 1 update/min por sessão

class SessionService {
  /**
   * Gera um hash único para o token de sessão
   * @param {string} token - JWT token
   * @returns {string} Hash do token
   */
  generateSessionToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Cria uma nova sessão e invalida todas as sessões anteriores do usuário
   * @param {number} userId - ID do usuário
   * @param {number} tenantId - ID do tenant
   * @param {string} accessToken - JWT token de acesso
   * @param {object} req - Request object (para extrair IP, user-agent, etc)
   * @returns {Promise<object>} Sessão criada
   */
  async createSession(userId, tenantId, accessToken, req = {}) {
    try {
      const sessionToken = this.generateSessionToken(accessToken);
      const ipAddress = req.ip || req.headers?.['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
      const userAgent = req.headers?.['user-agent'] || 'unknown';
      
      // Extrair informações do dispositivo
      const deviceInfo = {
        browser: this.extractBrowser(userAgent),
        os: this.extractOS(userAgent),
        device: this.extractDevice(userAgent)
      };

      // 1. INVALIDAR TODAS AS SESSÕES ANTERIORES DO USUÁRIO
      await pool.query(
        `UPDATE user_sessions 
         SET is_active = false 
         WHERE user_id = $1 AND is_active = true`,
        [userId]
      );

      console.log(`🔐 Sessões anteriores do usuário ${userId} foram invalidadas`);

      // 2. CRIAR NOVA SESSÃO
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias (mesmo tempo do JWT)
      
      const result = await pool.query(
        `INSERT INTO user_sessions 
         (user_id, tenant_id, session_token, device_info, ip_address, user_agent, expires_at, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         RETURNING *`,
        [userId, tenantId, sessionToken, JSON.stringify(deviceInfo), ipAddress, userAgent, expiresAt]
      );

      console.log(`✅ Nova sessão criada para usuário ${userId} (Token: ${sessionToken.substring(0, 10)}...)`);

      return result.rows[0];
    } catch (error) {
      console.error('❌ Erro ao criar sessão:', error);
      throw error;
    }
  }

  /**
   * Verifica se uma sessão é válida
   * Com cache in-memory de 60s: evita query ao banco em cada requisição HTTP.
   * @param {string} accessToken - JWT token de acesso
   * @param {number} userId - ID do usuário
   * @returns {Promise<boolean>} true se sessão é válida, false caso contrário
   */
  async isSessionValid(accessToken, userId) {
    try {
      const sessionToken = this.generateSessionToken(accessToken);
      const cacheKey = `${sessionToken}:${userId}`;
      const now = Date.now();

      // Verificar cache antes de ir ao banco
      const cached = _sessionValidCache.get(cacheKey);
      if (cached && (now - cached.ts) < SESSION_VALID_TTL) {
        return cached.valid;
      }

      const result = await pool.query(
        `SELECT id FROM user_sessions 
         WHERE session_token = $1 
         AND user_id = $2 
         AND is_active = true 
         AND expires_at > NOW()`,
        [sessionToken, userId]
      );

      const isValid = result.rows.length > 0;

      if (!isValid) {
        console.log(`⚠️  Sessão inválida ou expirada para usuário ${userId}`);
        // Não cachear resultado inválido — força nova verificação
        _sessionValidCache.delete(cacheKey);
      } else {
        _sessionValidCache.set(cacheKey, { valid: true, ts: now });
      }

      return isValid;
    } catch (error) {
      console.error('❌ Erro ao verificar sessão:', error);
      return false;
    }
  }

  /**
   * Invalida uma sessão específica
   * @param {string} accessToken - JWT token de acesso
   * @returns {Promise<boolean>} true se invalidou com sucesso
   */
  async invalidateSession(accessToken) {
    try {
      const sessionToken = this.generateSessionToken(accessToken);

      const result = await pool.query(
        `UPDATE user_sessions 
         SET is_active = false 
         WHERE session_token = $1`,
        [sessionToken]
      );

      // Limpar cache ao invalidar sessão
      for (const key of _sessionValidCache.keys()) {
        if (key.startsWith(sessionToken)) _sessionValidCache.delete(key);
      }

      console.log(`🚪 Sessão invalidada (Token: ${sessionToken.substring(0, 10)}...)`);

      return result.rowCount > 0;
    } catch (error) {
      console.error('❌ Erro ao invalidar sessão:', error);
      return false;
    }
  }

  /**
   * Invalida todas as sessões de um usuário
   * @param {number} userId - ID do usuário
   * @returns {Promise<number>} Quantidade de sessões invalidadas
   */
  async invalidateAllUserSessions(userId) {
    try {
      const result = await pool.query(
        `UPDATE user_sessions 
         SET is_active = false 
         WHERE user_id = $1 AND is_active = true`,
        [userId]
      );

      console.log(`🚪 ${result.rowCount} sessões invalidadas para usuário ${userId}`);

      return result.rowCount;
    } catch (error) {
      console.error('❌ Erro ao invalidar sessões:', error);
      return 0;
    }
  }

  /**
   * Atualiza a última atividade da sessão
   * Com throttle: executa no máximo 1x por minuto por sessão para não sobrecarregar o banco.
   * @param {string} accessToken - JWT token de acesso
   * @returns {Promise<boolean>}
   */
  async updateLastActivity(accessToken) {
    try {
      const sessionToken = this.generateSessionToken(accessToken);
      const now = Date.now();

      const lastUpdate = _lastActivityThrottle.get(sessionToken);
      if (lastUpdate && (now - lastUpdate) < LAST_ACTIVITY_THROTTLE) {
        return true; // Throttle: pular update
      }

      _lastActivityThrottle.set(sessionToken, now);

      // Fire-and-forget: não bloquear a requisição HTTP
      pool.query(
        `UPDATE user_sessions 
         SET last_activity = NOW() 
         WHERE session_token = $1 AND is_active = true`,
        [sessionToken]
      ).catch((err) => console.error('❌ Erro ao atualizar última atividade:', err));

      return true;
    } catch (error) {
      console.error('❌ Erro ao atualizar última atividade:', error);
      return false;
    }
  }

  /**
   * Lista todas as sessões ativas de um usuário
   * @param {number} userId - ID do usuário
   * @returns {Promise<Array>} Lista de sessões
   */
  async getUserSessions(userId) {
    try {
      const result = await pool.query(
        `SELECT 
          id, 
          device_info, 
          ip_address, 
          created_at, 
          last_activity, 
          expires_at, 
          is_active
         FROM user_sessions 
         WHERE user_id = $1 
         ORDER BY created_at DESC`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      console.error('❌ Erro ao listar sessões:', error);
      return [];
    }
  }

  /**
   * Limpa sessões expiradas
   * @returns {Promise<number>} Quantidade de sessões limpas
   */
  async cleanupExpiredSessions() {
    try {
      const result = await pool.query(
        `UPDATE user_sessions 
         SET is_active = false 
         WHERE expires_at < NOW() AND is_active = true`
      );

      if (result.rowCount > 0) {
        console.log(`🧹 ${result.rowCount} sessões expiradas foram limpas`);
      }

      return result.rowCount;
    } catch (error) {
      console.error('❌ Erro ao limpar sessões expiradas:', error);
      return 0;
    }
  }

  /**
   * Extrai o navegador do user-agent
   * @private
   */
  extractBrowser(userAgent) {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    return 'Unknown';
  }

  /**
   * Extrai o sistema operacional do user-agent
   * @private
   */
  extractOS(userAgent) {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'MacOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    return 'Unknown';
  }

  /**
   * Extrai o tipo de dispositivo do user-agent
   * @private
   */
  extractDevice(userAgent) {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Mobile')) return 'Mobile';
    if (userAgent.includes('Tablet')) return 'Tablet';
    return 'Desktop';
  }
}

// Exportar instância única (singleton)
module.exports = new SessionService();

