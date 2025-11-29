/**
 * Controller de Consultas Avulsas
 * Gerencia compra de créditos de consultas via PIX
 */

import { Request, Response } from 'express';
import { pool } from '../database/connection';
import asaasService from '../services/asaas.service';

class ConsultasAvulsasController {
  /**
   * GET /api/consultas-avulsas/faixas-preco
   * Retorna as faixas de preço ativas para quantidade personalizada
   */
  async getFaixasPreco(req: Request, res: Response) {
    try {
      const result = await pool.query(`
        SELECT 
          id,
          quantidade_min,
          quantidade_max,
          preco_unitario,
          ordem
        FROM consultas_faixas_preco
        WHERE ativo = true
        ORDER BY ordem ASC, quantidade_min ASC
      `);

      const faixas = result.rows.map(row => ({
        id: row.id,
        quantidade_min: parseInt(row.quantidade_min),
        quantidade_max: row.quantidade_max ? parseInt(row.quantidade_max) : null,
        preco_unitario: parseFloat(row.preco_unitario),
        ordem: row.ordem || 0
      }));

      console.log(`📊 ${faixas.length} faixas de preço retornadas`);

      return res.json({
        success: true,
        faixas
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar faixas de preço:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao buscar faixas de preço',
        error: error.message
      });
    }
  }

