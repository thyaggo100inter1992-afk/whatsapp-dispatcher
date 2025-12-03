const express = require('express');
const router = express.Router();
const { query } = require('../database/connection');

/**
 * GET /api/notifications/active
 * Retorna notificações ativas para o tenant atual (não lidas)
 */
router.get('/active', async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Tenant não identificado' });
    }

    // Buscar notificações ativas que o tenant ainda não leu
    const result = await query(`
      SELECT 
        n.id,
        n.title,
        n.message,
        n.type,
        n.link_url,
        n.link_text,
        n.icon_name
      FROM admin_notifications n
      WHERE n.is_active = TRUE
        AND (n.expires_at IS NULL OR n.expires_at > NOW())
        AND NOT EXISTS (
          SELECT 1 FROM admin_notification_reads r
          WHERE r.notification_id = n.id AND r.tenant_id = $1
        )
        AND (
          n.recipient_type = 'all'
          OR (n.recipient_type = 'active' AND (SELECT status FROM tenants WHERE id = $1) = 'active')
          OR (n.recipient_type = 'blocked' AND (SELECT status FROM tenants WHERE id = $1) = 'blocked')
          OR (n.recipient_type = 'trial' AND (SELECT status FROM tenants WHERE id = $1) = 'trial')
          OR (n.recipient_type = 'specific' AND n.specific_tenants @> $1::text::jsonb)
        )
      ORDER BY n.created_at DESC
    `, [tenantId]);

    res.json({
      success: true,
      notifications: result.rows
    });
  } catch (error) {
    console.error('❌ Erro ao buscar notificações ativas:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar notificações' });
  }
});

/**
 * POST /api/notifications/:id/read
 * Marca uma notificação como lida
 */
router.post('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant?.id;

    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Tenant não identificado' });
    }

    // Inserir registro de leitura (ou ignorar se já existe)
    await query(`
      INSERT INTO admin_notification_reads (notification_id, tenant_id, read_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (notification_id, tenant_id) DO NOTHING
    `, [id, tenantId]);

    res.json({ success: true, message: 'Notificação marcada como lida' });
  } catch (error) {
    console.error('❌ Erro ao marcar notificação como lida:', error);
    res.status(500).json({ success: false, message: 'Erro ao marcar notificação' });
  }
});

/**
 * POST /api/notifications/:id/click
 * Registra que o tenant clicou no link da notificação
 */
router.post('/:id/click', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant?.id;

    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Tenant não identificado' });
    }

    // Atualizar registro de leitura com timestamp de clique
    await query(`
      UPDATE admin_notification_reads
      SET clicked_at = NOW()
      WHERE notification_id = $1 AND tenant_id = $2
    `, [id, tenantId]);

    res.json({ success: true, message: 'Clique registrado' });
  } catch (error) {
    console.error('❌ Erro ao registrar clique:', error);
    res.status(500).json({ success: false, message: 'Erro ao registrar clique' });
  }
});

module.exports = router;

