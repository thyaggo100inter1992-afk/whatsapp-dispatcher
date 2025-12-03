/**
 * Controller para Sistema de Comunicação
 * Gerencia emails em massa e notificações pop-up para tenants
 */

const { query } = require('../../config/database');
const { pool } = require('../../database/connection');
const emailAccountService = require('../../services/email-account.service').default;
const emailCampaignWorker = require('../../workers/email-campaign.worker');

// ============================================
// CAMPANHAS DE EMAIL
// ============================================

/**
 * Listar todas as campanhas de email
 */
const getAllCampaigns = async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT 
        id, name, subject, recipient_type, 
        total_recipients, sent_count, failed_count,
        status, created_at, started_at, completed_at
      FROM admin_email_campaigns
    `;

    const params = [];
    
    if (status) {
      sql += ` WHERE status = $1`;
      params.push(status);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    res.json({
      success: true,
      campaigns: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('❌ Erro ao listar campanhas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar campanhas',
      error: error.message
    });
  }
};

/**
 * Buscar campanha por ID
 */
const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await query(
      'SELECT * FROM admin_email_campaigns WHERE id = $1',
      [id]
    );

    if (campaign.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Campanha não encontrada'
      });
    }

    // Buscar destinatários
    const recipients = await query(
      `SELECT email, status, sent_at, error_message 
       FROM admin_email_campaign_recipients 
       WHERE campaign_id = $1
       ORDER BY id`,
      [id]
    );

    res.json({
      success: true,
      campaign: campaign.rows[0],
      recipients: recipients.rows
    });
  } catch (error) {
    console.error('❌ Erro ao buscar campanha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar campanha',
      error: error.message
    });
  }
};

/**
 * Criar nova campanha de email (rascunho)
 */
const createCampaign = async (req, res) => {
  try {
    const {
      name,
      subject,
      content,
      recipient_type,
      recipient_list,
      email_accounts,
      delay_seconds
    } = req.body;

    // Validações
    if (!name || !subject || !content || !recipient_type) {
      return res.status(400).json({
        success: false,
        message: 'Nome, assunto, conteúdo e tipo de destinatário são obrigatórios'
      });
    }

    // Criar campanha
    const result = await query(
      `INSERT INTO admin_email_campaigns (
        name, subject, content, recipient_type, recipient_list,
        email_accounts, delay_seconds, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
      RETURNING *`,
      [
        name,
        subject,
        content,
        recipient_type,
        JSON.stringify(recipient_list || []),
        JSON.stringify(email_accounts || []),
        delay_seconds || 5
      ]
    );

    console.log('✅ Campanha criada:', result.rows[0].id);

    res.status(201).json({
      success: true,
      message: 'Campanha criada com sucesso',
      campaign: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao criar campanha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar campanha',
      error: error.message
    });
  }
};

/**
 * Gerar lista de destinatários (preview)
 */
const previewRecipients = async (req, res) => {
  try {
    const { recipient_type, recipient_list } = req.body;

    let emails = [];

    switch (recipient_type) {
      case 'all':
        const allTenants = await query('SELECT email FROM tenants WHERE email IS NOT NULL');
        emails = allTenants.rows.map(t => t.email);
        break;

      case 'active':
        const activeTenants = await query(
          "SELECT email FROM tenants WHERE status = 'active' AND email IS NOT NULL"
        );
        emails = activeTenants.rows.map(t => t.email);
        break;

      case 'blocked':
        const blockedTenants = await query(
          "SELECT email FROM tenants WHERE blocked_at IS NOT NULL AND email IS NOT NULL"
        );
        emails = blockedTenants.rows.map(t => t.email);
        break;

      case 'trial':
        const trialTenants = await query(
          "SELECT email FROM tenants WHERE status = 'trial' AND email IS NOT NULL"
        );
        emails = trialTenants.rows.map(t => t.email);
        break;

      case 'specific':
        if (recipient_list && recipient_list.tenant_ids) {
          const specificTenants = await query(
            'SELECT email FROM tenants WHERE id = ANY($1) AND email IS NOT NULL',
            [recipient_list.tenant_ids]
          );
          emails = specificTenants.rows.map(t => t.email);
        }
        break;

      case 'manual':
        if (recipient_list && recipient_list.emails) {
          emails = recipient_list.emails;
        }
        break;

      case 'file':
        if (recipient_list && recipient_list.emails) {
          emails = recipient_list.emails;
        }
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Tipo de destinatário inválido'
        });
    }

    // Remover duplicatas e emails inválidos
    emails = [...new Set(emails.filter(e => e && e.includes('@')))];

    res.json({
      success: true,
      total: emails.length,
      emails: emails
    });
  } catch (error) {
    console.error('❌ Erro ao gerar preview:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao gerar preview',
      error: error.message
    });
  }
};

/**
 * Iniciar envio de campanha
 */
const startCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar campanha
    const campaign = await query(
      'SELECT * FROM admin_email_campaigns WHERE id = $1',
      [id]
    );

    if (campaign.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Campanha não encontrada'
      });
    }

    const campaignData = campaign.rows[0];

    if (campaignData.status !== 'draft' && campaignData.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Campanha já foi iniciada ou concluída'
      });
    }

    console.log(`✅ Iniciando campanha ${id}...`);

    // Iniciar worker de envio (assíncrono)
    emailCampaignWorker.startCampaign(id).catch(err => {
      console.error('❌ Erro no worker de campanha:', err);
    });

    res.json({
      success: true,
      message: 'Campanha iniciada! O envio está sendo processado em segundo plano.'
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar campanha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao iniciar campanha',
      error: error.message
    });
  }
};

/**
 * Deletar campanha
 */
const deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    await query('DELETE FROM admin_email_campaigns WHERE id = $1', [id]);

    console.log('✅ Campanha deletada:', id);

    res.json({
      success: true,
      message: 'Campanha deletada com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao deletar campanha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar campanha',
      error: error.message
    });
  }
};

// ============================================
// NOTIFICAÇÕES POP-UP
// ============================================

/**
 * Listar todas as notificações
 */
const getAllNotifications = async (req, res) => {
  try {
    const { is_active } = req.query;

    let sql = `
      SELECT 
        id, title, message, type, link_url, link_text,
        recipient_type, is_active, created_at, updated_at
      FROM admin_notifications
      WHERE deleted_at IS NULL
    `;

    const params = [];

    if (is_active !== undefined) {
      sql += ` AND is_active = $1`;
      params.push(is_active === 'true');
    }

    sql += ` ORDER BY created_at DESC`;

    const result = await query(sql, params);

    // Buscar estatísticas de leitura para cada notificação
    for (const notification of result.rows) {
      const stats = await query(
        `SELECT 
          COUNT(*) as total_views,
          COUNT(*) FILTER (WHERE clicked = true) as total_clicks
         FROM admin_notification_reads
         WHERE notification_id = $1`,
        [notification.id]
      );
      notification.stats = stats.rows[0];
    }

    res.json({
      success: true,
      notifications: result.rows
    });
  } catch (error) {
    console.error('❌ Erro ao listar notificações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar notificações',
      error: error.message
    });
  }
};

/**
 * Buscar notificação por ID
 */
const getNotificationById = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await query(
      'SELECT * FROM admin_notifications WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (notification.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notificação não encontrada'
      });
    }

    // Buscar quem visualizou
    const reads = await query(
      `SELECT 
        r.tenant_id, t.nome as tenant_name, t.email,
        r.viewed_at, r.clicked, r.clicked_at, r.closed_at
       FROM admin_notification_reads r
       JOIN tenants t ON r.tenant_id = t.id
       WHERE r.notification_id = $1
       ORDER BY r.viewed_at DESC`,
      [id]
    );

    res.json({
      success: true,
      notification: notification.rows[0],
      reads: reads.rows
    });
  } catch (error) {
    console.error('❌ Erro ao buscar notificação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar notificação',
      error: error.message
    });
  }
};

/**
 * Criar nova notificação
 */
const createNotification = async (req, res) => {
  try {
    const {
      title,
      message,
      type,
      link_url,
      link_text,
      recipient_type,
      recipient_list
    } = req.body;

    // Validações
    if (!title || !message || !recipient_type) {
      return res.status(400).json({
        success: false,
        message: 'Título, mensagem e tipo de destinatário são obrigatórios'
      });
    }

    const result = await query(
      `INSERT INTO admin_notifications (
        title, message, type, link_url, link_text,
        recipient_type, recipient_list, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      RETURNING *`,
      [
        title,
        message,
        type || 'info',
        link_url,
        link_text,
        recipient_type,
        JSON.stringify(recipient_list || [])
      ]
    );

    console.log('✅ Notificação criada:', result.rows[0].id);

    res.status(201).json({
      success: true,
      message: 'Notificação criada com sucesso',
      notification: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao criar notificação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar notificação',
      error: error.message
    });
  }
};

/**
 * Atualizar notificação
 */
const updateNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      message,
      type,
      link_url,
      link_text,
      recipient_type,
      recipient_list,
      is_active
    } = req.body;

    const result = await query(
      `UPDATE admin_notifications 
       SET title = $1, message = $2, type = $3, link_url = $4, link_text = $5,
           recipient_type = $6, recipient_list = $7, is_active = $8,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 AND deleted_at IS NULL
       RETURNING *`,
      [
        title,
        message,
        type,
        link_url,
        link_text,
        recipient_type,
        JSON.stringify(recipient_list || []),
        is_active,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notificação não encontrada'
      });
    }

    console.log('✅ Notificação atualizada:', id);

    res.json({
      success: true,
      message: 'Notificação atualizada com sucesso',
      notification: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar notificação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar notificação',
      error: error.message
    });
  }
};

/**
 * Deletar notificação (soft delete)
 */
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    await query(
      'UPDATE admin_notifications SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    console.log('✅ Notificação deletada:', id);

    res.json({
      success: true,
      message: 'Notificação deletada com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao deletar notificação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar notificação',
      error: error.message
    });
  }
};

/**
 * Ativar/Desativar notificação
 */
const toggleNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE admin_notifications 
       SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notificação não encontrada'
      });
    }

    console.log('✅ Notificação toggled:', id, '-> is_active:', result.rows[0].is_active);

    res.json({
      success: true,
      message: result.rows[0].is_active ? 'Notificação ativada' : 'Notificação desativada',
      notification: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao toggle notificação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao alterar status da notificação',
      error: error.message
    });
  }
};

module.exports = {
  // Email Campaigns
  getAllCampaigns,
  getCampaignById,
  createCampaign,
  previewRecipients,
  startCampaign,
  deleteCampaign,
  
  // Notifications
  getAllNotifications,
  getNotificationById,
  createNotification,
  updateNotification,
  deleteNotification,
  toggleNotification
};

