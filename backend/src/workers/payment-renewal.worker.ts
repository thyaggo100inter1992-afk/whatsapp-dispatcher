/**
 * Worker para Verificar Vencimentos de Pagamento
 * 
 * Responsabilidades:
 * 1. Verificar pagamentos vencidos (overdue)
 * 2. Bloquear tenants com pagamento atrasado
 * 3. Notificar sobre vencimentos próximos (3, 2 e 1 dias antes)
 * 4. Criar novas cobranças para renovação mensal
 * 5. Período de carência: 20 dias após bloqueio
 */

import { pool } from '../database/connection';
import asaasService from '../services/asaas.service';

class PaymentRenewalWorker {
  /**
   * Executar todas as verificações
   */
  async run() {
    console.log('\n💰 ===== VERIFICANDO VENCIMENTOS DE PAGAMENTO =====');
    console.log(`⏰ ${new Date().toLocaleString('pt-BR')}\n`);

    try {
      await this.checkUpcomingDueDates();
      await this.applyScheduledDowngrades(); // ✅ PROCESSAR DOWNGRADES AGENDADOS ANTES DE BLOQUEAR
      await this.blockOverdueTenants();
      await this.createRenewalPayments();

      console.log('✅ Verificação de pagamentos concluída\n');
      console.log('====================================================\n');
    } catch (error) {
      console.error('❌ Erro no worker de pagamentos:', error);
    }
  }

