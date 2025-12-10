import { Request, Response } from 'express';
import { WhatsAppAccountModel } from '../models/WhatsAppAccount';
import { whatsappService } from '../services/whatsapp.service';
import { tenantQuery } from '../database/tenant-query';
import axios, { AxiosRequestConfig } from 'axios';
import { getProxyConfigFromAccount, applyProxyToRequest, formatProxyInfo } from '../helpers/proxy.helper';
import { cloudinaryService } from '../services/cloudinary.service';

export class WhatsAppAccountController {
  async create(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }
      
      const account = await WhatsAppAccountModel.create(req.body, tenantId);
      res.status(201).json({ success: true, data: account });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async findAll(req: Request, res: Response) {
    try {
      // @ts-ignore - tenant é injetado pelo middleware de autenticação
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }
      const accounts = await WhatsAppAccountModel.findAll(tenantId);
      res.json({ success: true, data: accounts });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getAccountDetails(req: Request, res: Response) {
    console.log('\n🔍 ===== GET ACCOUNT DETAILS =====');
    console.log(`   ID requisitado: ${req.params.id}`);
    
    try {
      const accountId = parseInt(req.params.id);
      const { start_date, end_date } = req.query;
      
      // @ts-ignore - tenant é injetado pelo middleware
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }
      
      const account = await WhatsAppAccountModel.findById(accountId, tenantId);
      
      if (!account) {
        return res.status(404).json({ success: false, error: 'Conta não encontrada' });
      }

      console.log(`   Filtro de data: ${start_date || 'hoje'} até ${end_date || 'hoje'}`);

      let whatsappDisplayName = account.name;
      let whatsappProfilePicture = null;
      let qualityRating = null;
      let statsUtility = 0;
      let statsMarketing = 0;

      // Buscar nome e quality rating
      try {
        let accountInfoConfig: AxiosRequestConfig = {
          params: { fields: 'verified_name,quality_rating' },
          headers: { 'Authorization': `Bearer ${account.access_token}` },
          timeout: 10000
        };

        // Aplicar proxy se configurado
        const proxyConfig = await getProxyConfigFromAccount(accountId, tenantId);
        if (proxyConfig) {
          console.log(`🌐 Aplicando proxy: ${formatProxyInfo(proxyConfig)} - Buscar info da conta`);
          accountInfoConfig = applyProxyToRequest(accountInfoConfig, proxyConfig, account.name);
        }

        const accountInfoResponse = await axios.get(
          `https://graph.facebook.com/v18.0/${account.phone_number_id}`,
          accountInfoConfig
        );
        whatsappDisplayName = accountInfoResponse.data.verified_name || account.name;
        qualityRating = accountInfoResponse.data.quality_rating || null;
        
        console.log(`✅ Quality Rating obtido com sucesso para conta ${accountId}: ${qualityRating}`);
        
        // Salvar quality_rating no banco para cache
        if (qualityRating) {
          try {
            await tenantQuery(req,
              'UPDATE whatsapp_accounts SET quality_rating = $1, updated_at = NOW() WHERE id = $2',
              [qualityRating, accountId]
            );
            console.log(`💾 Quality Rating salvo em cache: ${qualityRating}`);
          } catch (dbError) {
            console.error('❌ Erro ao salvar quality_rating no banco:', dbError);
          }
        }
      } catch (err: any) {
        console.error(`❌ Erro ao buscar info da conta ${accountId}:`, {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status,
          phone_number_id: account.phone_number_id,
          account_name: account.name
        });
        
        // Se falhar, tentar buscar do histórico no banco
        try {
          const cachedResult = await tenantQuery(req,
            'SELECT quality_rating FROM whatsapp_accounts WHERE id = $1',
            [accountId]
          );
          if (cachedResult.rows[0]?.quality_rating) {
            qualityRating = cachedResult.rows[0].quality_rating;
            console.log(`ℹ️ Usando quality_rating em cache: ${qualityRating}`);
          }
        } catch (cacheErr) {
          console.error('Erro ao buscar quality_rating em cache:', cacheErr);
        }
      }

      // Buscar foto de perfil
      try {
        let profileConfig: AxiosRequestConfig = {
          params: { fields: 'profile_picture_url' },
          headers: { 'Authorization': `Bearer ${account.access_token}` },
          timeout: 10000
        };

        // Aplicar proxy se configurado
        const proxyConfigProfile = await getProxyConfigFromAccount(accountId, tenantId);
        if (proxyConfigProfile) {
          console.log(`🌐 Aplicando proxy: ${formatProxyInfo(proxyConfigProfile)} - Buscar foto da conta`);
          profileConfig = applyProxyToRequest(profileConfig, proxyConfigProfile, account.name);
        }

        const profileResponse = await axios.get(
          `https://graph.facebook.com/v18.0/${account.phone_number_id}/whatsapp_business_profile`,
          profileConfig
        );
        whatsappProfilePicture = profileResponse.data.data[0]?.profile_picture_url || null;
        
        // Salvar foto de perfil no banco de dados
        if (whatsappProfilePicture) {
          try {
            await tenantQuery(req,
              'UPDATE whatsapp_accounts SET profile_picture_url = $1, updated_at = NOW() WHERE id = $2',
              [whatsappProfilePicture, accountId]
            );
            console.log('✅ Foto de perfil salva no banco de dados');
          } catch (dbError) {
            console.error('❌ Erro ao salvar profile_picture_url no banco:', dbError);
          }
        }
      } catch (err) {
        console.log(`Erro ao buscar foto da conta ${accountId}`);
      }

      // Buscar estatísticas e calcular custos
      let costUtility = 0;
      let costMarketing = 0;
      let costAuthentication = 0;
      let costService = 0;
      let totalCost = 0;

      // Taxa de conversão USD para BRL (aproximada) - global para uso em todo o método
      const USD_TO_BRL = 5.0;

      try {
        // Usar as datas fornecidas ou hoje como padrão
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const startDateObj = start_date ? new Date(start_date as string + 'T00:00:00') : today;
        const endDateObj = end_date ? new Date(end_date as string + 'T23:59:59') : new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
        
        const statsResult = await tenantQuery(
          req,
          `SELECT 
            SUM(CASE WHEN UPPER(t.category) = 'UTILITY' THEN 1 ELSE 0 END) as utility_count,
            SUM(CASE WHEN UPPER(t.category) = 'MARKETING' THEN 1 ELSE 0 END) as marketing_count,
            SUM(CASE WHEN UPPER(t.category) = 'AUTHENTICATION' THEN 1 ELSE 0 END) as authentication_count,
            SUM(CASE WHEN UPPER(t.category) = 'SERVICE' THEN 1 ELSE 0 END) as service_count,
            COUNT(*) as total_messages
           FROM messages m
           LEFT JOIN templates t ON m.template_name = t.template_name 
             AND m.whatsapp_account_id = t.whatsapp_account_id
           WHERE m.whatsapp_account_id = $1
           AND m.sent_at >= $2
           AND m.sent_at <= $3
           AND m.status IN ('sent', 'delivered', 'read')`,
          [account.id, startDateObj, endDateObj]
        );

        const stats = statsResult.rows[0] || { 
          utility_count: 0, 
          marketing_count: 0,
          authentication_count: 0,
          service_count: 0
        };
        
        statsUtility = parseInt(stats.utility_count) || 0;
        statsMarketing = parseInt(stats.marketing_count) || 0;
        const statsAuthentication = parseInt(stats.authentication_count) || 0;
        const statsService = parseInt(stats.service_count) || 0;
        const totalMessages = parseInt(stats.total_messages) || 0;

        console.log(`  📊 Mensagens hoje (conta ${accountId}):`);
        console.log(`     Total: ${totalMessages}`);
        console.log(`     Utility: ${statsUtility}`);
        console.log(`     Marketing: ${statsMarketing}`);
        console.log(`     Authentication: ${statsAuthentication}`);
        console.log(`     Service: ${statsService}`);

        // Calcular custos baseado em conversas
        // Preços REAIS por tipo de mensagem (em USD)
        const COSTS_USD = {
          utility: 0.0068,          // R$ 0,034 (seus preços reais)
          marketing: 0.0625,        // R$ 0,3125 (seus preços reais)
          authentication: 0.0068,   // R$ 0,034 (seus preços reais)
          service: 0.0068          // R$ 0,034 (mesmo que utility)
        };

        costUtility = statsUtility * COSTS_USD.utility * USD_TO_BRL;
        costMarketing = statsMarketing * COSTS_USD.marketing * USD_TO_BRL;
        costAuthentication = statsAuthentication * COSTS_USD.authentication * USD_TO_BRL;
        costService = statsService * COSTS_USD.service * USD_TO_BRL;
        totalCost = costUtility + costMarketing + costAuthentication + costService;

        console.log(`  💰 Custos calculados:`);
        console.log(`     Utility: R$${costUtility.toFixed(2)}`);
        console.log(`     Marketing: R$${costMarketing.toFixed(2)}`);
        console.log(`     Authentication: R$${costAuthentication.toFixed(2)}`);
        console.log(`     Service: R$${costService.toFixed(2)}`);
        console.log(`     TOTAL: R$${totalCost.toFixed(2)}`);
      } catch (err) {
        console.log(`Erro ao buscar stats da conta ${accountId}`);
      }

      // Tentar buscar dados reais do Facebook (se configurado)
      if (account.facebook_access_token && account.facebook_ad_account_id) {
        try {
          // Descriptografar token
          const crypto = require('crypto');
          const algorithm = 'aes-256-cbc';
          const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default-key-32-chars-minimum!!', 'utf-8').slice(0, 32);
          
          const parts = account.facebook_access_token.split(':');
          const iv = Buffer.from(parts[0], 'hex');
          const encrypted = parts[1];
          
          const decipher = crypto.createDecipheriv(algorithm, key, iv);
          let decrypted = decipher.update(encrypted, 'hex', 'utf8');
          decrypted += decipher.final('utf8');
          const facebookToken = decrypted;

          // Buscar gastos reais do Facebook
          const today = new Date();
          const todayStr = today.toISOString().split('T')[0];
          
          const sinceDate = start_date ? start_date as string : todayStr;
          const untilDate = end_date ? end_date as string : todayStr;

          let billingConfig: AxiosRequestConfig = {
            params: {
              fields: 'spend',
              time_range: JSON.stringify({ since: sinceDate, until: untilDate }),
              level: 'account'
            },
            headers: {
              'Authorization': `Bearer ${facebookToken}`
            },
            timeout: 10000
          };

          // Aplicar proxy se configurado
          const proxyConfigBilling = await getProxyConfigFromAccount(accountId, tenantId);
          if (proxyConfigBilling) {
            console.log(`🌐 Aplicando proxy: ${formatProxyInfo(proxyConfigBilling)} - Buscar billing Facebook`);
            billingConfig = applyProxyToRequest(billingConfig, proxyConfigBilling, account.name);
          }

          const billingResponse = await axios.get(
            `https://graph.facebook.com/v18.0/${account.facebook_ad_account_id}/insights`,
            billingConfig
          );

          if (billingResponse.data.data && billingResponse.data.data[0]) {
            const realSpend = parseFloat(billingResponse.data.data[0].spend) || 0;
            totalCost = realSpend * USD_TO_BRL; // Converter para BRL
            console.log(`  💰 Gastos reais do Facebook: R$${totalCost.toFixed(2)}`);
          }
        } catch (err: any) {
          console.log(`  ⚠️ Não foi possível buscar gastos do Facebook:`, err.message);
        }
      }

      console.log('\n📤 Retornando dados ao frontend:');
      console.log(`   Total Cost: R$ ${totalCost.toFixed(2)}`);
      console.log(`   Utility: ${statsUtility} msgs = R$ ${costUtility.toFixed(2)}`);
      console.log(`   Marketing: ${statsMarketing} msgs = R$ ${costMarketing.toFixed(2)}`);
      console.log('=====================================\n');

      res.json({
        success: true,
        data: {
          ...account,
          whatsapp_display_name: whatsappDisplayName,
          whatsapp_profile_picture: whatsappProfilePicture,
          quality_rating: qualityRating,
          stats_utility: statsUtility,
          stats_marketing: statsMarketing,
          // Retornar como NÚMEROS, não strings formatadas
          total_cost: totalCost,
          cost_utility: costUtility,
          cost_marketing: costMarketing,
          cost_authentication: costAuthentication,
          cost_service: costService
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async findActive(req: Request, res: Response) {
    try {
      // @ts-ignore - tenant é injetado pelo middleware
      const tenantId = req.tenant?.id;
      const userId = req.user?.id; // Pegar ID do usuário logado
      
      // 🔧 FILTRO POR TIPO: ?type=api (só API Oficial) | ?type=qr (só QR Connect) | ?type=all ou vazio (ambos)
      const connectionType = req.query.type as string || 'all';
      
      console.log('🔍 [findActive] Buscando contas ativas...');
      console.log(`   Tenant ID: ${tenantId}`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Tipo de conexão: ${connectionType}`);
      
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }
      
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Usuário não identificado' });
      }
      
      // Verificar se o usuário é o dono do tenant (master) pelo role
      const isTenantOwner = req.user?.role === 'admin' || req.user?.role === 'super_admin';
      console.log(`   É dono do tenant? ${isTenantOwner} (role: ${req.user?.role})`);
      
      let accounts: any[] = [];
      let apiAccounts: any[] = [];
      let qrInstances: any[] = [];
      
      if (isTenantOwner) {
        // Dono do tenant vê TODAS as contas ativas (filtradas por tipo)
        console.log('   ✅ Usuário master - retornando contas do tenant');
        
        // Buscar contas API se solicitado
        if (connectionType === 'api' || connectionType === 'all') {
          apiAccounts = await WhatsAppAccountModel.findActive(tenantId);
          console.log(`   📱 Contas API: ${apiAccounts.length}`);
        }
        
        // Buscar instâncias QR se solicitado
        if (connectionType === 'qr' || connectionType === 'all') {
          const qrResult = await tenantQuery(req, `
            SELECT ui.*, 'qr_connect' as connection_type
            FROM uaz_instances ui
            WHERE ui.tenant_id = $1 AND ui.is_active = true
            ORDER BY ui.display_order ASC, ui.created_at DESC
          `, [tenantId]);
          qrInstances = qrResult.rows;
          console.log(`   🔗 Instâncias QR: ${qrInstances.length}`);
        }
        
      } else {
        // Usuário comum vê apenas suas contas autorizadas (filtradas por tipo)
        console.log('   🔒 Usuário comum - filtrando por permissões');
        
        // Buscar contas API autorizadas (se solicitado)
        if (connectionType === 'api' || connectionType === 'all') {
          const apiAccountsResult = await tenantQuery(req, `
            SELECT wa.* 
            FROM whatsapp_accounts wa
            INNER JOIN user_whatsapp_accounts uwa ON wa.id = uwa.whatsapp_account_id
            WHERE uwa.user_id = $1 
              AND uwa.tenant_id = $2 
              AND wa.is_active = true
            ORDER BY wa.display_order ASC, wa.created_at DESC
          `, [userId, tenantId]);
          apiAccounts = apiAccountsResult.rows;
          console.log(`   📱 Contas API autorizadas: ${apiAccounts.length}`);
        }
        
        // Buscar instâncias QR autorizadas (se solicitado)
        if (connectionType === 'qr' || connectionType === 'all') {
          const qrInstancesResult = await tenantQuery(req, `
            SELECT ui.*,
              'qr_connect' as connection_type
            FROM uaz_instances ui
            INNER JOIN user_uaz_instances uui ON ui.id = uui.uaz_instance_id
            WHERE uui.user_id = $1 
              AND uui.tenant_id = $2 
              AND ui.is_active = true
            ORDER BY ui.display_order ASC, ui.created_at DESC
          `, [userId, tenantId]);
          qrInstances = qrInstancesResult.rows;
          console.log(`   🔗 Instâncias QR autorizadas: ${qrInstances.length}`);
        }
      }
      
      // Montar resultado baseado no tipo solicitado
      if (connectionType === 'api') {
        accounts = apiAccounts;
      } else if (connectionType === 'qr') {
        accounts = qrInstances;
      } else {
        // 'all' - combinar ambos
        accounts = [...apiAccounts, ...qrInstances];
      }
      
      console.log(`   ✅ Total de contas retornadas (tipo: ${connectionType}): ${accounts.length}`);
      res.json({ success: true, data: accounts });
    } catch (error: any) {
      console.error('❌ Erro ao buscar contas ativas:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async findById(req: Request, res: Response) {
    try {
      // @ts-ignore - tenant é injetado pelo middleware
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }
      const account = await WhatsAppAccountModel.findById(parseInt(req.params.id), tenantId);
      if (!account) {
        return res.status(404).json({ success: false, error: 'Account not found' });
      }
      res.json({ success: true, data: account });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      // @ts-ignore - tenant é injetado pelo middleware
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }
      const account = await WhatsAppAccountModel.update(parseInt(req.params.id), req.body, tenantId);
      if (!account) {
        return res.status(404).json({ success: false, error: 'Account not found' });
      }
      res.json({ success: true, data: account });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      // @ts-ignore - tenant é injetado pelo middleware
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }
      await WhatsAppAccountModel.delete(parseInt(req.params.id), tenantId);
      res.json({ success: true, message: 'Account deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async toggleActive(req: Request, res: Response) {
    try {
      // @ts-ignore - tenant é injetado pelo middleware
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }
      const account = await WhatsAppAccountModel.toggleActive(parseInt(req.params.id), tenantId);
      res.json({ success: true, data: account });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async deactivateMultiple(req: Request, res: Response) {
    try {
      const { account_ids } = req.body;
      
      if (!account_ids || !Array.isArray(account_ids) || account_ids.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'account_ids must be a non-empty array' 
        });
      }

      // @ts-ignore - tenant é injetado pelo middleware
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }

      for (const accountId of account_ids) {
        await WhatsAppAccountModel.deactivate(parseInt(accountId), tenantId);
      }

      res.json({ 
        success: true, 
        message: `${account_ids.length} conta(s) desativada(s) com sucesso` 
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async deactivateAll(req: Request, res: Response) {
    try {
      // @ts-ignore - tenant é injetado pelo middleware
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }
      
      const count = await WhatsAppAccountModel.deactivateAll(tenantId);
      
      res.json({ 
        success: true, 
        message: `${count} conta(s) desativada(s) com sucesso` 
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async activateMultiple(req: Request, res: Response) {
    try {
      const { account_ids } = req.body;
      
      if (!account_ids || !Array.isArray(account_ids) || account_ids.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'account_ids must be a non-empty array' 
        });
      }

      // @ts-ignore - tenant é injetado pelo middleware
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }

      for (const accountId of account_ids) {
        await WhatsAppAccountModel.activate(parseInt(accountId), tenantId);
      }

      res.json({ 
        success: true, 
        message: `${account_ids.length} conta(s) ativada(s) com sucesso` 
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async activateAll(req: Request, res: Response) {
    try {
      // @ts-ignore - tenant é injetado pelo middleware
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }
      
      const count = await WhatsAppAccountModel.activateAll(tenantId);
      
      res.json({ 
        success: true, 
        message: `${count} conta(s) ativada(s) com sucesso` 
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async testConnection(req: Request, res: Response) {
    try {
      const { access_token, phone_number_id } = req.body;
      
      if (!access_token || !phone_number_id) {
        return res.status(400).json({ 
          success: false, 
          error: 'access_token and phone_number_id are required' 
        });
      }

      const result = await whatsappService.testConnection(access_token, phone_number_id);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getTemplates(req: Request, res: Response) {
    try {
      console.log('\n📋 ===== GET TEMPLATES =====');
      console.log(`   ID da conta: ${req.params.id}`);
      
      // @ts-ignore - tenant é injetado pelo middleware
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        console.error('❌ Tenant não identificado');
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }
      
      console.log(`   Tenant ID: ${tenantId}`);
      const account = await WhatsAppAccountModel.findById(parseInt(req.params.id), tenantId);
      
      if (!account) {
        console.error('❌ Conta não encontrada');
        return res.status(404).json({ success: false, error: 'Account not found' });
      }

      console.log(`   Conta encontrada: ${account.name}`);
      console.log(`   Business Account ID: ${account.business_account_id}`);

      if (!account.business_account_id) {
        console.error('❌ Business Account ID não configurado');
        return res.status(400).json({ 
          success: false, 
          error: 'Business Account ID is required' 
        });
      }

      console.log('🔄 Buscando templates na API do WhatsApp...');
      const result = await whatsappService.getTemplates(
        account.access_token,
        account.business_account_id,
        account.id,
        account.name,
        tenantId
      );

      console.log(`✅ Templates obtidos: ${result.templates?.length || 0} templates`);
      res.json(result);
    } catch (error: any) {
      console.error('❌ Erro ao buscar templates:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async uploadMedia(req: Request, res: Response) {
    try {
      console.log('📨 Requisição de upload recebida:');
      console.log('   Conta ID:', req.params.id);
      console.log('   Headers:', JSON.stringify(req.headers['content-type']));
      console.log('   Body keys:', Object.keys(req.body));
      console.log('   File presente:', !!req.file);
      
      // @ts-ignore - tenant é injetado pelo middleware
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }
      
      const account = await WhatsAppAccountModel.findById(parseInt(req.params.id), tenantId);
      
      if (!account) {
        console.error('❌ Conta não encontrada:', req.params.id);
        return res.status(404).json({ success: false, error: 'Account not found' });
      }

      if (!req.file) {
        console.error('❌ Nenhum arquivo foi recebido no upload!');
        console.error('   Body:', JSON.stringify(req.body, null, 2));
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      console.log('📤 Fazendo upload de mídia para template:');
      console.log('   Conta:', account.name);
      console.log('   App ID:', account.app_id || 'NÃO CONFIGURADO');
      console.log('   Arquivo:', req.file.originalname);
      console.log('   Tamanho:', req.file.size, 'bytes');
      console.log('   Tipo:', req.file.mimetype);

      // Salvar arquivo temporariamente para upload ao Cloudinary
      const fs = await import('fs');
      const path = await import('path');
      const crypto = await import('crypto');
      
      const fileHash = crypto.randomBytes(8).toString('hex');
      const fileExt = path.extname(req.file.originalname);
      const fileName = `${Date.now()}_${fileHash}${fileExt}`;
      const uploadDir = path.join(__dirname, '../../uploads/temp');
      const filePath = path.join(uploadDir, fileName);
      
      // Criar diretório se não existir
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      // Salvar arquivo temporariamente
      fs.writeFileSync(filePath, req.file.buffer);
      
      // Upload para Cloudinary
      let publicUrl: string;
      console.log('🔍 Cloudinary isReady:', cloudinaryService.isReady());
      if (cloudinaryService.isReady()) {
        console.log('☁️ Fazendo upload para Cloudinary...');
        const cloudinaryResult = await cloudinaryService.uploadFile(
          filePath,
          `whatsapp-templates/${account.name.replace(/\s+/g, '-')}`
        );
        
        console.log('🔍 Resultado do Cloudinary:', cloudinaryResult);
        
        if (cloudinaryResult.success && cloudinaryResult.url) {
          publicUrl = cloudinaryResult.url;
          console.log('✅ Upload para Cloudinary concluído!');
          console.log('   🌐 URL Cloudinary:', publicUrl);
        } else {
          console.error('❌ Erro no upload para Cloudinary:', cloudinaryResult.error);
          // Fallback: usar URL local
          publicUrl = `${process.env.BACKEND_URL || 'http://localhost:3001'}/uploads/temp/${fileName}`;
          console.log('⚠️ Usando URL local como fallback:', publicUrl);
        }
        
        // Remover arquivo temporário
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error('⚠️ Erro ao remover arquivo temporário:', err);
        }
      } else {
        // Cloudinary não configurado, usar URL local
        publicUrl = `${process.env.BACKEND_URL || 'http://localhost:3001'}/uploads/temp/${fileName}`;
        console.log('⚠️ Cloudinary não configurado, usando URL local:', publicUrl);
      }

      // Fazer upload para o WhatsApp usando o método apropriado
      let result: any;
      let mediaHandle: string | null = null;
      
      if (account.app_id) {
        // Usar Resumable Upload API (retorna handle 4::xxx)
        console.log('📱 Usando Resumable Upload API com App ID');
        result = await whatsappService.uploadMediaWithAppId(
          account.app_id,
          account.access_token,
          req.file.buffer,
          req.file.mimetype,
          req.file.originalname,
          account.id,
          account.name,
          tenantId
        );
        
        if (result.success) {
          mediaHandle = result.mediaHandle;
          console.log('✅ Upload via Resumable API concluído!');
          console.log('✅ Media Handle (4::xxx):', mediaHandle);
        }
      } else {
        // Usar upload tradicional (retorna Media ID)
        console.log('📤 Usando upload tradicional (sem App ID)');
        result = await whatsappService.uploadMedia(
          account.access_token,
          account.phone_number_id,
          req.file.buffer,
          req.file.mimetype,
          account.id,
          account.name,
          tenantId
        );
        
        if (result.success) {
          mediaHandle = result.mediaHandle || result.mediaId;
          console.log('✅ Upload para WhatsApp concluído! Media ID:', result.mediaId);
          console.log('✅ Media Handle:', mediaHandle);
        }
      }

      if (result.success) {
        
        // Buscar a URL do Media ID para usar em templates (somente se não usou Resumable Upload)
        let mediaUrl = null;
        let mediaId = result.mediaId || null;
        
        if (mediaId && !account.app_id) {
          console.log('🔍 Buscando URL do Media ID...');
          const mediaUrlResult = await whatsappService.getMediaUrl(
            account.access_token,
            mediaId,
            account.id,
            account.name,
            tenantId
          );
          
          if (mediaUrlResult.success) {
            mediaUrl = mediaUrlResult.url;
            console.log('✅ URL do Media ID obtida:', mediaUrl);
          } else {
            console.error('❌ Erro ao obter URL do Media ID:', mediaUrlResult.error);
          }
        }
        
        return res.json({
          success: true,
          mediaHandle: mediaHandle, // Handle no formato 4::xxx (se App ID) ou Media ID (tradicional)
          mediaId: mediaId,
          mediaUrl: mediaUrl, // URL do WhatsApp para usar em templates
          publicUrl: publicUrl, // URL pública do Cloudinary para referência
          message: account.app_id 
            ? 'Media uploaded successfully via Resumable Upload API' 
            : 'Media uploaded successfully',
          usedResumableUpload: !!account.app_id
        });
      } else {
        console.error('❌ Erro no upload para WhatsApp:', result.error);
        // Mesmo com erro no WhatsApp, retornar a URL pública
        return res.json({
          success: true,
          mediaId: null,
          mediaUrl: null,
          publicUrl: publicUrl,
          message: 'Media uploaded to Cloudinary (WhatsApp upload failed)',
        });
      }
    } catch (error: any) {
      console.error('❌ Erro no uploadMedia:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // 🔼🔽 Reordenação de contas
  async moveUp(req: Request, res: Response) {
    try {
      const accountId = parseInt(req.params.id);
      const tenantId = (req as any).tenant?.id;

      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }

      // Buscar a conta atual
      const currentResult = await tenantQuery(
        req,
        'SELECT id, display_order FROM whatsapp_accounts WHERE id = $1 AND tenant_id = $2',
        [accountId, tenantId]
      );

      if (currentResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Conta não encontrada' });
      }

      const currentAccount = currentResult.rows[0];
      const currentOrder = currentAccount.display_order || 0;

      // Buscar a conta anterior (menor display_order que a atual)
      const previousResult = await tenantQuery(
        req,
        'SELECT id, display_order FROM whatsapp_accounts WHERE tenant_id = $1 AND display_order < $2 ORDER BY display_order DESC LIMIT 1',
        [tenantId, currentOrder]
      );

      if (previousResult.rows.length === 0) {
        return res.json({ success: true, message: 'Conta já está em primeiro lugar' });
      }

      const previousAccount = previousResult.rows[0];

      // Trocar as ordens
      await tenantQuery(
        req,
        'UPDATE whatsapp_accounts SET display_order = $1 WHERE id = $2 AND tenant_id = $3',
        [previousAccount.display_order, currentAccount.id, tenantId]
      );

      await tenantQuery(
        req,
        'UPDATE whatsapp_accounts SET display_order = $1 WHERE id = $2 AND tenant_id = $3',
        [currentOrder, previousAccount.id, tenantId]
      );

      res.json({ success: true, message: 'Ordem atualizada com sucesso' });
    } catch (error: any) {
      console.error('❌ Erro ao mover conta para cima:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async moveDown(req: Request, res: Response) {
    try {
      const accountId = parseInt(req.params.id);
      const tenantId = (req as any).tenant?.id;

      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }

      // Buscar a conta atual
      const currentResult = await tenantQuery(
        req,
        'SELECT id, display_order FROM whatsapp_accounts WHERE id = $1 AND tenant_id = $2',
        [accountId, tenantId]
      );

      if (currentResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Conta não encontrada' });
      }

      const currentAccount = currentResult.rows[0];
      const currentOrder = currentAccount.display_order || 0;

      // Buscar a próxima conta (maior display_order que a atual)
      const nextResult = await tenantQuery(
        req,
        'SELECT id, display_order FROM whatsapp_accounts WHERE tenant_id = $1 AND display_order > $2 ORDER BY display_order ASC LIMIT 1',
        [tenantId, currentOrder]
      );

      if (nextResult.rows.length === 0) {
        return res.json({ success: true, message: 'Conta já está em último lugar' });
      }

      const nextAccount = nextResult.rows[0];

      // Trocar as ordens
      await tenantQuery(
        req,
        'UPDATE whatsapp_accounts SET display_order = $1 WHERE id = $2 AND tenant_id = $3',
        [nextAccount.display_order, currentAccount.id, tenantId]
      );

      await tenantQuery(
        req,
        'UPDATE whatsapp_accounts SET display_order = $1 WHERE id = $2 AND tenant_id = $3',
        [currentOrder, nextAccount.id, tenantId]
      );

      res.json({ success: true, message: 'Ordem atualizada com sucesso' });
    } catch (error: any) {
      console.error('❌ Erro ao mover conta para baixo:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getAccountsStatus(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }

      console.log(`\n📊 ===== BUSCANDO STATUS DAS CONTAS (Tenant ${tenantId}) =====`);

      // Buscar todas as contas do tenant
      const accounts = await WhatsAppAccountModel.findAll(tenantId);
      
      const accountsStatus = await Promise.all(accounts.map(async (account: any) => {
        try {
          // 1. Buscar mensagens enviadas hoje
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const messagesResult = await tenantQuery(
            req,
            `SELECT COUNT(*) as total 
             FROM campaign_messages 
             WHERE whatsapp_account_id = $1 
             AND created_at >= $2
             AND status IN ('sent', 'delivered', 'read')`,
            [account.id, today]
          );
          const messagesToday = parseInt(messagesResult.rows[0]?.total || '0');

          // 2. Buscar quality rating (da Meta ou do cache no banco)
          let qualityScore = account.quality_rating || 'UNKNOWN';
          let apiConnected = false;
          let apiLastCheck = null;

          try {
            // Tentar buscar quality rating da Meta
            let config: AxiosRequestConfig = {
              params: { fields: 'quality_rating' },
              headers: { 'Authorization': `Bearer ${account.access_token}` },
              timeout: 5000
            };

            const proxyConfig = await getProxyConfigFromAccount(account.id, tenantId);
            if (proxyConfig) {
              config = applyProxyToRequest(config, proxyConfig, account.name);
            }

            const response = await axios.get(
              `https://graph.facebook.com/v18.0/${account.phone_number_id}`,
              config
            );

            qualityScore = response.data.quality_rating || 'UNKNOWN';
            apiConnected = true;
            apiLastCheck = new Date().toISOString();

            // Atualizar cache no banco
            await tenantQuery(
              req,
              'UPDATE whatsapp_accounts SET quality_rating = $1 WHERE id = $2',
              [qualityScore, account.id]
            );
          } catch (error) {
            console.error(`❌ Erro ao buscar quality rating da conta ${account.id}:`, error);
            apiConnected = false;
          }

          // 3. Buscar status do webhook
          const webhookResult = await tenantQuery(
            req,
            `SELECT 
               COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour') as recent_events,
               MAX(created_at) as last_event
             FROM webhook_events 
             WHERE account_id = $1`,
            [account.id]
          );
          
          const recentEvents = parseInt(webhookResult.rows[0]?.recent_events || '0');
          const webhookActive = recentEvents > 0;
          const webhookLastReceived = webhookResult.rows[0]?.last_event || null;

          // 4. Buscar último erro
          const errorResult = await tenantQuery(
            req,
            `SELECT error_message, created_at 
             FROM campaign_messages 
             WHERE whatsapp_account_id = $1 
             AND status = 'failed' 
             AND error_message IS NOT NULL 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [account.id]
          );
          
          const lastError = errorResult.rows[0]?.error_message || null;
          const lastErrorAt = errorResult.rows[0]?.created_at || null;

          return {
            id: account.id,
            name: account.name,
            phone_number: account.phone_number,
            is_active: account.is_active,
            messages_sent_today: messagesToday,
            quality_score: qualityScore,
            api_connected: apiConnected,
            api_last_check: apiLastCheck,
            webhook_active: webhookActive,
            webhook_last_received: webhookLastReceived,
            last_error: lastError,
            last_error_at: lastErrorAt
          };
        } catch (error: any) {
          console.error(`❌ Erro ao processar conta ${account.id}:`, error);
          return {
            id: account.id,
            name: account.name,
            phone_number: account.phone_number,
            is_active: account.is_active,
            messages_sent_today: 0,
            quality_score: 'UNKNOWN',
            api_connected: false,
            api_last_check: null,
            webhook_active: false,
            webhook_last_received: null,
            last_error: error.message,
            last_error_at: new Date().toISOString()
          };
        }
      }));

      console.log(`✅ Status de ${accountsStatus.length} conta(s) processado(s)`);
      
      res.json({ 
        success: true, 
        accounts: accountsStatus 
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar status das contas:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const whatsAppAccountController = new WhatsAppAccountController();