  /**
   * GET /api/consultas-avulsas/saldo
   * Retorna o saldo atual de consultas avulsas do tenant
   */
async getSaldo(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant?.id;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant não identificado'
        });
      }

      const result = await pool.query(
        'SELECT consultas_avulsas_saldo FROM tenants WHERE id = $1',
        [tenantId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Tenant não encontrado'
        });
      }

      const saldo = result.rows[0].consultas_avulsas_saldo || 0;

      console.log(`💰 Saldo de consultas avulsas do tenant ${tenantId}: ${saldo}`);

      return res.json({
        success: true,
        saldo
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar saldo:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao buscar saldo',
        error: error.message
      });
    }
  }

  /**
   * GET /api/consultas-avulsas/pacotes
   * Retorna pacotes configuráveis de consultas do banco de dados
   */
  async getPacotes(req: Request, res: Response) {
    try {
      const result = await pool.query(`
        SELECT 
          id,
          nome,
          quantidade,
          preco,
          preco_unitario,
          desconto,
          popular,
          ativo,
          ordem
        FROM consultas_avulsas_pacotes
        WHERE ativo = true
        ORDER BY ordem ASC, id ASC
      `);

      const pacotes = result.rows.map(row => ({
        id: row.id,
        nome: row.nome,
        quantidade: parseInt(row.quantidade),
        preco: parseFloat(row.preco),
        preco_unitario: parseFloat(row.preco_unitario),
        desconto: parseInt(row.desconto || 0),
        popular: row.popular || false,
        ordem: row.ordem || 0
      }));

      console.log(`📦 ${pacotes.length} pacotes ativos encontrados`);

      return res.json({
        success: true,
        pacotes
      });
    } catch (error: any) {
      console.error('❌ Erro ao listar pacotes:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao listar pacotes',
        error: error.message
      });
    }
  }

  /**
   * POST /api/consultas-avulsas/comprar
   * Cria uma cobrança PIX para compra de consultas avulsas
   */
  async comprar(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant?.id;
      const { quantidade, valor, tipo } = req.body;

      console.log('\n🛒 ===== INICIANDO COMPRA DE CONSULTAS AVULSAS =====');
      console.log(`📊 Tenant ID: ${tenantId}`);
      console.log(`📦 Quantidade: ${quantidade} consultas`);
      console.log(`💰 Valor: R$ ${valor}`);
      console.log(`🏷️  Tipo: ${tipo || 'personalizada'}`);

      // Validações
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant não identificado'
        });
      }

      if (!quantidade || quantidade < 1) {
        return res.status(400).json({
          success: false,
          message: 'Quantidade inválida'
        });
      }

      if (!valor || valor <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valor inválido'
        });
      }

      // ⚠️ VALIDAÇÃO: Compra por faixa (personalizada) só permitida acima de 100 consultas
      const MIN_QUANTIDADE_FAIXA = 100;
      if (tipo === 'personalizada' && quantidade < MIN_QUANTIDADE_FAIXA) {
        return res.status(400).json({
          success: false,
          message: `Para quantidade personalizada, o mínimo é ${MIN_QUANTIDADE_FAIXA} consultas. Por favor, escolha um pacote pré-definido ou quantidade acima de ${MIN_QUANTIDADE_FAIXA}.`,
          minQuantidade: MIN_QUANTIDADE_FAIXA
        });
      }

      // ⚠️ VALIDAÇÃO: Asaas exige valor mínimo de R$ 5,00
      const MIN_VALUE = 5.00;
      if (valor < MIN_VALUE) {
        return res.status(400).json({
          success: false,
          message: `O valor mínimo para cobrança é R$ ${MIN_VALUE.toFixed(2)}. Por favor, escolha um pacote maior ou quantidade personalizada acima deste valor.`,
          minValue: MIN_VALUE
        });
      }

      // 1. Buscar dados do tenant
      const tenantResult = await pool.query(
        'SELECT id, nome, email, documento, telefone, asaas_customer_id FROM tenants WHERE id = $1',
        [tenantId]
      );

      if (tenantResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Tenant não encontrado'
        });
      }

      const tenant = tenantResult.rows[0];

      // Validar documento
      if (!tenant.documento || tenant.documento.length < 11) {
        return res.status(400).json({
          success: false,
          message: 'CPF/CNPJ do tenant não cadastrado. Por favor, atualize seus dados.'
        });
      }

      console.log(`✅ Tenant encontrado: ${tenant.nome}`);

      // 2. Buscar ou criar cliente no Asaas
      let asaasCustomer;

      if (tenant.asaas_customer_id) {
        console.log(`🔍 Buscando cliente Asaas existente: ${tenant.asaas_customer_id}`);
        try {
          asaasCustomer = await asaasService.getCustomer(tenant.asaas_customer_id, tenantId);
          console.log(`✅ Cliente Asaas encontrado: ${asaasCustomer.name}`);

          // Atualizar documento se necessário
          if (!asaasCustomer.cpfCnpj || asaasCustomer.cpfCnpj !== tenant.documento) {
            console.log('🔄 Atualizando CPF/CNPJ do cliente...');
            await asaasService.updateCustomer(tenant.asaas_customer_id, {
              cpfCnpj: tenant.documento
            }, tenantId);
          }
        } catch (error) {
          console.log('⚠️  Cliente não encontrado no Asaas, criando novo...');
          asaasCustomer = null;
        }
      }

      if (!asaasCustomer) {
        console.log('🆕 Criando novo cliente no Asaas...');
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
        console.log(`✅ Cliente Asaas criado: ${asaasCustomer.id}`);
      }

      // 3. Criar cobrança PIX no Asaas
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1); // Vencimento em 1 dia

      console.log('💳 Criando cobrança PIX no Asaas...');
      
      const asaasPayment = await asaasService.createPayment({
        customer: asaasCustomer.id,
        billingType: 'PIX',
        value: Number(valor),
        dueDate: dueDate.toISOString().split('T')[0],
        description: `Compra de ${quantidade} consultas avulsas`,
        externalReference: `consultas_avulsas_${tenantId}_${Date.now()}`
      }, tenantId);

      console.log(`✅ Cobrança criada: ${asaasPayment.id}`);

      // 4. Buscar QR Code PIX
      console.log('🔍 Buscando QR Code PIX...');
      const pixQrCodeData = await asaasService.getPixQrCode(asaasPayment.id, tenantId);

      if (!pixQrCodeData || !pixQrCodeData.encodedImage) {
        console.error('❌ Não foi possível gerar QR Code PIX');
        return res.status(500).json({
          success: false,
          message: 'Erro ao gerar QR Code PIX'
        });
      }

      console.log('✅ QR Code PIX obtido com sucesso');

      // 5. Preparar QR Code (evitar duplicação do prefixo data:image)
      const qrCodeImage = pixQrCodeData.encodedImage.startsWith('data:image/')
        ? pixQrCodeData.encodedImage  // Já tem o prefixo
        : `data:image/png;base64,${pixQrCodeData.encodedImage}`; // Adicionar prefixo

      // 6. Salvar no banco de dados
      const paymentInsert = await pool.query(`
        INSERT INTO payments (
          tenant_id,
          asaas_payment_id,
          asaas_customer_id,
          payment_type,
          valor,
          status,
          descricao,
          due_date,
          asaas_pix_qr_code,
          asaas_pix_copy_paste,
          metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        RETURNING *
      `, [
        tenantId,
        asaasPayment.id,
        asaasCustomer.id,
        'PIX',
        valor,
        'pending',
        `Compra de ${quantidade} consultas avulsas`,
        dueDate.toISOString().split('T')[0],
        qrCodeImage,
        pixQrCodeData.payload,
        JSON.stringify({ 
          tipo: 'consultas_avulsas',
          quantidade_consultas: quantidade,
          pacote_id: null // Compra personalizada (não vinculada a pacote específico)
        })
      ]);

      console.log(`✅ Pagamento salvo no banco: ID ${paymentInsert.rows[0].id}`);
      console.log('🎉 ===== COMPRA CRIADA COM SUCESSO =====\n');

      return res.json({
        success: true,
        message: 'Cobrança PIX gerada com sucesso!',
        payment: {
          id: paymentInsert.rows[0].id,
          asaas_payment_id: asaasPayment.id,
          valor,
          quantidade_consultas: quantidade,
          status: 'PENDING',
          pix_qr_code: `data:image/png;base64,${pixQrCodeData.encodedImage}`,
          pix_copy_paste: pixQrCodeData.payload,
          data_vencimento: dueDate
        }
      });

    } catch (error: any) {
      console.error('❌ Erro ao criar cobrança:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao criar cobrança',
        error: error.message
      });
    }
  }

  /**
   * GET /api/consultas-avulsas/historico
   * Retorna histórico de compras de consultas avulsas
   */
  async getHistorico(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant?.id;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant não identificado'
        });
      }

      const result = await pool.query(`
        SELECT 
          id,
          asaas_payment_id,
          valor,
          status,
          descricao,
          metadata,
          data_vencimento,
          data_pagamento,
          created_at
        FROM payments
        WHERE tenant_id = $1 
        AND metadata->>'tipo' = 'consultas_avulsas'
        ORDER BY created_at DESC
        LIMIT 50
      `, [tenantId]);

      const compras = result.rows.map(row => ({
        ...row,
        quantidade_consultas: row.metadata?.quantidade_consultas || 0
      }));

      console.log(`📜 Histórico de compras do tenant ${tenantId}: ${compras.length} registros`);

      return res.json({
        success: true,
        compras
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar histórico:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao buscar histórico',
        error: error.message
      });
    }
  }
}

export default new ConsultasAvulsasController();

