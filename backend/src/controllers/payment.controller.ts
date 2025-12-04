/**
 * Controller de Pagamentos
 * Gerencia criação de cobranças, assinaturas e webhooks Asaas
 */

import { Request, Response } from 'express';
import { pool } from '../database/connection';
import asaasService from '../services/asaas.service';

class PaymentController {
  /**
   * GET /api/payments/plans
   * Listar planos disponíveis
   */
  async listPlans(req: Request, res: Response) {
    try {
      const result = await pool.query(`
        SELECT 
          id, 
          nome, 
          slug, 
          descricao,
          preco_mensal, 
          preco_anual,
          limite_usuarios, 
          limite_contas_whatsapp,
          limite_mensagens_mes,
          limite_campanhas_mes,
          limite_contatos, 
          limite_templates,
          CASE WHEN ativo = true THEN 'active' ELSE 'inactive' END as status,
          ordem,
          duracao_trial_dias
        FROM plans
        WHERE ativo = true AND visivel = true
        ORDER BY ordem ASC, preco_mensal ASC
      `);

      console.log(`📊 Listando ${result.rows.length} planos ativos`);
      result.rows.forEach(plan => {
        console.log(`  - ${plan.nome}: R$ ${plan.preco_mensal} (${plan.status})`);
      });

      return res.json({
        success: true,
        plans: result.rows
      });
    } catch (error: any) {
      console.error('❌ Erro ao listar planos:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao listar planos',
        error: error.message
      });
    }
  }

  /**
   * GET /api/payments/financial-info
   * Buscar informações financeiras completas do tenant (apenas admin)
   * Mostra: plano, vencimento, status, histórico de pagamentos
   */
  async getFinancialInfo(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant.id;

      // 1. Buscar informações do tenant e plano
      const tenantResult = await pool.query(`
        SELECT 
          t.id,
          t.nome,
          t.proximo_vencimento,
          t.plan_id,
          p.nome as plano_nome,
          p.preco_mensal,
          p.preco_anual,
          p.limite_usuarios,
          p.limite_contas_whatsapp,
          p.limite_campanhas_mes,
          p.limite_mensagens_dia,
          p.funcionalidades
        FROM tenants t
        LEFT JOIN plans p ON t.plan_id = p.id
        WHERE t.id = $1
      `, [tenantId]);

      if (tenantResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Tenant não encontrado'
        });
      }

      const tenant = tenantResult.rows[0];

      // 2. Calcular dias restantes até o vencimento
      let diasRestantes = 0;
      let statusVencimento = 'ativo';
      let corAlerta = 'green';

      if (tenant.proximo_vencimento) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const vencimento = new Date(tenant.proximo_vencimento);
        vencimento.setHours(0, 0, 0, 0);
        
        diasRestantes = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

        if (diasRestantes < 0) {
          statusVencimento = 'vencido';
          corAlerta = 'red';
        } else if (diasRestantes <= 7) {
          statusVencimento = 'proximo';
          corAlerta = 'red';
        } else if (diasRestantes <= 15) {
          statusVencimento = 'atencao';
          corAlerta = 'yellow';
        } else {
          statusVencimento = 'ativo';
          corAlerta = 'green';
        }
      }

      // 3. Buscar histórico de pagamentos (apenas pagamentos de planos, não de consultas avulsas)
      const paymentsResult = await pool.query(`
        SELECT 
          id,
          valor,
          payment_type,
          status,
          due_date,
          paid_at,
          asaas_invoice_url,
          asaas_bank_slip_url,
          asaas_pix_qr_code,
          asaas_pix_copy_paste,
          metadata,
          created_at,
          CASE 
            WHEN metadata->>'tipo' = 'consultas_avulsas' THEN 'Compra de Consultas Avulsas'
            ELSE 'Pagamento'
          END as descricao
        FROM payments
        WHERE tenant_id = $1
          AND (metadata->>'tipo' IS NULL OR metadata->>'tipo' != 'consultas_avulsas')
        ORDER BY created_at DESC
        LIMIT 10
      `, [tenantId]);

      // 4. Buscar último pagamento pendente com dados de cobrança
      // Apenas pagamentos realmente pendentes (não pagos, não cancelados)
      const pendingPayment = paymentsResult.rows.find(p => {
        const status = (p.status || '').toUpperCase();
        // Considerar apenas PENDING (não RECEIVED, CONFIRMED, CANCELLED, etc)
        // E que NÃO tenha data de pagamento (paid_at)
        return status === 'PENDING' && !p.paid_at && !p.confirmed_at;
      });

      return res.json({
        success: true,
        data: {
          plano: {
            id: tenant.plan_id,
            nome: tenant.plano_nome,
            preco_mensal: tenant.preco_mensal,
            preco_anual: tenant.preco_anual
          },
          vencimento: {
            data: tenant.proximo_vencimento,
            dias_restantes: diasRestantes,
            status: statusVencimento,
            cor_alerta: corAlerta
          },
          limites: {
            usuarios: tenant.limite_usuarios,
            contas_whatsapp: tenant.limite_contas_whatsapp,
            campanhas_mes: tenant.limite_campanhas_mes,
            mensagens_dia: tenant.limite_mensagens_dia
          },
          funcionalidades: tenant.funcionalidades,
          historico_pagamentos: paymentsResult.rows,
          pagamento_pendente: pendingPayment || null
        }
      });

    } catch (error: any) {
      console.error('❌ Erro ao buscar informações financeiras:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao buscar informações financeiras',
        error: error.message
      });
    }
  }

  /**
   * GET /api/payments/:id/status
   * Verificar status de um pagamento específico
   */
  async checkPaymentStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = (req as any).tenant.id;

      // Buscar pagamento
      const result = await pool.query(
        'SELECT id, status, paid_at, confirmed_at FROM payments WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Pagamento não encontrado'
        });
      }

      const payment = result.rows[0];

      return res.json({
        success: true,
        status: payment.status,
        paid_at: payment.paid_at,
        confirmed_at: payment.confirmed_at
      });
    } catch (error: any) {
      console.error('❌ Erro ao verificar status do pagamento:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao verificar status do pagamento',
        error: error.message
      });
    }
  }

  /**
   * GET /api/payments/status
   * Obter status de pagamento do tenant
   */
  async getPaymentStatus(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant.id;

      // Buscar dados do tenant
      const tenantResult = await pool.query(`
        SELECT 
          t.id, t.nome, t.email, t.plano, t.status, t.plan_id,
          t.trial_ends_at, t.blocked_at, t.will_be_deleted_at,
          t.proximo_vencimento, t.asaas_customer_id, t.asaas_subscription_id,
          t.funcionalidades_customizadas,
          t.funcionalidades_config,
          COALESCE(t.consultas_avulsas_saldo, 0) as consultas_avulsas_saldo,
          COALESCE(t.consultas_avulsas_usadas, 0) as consultas_avulsas_usadas,
          COALESCE(t.limite_nova_vida_dia_customizado, p.limite_consultas_dia) as limite_novavida_dia,
          COALESCE(t.limite_novavida_mes_customizado, p.limite_consultas_mes) as limite_novavida_mes,
          p.nome as plano_nome, 
          p.slug as plano_slug,
          p.preco_mensal,
          p.limite_usuarios,
          p.limite_contas_whatsapp,
          p.limite_campanhas_mes,
          p.limite_mensagens_dia,
          p.limite_consultas_dia,
          p.limite_consultas_mes,
          p.limite_templates,
          p.funcionalidades as plano_funcionalidades
        FROM tenants t
        LEFT JOIN plans p ON t.plan_id = p.id
        WHERE t.id = $1
      `, [tenantId]);

      if (tenantResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Tenant não encontrado'
        });
      }

      const tenant = tenantResult.rows[0];

      // Buscar último pagamento
      const paymentResult = await pool.query(`
        SELECT 
          id, valor, status, payment_type, due_date,
          asaas_invoice_url, asaas_bank_slip_url,
          asaas_pix_qr_code, asaas_pix_copy_paste,
          paid_at, confirmed_at
        FROM payments
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `, [tenantId]);

      const lastPayment = paymentResult.rows[0] || null;

      // Calcular status
      let statusInfo: any = {
        status: tenant.status,
        plano: tenant.plano || tenant.plano_slug,
        plano_nome: tenant.plano_nome,
        plano_slug: tenant.plano_slug,
        preco_mensal: tenant.preco_mensal,
        is_trial: tenant.status === 'trial',
        is_blocked: tenant.status === 'blocked' || !!tenant.blocked_at,
        trial_ends_at: tenant.trial_ends_at,
        proximo_vencimento: tenant.proximo_vencimento,
        blocked_at: tenant.blocked_at,
        will_be_deleted_at: tenant.will_be_deleted_at,
        limite_usuarios: tenant.limite_usuarios,
        limite_contas_whatsapp: tenant.limite_contas_whatsapp,
        limite_campanhas_mes: tenant.limite_campanhas_mes,
        limite_mensagens_dia: tenant.limite_mensagens_dia,
        limite_consultas_dia: tenant.limite_consultas_dia,
        limite_consultas_mes: tenant.limite_consultas_mes,
        limite_novavida_dia: tenant.limite_novavida_dia,
        limite_novavida_mes: tenant.limite_novavida_mes,
        limite_templates: tenant.limite_templates,
        consultas_avulsas_saldo: tenant.consultas_avulsas_saldo,
        consultas_avulsas_usadas: tenant.consultas_avulsas_usadas,
        funcionalidades_customizadas: tenant.funcionalidades_customizadas,
        funcionalidades_config: tenant.funcionalidades_config,
        plano_funcionalidades: tenant.plano_funcionalidades
      };

      // Calcular dias restantes do trial
      if (tenant.trial_ends_at) {
        const now = new Date();
        const trialEnd = new Date(tenant.trial_ends_at);
        const diffDays = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        statusInfo.trial_days_remaining = Math.max(0, diffDays);
      }

      // Calcular dias até deleção
      if (tenant.will_be_deleted_at) {
        const now = new Date();
        const deleteDate = new Date(tenant.will_be_deleted_at);
        const diffDays = Math.ceil((deleteDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        statusInfo.days_until_deletion = Math.max(0, diffDays);
      }

      return res.json({
        success: true,
        tenant: statusInfo,
        last_payment: lastPayment
      });
    } catch (error: any) {
      console.error('Erro ao obter status de pagamento:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao obter status de pagamento',
        error: error.message
      });
    }
  }

  /**
   * POST /api/payments/create
   * Criar cobrança para upgrade de plano
   */
  async createPayment(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant.id;
      const { plan_slug, billing_type, documento } = req.body;

      // Validação
      if (!plan_slug || !billing_type) {
        return res.status(400).json({
          success: false,
          message: 'Plan e tipo de pagamento são obrigatórios'
        });
      }

      if (!['BOLETO', 'PIX', 'CREDIT_CARD'].includes(billing_type)) {
        return res.status(400).json({
          success: false,
          message: 'Tipo de pagamento inválido'
        });
      }

      // Validar documento (obrigatório)
      if (!documento || documento.length < 11) {
        return res.status(400).json({
          success: false,
          message: 'CPF ou CNPJ é obrigatório para gerar a cobrança'
        });
      }

      // Buscar tenant
      const tenantResult = await pool.query(
        'SELECT * FROM tenants WHERE id = $1',
        [tenantId]
      );

      if (tenantResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Tenant não encontrado'
        });
      }

      let tenant = tenantResult.rows[0];

      // Atualizar documento do tenant se necessário
      if (!tenant.documento || tenant.documento !== documento) {
        console.log(`📝 Atualizando documento do tenant ${tenantId}: ${documento}`);
        await pool.query(
          'UPDATE tenants SET documento = $1 WHERE id = $2',
          [documento, tenantId]
        );
        tenant.documento = documento;
      }

      // Buscar plano
      const planResult = await pool.query(
        'SELECT * FROM plans WHERE slug = $1 AND ativo = true',
        [plan_slug]
      );

      if (planResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Plano não encontrado'
        });
      }

      const plan = planResult.rows[0];

      // Verificar se Asaas está configurado
      if (!(await asaasService.isConfigured(tenantId))) {
        return res.status(500).json({
          success: false,
          message: 'Sistema de pagamentos não configurado. Solicite ao administrador que configure uma credencial Asaas.'
        });
      }

      // Validar dados do tenant antes de criar cobrança
      console.log('📋 Validando dados do tenant para Asaas...');
      console.log('   - Nome:', tenant.nome);
      console.log('   - Email:', tenant.email);
      console.log('   - Documento:', tenant.documento);
      console.log('   - Telefone:', tenant.telefone);

      if (!tenant.nome || !tenant.email) {
        return res.status(400).json({
          success: false,
          message: 'Dados do tenant incompletos! Necessário: nome e email.',
          missing: {
            nome: !tenant.nome,
            email: !tenant.email
          }
        });
      }

      // 1. Criar ou buscar/atualizar cliente no Asaas
      let asaasCustomer = null;
      
      if (tenant.asaas_customer_id) {
        // Já tem cliente cadastrado, vamos atualizar com o documento
        console.log(`✅ Cliente Asaas já existente: ${tenant.asaas_customer_id}`);
        console.log(`📝 Atualizando dados do cliente Asaas com documento...`);
        
        try {
          // Atualizar cliente no Asaas
          await asaasService.updateCustomer(tenant.asaas_customer_id, {
            name: tenant.nome,
            email: tenant.email,
            cpfCnpj: tenant.documento,
            phone: tenant.telefone || undefined
          }, tenantId);
          console.log(`✅ Cliente Asaas atualizado com sucesso`);
        } catch (updateError: any) {
          console.error(`⚠️  Erro ao atualizar cliente Asaas:`, updateError.message);
          // Se falhar a atualização, vamos criar um novo cliente
          console.log(`🔄 Criando novo cliente Asaas...`);
          asaasCustomer = await asaasService.createCustomer({
            name: tenant.nome,
            email: tenant.email,
            cpfCnpj: tenant.documento,
            phone: tenant.telefone || undefined
          }, tenantId);
          
          await pool.query(
            'UPDATE tenants SET asaas_customer_id = $1 WHERE id = $2',
            [asaasCustomer.id, tenantId]
          );
          console.log(`✅ Novo cliente Asaas criado: ${asaasCustomer.id}`);
        }
        
        asaasCustomer = { id: tenant.asaas_customer_id };
      } else {
        // Criar novo cliente
        console.log('🆕 Criando novo cliente no Asaas...');
        asaasCustomer = await asaasService.createCustomer({
          name: tenant.nome,
          email: tenant.email,
          cpfCnpj: tenant.documento,
          phone: tenant.telefone || undefined
        }, tenantId);

        // Salvar ID do cliente
        await pool.query(
          'UPDATE tenants SET asaas_customer_id = $1 WHERE id = $2',
          [asaasCustomer.id, tenantId]
        );
        console.log(`✅ Cliente Asaas criado e vinculado: ${asaasCustomer.id}`);
      }

      // 2. Criar cobrança no Asaas
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3); // Vencimento em 3 dias

      const asaasPayment = await asaasService.createPayment({
        customer: asaasCustomer.id,
        billingType: billing_type as any,
        value: Number(plan.preco_mensal),
        dueDate: dueDate.toISOString().split('T')[0],
        description: `${plan.nome} - Mensalidade`,
        externalReference: `tenant_${tenantId}_plan_${plan.id}`
      }, tenantId);

      // 2.1. Se for PIX, buscar QR Code
      let pixQrCodeData = null;
      if (billing_type === 'PIX') {
        console.log('🔍 Buscando dados do QR Code PIX...');
        pixQrCodeData = await asaasService.getPixQrCode(asaasPayment.id, tenantId);
        
        if (pixQrCodeData) {
          console.log('✅ QR Code PIX obtido:');
          console.log('   - Payload (copia e cola):', pixQrCodeData.payload ? 'SIM' : 'NÃO');
          console.log('   - EncodedImage (QR Code):', pixQrCodeData.encodedImage ? 'SIM' : 'NÃO');
        } else {
          console.log('⚠️  Não foi possível obter QR Code PIX');
        }
      }

      // 3. Preparar QR Code (evitar duplicação do prefixo data:image)
      let qrCodeImage = pixQrCodeData?.encodedImage || asaasPayment.pixQrCodeUrl || null;
      if (qrCodeImage && !qrCodeImage.startsWith('data:image/')) {
        qrCodeImage = `data:image/png;base64,${qrCodeImage}`;
      }

      // 4. Salvar cobrança no banco
      const paymentInsert = await pool.query(`
        INSERT INTO payments (
          tenant_id, plan_id, asaas_payment_id, asaas_customer_id,
          valor, payment_type, status, due_date,
          asaas_invoice_url, asaas_bank_slip_url,
          asaas_pix_qr_code, asaas_pix_copy_paste,
          descricao, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `, [
        tenantId,
        plan.id,
        asaasPayment.id,
        asaasCustomer.id,
        plan.preco_mensal,
        billing_type,
        asaasPayment.status,
        dueDate,
        asaasPayment.invoiceUrl,
        asaasPayment.bankSlipUrl,
        qrCodeImage,
        pixQrCodeData?.payload || asaasPayment.pixCopyAndPaste || null,
        `${plan.nome} - Mensalidade`,
        JSON.stringify({ tipo: 'primeiro_pagamento' })  // Adicionar metadata
      ]);

      const payment = paymentInsert.rows[0];

      console.log(`✅ Cobrança criada: Tenant ${tenantId} - Plano ${plan.nome} - ${billing_type}`);

      return res.json({
        success: true,
        message: 'Cobrança criada com sucesso',
        payment: {
          id: payment.id,
          valor: payment.valor,
          due_date: payment.due_date,
          payment_type: payment.payment_type,
          invoice_url: payment.asaas_invoice_url,
          bank_slip_url: payment.asaas_bank_slip_url,
          pix_qr_code: payment.asaas_pix_qr_code,
          pix_copy_paste: payment.asaas_pix_copy_paste
        },
        plan: {
          nome: plan.nome,
          preco: plan.preco_mensal
        }
      });

    } catch (error: any) {
      console.error('❌ ========================================');
      console.error('❌ ERRO AO CRIAR COBRANÇA NO ASAAS');
      console.error('❌ ========================================');
      console.error('❌ Mensagem:', error.message);
      console.error('❌ Stack:', error.stack);
      
      return res.status(500).json({
        success: false,
        message: 'Erro ao criar cobrança',
        error: error.message,
        details: 'Verifique se a API Key do Asaas está correta e ativa. Consulte os logs do servidor para mais detalhes.'
      });
    }
  }

  /**
   * POST /api/payments/webhook
   * Webhook do Asaas (público, sem autenticação)
   */
  async handleWebhook(req: Request, res: Response) {
    try {
      const { event, payment } = req.body;

      console.log('📨 Webhook recebido:', event, payment?.id);

      // Eventos que liberam o acesso
      const successEvents = [
        'PAYMENT_CONFIRMED',
        'PAYMENT_RECEIVED',
        'PAYMENT_RECEIVED_IN_CASH'
      ];

      if (successEvents.includes(event)) {
        // Buscar pagamento no banco
        const paymentResult = await pool.query(
          'SELECT * FROM payments WHERE asaas_payment_id = $1',
          [payment.id]
        );

        if (paymentResult.rows.length === 0) {
          console.log('⚠️ Pagamento não encontrado no banco:', payment.id);
          return res.json({ received: true });
        }

        const dbPayment = paymentResult.rows[0];

        // Atualizar status do pagamento
        await pool.query(`
          UPDATE payments 
          SET 
            status = 'confirmed',
            confirmed_at = NOW(),
            paid_at = NOW(),
            valor_pago = $1
          WHERE id = $2
        `, [payment.value, dbPayment.id]);

        // Verificar tipo de cobrança através do metadata
        const metadata = dbPayment.metadata || {};
        const tipoCobranca = metadata.tipo; // 'consultas_avulsas', 'upgrade', 'renovacao'
        
        console.log(`🔍 Tipo de cobrança detectado: ${tipoCobranca}`);
        console.log(`📦 Metadata completo:`, metadata);
        
        // 🛒 SE FOR COMPRA DE CONSULTAS AVULSAS
        if (tipoCobranca === 'consultas_avulsas') {
          const quantidadeConsultas = metadata.quantidade_consultas || 0;
          
          console.log(`🛒 COMPRA DE CONSULTAS AVULSAS CONFIRMADA!`);
          console.log(`   Tenant: ${dbPayment.tenant_id}`);
          console.log(`   Quantidade: ${quantidadeConsultas} consultas`);
          console.log(`   Valor: R$ ${payment.value}`);
          
          // Adicionar consultas ao saldo do tenant
          await pool.query(`
            UPDATE tenants
            SET
              consultas_avulsas_saldo = COALESCE(consultas_avulsas_saldo, 0) + $1,
              updated_at = NOW()
            WHERE id = $2
          `, [quantidadeConsultas, dbPayment.tenant_id]);
          
          console.log(`✅ ${quantidadeConsultas} consultas adicionadas ao saldo do Tenant ${dbPayment.tenant_id}`);
          
          // TODO: Enviar email de confirmação da compra
          
        } else if (tipoCobranca === 'upgrade') {
          // 🚀 UPGRADE: Muda plano IMEDIATAMENTE mas MANTÉM a data de vencimento atual
          console.log(`🚀 UPGRADE CONFIRMADO! Aplicando mudança imediata de plano para Tenant ${dbPayment.tenant_id}`);
          
          await pool.query(`
            UPDATE tenants
            SET
              plan_id = $1,
              status = 'active',
              is_trial = false,
              trial_ends_at = NULL,
              blocked_at = NULL,
              will_be_deleted_at = NULL,
              plano = (SELECT slug FROM plans WHERE id = $1),
              data_ativacao = COALESCE(data_ativacao, NOW()),
              updated_at = NOW()
            WHERE id = $2
          `, [dbPayment.plan_id, dbPayment.tenant_id]);
          
          console.log(`✅ Tenant ${dbPayment.tenant_id} SAIU DO TRIAL - Plano PAGO ativado`);
          
        } else if (tipoCobranca === 'renovacao') {
          // RENOVAÇÃO: MANTÉM o plano atual e ESTENDE o vencimento em 30 dias
          console.log(`🔄 RENOVAÇÃO CONFIRMADA! Estendendo vencimento do Tenant ${dbPayment.tenant_id} em 30 dias`);
          
          await pool.query(`
            UPDATE tenants
            SET
              status = 'active',
              is_trial = false,
              trial_ends_at = NULL,
              blocked_at = NULL,
              will_be_deleted_at = NULL,
              proximo_vencimento = COALESCE(proximo_vencimento, NOW()) + INTERVAL '30 days',
              data_ativacao = COALESCE(data_ativacao, NOW()),
              updated_at = NOW()
            WHERE id = $1
          `, [dbPayment.tenant_id]);
          
          console.log(`✅ Tenant ${dbPayment.tenant_id} SAIU DO TRIAL - Renovação PAGA confirmada`);
          
        } else {
          // PRIMEIRO PAGAMENTO ou PRIMEIRA COMPRA: Libera acesso, define plano e vencimento de 30 dias
          console.log(`🎉 PRIMEIRO PAGAMENTO! Ativando Tenant ${dbPayment.tenant_id} com plano ${dbPayment.plan_id}`);
          
          await pool.query(`
            UPDATE tenants
            SET
              plan_id = $1,
              status = 'active',
              is_trial = false,
              trial_ends_at = NULL,
              blocked_at = NULL,
              will_be_deleted_at = NULL,
              plano = (SELECT slug FROM plans WHERE id = $1),
              proximo_vencimento = NOW() + INTERVAL '30 days',
              data_ativacao = COALESCE(data_ativacao, NOW()),
              updated_at = NOW()
            WHERE id = $2
          `, [dbPayment.plan_id, dbPayment.tenant_id]);
          
          console.log(`✅ Tenant ${dbPayment.tenant_id} SAIU DO TRIAL - Primeiro pagamento confirmado!`);
        }

        // Buscar dados do tenant e plano para atualizar limites
        const planResult = await pool.query('SELECT * FROM plans WHERE id = $1', [dbPayment.plan_id]);
        
        if (planResult.rows.length > 0) {
          const plan = planResult.rows[0];
          
          // Atualizar limites do tenant baseado no plano
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
            dbPayment.tenant_id
          ]);
        }

          console.log(`✅ PAGAMENTO CONFIRMADO! Tenant ${dbPayment.tenant_id} liberado - Plano ${dbPayment.plan_id}`);

          // TODO: Enviar email de confirmação
      }

      // Eventos de falha
      if (event === 'PAYMENT_OVERDUE') {
        const paymentResult = await pool.query(
          'SELECT * FROM payments WHERE asaas_payment_id = $1',
          [payment.id]
        );

        if (paymentResult.rows.length > 0) {
          await pool.query(
            'UPDATE payments SET status = $1 WHERE asaas_payment_id = $2',
            ['overdue', payment.id]
          );

          console.log(`⚠️ Pagamento vencido: ${payment.id}`);
          // TODO: Notificar tenant
        }
      }

      return res.json({ received: true });

    } catch (error: any) {
      console.error('❌ Erro ao processar webhook:', error);
      // Sempre retornar sucesso para o Asaas, mas logar o erro
      return res.json({ received: true, error: error.message });
    }
  }

  /**
   * GET /api/payments/calculate-upgrade
   * Calcular valor proporcional para upgrade de plano
   */
  async calculateUpgrade(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant.id;
      const { new_plan_id } = req.query;

      console.log(`🔍 [calculateUpgrade] Tenant: ${tenantId}, Novo Plano ID: ${new_plan_id}`);

      if (!new_plan_id) {
        console.log('❌ [calculateUpgrade] ID do novo plano não fornecido');
        return res.status(400).json({
          success: false,
          message: 'ID do novo plano é obrigatório'
        });
      }

      // Buscar dados do tenant atual
      const tenantResult = await pool.query(`
        SELECT 
          t.id, t.plan_id, t.proximo_vencimento,
          p_atual.id as plano_atual_id,
          p_atual.nome as plano_atual_nome,
          p_atual.preco_mensal as plano_atual_preco,
          p_novo.id as plano_novo_id,
          p_novo.nome as plano_novo_nome,
          p_novo.preco_mensal as plano_novo_preco
        FROM tenants t
        LEFT JOIN plans p_atual ON t.plan_id = p_atual.id
        LEFT JOIN plans p_novo ON p_novo.id = $2
        WHERE t.id = $1
      `, [tenantId, new_plan_id]);

      if (tenantResult.rows.length === 0) {
        console.log('❌ [calculateUpgrade] Tenant ou plano não encontrado');
        return res.status(404).json({
          success: false,
          message: 'Tenant ou plano não encontrado'
        });
      }

      const tenant = tenantResult.rows[0];
      console.log(`📊 [calculateUpgrade] Dados: plan_id atual=${tenant.plan_id}, plano_novo_id=${tenant.plano_novo_id}, plano_novo_nome=${tenant.plano_novo_nome}`);

      // Verificar se o novo plano existe
      if (!tenant.plano_novo_id) {
        console.log('❌ [calculateUpgrade] Plano de destino não encontrado');
        return res.status(404).json({
          success: false,
          message: 'Plano de destino não encontrado'
        });
      }

      // Se o tenant não tem plano atual, é uma primeira compra (não é upgrade)
      if (!tenant.plano_atual_id) {
        console.log(`✅ [calculateUpgrade] Primeira compra detectada - Plano: ${tenant.plano_novo_nome} (R$ ${tenant.plano_novo_preco})`);
        return res.json({
          success: true,
          data: {
            is_upgrade: false,
            is_first_purchase: true,
            plano_atual: null,
            plano_novo: {
              id: tenant.plano_novo_id,
              nome: tenant.plano_novo_nome,
              preco_mensal: Number(tenant.plano_novo_preco)
            },
            dias_restantes: 0,
            proximo_vencimento: null,
            valor_proporcional: 0,
            mensagem: `Você será cobrado R$ ${Number(tenant.plano_novo_preco).toFixed(2)} e o plano ${tenant.plano_novo_nome} será ativado após a confirmação do pagamento.`
          }
        });
      }

      // Verificar se é o mesmo plano
      if (tenant.plano_atual_id === tenant.plano_novo_id) {
        console.log(`⚠️ [calculateUpgrade] Tentativa de mudar para o mesmo plano atual`);
        return res.status(400).json({
          success: false,
          message: 'Você já está neste plano'
        });
      }

      // Calcular dias restantes até o vencimento
      const hoje = new Date();
      const vencimento = tenant.proximo_vencimento ? new Date(tenant.proximo_vencimento) : null;
      
      console.log(`📅 [calculateUpgrade] Vencimento: ${vencimento}, Hoje: ${hoje}`);
      
      // Se não tem vencimento (trial ou novo), tratar como primeira compra
      if (!vencimento) {
        console.log(`✅ [calculateUpgrade] Tenant sem vencimento (trial/novo) - Tratando como primeira compra`);
        return res.json({
          success: true,
          data: {
            is_upgrade: false,
            is_first_purchase: true,
            plano_atual: tenant.plano_atual_id ? {
              id: tenant.plano_atual_id,
              nome: tenant.plano_atual_nome,
              preco_mensal: Number(tenant.plano_atual_preco)
            } : null,
            plano_novo: {
              id: tenant.plano_novo_id,
              nome: tenant.plano_novo_nome,
              preco_mensal: Number(tenant.plano_novo_preco)
            },
            dias_restantes: 0,
            proximo_vencimento: null,
            valor_proporcional: Number(tenant.plano_novo_preco),
            mensagem: `Você será cobrado R$ ${Number(tenant.plano_novo_preco).toFixed(2)} e o plano ${tenant.plano_novo_nome} será ativado após a confirmação do pagamento.`
          }
        });
      }

      const diasRestantes = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`⏰ [calculateUpgrade] Dias restantes: ${diasRestantes}`);

      // Se já venceu, tratar como renovação/primeira compra
      if (diasRestantes <= 0) {
        console.log(`⚠️ [calculateUpgrade] Plano vencido - Tratando como renovação completa`);
        return res.json({
          success: true,
          data: {
            is_upgrade: false,
            is_first_purchase: false,
            plano_atual: {
              id: tenant.plano_atual_id,
              nome: tenant.plano_atual_nome,
              preco_mensal: Number(tenant.plano_atual_preco)
            },
            plano_novo: {
              id: tenant.plano_novo_id,
              nome: tenant.plano_novo_nome,
              preco_mensal: Number(tenant.plano_novo_preco)
            },
            dias_restantes: 0,
            proximo_vencimento: vencimento,
            valor_proporcional: Number(tenant.plano_novo_preco),
            mensagem: `Seu plano está vencido. Você será cobrado R$ ${Number(tenant.plano_novo_preco).toFixed(2)} para ativar o plano ${tenant.plano_novo_nome}.`
          }
        });
      }

      // Determinar se é upgrade ou downgrade
      const precoAtual = Number(tenant.plano_atual_preco);
      const precoNovo = Number(tenant.plano_novo_preco);
      const isUpgrade = precoNovo > precoAtual;

      let valorProporcional = 0;
      let mensagem = '';

      if (isUpgrade) {
        // UPGRADE: Cobra diferença proporcional AGORA
        const diferencaMensal = precoNovo - precoAtual;
        valorProporcional = (diferencaMensal / 30) * diasRestantes;
        mensagem = `Você pagará R$ ${valorProporcional.toFixed(2)} agora (diferença proporcional por ${diasRestantes} dias) e mudará IMEDIATAMENTE para o plano ${tenant.plano_novo_nome}.`;
        console.log(`⬆️ [calculateUpgrade] UPGRADE: ${tenant.plano_atual_nome} → ${tenant.plano_novo_nome}, Valor: R$ ${valorProporcional.toFixed(2)}`);
      } else {
        // DOWNGRADE: Apenas agenda para próximo vencimento
        valorProporcional = 0;
        mensagem = `A mudança para o plano ${tenant.plano_novo_nome} será aplicada no próximo vencimento (${vencimento.toLocaleDateString('pt-BR')}). Você não será cobrado agora e continuará usando o plano atual até lá.`;
        console.log(`⬇️ [calculateUpgrade] DOWNGRADE: ${tenant.plano_atual_nome} → ${tenant.plano_novo_nome}, Agendado para ${vencimento.toLocaleDateString('pt-BR')}`);
      }

      console.log(`✅ [calculateUpgrade] Cálculo concluído com sucesso`);
      return res.json({
        success: true,
        data: {
          is_upgrade: isUpgrade,
          plano_atual: {
            id: tenant.plano_atual_id,
            nome: tenant.plano_atual_nome,
            preco_mensal: precoAtual
          },
          plano_novo: {
            id: tenant.plano_novo_id,
            nome: tenant.plano_novo_nome,
            preco_mensal: precoNovo
          },
          dias_restantes: diasRestantes,
          proximo_vencimento: vencimento,
          valor_proporcional: valorProporcional,
          mensagem: mensagem
        }
      });

    } catch (error: any) {
      console.error('❌ [calculateUpgrade] Erro ao calcular upgrade:', error);
      console.error('❌ [calculateUpgrade] Stack:', error.stack);
      return res.status(500).json({
        success: false,
        message: 'Erro ao calcular upgrade',
        error: error.message
      });
    }
  }

  /**
   * POST /api/payments/upgrade
   * Processar upgrade de plano (gera cobrança proporcional)
   */
  async processUpgrade(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant.id;
      const { new_plan_id, billing_type } = req.body;

      if (!new_plan_id || !billing_type) {
        return res.status(400).json({
          success: false,
          message: 'ID do novo plano e forma de pagamento são obrigatórios'
        });
      }

      if (!['BOLETO', 'PIX'].includes(billing_type)) {
        return res.status(400).json({
          success: false,
          message: 'Forma de pagamento inválida (use BOLETO ou PIX)'
        });
      }

      // Buscar dados do tenant
      const tenantResult = await pool.query(`
        SELECT 
          t.*, 
          p_atual.preco_mensal as plano_atual_preco,
          p_novo.id as plano_novo_id,
          p_novo.nome as plano_novo_nome,
          p_novo.preco_mensal as plano_novo_preco
        FROM tenants t
        LEFT JOIN plans p_atual ON t.plan_id = p_atual.id
        LEFT JOIN plans p_novo ON p_novo.id = $2
        WHERE t.id = $1
      `, [tenantId, new_plan_id]);

      if (tenantResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Tenant ou plano não encontrado'
        });
      }

      const tenant = tenantResult.rows[0];

      const precoAtual = Number(tenant.plano_atual_preco) || 0;
      const precoNovo = Number(tenant.plano_novo_preco);
      const isFirstPurchase = !tenant.plan_id;

      // ✅ VALIDAR se o uso atual do tenant cabe no plano escolhido
      // Isso é especialmente importante para tenant bloqueado escolhendo plano em /escolher-plano
      console.log(`🔍 [VALIDAÇÃO - ESCOLHA DE PLANO] Verificando uso do Tenant ${tenantId}...`);
      const validation = await this.validateTenantUsage(tenantId, new_plan_id);

      if (!validation.valid) {
        console.log(`❌ Escolha de plano BLOQUEADA - Uso excede limites do plano ${tenant.plano_novo_nome}`);
        return res.status(400).json({
          success: false,
          message: `❌ Você não pode selecionar o plano ${tenant.plano_novo_nome}`,
          details: {
            message: 'Você está usando mais recursos do que o plano permite:',
            errors: validation.errors,
            action: isFirstPurchase 
              ? 'Por favor, escolha um plano maior ou reduza seu uso antes de continuar.'
              : 'Por favor, escolha um plano maior ou use o downgrade para planos menores.'
          }
        });
      }

      console.log(`✅ Validação passou - Uso atual cabe no plano ${tenant.plano_novo_nome}`);

      let valorProporcional = precoNovo; // Valor padrão para primeira compra
      let diasRestantes = 0;

      if (!isFirstPurchase) {
        // Validar que é upgrade (não downgrade) - apenas se já tiver um plano
        if (precoNovo <= precoAtual) {
          return res.status(400).json({
            success: false,
            message: 'Este não é um upgrade. Para downgrade, use o endpoint apropriado.'
          });
        }

        // Calcular valor proporcional
        const hoje = new Date();
        const vencimento = new Date(tenant.proximo_vencimento);
        diasRestantes = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

        if (diasRestantes <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Plano vencido. Faça a renovação primeiro.'
          });
        }

        const diferencaMensal = precoNovo - precoAtual;
        valorProporcional = (diferencaMensal / 30) * diasRestantes;
      }

      // Verificar se Asaas está configurado
      if (!(await asaasService.isConfigured(tenantId))) {
        return res.status(500).json({
          success: false,
          message: 'Sistema de pagamentos não configurado'
        });
      }

      // Criar/buscar cliente no Asaas
      let asaasCustomer = null;
      
      if (tenant.asaas_customer_id) {
        asaasCustomer = { id: tenant.asaas_customer_id };
      } else {
        asaasCustomer = await asaasService.createCustomer({
          name: tenant.nome,
          email: tenant.email,
          cpfCnpj: tenant.documento || undefined,
          phone: tenant.telefone || undefined
        }, tenantId);

        await pool.query(
          'UPDATE tenants SET asaas_customer_id = $1 WHERE id = $2',
          [asaasCustomer.id, tenantId]
        );
      }

      // Criar cobrança no Asaas
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3); // Vencimento em 3 dias

      const description = isFirstPurchase 
        ? `${tenant.plano_novo_nome} - Primeira assinatura`
        : `Upgrade para ${tenant.plano_novo_nome} - Valor proporcional (${diasRestantes} dias)`;

      const externalReference = isFirstPurchase
        ? `tenant_${tenantId}_first_${new_plan_id}`
        : `tenant_${tenantId}_upgrade_${new_plan_id}`;

      const asaasPayment = await asaasService.createPayment({
        customer: asaasCustomer.id,
        billingType: billing_type as any,
        value: Number(valorProporcional.toFixed(2)),
        dueDate: dueDate.toISOString().split('T')[0],
        description: description,
        externalReference: externalReference
      }, tenantId);

      // Salvar cobrança no banco
      const paymentInsert = await pool.query(`
        INSERT INTO payments (
          tenant_id, plan_id, asaas_payment_id, asaas_customer_id,
          valor, payment_type, status, due_date,
          asaas_invoice_url, asaas_bank_slip_url,
          asaas_pix_qr_code, asaas_pix_copy_paste,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        tenantId,
        new_plan_id,
        asaasPayment.id,
        asaasCustomer.id,
        valorProporcional.toFixed(2),
        billing_type,
        asaasPayment.status,
        dueDate,
        asaasPayment.invoiceUrl,
        asaasPayment.bankSlipUrl,
        asaasPayment.pixQrCodeUrl || asaasPayment.qrCode?.payload,
        asaasPayment.pixCopyAndPaste || asaasPayment.qrCode?.encodedImage,
        JSON.stringify({ 
          tipo: isFirstPurchase ? 'primeira_compra' : 'upgrade',
          plano_anterior_id: tenant.plan_id,
          dias_proporcionais: diasRestantes 
        })
      ]);

      const payment = paymentInsert.rows[0];

      const logMessage = isFirstPurchase
        ? `✅ Primeira compra criada: Tenant ${tenantId} - ${tenant.plano_novo_nome} - R$ ${valorProporcional.toFixed(2)}`
        : `✅ Upgrade criado: Tenant ${tenantId} - ${tenant.plano_novo_nome} - R$ ${valorProporcional.toFixed(2)}`;
      
      console.log(logMessage);

      return res.json({
        success: true,
        message: 'Cobrança de upgrade gerada com sucesso',
        payment: {
          id: payment.id,
          valor: payment.valor,
          due_date: payment.due_date,
          payment_type: payment.payment_type,
          invoice_url: payment.asaas_invoice_url,
          bank_slip_url: payment.asaas_bank_slip_url,
          pix_qr_code: payment.asaas_pix_qr_code,
          pix_copy_paste: payment.asaas_pix_copy_paste
        },
        plano_novo: {
          nome: tenant.plano_novo_nome,
          preco: precoNovo
        },
        dias_proporcionais: diasRestantes,
        valor_proporcional: valorProporcional
      });

    } catch (error: any) {
      console.error('❌ Erro ao processar upgrade:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao processar upgrade',
        error: error.message
      });
    }
  }

  /**
   * Validar se o uso atual do tenant cabe nos limites do plano
   * Retorna { valid: boolean, errors: string[] }
   */
  async validateTenantUsage(tenantId: number, planId: number): Promise<{ valid: boolean; errors: string[] }> {
    try {
      // Buscar limites do plano
      const planResult = await pool.query(`
        SELECT 
          nome,
          limite_usuarios,
          limite_contas_whatsapp,
          limite_campanhas_mes
        FROM plans
        WHERE id = $1
      `, [planId]);

      if (planResult.rows.length === 0) {
        return { valid: false, errors: ['Plano não encontrado'] };
      }

      const plan = planResult.rows[0];
      const errors: string[] = [];

      // 1. Validar número de usuários ativos
      const usersResult = await pool.query(`
        SELECT COUNT(*) as total
        FROM users
        WHERE tenant_id = $1 AND ativo = true
      `, [tenantId]);
      const totalUsers = parseInt(usersResult.rows[0].total);
      
      if (totalUsers > plan.limite_usuarios) {
        errors.push(`${totalUsers} usuários ativos (plano permite ${plan.limite_usuarios})`);
      }

      // 2. Validar número de conexões WhatsApp ativas
      const whatsappResult = await pool.query(`
        SELECT COUNT(*) as total
        FROM whatsapp_connections
        WHERE tenant_id = $1 AND status = 'connected'
      `, [tenantId]);
      const totalWhatsApp = parseInt(whatsappResult.rows[0].total);
      
      if (totalWhatsApp > plan.limite_contas_whatsapp) {
        errors.push(`${totalWhatsApp} conexões WhatsApp ativas (plano permite ${plan.limite_contas_whatsapp})`);
      }

      // 3. Validar campanhas ativas/agendadas
      const campaignsResult = await pool.query(`
        SELECT COUNT(*) as total
        FROM campaigns
        WHERE tenant_id = $1 AND status IN ('running', 'scheduled')
      `, [tenantId]);
      const totalCampaigns = parseInt(campaignsResult.rows[0].total);
      
      if (totalCampaigns > plan.limite_campanhas_mes) {
        errors.push(`${totalCampaigns} campanhas ativas/agendadas (plano permite ${plan.limite_campanhas_mes})`);
      }

      console.log(`🔍 Validação de uso - Tenant ${tenantId} → Plano ${plan.nome}:`);
      console.log(`  - Usuários: ${totalUsers}/${plan.limite_usuarios} ${totalUsers > plan.limite_usuarios ? '❌' : '✅'}`);
      console.log(`  - WhatsApp: ${totalWhatsApp}/${plan.limite_contas_whatsapp} ${totalWhatsApp > plan.limite_contas_whatsapp ? '❌' : '✅'}`);
      console.log(`  - Campanhas: ${totalCampaigns}/${plan.limite_campanhas_mes} ${totalCampaigns > plan.limite_campanhas_mes ? '❌' : '✅'}`);

      return {
        valid: errors.length === 0,
        errors: errors
      };

    } catch (error: any) {
      console.error('❌ Erro ao validar uso do tenant:', error);
      return { valid: false, errors: ['Erro ao validar uso atual'] };
    }
  }

  /**
   * POST /api/payments/downgrade
   * Agendar downgrade de plano (aplica no próximo vencimento)
   */
  async scheduleDowngrade(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant.id;
      const { new_plan_id } = req.body;

      if (!new_plan_id) {
        return res.status(400).json({
          success: false,
          message: 'ID do novo plano é obrigatório'
        });
      }

      // Buscar dados do tenant
      const tenantResult = await pool.query(`
        SELECT 
          t.*, 
          p_atual.preco_mensal as plano_atual_preco,
          p_atual.nome as plano_atual_nome,
          p_novo.id as plano_novo_id,
          p_novo.nome as plano_novo_nome,
          p_novo.preco_mensal as plano_novo_preco
        FROM tenants t
        LEFT JOIN plans p_atual ON t.plan_id = p_atual.id
        LEFT JOIN plans p_novo ON p_novo.id = $2
        WHERE t.id = $1
      `, [tenantId, new_plan_id]);

      if (tenantResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Tenant ou plano não encontrado'
        });
      }

      const tenant = tenantResult.rows[0];

      // Validar que é downgrade (não upgrade)
      const precoAtual = Number(tenant.plano_atual_preco);
      const precoNovo = Number(tenant.plano_novo_preco);

      if (precoNovo >= precoAtual) {
        return res.status(400).json({
          success: false,
          message: 'Este não é um downgrade. Para upgrade, use o endpoint apropriado.'
        });
      }

      // ✅ VALIDAÇÃO 1: Verificar se o uso atual cabe no novo plano
      console.log(`🔍 [VALIDAÇÃO 1 - AGENDAMENTO] Verificando uso do Tenant ${tenantId} para downgrade...`);
      const validation = await this.validateTenantUsage(tenantId, new_plan_id);

      if (!validation.valid) {
        console.log(`❌ Downgrade BLOQUEADO - Uso excede limites do plano ${tenant.plano_novo_nome}`);
        return res.status(400).json({
          success: false,
          message: `❌ Não é possível fazer downgrade para o plano ${tenant.plano_novo_nome}`,
          details: {
            message: 'Você está usando mais recursos do que o plano permite:',
            errors: validation.errors,
            action: 'Por favor, desative os recursos excedentes antes de fazer o downgrade.'
          }
        });
      }

      console.log(`✅ Validação passou - Uso atual cabe no plano ${tenant.plano_novo_nome}`);

      // Agendar mudança de plano
      await pool.query(
        'UPDATE tenants SET plan_change_scheduled_id = $1 WHERE id = $2',
        [new_plan_id, tenantId]
      );

      console.log(`📅 Downgrade agendado: Tenant ${tenantId} - ${tenant.plano_atual_nome} → ${tenant.plano_novo_nome} no próximo vencimento`);

      return res.json({
        success: true,
        message: `Downgrade agendado! Você continuará usando o plano ${tenant.plano_atual_nome} até ${new Date(tenant.proximo_vencimento).toLocaleDateString('pt-BR')}. Após essa data, seu plano mudará automaticamente para ${tenant.plano_novo_nome}.`,
        data: {
          plano_atual: {
            nome: tenant.plano_atual_nome,
            preco: precoAtual
          },
          plano_novo: {
            nome: tenant.plano_novo_nome,
            preco: precoNovo
          },
          proximo_vencimento: tenant.proximo_vencimento,
          economia_mensal: precoAtual - precoNovo
        }
      });

    } catch (error: any) {
      console.error('❌ Erro ao agendar downgrade:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao agendar downgrade',
        error: error.message
      });
    }
  }

  /**
   * POST /api/payments/renew
   * Renovar plano atual (mesmo plano, estende por mais 30 dias)
   */
  async renewPlan(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant.id;
      const { billing_type } = req.body;

      if (!billing_type || !['BOLETO', 'PIX'].includes(billing_type)) {
        return res.status(400).json({
          success: false,
          message: 'Forma de pagamento inválida (use BOLETO ou PIX)'
        });
      }

      // Buscar dados do tenant e plano atual
      const tenantResult = await pool.query(`
        SELECT 
          t.*, 
          p.nome as plano_nome,
          p.preco_mensal,
          p.preco_anual
        FROM tenants t
        LEFT JOIN plans p ON t.plan_id = p.id
        WHERE t.id = $1
      `, [tenantId]);

      if (tenantResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Tenant não encontrado'
        });
      }

      const tenant = tenantResult.rows[0];

      if (!tenant.plan_id) {
        return res.status(400).json({
          success: false,
          message: 'Tenant não possui plano ativo'
        });
      }

      // Verificar se Asaas está configurado
      if (!(await asaasService.isConfigured(tenantId))) {
        return res.status(500).json({
          success: false,
          message: 'Sistema de pagamentos não configurado'
        });
      }

      // Criar/buscar cliente no Asaas
      let asaasCustomer = null;
      
      if (tenant.asaas_customer_id) {
        asaasCustomer = { id: tenant.asaas_customer_id };
      } else {
        asaasCustomer = await asaasService.createCustomer({
          name: tenant.nome,
          email: tenant.email,
          cpfCnpj: tenant.documento || undefined,
          phone: tenant.telefone || undefined
        }, tenantId);

        await pool.query(
          'UPDATE tenants SET asaas_customer_id = $1 WHERE id = $2',
          [asaasCustomer.id, tenantId]
        );
      }

      // Criar cobrança no Asaas
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3); // Vencimento em 3 dias
      const valorMensal = Number(tenant.preco_mensal);

      const asaasPayment = await asaasService.createPayment({
        customer: asaasCustomer.id,
        billingType: billing_type as any,
        value: valorMensal,
        dueDate: dueDate.toISOString().split('T')[0],
        description: `Renovação - ${tenant.plano_nome} (30 dias)`,
        externalReference: `tenant_${tenantId}_renewal_${tenant.plan_id}`
      }, tenantId);

      // Log detalhado da resposta do Asaas para debug
      console.log('📦 Resposta completa do Asaas:');
      console.log('   - ID:', asaasPayment.id);
      console.log('   - Status:', asaasPayment.status);
      console.log('   - Invoice URL:', asaasPayment.invoiceUrl);
      console.log('   - Bank Slip URL:', asaasPayment.bankSlipUrl);
      console.log('   - PIX QR Code URL:', asaasPayment.encodedImage);
      console.log('   - PIX Copy/Paste:', asaasPayment.payload);
      console.log('   - Objeto completo:', JSON.stringify(asaasPayment, null, 2));

      // Para PIX, buscar os dados do QR Code em um endpoint específico
      let pixQrCode = asaasPayment.encodedImage || asaasPayment.qrCode?.encodedImage || asaasPayment.pixQrCodeUrl || null;
      let pixCopyPaste = asaasPayment.payload || asaasPayment.qrCode?.payload || asaasPayment.pixCopyAndPaste || null;

      if (billing_type === 'PIX' && !pixQrCode && !pixCopyPaste) {
        console.log('🔍 Dados do PIX não retornados na criação. Buscando...');
        const pixData = await asaasService.getPixQrCode(asaasPayment.id, tenantId);
        if (pixData) {
          pixQrCode = pixData.encodedImage;
          pixCopyPaste = pixData.payload;
          console.log('✅ Dados do PIX obtidos:', {
            qrCode: pixQrCode ? 'SIM' : 'NÃO',
            copyPaste: pixCopyPaste ? 'SIM' : 'NÃO'
          });
        } else {
          console.log('⚠️ Não foi possível obter os dados do PIX no momento');
        }
      }

      // Salvar cobrança no banco

      const paymentInsert = await pool.query(`
        INSERT INTO payments (
          tenant_id, plan_id, asaas_payment_id, asaas_customer_id,
          valor, payment_type, status, due_date,
          asaas_invoice_url, asaas_bank_slip_url,
          asaas_pix_qr_code, asaas_pix_copy_paste,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        tenantId,
        tenant.plan_id,
        asaasPayment.id,
        asaasCustomer.id,
        valorMensal.toFixed(2),
        billing_type,
        asaasPayment.status,
        dueDate,
        asaasPayment.invoiceUrl,
        asaasPayment.bankSlipUrl,
        pixQrCode,
        pixCopyPaste,
        JSON.stringify({ 
          tipo: 'renovacao',
          plano_id: tenant.plan_id
        })
      ]);

      console.log('💾 Dados do PIX salvos:');
      console.log('   - QR Code:', pixQrCode ? 'SIM' : 'NÃO');
      console.log('   - Copia e Cola:', pixCopyPaste ? 'SIM' : 'NÃO');

      const payment = paymentInsert.rows[0];

      console.log(`🔄 Renovação criada: Tenant ${tenantId} - ${tenant.plano_nome} - R$ ${valorMensal.toFixed(2)}`);

      return res.json({
        success: true,
        message: 'Cobrança de renovação gerada com sucesso',
        payment: {
          id: payment.id,
          valor: payment.valor,
          due_date: payment.due_date,
          payment_type: payment.payment_type,
          invoice_url: payment.asaas_invoice_url,
          bank_slip_url: payment.asaas_bank_slip_url,
          pix_qr_code: payment.asaas_pix_qr_code,
          pix_copy_paste: payment.asaas_pix_copy_paste
        },
        plano: {
          nome: tenant.plano_nome,
          preco: valorMensal
        }
      });

    } catch (error: any) {
      console.error('❌ Erro ao processar renovação:', error);
      
      // Verificar se é erro do Asaas
      if (error.response?.data?.errors) {
        const asaasError = error.response.data.errors[0];
        let userMessage = 'Erro ao processar pagamento';
        
        if (asaasError.code === 'invalid_access_token') {
          userMessage = 'Sistema de pagamentos não está configurado corretamente. Entre em contato com o suporte.';
        } else if (asaasError.description) {
          userMessage = asaasError.description;
        }
        
        return res.status(500).json({
          success: false,
          message: userMessage,
          error: asaasError.description || error.message
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Erro ao processar renovação. Por favor, tente novamente ou entre em contato com o suporte.',
        error: error.message
      });
    }
  }

  /**
   * GET /api/payments/:id
   * Buscar dados completos de um pagamento
   */
  async getPayment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = (req as any).tenant?.id;

      if (!tenantId) {
        return res.status(401).json({
          success: false,
          message: 'Tenant não identificado'
        });
      }

      console.log(`🔍 Buscando pagamento ID: ${id} - Tenant: ${tenantId}`);

      // Buscar pagamento no banco
      const paymentResult = await pool.query(
        `SELECT * FROM payments WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId]
      );

      if (paymentResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Pagamento não encontrado'
        });
      }

      const payment = paymentResult.rows[0];

      // Se for PIX e não tiver QR Code, tentar buscar no Asaas
      if (payment.payment_type === 'PIX' && (!payment.asaas_pix_qr_code || !payment.asaas_pix_copy_paste)) {
        console.log('🔄 Tentando buscar dados do PIX no Asaas...');
        
        const pixData = await asaasService.getPixQrCode(payment.asaas_payment_id, tenantId);
        
        if (pixData && (pixData.encodedImage || pixData.payload)) {
          console.log('✅ Dados do PIX obtidos do Asaas');
          
          // Atualizar no banco
          await pool.query(
            `UPDATE payments 
             SET asaas_pix_qr_code = $1, asaas_pix_copy_paste = $2, updated_at = NOW()
             WHERE id = $3`,
            [pixData.encodedImage || payment.asaas_pix_qr_code, pixData.payload || payment.asaas_pix_copy_paste, id]
          );

          payment.asaas_pix_qr_code = pixData.encodedImage || payment.asaas_pix_qr_code;
          payment.asaas_pix_copy_paste = pixData.payload || payment.asaas_pix_copy_paste;
        }
      }

      return res.json({
        success: true,
        payment: {
          id: payment.id,
          valor: payment.valor,
          due_date: payment.due_date,
          payment_type: payment.payment_type,
          status: payment.status,
          invoice_url: payment.asaas_invoice_url,
          bank_slip_url: payment.asaas_bank_slip_url,
          pix_qr_code: payment.asaas_pix_qr_code,
          pix_copy_paste: payment.asaas_pix_copy_paste
        }
      });

    } catch (error: any) {
      console.error('❌ Erro ao buscar pagamento:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao buscar pagamento',
        error: error.message
      });
    }
  }

  /**
   * Atualizar dados do PIX de um pagamento existente
   */
  async updatePixData(req: Request, res: Response) {
    try {
      const { paymentId } = req.params;
      const tenantId = (req as any).userId;

      console.log(`🔄 Atualizando dados do PIX: Payment ${paymentId} - Tenant ${tenantId}`);

      // Buscar pagamento no banco
      const paymentResult = await pool.query(
        'SELECT * FROM payments WHERE id = $1 AND tenant_id = $2',
        [paymentId, tenantId]
      );

      if (paymentResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Pagamento não encontrado'
        });
      }

      const payment = paymentResult.rows[0];

      if (payment.payment_type !== 'PIX') {
        return res.status(400).json({
          success: false,
          message: 'Este pagamento não é do tipo PIX'
        });
      }

      // Buscar dados do PIX no Asaas
      const pixData = await asaasService.getPixQrCode(payment.asaas_payment_id, tenantId);

      if (!pixData || (!pixData.encodedImage && !pixData.payload)) {
        return res.status(400).json({
          success: false,
          message: 'Dados do PIX ainda não disponíveis. Tente novamente em alguns instantes.'
        });
      }

      // Atualizar no banco
      const updateResult = await pool.query(`
        UPDATE payments
        SET 
          asaas_pix_qr_code = $1,
          asaas_pix_copy_paste = $2,
          updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `, [pixData.encodedImage, pixData.payload, paymentId]);

      const updatedPayment = updateResult.rows[0];

      console.log('✅ Dados do PIX atualizados com sucesso');

      return res.json({
        success: true,
        message: 'Dados do PIX atualizados com sucesso',
        payment: {
          id: updatedPayment.id,
          valor: updatedPayment.valor,
          due_date: updatedPayment.due_date,
          payment_type: updatedPayment.payment_type,
          invoice_url: updatedPayment.asaas_invoice_url,
          bank_slip_url: updatedPayment.asaas_bank_slip_url,
          pix_qr_code: updatedPayment.asaas_pix_qr_code,
          pix_copy_paste: updatedPayment.asaas_pix_copy_paste
        }
      });

    } catch (error: any) {
      console.error('❌ Erro ao atualizar dados do PIX:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao atualizar dados do PIX',
        error: error.message
      });
    }
  }

  /**
   * POST /api/payments/sync
   * Sincronizar pagamentos pendentes com Asaas
   */
  async syncPayments(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant.id;
      
      console.log(`🔄 Sincronizando pagamentos do tenant ${tenantId}...`);

      // Buscar todos os pagamentos pendentes do tenant
      const pendingPayments = await pool.query(
        `SELECT * FROM payments 
         WHERE tenant_id = $1 
         AND status IN ('pending', 'PENDING')
         AND asaas_payment_id IS NOT NULL`,
        [tenantId]
      );

      let updatedCount = 0;

      // Para cada pagamento pendente, verificar status no Asaas
      for (const payment of pendingPayments.rows) {
        try {
          console.log(`📊 Verificando pagamento ${payment.asaas_payment_id}...`);
          
          // Buscar status no Asaas
          const asaasPayment = await asaasService.getPayment(payment.asaas_payment_id, tenantId);
          
          if (!asaasPayment) {
            console.log(`⚠️  Pagamento ${payment.asaas_payment_id} não encontrado no Asaas`);
            continue;
          }

          // Se o status mudou, atualizar no banco
          if (asaasPayment.status !== payment.status) {
            console.log(`✅ Atualizando status: ${payment.status} → ${asaasPayment.status}`);
            
            await pool.query(
              `UPDATE payments 
               SET status = $1::text, 
                   updated_at = CURRENT_TIMESTAMP,
                   confirmed_at = CASE WHEN $1::text IN ('CONFIRMED', 'RECEIVED') THEN CURRENT_TIMESTAMP ELSE confirmed_at END
               WHERE id = $2::integer`,
              [asaasPayment.status, payment.id]
            );

            updatedCount++;

            // Se foi confirmado, ativar o tenant
            if (asaasPayment.status === 'CONFIRMED' || asaasPayment.status === 'confirmed') {
              console.log(`🎉 Pagamento confirmado! Ativando tenant ${tenantId}...`);
              
              // Buscar tenant
              const tenantResult = await pool.query(
                'SELECT * FROM tenants WHERE id = $1',
                [tenantId]
              );

              if (tenantResult.rows.length > 0) {
                const tenant = tenantResult.rows[0];
                
                // Calcular nova data de vencimento
                const today = new Date();
                const newExpiry = new Date(today);
                newExpiry.setDate(newExpiry.getDate() + 30);

                // Atualizar tenant
                await pool.query(
                  `UPDATE tenants 
                   SET status = 'active'::text,
                       proximo_vencimento = $1::timestamp,
                       blocked_at = NULL,
                       will_be_deleted_at = NULL,
                       updated_at = CURRENT_TIMESTAMP
                   WHERE id = $2::integer`,
                  [newExpiry, tenantId]
                );

                console.log(`✅ Tenant ${tenantId} ativado até ${newExpiry.toISOString()}`);
              }
            }
          }
        } catch (error: any) {
          console.error(`❌ Erro ao verificar pagamento ${payment.id}:`, error.message);
          // Continuar com os próximos
        }
      }

      console.log(`✅ Sincronização concluída: ${updatedCount} pagamento(s) atualizado(s)`);

      return res.json({
        success: true,
        updated: updatedCount,
        message: `${updatedCount} pagamento(s) atualizado(s)`
      });

    } catch (error: any) {
      console.error('❌ Erro ao sincronizar pagamentos:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao sincronizar pagamentos',
        error: error.message
      });
    }
  }

  /**
   * POST /api/payments/:id/mark-as-paid
   * Marcar pagamento como pago manualmente
   */
  async markAsPaid(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant.id;
      const paymentId = parseInt(req.params.id);

      console.log(`💰 Marcando pagamento ${paymentId} como pago manualmente...`);

      // Buscar pagamento
      const paymentResult = await pool.query(
        'SELECT * FROM payments WHERE id = $1 AND tenant_id = $2',
        [paymentId, tenantId]
      );

      if (paymentResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Pagamento não encontrado'
        });
      }

      const payment = paymentResult.rows[0];

      // Verificar se já está pago
      if (payment.status === 'CONFIRMED' || payment.status === 'confirmed') {
        return res.status(400).json({
          success: false,
          message: 'Este pagamento já está marcado como pago'
        });
      }

      // Atualizar status do pagamento
      await pool.query(
        `UPDATE payments 
         SET status = 'CONFIRMED'::text,
             confirmed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1::integer`,
        [paymentId]
      );

      console.log(`✅ Pagamento ${paymentId} marcado como pago`);

      // Buscar tenant
      const tenantResult = await pool.query(
        'SELECT * FROM tenants WHERE id = $1',
        [tenantId]
      );

      if (tenantResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Tenant não encontrado'
        });
      }

      const tenant = tenantResult.rows[0];

      // Calcular nova data de vencimento
      const today = new Date();
      const currentExpiry = tenant.plano_ativo_ate ? new Date(tenant.plano_ativo_ate) : today;
      
      // Se já expirou, começar de hoje. Senão, adicionar 30 dias ao vencimento atual
      const baseDate = currentExpiry > today ? currentExpiry : today;
      const newExpiry = new Date(baseDate);
      newExpiry.setDate(newExpiry.getDate() + 30);

      // Atualizar tenant (ativar e estender)
      await pool.query(
        `UPDATE tenants 
         SET status = 'active'::text,
             proximo_vencimento = $1::timestamp,
             blocked_at = NULL,
             will_be_deleted_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2::integer`,
        [newExpiry, tenantId]
      );

      console.log(`🎉 Tenant ${tenantId} ativado até ${newExpiry.toISOString()}`);

      return res.json({
        success: true,
        message: 'Pagamento marcado como pago e plano ativado com sucesso',
        data: {
          payment_id: paymentId,
          new_expiry: newExpiry,
          tenant_status: 'active'
        }
      });

    } catch (error: any) {
      console.error('❌ Erro ao marcar pagamento como pago:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao marcar pagamento como pago',
        error: error.message
      });
    }
  }
}

export default new PaymentController();

