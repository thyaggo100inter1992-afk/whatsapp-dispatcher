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
    
    console.log('🔔 [Notifications] Buscando notificações para tenant:', tenantId);
    
    if (!tenantId) {
      console.log('❌ [Notifications] Tenant não identificado');
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
        n.link_text
      FROM admin_notifications n
      WHERE n.is_active = TRUE
        AND n.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM admin_notification_reads r
          WHERE r.notification_id = n.id AND r.tenant_id = $1
        )
        AND (
          n.recipient_type = 'all'
          OR (n.recipient_type = 'active' AND (SELECT status FROM tenants WHERE id = $1) = 'active')
          OR (n.recipient_type = 'blocked' AND (SELECT blocked_at FROM tenants WHERE id = $1) IS NOT NULL)
          OR (n.recipient_type = 'trial' AND (SELECT status FROM tenants WHERE id = $1) = 'trial')
          OR (n.recipient_type = 'specific' AND n.recipient_list->'tenant_ids' @> to_jsonb($1))
        )
      ORDER BY n.created_at DESC
    `, [tenantId]);

    // Buscar dados do tenant para substituir variáveis
    const tenantResult = await query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
    const tenantData = tenantResult.rows[0];

    // Buscar planos
    const plansResult = await query('SELECT * FROM plans WHERE is_active = TRUE');
    const plans = {};
    plansResult.rows.forEach(plan => {
      const planKey = plan.name.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
      plans[planKey] = plan;
    });

    // Variáveis para substituição
    const now = new Date();
    const variables = {
      nome: tenantData?.nome || 'Cliente',
      empresa: tenantData?.nome || 'Empresa',
      email: tenantData?.email || '',
      data_atual: now.toLocaleDateString('pt-BR'),
      hora_atual: now.toLocaleTimeString('pt-BR'),
      data_cadastro: tenantData?.created_at ? new Date(tenantData.created_at).toLocaleDateString('pt-BR') : '',
      data_vencimento: tenantData?.data_vencimento ? new Date(tenantData.data_vencimento).toLocaleDateString('pt-BR') : '',
      plano_atual: tenantData?.plano || 'Não definido',
      dias_teste: '3',
      data_fim_teste: tenantData?.trial_end ? new Date(tenantData.trial_end).toLocaleDateString('pt-BR') : '',
      valor_basico: plans.basico?.monthly_price || '0',
      valor_profissional: plans.profissional?.monthly_price || '0',
      valor_empresarial: plans.empresarial?.monthly_price || '0',
      valor_megatop: plans.megatop?.monthly_price || '0',
      url_sistema: 'https://sistemasnettsistemas.com.br',
      url_registro: 'https://sistemasnettsistemas.com.br/registro',
      url_site: 'https://sistemasnettsistemas.com.br/site'
    };

    // Substituir variáveis em cada notificação
    const processedNotifications = result.rows.map(notif => {
      let title = notif.title;
      let message = notif.message;
      let link_text = notif.link_text;

      Object.keys(variables).forEach(key => {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        title = title.replace(regex, variables[key]);
        message = message.replace(regex, variables[key]);
        if (link_text) {
          link_text = link_text.replace(regex, variables[key]);
        }
      });

      return {
        ...notif,
        title,
        message,
        link_text
      };
    });

    console.log(`🔔 [Notifications] Encontradas ${result.rows.length} notificações ativas`);
    console.log(`🔔 [Notifications] Após processamento: ${processedNotifications.length} notificações`);

    res.json({
      success: true,
      notifications: processedNotifications
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
      INSERT INTO admin_notification_reads (notification_id, tenant_id, viewed_at)
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