  /**
   * Notificar sobre vencimentos próximos (3, 2 e 1 dias antes)
   */
  async checkUpcomingDueDates() {
    try {
      console.log('📅 Verificando vencimentos próximos...');

      // Buscar tenants que vencem em 3, 2 ou 1 dias
      const result = await pool.query(`
        SELECT 
          t.id, t.nome, t.email, t.proximo_vencimento, t.plano,
          p.preco_mensal, p.nome as plano_nome
        FROM tenants t
        LEFT JOIN plans p ON p.slug = t.plano
        WHERE t.status = 'active'
          AND t.proximo_vencimento IS NOT NULL
          AND t.proximo_vencimento <= NOW() + INTERVAL '3 days'
          AND t.proximo_vencimento > NOW()
      `);

      if (result.rows.length === 0) {
        console.log('✅ Nenhum vencimento próximo');
        return;
      }

      console.log(`⚠️  ${result.rows.length} vencimentos nos próximos 3 dias\n`);

      for (const tenant of result.rows) {
        const daysUntilDue = Math.ceil(
          (new Date(tenant.proximo_vencimento).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        // Enviar notificação apenas para 3, 2 ou 1 dias
        if (daysUntilDue === 3 || daysUntilDue === 2 || daysUntilDue === 1) {
          console.log(`📧 NOTIFICAÇÃO: ${tenant.nome} - Vence em ${daysUntilDue} dia(s)`);
          console.log(`   Email: ${tenant.email}`);
          console.log(`   Plano: ${tenant.plano_nome || tenant.plano}`);
          console.log(`   Valor: R$ ${tenant.preco_mensal}`);
          console.log(`   Vencimento: ${new Date(tenant.proximo_vencimento).toLocaleDateString('pt-BR')}\n`);
          
          // Enviar email de notificação
          await this.sendExpirationNotification(tenant, daysUntilDue);
        }
      }

      console.log();
    } catch (error) {
      console.error('❌ Erro ao verificar vencimentos próximos:', error);
    }
  }

  /**
   * Enviar email de notificação de vencimento próximo
   */
  async sendExpirationNotification(tenant: any, daysUntilDue: number) {
    try {
      // Verificar se já enviou notificação hoje para este tenant
      const lastNotification = await pool.query(`
        SELECT created_at 
        FROM payment_notifications 
        WHERE tenant_id = $1 
          AND notification_type = 'expiration_warning'
          AND days_before = $2
          AND created_at > NOW() - INTERVAL '12 hours'
        ORDER BY created_at DESC 
        LIMIT 1
      `, [tenant.id, daysUntilDue]);

      if (lastNotification.rows.length > 0) {
        console.log(`   ⏭️  Notificação já enviada hoje, pulando...`);
        return;
      }

      const emailService = require('../services/email.service').default;
      
      const subject = daysUntilDue === 1 
        ? '⚠️ Seu plano vence AMANHÃ!' 
        : `⚠️ Seu plano vence em ${daysUntilDue} dias`;

      const message = `
        <h2>Olá, ${tenant.nome}!</h2>
        
        <p>Seu plano <strong>${tenant.plano_nome || tenant.plano}</strong> vence em <strong>${daysUntilDue} dia(s)</strong>.</p>
        
        <p><strong>Data de vencimento:</strong> ${new Date(tenant.proximo_vencimento).toLocaleDateString('pt-BR')}</p>
        <p><strong>Valor da renovação:</strong> R$ ${tenant.preco_mensal}</p>
        
        <p style="color: #d32f2f; font-weight: bold;">
          ⚠️ Após o vencimento, seu acesso será bloqueado automaticamente.
        </p>
        
        <p>Para renovar seu plano, acesse:</p>
        <p><a href="https://sistemasnettsistemas.com.br/gestao" style="background: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Renovar Agora</a></p>
        
        <p>Caso já tenha realizado o pagamento, desconsidere este email.</p>
        
        <p>Atenciosamente,<br>Equipe Nett Sistemas</p>
      `;

      await emailService.sendEmail(tenant.email, subject, message);
      
      // Registrar notificação enviada
      await pool.query(`
        INSERT INTO payment_notifications (
          tenant_id, notification_type, days_before, sent_at, created_at
        ) VALUES ($1, 'expiration_warning', $2, NOW(), NOW())
      `, [tenant.id, daysUntilDue]);

      console.log(`   ✅ Email enviado com sucesso!`);
      
    } catch (error: any) {
      console.error(`   ❌ Erro ao enviar email:`, error.message);
    }
  }

  /**
   * ✅ VALIDAÇÃO 2: Aplicar downgrades agendados no vencimento
   * Verifica NOVAMENTE se o uso atual ainda cabe no plano de destino
   */
  async applyScheduledDowngrades() {
    try {
      console.log('🔽 Verificando downgrades agendados...');

      // Buscar tenants com downgrade agendado e vencimento hoje ou passado
      const result = await pool.query(`
        SELECT 
          t.id, 
          t.nome, 
          t.plan_id as plano_atual_id,
          t.plan_change_scheduled_id as plano_novo_id,
          t.proximo_vencimento,
          p_atual.nome as plano_atual_nome,
          p_novo.nome as plano_novo_nome,
          p_novo.limite_usuarios,
          p_novo.limite_contas_whatsapp,
          p_novo.limite_campanhas_mes
        FROM tenants t
        INNER JOIN plans p_atual ON t.plan_id = p_atual.id
        INNER JOIN plans p_novo ON t.plan_change_scheduled_id = p_novo.id
        WHERE t.plan_change_scheduled_id IS NOT NULL
          AND t.proximo_vencimento <= NOW()
      `);

      if (result.rows.length === 0) {
        console.log('✅ Nenhum downgrade agendado para processar');
        return;
      }

      console.log(`🔽 ${result.rows.length} downgrades agendados para processar\n`);

      for (const tenant of result.rows) {
        try {
          console.log(`\n🔍 [VALIDAÇÃO 2 - VENCIMENTO] Processando downgrade de ${tenant.nome}...`);
          console.log(`   ${tenant.plano_atual_nome} → ${tenant.plano_novo_nome}`);

          // ✅ VALIDAÇÃO 2: Verificar NOVAMENTE se o uso atual cabe no novo plano
          const validation = await this.validateTenantUsageForDowngrade(
            tenant.id, 
            tenant.plano_novo_id,
            tenant.plano_novo_nome,
            tenant.limite_usuarios,
            tenant.limite_contas_whatsapp,
            tenant.limite_campanhas_mes
          );

          if (!validation.valid) {
            // ❌ USO EXCEDE LIMITES - Bloquear tenant e cancelar downgrade
            console.log(`❌ DOWNGRADE CANCELADO - ${tenant.nome} excedeu limites:`);
            validation.errors.forEach(err => console.log(`   - ${err}`));

            // Bloquear tenant (20 dias de carência)
            const willBeDeletedAt = new Date();
            willBeDeletedAt.setDate(willBeDeletedAt.getDate() + 20);

            await pool.query(`
              UPDATE tenants 
              SET 
                status = 'blocked',
                blocked_at = NOW(),
                will_be_deleted_at = $1,
                plan_change_scheduled_id = NULL,
                updated_at = NOW()
              WHERE id = $2
            `, [willBeDeletedAt, tenant.id]);

            console.log(`🔒 Tenant BLOQUEADO - Precisa escolher novo plano ou reduzir uso\n`);

            // TODO: Enviar email explicando o que aconteceu
            continue;
          }

          // ✅ VALIDAÇÃO PASSOU - Aplicar downgrade
          console.log(`✅ Validação passou - Aplicando downgrade...`);

          await pool.query(`
            UPDATE tenants 
            SET 
              plan_id = $1,
              plano = (SELECT slug FROM plans WHERE id = $1),
              plan_change_scheduled_id = NULL,
              proximo_vencimento = NOW() + INTERVAL '30 days',
              updated_at = NOW()
            WHERE id = $2
          `, [tenant.plano_novo_id, tenant.id]);

          // Atualizar limites do tenant conforme o novo plano
          const planResult = await pool.query(`
            SELECT * FROM plans WHERE id = $1
          `, [tenant.plano_novo_id]);

          if (planResult.rows.length > 0) {
            const plan = planResult.rows[0];
            await pool.query(`
              UPDATE tenants
              SET
                limite_usuarios = $1,
                limite_instancias_whatsapp = $2,
                limite_mensagens_mes = $3,
                limite_campanhas_mes = $4,
                limite_contatos_total = $5,
                limite_templates = $6
              WHERE id = $7
            `, [
              plan.limite_usuarios,
              plan.limite_contas_whatsapp,
              plan.limite_mensagens_mes,
              plan.limite_campanhas_mes,
              plan.limite_contatos,
              plan.limite_templates,
              tenant.id
            ]);
          }

          console.log(`✅ DOWNGRADE APLICADO: ${tenant.nome}`);
          console.log(`   ${tenant.plano_atual_nome} → ${tenant.plano_novo_nome}`);
          console.log(`   Próximo vencimento: ${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('pt-BR')}\n`);

          // TODO: Enviar email confirmando downgrade
        } catch (error: any) {
          console.error(`❌ Erro ao processar downgrade de ${tenant.nome}:`, error.message);
        }
      }

      console.log(`✅ Downgrades processados\n`);
    } catch (error) {
      console.error('❌ Erro ao aplicar downgrades:', error);
    }
  }

  /**
   * Validar se o uso atual do tenant cabe nos limites do plano (para worker)
   */
  async validateTenantUsageForDowngrade(
    tenantId: number, 
    planId: number,
    planName: string,
    limiteUsuarios: number,
    limiteWhatsapp: number,
    limiteCampanhas: number
  ): Promise<{ valid: boolean; errors: string[] }> {
    try {
      const errors: string[] = [];

      // 1. Validar usuários
      const usersResult = await pool.query(`
        SELECT COUNT(*) as total
        FROM users
        WHERE tenant_id = $1 AND ativo = true
      `, [tenantId]);
      const totalUsers = parseInt(usersResult.rows[0].total);
      
      if (totalUsers > limiteUsuarios) {
        errors.push(`${totalUsers} usuários ativos (plano permite ${limiteUsuarios})`);
      }

      // 2. Validar WhatsApp
      const whatsappResult = await pool.query(`
        SELECT COUNT(*) as total
        FROM whatsapp_connections
        WHERE tenant_id = $1 AND status = 'connected'
      `, [tenantId]);
      const totalWhatsApp = parseInt(whatsappResult.rows[0].total);
      
      if (totalWhatsApp > limiteWhatsapp) {
        errors.push(`${totalWhatsApp} conexões WhatsApp ativas (plano permite ${limiteWhatsapp})`);
      }

      // 3. Validar campanhas
      const campaignsResult = await pool.query(`
        SELECT COUNT(*) as total
        FROM campaigns
        WHERE tenant_id = $1 AND status IN ('running', 'scheduled')
      `, [tenantId]);
      const totalCampaigns = parseInt(campaignsResult.rows[0].total);
      
      if (totalCampaigns > limiteCampanhas) {
        errors.push(`${totalCampaigns} campanhas ativas/agendadas (plano permite ${limiteCampanhas})`);
      }

      console.log(`   📊 Uso atual vs limites do plano ${planName}:`);
      console.log(`      Usuários: ${totalUsers}/${limiteUsuarios} ${totalUsers > limiteUsuarios ? '❌' : '✅'}`);
      console.log(`      WhatsApp: ${totalWhatsApp}/${limiteWhatsapp} ${totalWhatsApp > limiteWhatsapp ? '❌' : '✅'}`);
      console.log(`      Campanhas: ${totalCampaigns}/${limiteCampanhas} ${totalCampaigns > limiteCampanhas ? '❌' : '✅'}`);

      return {
        valid: errors.length === 0,
        errors: errors
      };

    } catch (error: any) {
      console.error('❌ Erro ao validar uso:', error);
      return { valid: false, errors: ['Erro ao validar uso atual'] };
    }
  }

  /**
   * Bloquear tenants com pagamento vencido
   */
  async blockOverdueTenants() {
    try {
      console.log('🔒 Verificando pagamentos vencidos...');

      const result = await pool.query(`
        SELECT 
          t.id, t.nome, t.email, t.plano, t.proximo_vencimento
        FROM tenants t
        WHERE t.status = 'active'
          AND t.proximo_vencimento IS NOT NULL
          AND t.proximo_vencimento < NOW()
      `);

      if (result.rows.length === 0) {
        console.log('✅ Nenhum pagamento vencido');
        return;
      }

      console.log(`⚠️  ${result.rows.length} tenants com pagamento vencido\n`);

      for (const tenant of result.rows) {
        try {
          // Calcular data de deleção (20 dias após bloqueio)
          const willBeDeletedAt = new Date();
          willBeDeletedAt.setDate(willBeDeletedAt.getDate() + 20);

          // Bloquear tenant
          await pool.query(`
            UPDATE tenants 
            SET 
              status = 'blocked',
              blocked_at = NOW(),
              will_be_deleted_at = $1,
              updated_at = NOW()
            WHERE id = $2
          `, [willBeDeletedAt, tenant.id]);

          console.log(`🔒 BLOQUEADO: ${tenant.nome} (${tenant.email})`);
          console.log(`   Vencimento: ${new Date(tenant.proximo_vencimento).toLocaleString('pt-BR')}`);
          console.log(`   Será deletado em: ${willBeDeletedAt.toLocaleString('pt-BR')} (20 dias)\n`);

          // Enviar email notificando bloqueio e link de pagamento
          await this.sendBlockedNotification(tenant, willBeDeletedAt);
        } catch (error: any) {
          console.error(`❌ Erro ao bloquear tenant ${tenant.id}:`, error.message);
        }
      }

      console.log(`✅ ${result.rows.length} tenants bloqueados\n`);
    } catch (error) {
      console.error('❌ Erro ao bloquear tenants:', error);
    }
  }

  /**
   * Enviar email de notificação de bloqueio por falta de pagamento
   */
  async sendBlockedNotification(tenant: any, willBeDeletedAt: Date) {
    try {
      const emailService = require('../services/email.service').default;
      
      const daysUntilDeletion = Math.ceil(
        (willBeDeletedAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      const subject = '🔒 Seu acesso foi bloqueado - Pagamento vencido';

      const message = `
        <h2>Olá, ${tenant.nome}!</h2>
        
        <p style="color: #d32f2f; font-weight: bold; font-size: 18px;">
          ⚠️ Seu acesso ao sistema foi bloqueado devido ao vencimento do plano.
        </p>
        
        <p><strong>Plano:</strong> ${tenant.plano}</p>
        <p><strong>Data de vencimento:</strong> ${new Date(tenant.proximo_vencimento).toLocaleDateString('pt-BR')}</p>
        
        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #856404;">
            <strong>⏰ ATENÇÃO:</strong> Você tem <strong>${daysUntilDeletion} dias</strong> para renovar seu plano.
            Após este prazo, todos os seus dados serão <strong>DELETADOS PERMANENTEMENTE</strong>.
          </p>
        </div>
        
        <p><strong>O que será deletado:</strong></p>
        <ul>
          <li>Todas as suas campanhas e mensagens</li>
          <li>Todos os contatos e listas</li>
          <li>Todas as conexões WhatsApp</li>
          <li>Todos os templates e configurações</li>
          <li>Todo o histórico e relatórios</li>
        </ul>
        
        <p style="font-size: 18px; margin: 30px 0;">
          <a href="https://sistemasnettsistemas.com.br/gestao" style="background: #d32f2f; color: white; padding: 15px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
            🔓 RENOVAR AGORA E REATIVAR ACESSO
          </a>
        </p>
        
        <p>Após o pagamento, seu acesso será <strong>reativado automaticamente</strong>.</p>
        
        <p>Atenciosamente,<br>Equipe Nett Sistemas</p>
      `;

      await emailService.sendEmail(tenant.email, subject, message);
      
      // Registrar notificação enviada
      await pool.query(`
        INSERT INTO payment_notifications (
          tenant_id, notification_type, sent_at, created_at
        ) VALUES ($1, 'blocked', NOW(), NOW())
      `, [tenant.id]);

      console.log(`   ✅ Email de bloqueio enviado para ${tenant.email}`);
      
    } catch (error: any) {
      console.error(`   ❌ Erro ao enviar email de bloqueio:`, error.message);
    }
  }

  /**
   * Criar cobranças de renovação mensal (3 dias antes do vencimento)
   * ⚠️ DESABILITADO: Cobranças devem ser criadas apenas manualmente via botão "Renovar"
   */
  async createRenewalPayments() {
    // ⚠️ FUNÇÃO DESABILITADA - Não criar cobranças automáticas
    console.log('ℹ️  Criação automática de cobranças DESABILITADA');
    console.log('   Cobranças devem ser criadas manualmente pelo botão "Renovar"');
    console.log('✅ Renovações processadas\n');
    return;
    
    try {
      console.log('🔄 Verificando renovações necessárias...');

      // Buscar tenants ativos que precisam de cobrança de renovação
      const result = await pool.query(`
        SELECT 
          t.id, t.nome, t.email, t.plano, t.proximo_vencimento,
          t.asaas_customer_id, t.asaas_subscription_id,
          p.id as plan_id, p.preco_mensal, p.nome as plan_nome
        FROM tenants t
        INNER JOIN plans p ON p.slug = t.plano
        WHERE t.status = 'active'
          AND t.proximo_vencimento IS NOT NULL
          AND t.proximo_vencimento <= NOW() + INTERVAL '3 days'
          AND t.proximo_vencimento > NOW()
          AND NOT EXISTS (
            SELECT 1 FROM payments pay
            WHERE pay.tenant_id = t.id
              AND pay.status = 'pending'
              AND pay.due_date >= NOW()
          )
      `);

      if (result.rows.length === 0) {
        console.log('✅ Nenhuma renovação necessária');
        return;
      }

      console.log(`🔄 ${result.rows.length} renovações a processar\n`);

      for (const tenant of result.rows) {
        try {
          // Se tem assinatura no Asaas, não precisa criar cobrança manual
          if (tenant.asaas_subscription_id) {
            console.log(`ℹ️  ${tenant.nome} - Assinatura automática ativa`);
            continue;
          }

          // Verificar se Asaas está configurado
          if (!asaasService.isConfigured()) {
            console.log('⚠️  Asaas não configurado, pulando renovações');
            break;
          }

          // Criar cobrança de renovação
          const dueDate = new Date(tenant.proximo_vencimento);
          
          const asaasPayment = await asaasService.createPayment({
            customer: tenant.asaas_customer_id,
            billingType: 'BOLETO',
            value: Number(tenant.preco_mensal),
            dueDate: dueDate.toISOString().split('T')[0],
            description: `${tenant.plan_nome} - Renovação Mensal`,
            externalReference: `tenant_${tenant.id}_renewal_${Date.now()}`
          });

          // Salvar cobrança no banco
          await pool.query(`
            INSERT INTO payments (
              tenant_id, plan_id, asaas_payment_id, asaas_customer_id,
              valor, payment_type, status, due_date,
              asaas_invoice_url, asaas_bank_slip_url,
              descricao
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, [
            tenant.id,
            tenant.plan_id,
            asaasPayment.id,
            tenant.asaas_customer_id,
            tenant.preco_mensal,
            'BOLETO',
            asaasPayment.status,
            dueDate,
            asaasPayment.invoiceUrl,
            asaasPayment.bankSlipUrl,
            `${tenant.plan_nome} - Renovação Mensal`
          ]);

          console.log(`✅ Cobrança criada: ${tenant.nome} - R$ ${tenant.preco_mensal}`);
          console.log(`   Vencimento: ${dueDate.toLocaleDateString('pt-BR')}\n`);

          // TODO: Enviar email com boleto de renovação
        } catch (error: any) {
          console.error(`❌ Erro ao criar renovação para ${tenant.nome}:`, error.message);
        }
      }

      console.log(`✅ Renovações processadas\n`);
    } catch (error) {
      console.error('❌ Erro ao criar renovações:', error);
    }
  }
}

export const paymentRenewalWorker = new PaymentRenewalWorker();

