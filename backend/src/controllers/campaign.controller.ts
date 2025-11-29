import { Request, Response } from 'express';
import { CampaignModel } from '../models/Campaign';
import { ContactModel } from '../models/Contact';
import { MessageModel } from '../models/Message';
import { tenantQuery } from '../database/tenant-query';
import { campaignWorker } from '../workers/campaign.worker';
import { whatsappHealthService } from '../services/whatsapp-health.service';
import { reportService } from '../services/report.service';
import ExcelJS from 'exceljs';
// import { queueService } from '../services/queue.service'; // Temporariamente desabilitado

export class CampaignController {
  async create(req: Request, res: Response) {
    try {
      const {
        name,
        templates,
        contacts,
        scheduled_at,
        schedule_config,
        pause_config,
      } = req.body;

      const tenantId = (req as any).tenant?.id;

      console.log('📋 Criando campanha:', {
        name,
        tenantId,
        templatesCount: templates.length,
        contactsCount: contacts.length,
        scheduled_at,
      });

      // Criar campanha
      const campaign = await CampaignModel.create({
        name,
        status: scheduled_at ? 'scheduled' : 'pending',
        tenant_id: tenantId,
        scheduled_at: scheduled_at ? new Date(scheduled_at) : undefined,
        total_contacts: contacts.length,
        schedule_config,
        pause_config,
        sent_count: 0,
        delivered_count: 0,
        read_count: 0,
        failed_count: 0,
        no_whatsapp_count: 0,
        button_clicks_count: 0,
      });

      console.log('✅ Campanha criada com ID:', campaign.id);

      // Criar/atualizar contatos em massa com tenant_id
      const createdContacts = await ContactModel.createBulk(contacts, tenantId);
      console.log(`✅ ${createdContacts.length} contatos criados/atualizados`);

      // Associar contatos à campanha
      for (const contact of createdContacts) {
        await tenantQuery(req, 
          'INSERT INTO campaign_contacts (campaign_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [campaign.id, contact.id]
        );
      }
      console.log('✅ Contatos associados à campanha');

      // Criar registros de templates da campanha
      const campaignTemplates = [];
      for (let i = 0; i < templates.length; i++) {
        const template = templates[i];
        
        // Buscar ou criar template_id pelo nome
        let templateId = template.template_id;
        if (!templateId && template.template_name) {
          const templateResult = await tenantQuery(req, 
            'SELECT id FROM templates WHERE whatsapp_account_id = $1 AND template_name = $2 LIMIT 1',
            [template.whatsapp_account_id, template.template_name]
          );
          if (templateResult.rows.length > 0) {
            templateId = templateResult.rows[0].id;
          } else {
            // Criar o template no banco se não existir
            const newTemplateResult = await tenantQuery(req, 
              `INSERT INTO templates (whatsapp_account_id, template_name, status, has_media, media_type)
               VALUES ($1, $2, 'APPROVED', $3, $4)
               RETURNING id`,
              [template.whatsapp_account_id, template.template_name, !!template.media_url, template.media_type]
            );
            templateId = newTemplateResult.rows[0].id;
            console.log(`✅ Template "${template.template_name}" criado no banco com ID: ${templateId}`);
          }
        }
        
        const result = await tenantQuery(req, 
          `INSERT INTO campaign_templates 
           (campaign_id, whatsapp_account_id, template_id, media_url, media_type, order_index, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, true)
           RETURNING *`,
          [
            campaign.id,
            template.whatsapp_account_id,
            templateId,
            template.media_url,
            template.media_type,
            i,
          ]
        );
        campaignTemplates.push({
          ...result.rows[0],
          template_name: template.template_name,
        });
      }
      console.log(`✅ ${campaignTemplates.length} templates associados à campanha`);

      // Se não for agendada, iniciar imediatamente
      // NOTA: Queue service desabilitado temporariamente
      // A campanha fica com status 'pending' até implementarmos o worker
      if (!scheduled_at) {
        console.log('⚠️ Queue service desabilitado. Campanha criada com status "pending".');
        console.log('💡 Implemente um worker para processar campanhas com status "pending"');
        // await queueService.addCampaign({
        //   campaignId: campaign.id!,
        //   templates: campaignTemplates,
        //   contacts: createdContacts,
        //   pauseConfig: pause_config,
        //   scheduleConfig: schedule_config,
        // });
      }

      res.status(201).json({
        success: true,
        data: campaign,
        message: scheduled_at 
          ? 'Campanha agendada com sucesso!' 
          : 'Campanha criada com sucesso! (Worker de envio em desenvolvimento)',
      });
    } catch (error: any) {
      console.error('❌ Erro ao criar campanha:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async findAll(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }
      
      const campaigns = await CampaignModel.findAll(tenantId);
      
      // Adicionar status real para cada campanha (considerando horário, pausas, etc.)
      const campaignsWithRealStatus = campaigns.map((campaign: any) => {
        let currentStatus = campaign.status;
        
        // Se a campanha está rodando ou pausada, verificar condições
        if (campaign.status === 'running' || campaign.status === 'paused') {
          const scheduleConfig = campaign.schedule_config || {};
          
          // Verificar horário de trabalho
          if (scheduleConfig.work_start_time && scheduleConfig.work_end_time) {
            const now = new Date();
            const currentTime = now.toTimeString().slice(0, 5); // HH:MM
            const startTime = scheduleConfig.work_start_time;
            const endTime = scheduleConfig.work_end_time;
            
            const isWithinWorkHours = currentTime >= startTime && currentTime <= endTime;
            
            if (!isWithinWorkHours) {
              currentStatus = 'outside_hours';
            }
          }
          
          // Verificar pausa programada
          const pauseConfig = campaign.pause_config || {};
          const pauseState = campaignWorker.getPauseState(campaign.id);
          const shouldBePaused = pauseState !== null;
          
          if (shouldBePaused && currentStatus !== 'outside_hours') {
            currentStatus = 'pause_programmed';
          }
        }
        
        return {
          ...campaign,
          realStatus: currentStatus // Status real considerando todas as condições
        };
      });
      
      res.json({ success: true, data: campaignsWithRealStatus });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async findById(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }
      
      const campaign = await CampaignModel.findById(parseInt(req.params.id), tenantId);
      
      if (!campaign) {
        return res.status(404).json({ success: false, error: 'Campaign not found' });
      }

      // Buscar templates da campanha
      const templatesResult = await tenantQuery(req, 
        `SELECT ct.*, t.template_name, w.name as account_name, w.phone_number
         FROM campaign_templates ct
         LEFT JOIN templates t ON ct.template_id = t.id
         LEFT JOIN whatsapp_accounts w ON ct.whatsapp_account_id = w.id
         WHERE ct.campaign_id = $1
         ORDER BY ct.order_index`,
        [campaign.id]
      );

      // Buscar estatísticas atualizadas
      const stats = await MessageModel.getCampaignStats(campaign.id!);
      const noWhatsappCount = await MessageModel.getNoWhatsAppCount(campaign.id!);
      const buttonClicksCount = await MessageModel.getButtonClicksCount(campaign.id!);

      // Atualizar os contadores na campanha
      await CampaignModel.updateStats(campaign.id!, {
        no_whatsapp_count: noWhatsappCount,
        button_clicks_count: buttonClicksCount
      }, tenantId);

      res.json({
        success: true,
        data: {
          ...campaign,
          no_whatsapp_count: noWhatsappCount,
          button_clicks_count: buttonClicksCount,
          templates: templatesResult.rows,
          stats,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getMessages(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const messages = await MessageModel.findByCampaign(campaignId, limit, offset);

      res.json({ success: true, data: messages });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getContacts(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);

      // Buscar todos os contatos da campanha
      const result = await tenantQuery(req, 
        `SELECT c.id, c.phone_number as phone, c.name
         FROM contacts c
         INNER JOIN campaign_contacts cc ON c.id = cc.contact_id
         WHERE cc.campaign_id = $1
         ORDER BY cc.id ASC`,
        [campaignId]
      );

      res.json({ success: true, data: result.rows });
    } catch (error: any) {
      console.error('Erro ao buscar contatos da campanha:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getActivityLog(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);
      const tenantId = (req as any).tenant?.id;
      
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }
      
      // Buscar informações da campanha
      const campaign = await CampaignModel.findById(campaignId, tenantId);
      if (!campaign) {
        return res.status(404).json({ success: false, error: 'Campanha não encontrada' });
      }

      // Buscar todas as contas (ativas e inativas) para mostrar status
      const activeAccounts = await tenantQuery(req, 
        `SELECT DISTINCT ON (ct.whatsapp_account_id) 
         ct.whatsapp_account_id, 
         w.id as account_id,
         w.name as account_name, 
         w.phone_number,
         w.access_token,
         w.phone_number_id,
         w.tenant_id,
         ct.is_active,
         ct.consecutive_failures,
         ct.last_error,
         ct.removed_at,
         ct.removal_count,
         ct.permanent_removal,
         ct.removal_history
         FROM campaign_templates ct
         LEFT JOIN whatsapp_accounts w ON ct.whatsapp_account_id = w.id
         WHERE ct.campaign_id = $1
         ORDER BY ct.whatsapp_account_id`,
        [campaignId]
      );

      // Buscar última mensagem enviada
      const lastMessage = await tenantQuery(req, 
        `SELECT m.*, w.name as account_name, w.phone_number
         FROM messages m
         LEFT JOIN whatsapp_accounts w ON m.whatsapp_account_id = w.id
         WHERE m.campaign_id = $1
         ORDER BY m.created_at DESC
         LIMIT 1`,
        [campaignId]
      );

      // Verificar se está no horário de trabalho
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const scheduleConfig = campaign.schedule_config || {};
      const isWithinWorkHours = 
        !scheduleConfig.work_start_time || 
        !scheduleConfig.work_end_time ||
        (currentTime >= scheduleConfig.work_start_time && currentTime <= scheduleConfig.work_end_time);

      // Verificar se está em pausa programada (agora busca do banco - persistente)
      const pauseConfig = campaign.pause_config || {};
      const pauseState = await campaignWorker.getPauseStateAsync(campaignId);
      const shouldBePaused = pauseState !== null;

      // Montar log de atividades
      // Determinar status atual da campanha
      let currentStatusString = 'sending';
      if (!isWithinWorkHours) {
        currentStatusString = 'outside_hours';
      } else if (shouldBePaused) {
        currentStatusString = 'pause_programmed';
      } else if (campaign.status === 'paused') {
        currentStatusString = 'paused';
      }

      // Obter informações de intervalo entre mensagens
      const intervalSeconds = scheduleConfig.interval_seconds || 5;
      
      // Obter informações de pausa automática (pauseConfig já foi declarado acima)
      const pauseAfter = pauseConfig.pause_after || 0;
      const pauseDurationMinutes = pauseConfig.pause_duration_minutes || 0;
      
      // Calcular quantas mensagens faltam para a próxima pausa automática
      let messagesUntilPause = 0;
      if (pauseAfter > 0) {
        const sentSinceLastPause = campaign.sent_count % pauseAfter;
        messagesUntilPause = pauseAfter - sentSinceLastPause;
      }

      // Calcular tempo até próxima mensagem
      let nextMessageIn = 0;
      if (lastMessage.rows[0] && campaign.status === 'running') {
        const lastSentAt = new Date(lastMessage.rows[0].sent_at || lastMessage.rows[0].created_at);
        const nextSendTime = new Date(lastSentAt.getTime() + (intervalSeconds * 1000));
        const secondsUntilNext = Math.max(0, Math.floor((nextSendTime.getTime() - now.getTime()) / 1000));
        nextMessageIn = secondsUntilNext;
      }

      const activityLog = {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
        },
        currentStatus: currentStatusString, // String simples para o frontend
        statusDetails: {
          isWithinWorkHours,
          shouldBePaused,
          pauseRemainingSeconds: pauseState?.remainingSeconds || 0,
          currentTime,
          workHours: `${scheduleConfig.work_start_time || 'N/A'} - ${scheduleConfig.work_end_time || 'N/A'}`,
        },
        intervalInfo: {
          intervalSeconds,
          messagesUntilPause,
          pauseAfter,
          pauseDurationMinutes,
          nextMessageIn,
        },
        activeAccounts: await Promise.all(
          activeAccounts.rows.map(async (acc) => {
            // Buscar health da conta (com proxy se configurado)
            const health = await whatsappHealthService.getPhoneNumberHealth(
              acc.phone_number_id,
              acc.access_token,
              acc.account_id,
              acc.account_name,
              acc.tenant_id
            );

            // Determinar status na campanha
            let campaignStatus = 'ATIVA E ENVIANDO';
            if (!acc.is_active) {
              if (acc.permanent_removal) {
                campaignStatus = `🚫 REMOVIDA PERMANENTEMENTE (${acc.removal_count}x remoções)`;
              } else if (acc.last_error) {
                campaignStatus = `PAUSADA - ${acc.last_error}`;
              } else if (acc.consecutive_failures >= 5) {
                campaignStatus = `PAUSADA - ${acc.consecutive_failures} falhas consecutivas`;
              } else {
                campaignStatus = 'PAUSADA - Removida manualmente';
              }
            }

            // Parse removal history
            let removalHistory = [];
            try {
              removalHistory = acc.removal_history ? 
                (typeof acc.removal_history === 'string' ? 
                  JSON.parse(acc.removal_history) : 
                  acc.removal_history) : 
                [];
            } catch (e) {
              removalHistory = [];
            }

            // Contar mensagens enviadas HOJE por esta conta
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const messagesResult = await tenantQuery(req, 
              `SELECT COUNT(*) as sent_today
               FROM messages
               WHERE whatsapp_account_id = $1
               AND sent_at >= $2
               AND status IN ('sent', 'delivered', 'read')`,
              [acc.whatsapp_account_id, today]
            );
            const sentToday = parseInt(messagesResult.rows[0]?.sent_today || '0');

            // Determinar limite diário baseado no throughput
            let dailyLimit = 1000; // Padrão
            if (health.throughput_level === 'STANDARD') dailyLimit = 1000;
            else if (health.throughput_level === 'HIGH') dailyLimit = 10000;
            else if (health.throughput_level === 'VERY_HIGH') dailyLimit = 100000;

            const remaining = Math.max(0, dailyLimit - sentToday);

            // Determinar status de conexão simplificado
            let simpleStatus = 'CONECTADO';
            if (health.code_verification_status === 'UNVERIFIED') {
              simpleStatus = 'NÃO VERIFICADO';
            } else if (health.quality_rating === 'RED') {
              simpleStatus = 'PROBLEMA';
            } else if (health.quality_rating === 'YELLOW') {
              simpleStatus = 'ATENÇÃO';
            }

            return {
              id: acc.whatsapp_account_id,
              name: acc.account_name,
              phone: acc.phone_number,
              isActive: acc.is_active,
              consecutiveFailures: acc.consecutive_failures || 0,
              lastError: acc.last_error,
              // Health info (SIMPLIFICADO)
              qualityRating: health.quality_rating,
              accountStatus: simpleStatus,
              dailyLimit: dailyLimit,
              sentToday: sentToday,
              remaining: remaining,
              // Campaign status
              campaignStatus,
              removedAt: acc.removed_at,
              // Removal tracking
              removalCount: acc.removal_count || 0,
              permanentRemoval: acc.permanent_removal || false,
              removalHistory: removalHistory,
            };
          })
        ),
        lastMessage: lastMessage.rows[0] ? {
          accountName: lastMessage.rows[0].account_name,
          phoneNumber: lastMessage.rows[0].phone_number,
          templateName: lastMessage.rows[0].template_name,
          status: lastMessage.rows[0].status,
          sentAt: lastMessage.rows[0].sent_at,
          contactPhone: lastMessage.rows[0].phone_number,
        } : null,
        stats: {
          totalContacts: campaign.total_contacts,
          sentCount: campaign.sent_count,
          deliveredCount: campaign.delivered_count,
          readCount: campaign.read_count,
          failedCount: campaign.failed_count,
          pendingCount: campaign.total_contacts - (campaign.sent_count || 0),
        },
      };

      res.json({ success: true, data: activityLog });
    } catch (error: any) {
      console.error('Erro ao buscar log de atividades:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateStatus(req: Request, res: Response) {
    try {
      const { status } = req.body;
      const campaign = await CampaignModel.update(parseInt(req.params.id), { status });

      res.json({ success: true, data: campaign });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async pause(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);
      // Limpar pausa programada ao pausar manualmente
      const campaign = await CampaignModel.update(campaignId, { 
        status: 'paused',
        pause_started_at: null 
      });

      console.log(`⏸️ Campanha ${campaignId} pausada manualmente`);

      res.json({ 
        success: true, 
        data: campaign,
        message: 'Campanha pausada com sucesso' 
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async resume(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);
      // Limpar pausa programada ao retomar manualmente
      const campaign = await CampaignModel.update(campaignId, { 
        status: 'running',
        pause_started_at: null 
      });

      console.log(`▶️ Campanha ${campaignId} retomada manualmente`);

      res.json({ 
        success: true, 
        data: campaign,
        message: 'Campanha retomada com sucesso' 
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async cancel(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);
      // Limpar pausa programada ao cancelar
      const campaign = await CampaignModel.update(campaignId, { 
        status: 'cancelled',
        pause_started_at: null 
      });

      console.log(`🛑 Campanha ${campaignId} cancelada manualmente`);

      res.json({ 
        success: true, 
        data: campaign,
        message: 'Campanha cancelada com sucesso' 
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async edit(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);
      const {
        name,
        scheduled_at,
        schedule_config,
        pause_config,
      } = req.body;

      console.log(`✏️ Editando campanha ${campaignId}`);

      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }

      // Buscar campanha atual
      const currentCampaign = await CampaignModel.findById(campaignId, tenantId);

      if (!currentCampaign) {
        return res.status(404).json({ success: false, error: 'Campanha não encontrada' });
      }

      // Verificar se pode editar (não pode editar completed ou cancelled)
      if (currentCampaign.status === 'completed' || currentCampaign.status === 'cancelled') {
        return res.status(400).json({ 
          success: false, 
          error: 'Não é possível editar uma campanha concluída ou cancelada' 
        });
      }

      // Preparar dados para atualização
      const updateData: any = {};

      if (name) updateData.name = name;
      
      // ⚠️ IMPORTANTE: Não alterar scheduled_at se a campanha já está rodando
      // Uma vez iniciada, o agendamento não deve mais ser modificado
      if (scheduled_at !== undefined && currentCampaign.status !== 'running') {
        updateData.scheduled_at = scheduled_at ? new Date(scheduled_at) : null;
      } else if (scheduled_at !== undefined && currentCampaign.status === 'running') {
        console.log(`⚠️ Ignorando alteração de scheduled_at pois campanha já está RUNNING`);
        // Se tentar agendar uma campanha running, remover o agendamento
        updateData.scheduled_at = null;
      }
      
      if (schedule_config) updateData.schedule_config = schedule_config;
      if (pause_config) updateData.pause_config = pause_config;

      // Atualizar campanha
      const campaign = await CampaignModel.update(campaignId, updateData);

      console.log(`✅ Campanha ${campaignId} editada com sucesso`);

      res.json({ 
        success: true, 
        data: campaign,
        message: 'Campanha editada com sucesso' 
      });
    } catch (error: any) {
      console.error('❌ Erro ao editar campanha:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);
      
      console.log(`🗑️ Excluindo campanha ${campaignId}`);

      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }

      // Verificar se a campanha existe
      const campaign = await CampaignModel.findById(campaignId, tenantId);
      if (!campaign) {
        return res.status(404).json({ success: false, error: 'Campanha não encontrada' });
      }

      // Excluir mensagens associadas
      await tenantQuery(req, 'DELETE FROM messages WHERE campaign_id = $1', [campaignId]);
      
      // Excluir templates da campanha
      await tenantQuery(req, 'DELETE FROM campaign_templates WHERE campaign_id = $1', [campaignId]);
      
      // Excluir associações de contatos
      await tenantQuery(req, 'DELETE FROM campaign_contacts WHERE campaign_id = $1', [campaignId]);
      
      // Excluir a campanha
      await CampaignModel.delete(campaignId);

      console.log(`✅ Campanha ${campaignId} excluída com sucesso`);

      res.json({ success: true, message: 'Campanha excluída com sucesso' });
    } catch (error: any) {
      console.error('❌ Erro ao excluir campanha:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Excluir todas as campanhas finalizadas (concluídas ou canceladas)
   */
  async deleteFinished(req: Request, res: Response) {
    try {
      console.log('🗑️ Excluindo todas as campanhas finalizadas...');

      // Buscar campanhas finalizadas
      const campaignsResult = await tenantQuery(req, 
        `SELECT id, name, status, completed_at 
         FROM campaigns 
         WHERE status IN ('completed', 'cancelled')
         ORDER BY completed_at DESC`,
        []
      );

      const campaigns = campaignsResult.rows;
      
      if (campaigns.length === 0) {
        return res.json({ 
          success: true, 
          message: 'Nenhuma campanha finalizada para excluir',
          data: { deleted_count: 0 }
        });
      }

      console.log(`📋 Encontradas ${campaigns.length} campanhas finalizadas`);

      let deletedCount = 0;
      const campaignIds = campaigns.map((c) => c.id);

      // Excluir em batch para melhor performance
      // 1. Excluir mensagens
      const messagesResult = await tenantQuery(req, 
        'DELETE FROM messages WHERE campaign_id = ANY($1::int[])',
        [campaignIds]
      );
      console.log(`🗑️ ${messagesResult.rowCount} mensagens excluídas`);

      // 2. Excluir templates das campanhas
      const templatesResult = await tenantQuery(req, 
        'DELETE FROM campaign_templates WHERE campaign_id = ANY($1::int[])',
        [campaignIds]
      );
      console.log(`🗑️ ${templatesResult.rowCount} templates excluídos`);

      // 3. Excluir associações de contatos
      const contactsResult = await tenantQuery(req, 
        'DELETE FROM campaign_contacts WHERE campaign_id = ANY($1::int[])',
        [campaignIds]
      );
      console.log(`🗑️ ${contactsResult.rowCount} associações de contatos excluídas`);

      // 4. Excluir as campanhas
      const campaignsDeleteResult = await tenantQuery(req, 
        'DELETE FROM campaigns WHERE id = ANY($1::int[])',
        [campaignIds]
      );
      deletedCount = campaignsDeleteResult.rowCount || 0;

      console.log(`✅ ${deletedCount} campanhas excluídas com sucesso`);

      res.json({ 
        success: true, 
        message: `${deletedCount} campanha(s) excluída(s) com sucesso`,
        data: { 
          deleted_count: deletedCount,
          campaigns: campaigns.map((c) => ({ id: c.id, name: c.name, status: c.status }))
        }
      });
    } catch (error: any) {
      console.error('❌ Erro ao excluir campanhas finalizadas:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Excluir campanhas finalizadas há mais de N dias (para automação)
   */
  async deleteOldFinished(req: Request, days: number = 7): Promise<number> {
    try {
      console.log(`🗑️ Limpeza automática: Excluindo campanhas finalizadas há mais de ${days} dias...`);

      // Buscar campanhas finalizadas há mais de N dias
      const campaignsResult = await tenantQuery(req, 
        `SELECT id, name, status, completed_at 
         FROM campaigns 
         WHERE status IN ('completed', 'cancelled')
         AND completed_at < NOW() - INTERVAL '${days} days'
         ORDER BY completed_at DESC`,
        []
      );

      const campaigns = campaignsResult.rows;
      
      if (campaigns.length === 0) {
        console.log('✅ Nenhuma campanha antiga para excluir');
        return 0;
      }

      console.log(`📋 Encontradas ${campaigns.length} campanhas antigas (>${days} dias)`);

      const campaignIds = campaigns.map((c) => c.id);

      // Excluir em batch
      await tenantQuery(req, 'DELETE FROM messages WHERE campaign_id = ANY($1::int[])', [campaignIds]);
      await tenantQuery(req, 'DELETE FROM campaign_templates WHERE campaign_id = ANY($1::int[])', [campaignIds]);
      await tenantQuery(req, 'DELETE FROM campaign_contacts WHERE campaign_id = ANY($1::int[])', [campaignIds]);
      const result = await tenantQuery(req, 'DELETE FROM campaigns WHERE id = ANY($1::int[])', [campaignIds]);

      const deletedCount = result.rowCount || 0;
      console.log(`✅ Limpeza automática: ${deletedCount} campanhas antigas excluídas`);
      
      return deletedCount;
    } catch (error: any) {
      console.error('❌ Erro na limpeza automática de campanhas:', error);
      throw error;
    }
  }

  async getStats(req: Request, res: Response) {
    try {
      const stats = await MessageModel.getCampaignStats(parseInt(req.params.id));
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Obter status das contas de uma campanha
   */
  async getAccountsStatus(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);

      console.log(`📊 Obtendo status das contas da campanha ${campaignId}`);

      const result = await tenantQuery(req, 
        `SELECT 
          ct.id,
          ct.whatsapp_account_id,
          ct.is_active,
          ct.consecutive_failures,
          ct.last_error,
          ct.removed_at,
          ct.template_id,
          w.name as account_name,
          w.phone_number,
          t.template_name,
          (SELECT COUNT(*) FROM messages WHERE campaign_id = $1 AND whatsapp_account_id = ct.whatsapp_account_id AND status = 'sent') as sent_count,
          (SELECT COUNT(*) FROM messages WHERE campaign_id = $1 AND whatsapp_account_id = ct.whatsapp_account_id AND status = 'failed') as failed_count
         FROM campaign_templates ct
         JOIN whatsapp_accounts w ON ct.whatsapp_account_id = w.id
         LEFT JOIN templates t ON ct.template_id = t.id
         WHERE ct.campaign_id = $1
         ORDER BY ct.order_index`,
        [campaignId]
      );

      // Agrupar por conta (uma conta pode ter múltiplos templates)
      const accountsMap = new Map();
      
      result.rows.forEach((row) => {
        if (!accountsMap.has(row.whatsapp_account_id)) {
          accountsMap.set(row.whatsapp_account_id, {
            account_id: row.whatsapp_account_id,
            account_name: row.account_name,
            phone_number: row.phone_number,
            is_active: row.is_active,
            consecutive_failures: row.consecutive_failures,
            last_error: row.last_error,
            removed_at: row.removed_at,
            sent_count: parseInt(row.sent_count) || 0,
            failed_count: parseInt(row.failed_count) || 0,
            templates: []
          });
        }
        
        const account = accountsMap.get(row.whatsapp_account_id);
        account.templates.push({
          template_id: row.template_id,
          template_name: row.template_name,
          campaign_template_id: row.id
        });
      });

      const accounts = Array.from(accountsMap.values());

      console.log(`✅ Status de ${accounts.length} contas obtido`);

      res.json({
        success: true,
        data: accounts
      });
    } catch (error: any) {
      console.error('❌ Erro ao obter status das contas:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Remover conta de uma campanha (desativa temporariamente)
   */
  async removeAccount(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);
      const { accountId } = req.body;

      console.log(`🗑️ Removendo conta ${accountId} da campanha ${campaignId}`);

      // Verificar se a campanha existe e está em andamento
      const campaignResult = await tenantQuery(req, 
        'SELECT status FROM campaigns WHERE id = $1',
        [campaignId]
      );

      if (campaignResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Campanha não encontrada'
        });
      }

      const campaignStatus = campaignResult.rows[0].status;

      // Desativar todas as entradas de campaign_templates para esta conta
      const updateResult = await tenantQuery(req, 
        `UPDATE campaign_templates 
         SET is_active = false, removed_at = NOW()
         WHERE campaign_id = $1 AND whatsapp_account_id = $2
         RETURNING *`,
        [campaignId, accountId]
      );

      if (updateResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Conta não encontrada nesta campanha'
        });
      }

      // Verificar quantas contas ativas restam
      const activeCountResult = await tenantQuery(req, 
        `SELECT COUNT(DISTINCT whatsapp_account_id) as active_count
         FROM campaign_templates
         WHERE campaign_id = $1 AND is_active = true`,
        [campaignId]
      );

      const activeCount = parseInt(activeCountResult.rows[0].active_count);

      console.log(`✅ Conta ${accountId} removida da campanha ${campaignId}`);
      console.log(`📊 Contas ativas restantes: ${activeCount}`);

      if (activeCount === 0) {
        console.log('⚠️ AVISO: Nenhuma conta ativa restante! Pausando campanha...');
        await tenantQuery(req, 
          'UPDATE campaigns SET status = $1 WHERE id = $2',
          ['paused', campaignId]
        );
      }

      res.json({
        success: true,
        message: 'Conta removida com sucesso',
        data: {
          removed_templates: updateResult.rows.length,
          active_accounts_remaining: activeCount,
          campaign_paused: activeCount === 0
        }
      });
    } catch (error: any) {
      console.error('❌ Erro ao remover conta:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Re-adicionar conta a uma campanha (reativa)
   */
  async addAccount(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);
      const { accountId } = req.body;

      console.log(`✅ Re-adicionando MANUALMENTE conta ${accountId} à campanha ${campaignId}`);

      // Buscar dados atuais
      const current = await tenantQuery(req, 
        `SELECT removal_history FROM campaign_templates 
         WHERE campaign_id = $1 AND whatsapp_account_id = $2 
         LIMIT 1`,
        [campaignId, accountId]
      );

      if (current.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Conta não encontrada nesta campanha'
        });
      }

      // Atualizar histórico com reativação manual
      let history = [];
      try {
        history = current.rows[0].removal_history ? 
          (typeof current.rows[0].removal_history === 'string' ? 
            JSON.parse(current.rows[0].removal_history) : 
            current.rows[0].removal_history) : 
          [];
      } catch (e) {
        history = [];
      }

      if (history.length > 0) {
        history[history.length - 1].reactivated_at = new Date().toISOString();
        history[history.length - 1].reactivation_reason = 'Reativação manual pelo usuário';
      }

      // Reativar todas as entradas de campaign_templates para esta conta
      // IMPORTANTE: Não resetar removal_count (mantém histórico)
      const updateResult = await tenantQuery(req, 
        `UPDATE campaign_templates 
         SET is_active = true, 
             consecutive_failures = 0, 
             last_error = NULL, 
             removed_at = NULL,
             permanent_removal = false,
             removal_history = $1
         WHERE campaign_id = $2 AND whatsapp_account_id = $3
         RETURNING *`,
        [JSON.stringify(history), campaignId, accountId]
      );

      if (updateResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Conta não encontrada nesta campanha'
        });
      }

      // Verificar quantas contas ativas agora
      const activeCountResult = await tenantQuery(req, 
        `SELECT COUNT(DISTINCT whatsapp_account_id) as active_count
         FROM campaign_templates
         WHERE campaign_id = $1 AND is_active = true`,
        [campaignId]
      );

      const activeCount = parseInt(activeCountResult.rows[0].active_count);

      console.log(`✅ Conta ${accountId} re-adicionada à campanha ${campaignId}`);
      console.log(`📊 Total de contas ativas: ${activeCount}`);

      res.json({
        success: true,
        message: 'Conta re-adicionada com sucesso',
        data: {
          reactivated_templates: updateResult.rows.length,
          active_accounts_total: activeCount
        }
      });
    } catch (error: any) {
      console.error('❌ Erro ao re-adicionar conta:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Atualizar configuração de remoção automática
   */
  async updateAutoRemoveConfig(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);
      const { auto_remove_account_failures } = req.body;

      console.log(`⚙️ Atualizando config de remoção automática da campanha ${campaignId}: ${auto_remove_account_failures} falhas`);

      const result = await tenantQuery(req, 
        'UPDATE campaigns SET auto_remove_account_failures = $1 WHERE id = $2 RETURNING *',
        [auto_remove_account_failures, campaignId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Campanha não encontrada'
        });
      }

      res.json({
        success: true,
        message: 'Configuração atualizada',
        data: result.rows[0]
      });
    } catch (error: any) {
      console.error('❌ Erro ao atualizar configuração:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Gerar e baixar relatório Excel da campanha
   */
  async downloadReport(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);

      console.log(`📊 Gerando relatório Excel para campanha ${campaignId}...`);

      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }

      // Verificar se a campanha existe
      const campaign = await CampaignModel.findById(campaignId, tenantId);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          error: 'Campanha não encontrada'
        });
      }

      // Gerar relatório
      const buffer = await reportService.generateCampaignReport(campaignId, tenantId);

      // Configurar headers para download
      const fileName = `Relatorio_Campanha_${campaign.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      console.log(`✅ Relatório gerado com sucesso: ${fileName}`);

      // Enviar arquivo
      res.send(buffer);
    } catch (error: any) {
      console.error('❌ Erro ao gerar relatório:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Gerar e baixar relatório geral de todas as campanhas
   */
  async downloadGeneralReport(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      console.log('📊 Gerando relatório geral de todas as campanhas...');
      console.log('   📅 Filtros:', { startDate, endDate });

      const workbook = new ExcelJS.Workbook();
      
      // Estilos
      const headerStyle = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF4472C4' } },
        alignment: { vertical: 'middle' as const, horizontal: 'center' as const },
        border: {
          top: { style: 'thin' as const },
          left: { style: 'thin' as const },
          bottom: { style: 'thin' as const },
          right: { style: 'thin' as const }
        }
      };

      // Query para buscar campanhas
      let dateFilter = '';
      const params: any[] = [];

      if (startDate && endDate) {
        dateFilter = 'WHERE created_at >= $1 AND created_at <= $2';
        params.push(startDate, endDate);
      } else if (startDate) {
        dateFilter = 'WHERE DATE(created_at) = $1';
        params.push(startDate);
      }

      const campaignsQuery = `
        SELECT 
          id,
          name,
          status,
          total_contacts,
          sent_count,
          delivered_count,
          read_count,
          failed_count,
          created_at,
          started_at,
          completed_at,
          scheduled_at
        FROM campaigns
        ${dateFilter}
        ORDER BY created_at DESC
      `;

      const campaignsResult = await tenantQuery(req, campaignsQuery, params);
      const campaigns = campaignsResult.rows;

      // Buscar dados adicionais para cada campanha (sem WhatsApp e cliques)
      for (const campaign of campaigns) {
        // Buscar contagem de "sem WhatsApp"
        const noWhatsappResult = await tenantQuery(req, 
          `SELECT COUNT(*) as count FROM messages 
           WHERE campaign_id = $1 
           AND (error_message ILIKE '%131026%' 
           OR error_message ILIKE '%not registered%'
           OR error_message ILIKE '%no whatsapp%')`,
          [campaign.id]
        );
        campaign.no_whatsapp_count = parseInt(noWhatsappResult.rows[0]?.count) || 0;

        // Buscar contagem de cliques em botões
        const buttonClicksResult = await tenantQuery(req, 
          'SELECT COUNT(*) as count FROM button_clicks WHERE campaign_id = $1',
          [campaign.id]
        );
        campaign.button_clicks_count = parseInt(buttonClicksResult.rows[0]?.count) || 0;
      }

      console.log(`✅ Dados de ${campaigns.length} campanhas carregados para o relatório`);

      // Aba: Resumo Geral
      const resumoSheet = workbook.addWorksheet('Resumo Geral');
      resumoSheet.columns = [
        { header: 'Campanha', key: 'name', width: 30 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Total Contatos', key: 'total', width: 15 },
        { header: 'Enviadas', key: 'sent', width: 12 },
        { header: 'Entregues', key: 'delivered', width: 12 },
        { header: 'Lidas', key: 'read', width: 12 },
        { header: 'Falhas', key: 'failed', width: 12 },
        { header: 'Sem WhatsApp', key: 'no_whatsapp', width: 15 },
        { header: 'Cliques Botões', key: 'clicks', width: 15 },
        { header: 'Taxa Entrega %', key: 'delivery_rate', width: 15 },
        { header: 'Criada Em', key: 'created', width: 18 }
      ];

      resumoSheet.getRow(1).eachCell(cell => {
        cell.style = headerStyle;
      });

      campaigns.forEach((campaign: any) => {
        const deliveryRate = campaign.sent_count > 0 
          ? ((campaign.delivered_count / campaign.sent_count) * 100).toFixed(2)
          : '0.00';

        resumoSheet.addRow({
          name: campaign.name,
          status: campaign.status,
          total: campaign.total_contacts || 0,
          sent: campaign.sent_count || 0,
          delivered: campaign.delivered_count || 0,
          read: campaign.read_count || 0,
          failed: campaign.failed_count || 0,
          no_whatsapp: campaign.no_whatsapp_count || 0,
          clicks: campaign.button_clicks_count || 0,
          delivery_rate: `${deliveryRate}%`,
          created: new Date(campaign.created_at).toLocaleString('pt-BR')
        });
      });

      // Totais
      const totalRow = resumoSheet.addRow({
        name: 'TOTAL GERAL',
        status: '-',
        total: campaigns.reduce((sum: number, c: any) => sum + (c.total_contacts || 0), 0),
        sent: campaigns.reduce((sum: number, c: any) => sum + (c.sent_count || 0), 0),
        delivered: campaigns.reduce((sum: number, c: any) => sum + (c.delivered_count || 0), 0),
        read: campaigns.reduce((sum: number, c: any) => sum + (c.read_count || 0), 0),
        failed: campaigns.reduce((sum: number, c: any) => sum + (c.failed_count || 0), 0),
        no_whatsapp: campaigns.reduce((sum: number, c: any) => sum + (c.no_whatsapp_count || 0), 0),
        clicks: campaigns.reduce((sum: number, c: any) => sum + (c.button_clicks_count || 0), 0),
        delivery_rate: '-',
        created: '-'
      });

      totalRow.eachCell(cell => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE7E6E6' } };
      });

      // Aplicar bordas
      resumoSheet.eachRow((row) => {
        row.eachCell(cell => {
          cell.border = {
            top: { style: 'thin' as const },
            left: { style: 'thin' as const },
            bottom: { style: 'thin' as const },
            right: { style: 'thin' as const }
          };
        });
      });

      // Gerar arquivo
      const buffer = await workbook.xlsx.writeBuffer();
      
      const dateRange = startDate && endDate 
        ? `${startDate}_${endDate}`
        : startDate 
          ? startDate 
          : 'Todas';
      const fileName = `Relatorio_Geral_Campanhas_${dateRange}_${Date.now()}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      console.log(`✅ Relatório geral gerado: ${fileName}`);

      res.send(buffer);
    } catch (error: any) {
      console.error('❌ Erro ao gerar relatório geral:', error);
      console.error('   Stack:', error.stack);
      res.status(500).json({ success: false, error: error.message, stack: error.stack });
    }
  }

  /**
   * Baixar modelo Excel de contatos
   */
  async downloadContactsTemplate(req: Request, res: Response) {
    try {
      console.log('📥 Gerando modelo Excel de contatos...');

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Contatos');

      // Estilo do cabeçalho
      const headerStyle = {
        font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 },
        fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF4472C4' } },
        alignment: { vertical: 'middle' as const, horizontal: 'center' as const },
        border: {
          top: { style: 'thin' as const },
          left: { style: 'thin' as const },
          bottom: { style: 'thin' as const },
          right: { style: 'thin' as const }
        }
      };

      // Definir colunas
      sheet.columns = [
        { header: 'NUMERO', key: 'numero', width: 20 },
        { header: 'VARIAVEL_1', key: 'variavel_1', width: 20 },
        { header: 'VARIAVEL_2', key: 'variavel_2', width: 20 },
        { header: 'VARIAVEL_3', key: 'variavel_3', width: 20 }
      ];

      // Aplicar estilo ao cabeçalho
      sheet.getRow(1).eachCell(cell => {
        cell.style = headerStyle;
      });

      // Adicionar exemplos
      sheet.addRow({
        numero: '5511999887766',
        variavel_1: 'João',
        variavel_2: 'São Paulo',
        variavel_3: '15/08'
      });

      sheet.addRow({
        numero: '5521988776655',
        variavel_1: 'Maria',
        variavel_2: 'Rio de Janeiro',
        variavel_3: '20/09'
      });

      sheet.addRow({
        numero: '5531977665544',
        variavel_1: 'Pedro',
        variavel_2: 'Belo Horizonte',
        variavel_3: '10/10'
      });

      // Aplicar bordas em todas as células
      sheet.eachRow((row, rowNumber) => {
        row.eachCell(cell => {
          if (rowNumber > 1) { // Não aplicar nos exemplos
            cell.border = {
              top: { style: 'thin' as const },
              left: { style: 'thin' as const },
              bottom: { style: 'thin' as const },
              right: { style: 'thin' as const }
            };
          }
        });
      });

      // Adicionar observações em uma aba separada
      const instructionsSheet = workbook.addWorksheet('Instruções');
      instructionsSheet.columns = [
        { header: 'INSTRUÇÕES DE USO', key: 'instructions', width: 80 }
      ];

      instructionsSheet.getRow(1).getCell(1).style = headerStyle;

      instructionsSheet.addRow({ instructions: '' });
      instructionsSheet.addRow({ instructions: '📋 FORMATO DO ARQUIVO:' });
      instructionsSheet.addRow({ instructions: '• A coluna NUMERO é obrigatória' });
      instructionsSheet.addRow({ instructions: '• O número deve estar completo com DDI + DDD (Exemplo: 5511999887766)' });
      instructionsSheet.addRow({ instructions: '• As colunas VARIAVEL_1, VARIAVEL_2, VARIAVEL_3... são opcionais' });
      instructionsSheet.addRow({ instructions: '• Use quantas variáveis precisar (VARIAVEL_1, VARIAVEL_2, VARIAVEL_3, etc.)' });
      instructionsSheet.addRow({ instructions: '' });
      instructionsSheet.addRow({ instructions: '⚠️ IMPORTANTE:' });
      instructionsSheet.addRow({ instructions: '• Não altere o nome das colunas (NUMERO, VARIAVEL_1, VARIAVEL_2, etc.)' });
      instructionsSheet.addRow({ instructions: '• Delete os exemplos antes de adicionar seus contatos reais' });
      instructionsSheet.addRow({ instructions: '• Certifique-se de que todos os números estão corretos' });
      instructionsSheet.addRow({ instructions: '• Use a aba "Contatos" para adicionar seus dados' });

      // Gerar arquivo
      const buffer = await workbook.xlsx.writeBuffer();
      const fileName = `Modelo_Contatos_Campanha.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      console.log(`✅ Modelo de contatos gerado: ${fileName}`);

      res.send(buffer);
    } catch (error: any) {
      console.error('❌ Erro ao gerar modelo de contatos:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Buscar estatísticas de envios imediatos (mensagens diretas)
   */
  async getImmediateMessagesStats(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      console.log('📨 Buscando estatísticas de envios imediatos...');
      console.log('Filtros:', { startDate, endDate });

      // Construir filtro de data (CORRIGIDO: inclui dia inteiro + trata registros sem data)
      let dateFilter = '';
      const params: any[] = [];
      
      if (startDate && endDate) {
        dateFilter = 'AND sent_at IS NOT NULL AND sent_at >= $1::date AND sent_at < ($2::date + INTERVAL \'1 day\')';
        params.push(startDate, endDate);
      } else if (startDate) {
        dateFilter = 'AND sent_at IS NOT NULL AND sent_at >= $1::date AND sent_at < ($1::date + INTERVAL \'1 day\')';
        params.push(startDate);
      } else if (endDate) {
        dateFilter = 'AND sent_at IS NOT NULL AND sent_at < ($1::date + INTERVAL \'1 day\')';
        params.push(endDate);
      } else {
        // Padrão: apenas mensagens de hoje (com sent_at válido)
        dateFilter = 'AND sent_at IS NOT NULL AND sent_at >= CURRENT_DATE AT TIME ZONE \'America/Sao_Paulo\' AND sent_at < (CURRENT_DATE + INTERVAL \'1 day\') AT TIME ZONE \'America/Sao_Paulo\'';
      }

      console.log('📅 Filtro de data:', dateFilter);
      console.log('📦 Params:', params);

      // Buscar mensagens que NÃO são de campanhas (campaign_id IS NULL)
      const messagesQuery = `
        SELECT 
          COUNT(*) as total_sent,
          COUNT(*) FILTER (WHERE status = 'delivered') as total_delivered,
          COUNT(*) FILTER (WHERE status = 'read') as total_read,
          COUNT(*) FILTER (WHERE status = 'failed') as total_failed,
          COUNT(DISTINCT phone_number) as unique_contacts
        FROM messages
        WHERE campaign_id IS NULL
        ${dateFilter}
      `;

      const result = await tenantQuery(req, messagesQuery, params);
      const stats = result.rows[0];

      // Calcular taxas
      const totalSent = parseInt(stats.total_sent) || 0;
      const totalDelivered = parseInt(stats.total_delivered) || 0;
      const totalRead = parseInt(stats.total_read) || 0;
      const totalFailed = parseInt(stats.total_failed) || 0;

      const deliveryRate = totalSent > 0 ? ((totalDelivered / totalSent) * 100) : 0;
      const readRate = totalSent > 0 ? ((totalRead / totalSent) * 100) : 0;
      const failureRate = totalSent > 0 ? ((totalFailed / totalSent) * 100) : 0;

      // Buscar cliques de botões de mensagens imediatas (com filtro de data)
      // NOTA: Substituir 'sent_at' por 'clicked_at' no filtro
      const buttonDateFilter = dateFilter.replace(/sent_at/g, 'clicked_at');
      
      const buttonClicksQuery = `
        SELECT 
          COUNT(*) as total_clicks,
          COUNT(DISTINCT button_text) as unique_buttons,
          COUNT(DISTINCT phone_number) as unique_contacts
        FROM button_clicks
        WHERE campaign_id IS NULL
        ${buttonDateFilter}
      `;
      
      console.log('🔘 Query de cliques:', buttonClicksQuery);
      
      const buttonResult = await tenantQuery(req, buttonClicksQuery, params);
      const buttonStats = buttonResult.rows[0];
      const totalButtonClicks = parseInt(buttonStats.total_clicks) || 0;
      const uniqueButtons = parseInt(buttonStats.unique_buttons) || 0;
      const uniqueButtonContacts = parseInt(buttonStats.unique_contacts) || 0;

      console.log('✅ Estatísticas de envios imediatos carregadas');
      console.log(`   📨 Total enviado: ${totalSent}`);
      console.log(`   ✅ Entregues: ${totalDelivered}`);
      console.log(`   👀 Lidas: ${totalRead}`);
      console.log(`   ❌ Falhas: ${totalFailed}`);
      console.log(`   👥 Contatos únicos: ${parseInt(stats.unique_contacts) || 0}`);
      console.log(`   🔘 Cliques em botões: ${totalButtonClicks}`);

      res.json({
        success: true,
        data: {
          total_sent: totalSent,
          total_delivered: totalDelivered,
          total_read: totalRead,
          total_failed: totalFailed,
          unique_contacts: parseInt(stats.unique_contacts) || 0,
          button_clicks: {
            total_clicks: totalButtonClicks,
            unique_buttons: uniqueButtons,
            unique_contacts: uniqueButtonContacts
          },
          rates: {
            delivery: parseFloat(deliveryRate.toFixed(2)),
            read: parseFloat(readRate.toFixed(2)),
            failure: parseFloat(failureRate.toFixed(2))
          }
        }
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar estatísticas de envios imediatos:', error);
      console.error('Stack trace:', error.stack);
      console.error('Query error details:', error.detail);
      res.status(500).json({ 
        success: false, 
        error: error.message, 
        detail: error.detail,
        stack: error.stack 
      });
    }
  }

  /**
   * Buscar histórico de envios imediatos (log)
   */
  async getImmediateMessagesLog(req: Request, res: Response) {
    try {
      const { limit = 50, offset = 0, startDate, endDate } = req.query;

      console.log('📋 Buscando histórico de envios imediatos...');
      console.log(`   📅 Filtro: startDate=${startDate}, endDate=${endDate}`);

      // Construir WHERE clause com filtro de data
      let whereClause = 'm.campaign_id IS NULL';
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (startDate) {
        whereClause += ` AND m.sent_at >= $${paramIndex}::date`;
        queryParams.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereClause += ` AND m.sent_at < ($${paramIndex}::date + interval '1 day')`;
        queryParams.push(endDate);
        paramIndex++;
      }

      // Buscar mensagens que NÃO são de campanhas (campaign_id IS NULL)
      const messagesQuery = `
        SELECT 
          m.id,
          m.phone_number,
          m.template_name,
          m.status,
          m.sent_at,
          m.delivered_at,
          m.read_at,
          m.failed_at,
          m.error_message,
          m.whatsapp_message_id,
          c.name as contact_name,
          wa.name as account_name,
          wa.phone_number as account_phone
        FROM messages m
        LEFT JOIN contacts c ON m.contact_id = c.id
        LEFT JOIN whatsapp_accounts wa ON m.whatsapp_account_id = wa.id
        WHERE ${whereClause}
        ORDER BY m.sent_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(limit, offset);
      const result = await tenantQuery(req, messagesQuery, queryParams);
      const messages = result.rows;

      // Contar total (aplicando o mesmo filtro de data)
      const countQueryParams: any[] = [];
      let countParamIndex = 1;
      let countWhereClause = 'campaign_id IS NULL';

      if (startDate) {
        countWhereClause += ` AND sent_at >= $${countParamIndex}::date`;
        countQueryParams.push(startDate);
        countParamIndex++;
      }

      if (endDate) {
        countWhereClause += ` AND sent_at < ($${countParamIndex}::date + interval '1 day')`;
        countQueryParams.push(endDate);
        countParamIndex++;
      }

      const countResult = await tenantQuery(req, 
        `SELECT COUNT(*) as total FROM messages WHERE ${countWhereClause}`,
        countQueryParams
      );
      const total = parseInt(countResult.rows[0].total) || 0;

      console.log(`✅ Encontrados ${messages.length} envios imediatos (total: ${total})`);

      res.json({
        success: true,
        data: {
          messages,
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        }
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar histórico de envios imediatos:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Buscar estatísticas gerais do dashboard
   */
  async getDashboardStats(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      console.log('📊 Buscando estatísticas do dashboard...');
      console.log('Filtros:', { startDate, endDate });

      // Construir query com filtro de data no SQL (mais eficiente e sem problemas de timezone)
      let campaignsQuery = 'SELECT * FROM campaigns';
      const params: any[] = [];
      let paramIndex = 1;
      let hasDateFilter = false;

      if (startDate && endDate) {
        console.log('Filtro: startDate E endDate fornecidos');
        campaignsQuery += ` WHERE created_at >= $${paramIndex++}::date AND created_at < ($${paramIndex++}::date + INTERVAL '1 day')`;
        params.push(startDate, endDate);
        hasDateFilter = true;
      } else if (startDate) {
        console.log('Filtro: apenas startDate fornecido');
        campaignsQuery += ` WHERE created_at >= $${paramIndex++}::date AND created_at < ($${paramIndex++}::date + INTERVAL '1 day')`;
        params.push(startDate, startDate);
        hasDateFilter = true;
      } else if (endDate) {
        console.log('Filtro: apenas endDate fornecido');
        campaignsQuery += ` WHERE created_at < ($${paramIndex++}::date + INTERVAL '1 day')`;
        params.push(endDate);
        hasDateFilter = true;
      } else {
        console.log('Filtro: NENHUM - usando hoje como padrão');
        // Padrão: apenas campanhas de hoje
        campaignsQuery += ` WHERE created_at >= CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo' AND created_at < (CURRENT_DATE + INTERVAL '1 day') AT TIME ZONE 'America/Sao_Paulo'`;
      }

      campaignsQuery += ' ORDER BY created_at DESC';

      console.log('Query SQL:', campaignsQuery);
      console.log('Params:', params);

      const campaignsResult = await tenantQuery(req, campaignsQuery, params);
      const filteredCampaigns = campaignsResult.rows;

      console.log(`✅ Campanhas encontradas: ${filteredCampaigns.length}`);

      // Calcular estatísticas
      const stats = {
        total: filteredCampaigns.length,
        active: filteredCampaigns.filter((c) => c.status === 'running').length,
        completed: filteredCampaigns.filter((c) => c.status === 'completed').length,
        paused: filteredCampaigns.filter((c) => c.status === 'paused').length,
        cancelled: filteredCampaigns.filter((c) => c.status === 'cancelled').length,
        total_sent: filteredCampaigns.reduce((sum: number, c: any) => sum + (parseInt(c.sent_count) || 0), 0),
        // ⚠️ CORREÇÃO: total_delivered deve incluir as lidas (pois lida implica entregue)
        total_delivered: filteredCampaigns.reduce((sum: number, c: any) => sum + (parseInt(c.delivered_count) || 0) + (parseInt(c.read_count) || 0), 0),
        total_read: filteredCampaigns.reduce((sum: number, c: any) => sum + (parseInt(c.read_count) || 0), 0),
        total_failed: filteredCampaigns.reduce((sum: number, c: any) => sum + (parseInt(c.failed_count) || 0), 0),
        total_contacts: filteredCampaigns.reduce((sum: number, c: any) => sum + (parseInt(c.total_contacts) || 0), 0)
      };

      // Contar contas WhatsApp (filtrar por tenant)
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }
      
      const accountsResult = await tenantQuery(req, 'SELECT * FROM whatsapp_accounts WHERE tenant_id = $1', [tenantId]);
      const accounts = accountsResult.rows;
      const accountStats = {
        total: accounts.length,
        active: accounts.filter((a: any) => a.is_active === true).length,
        inactive: accounts.filter((a: any) => a.is_active === false).length
      };

      // Calcular taxas
      const deliveryRate = stats.total_sent > 0 ? ((stats.total_delivered / stats.total_sent) * 100) : 0;
      const readRate = stats.total_sent > 0 ? ((stats.total_read / stats.total_sent) * 100) : 0;
      const failureRate = stats.total_sent > 0 ? ((stats.total_failed / stats.total_sent) * 100) : 0;

      // Buscar total de cliques em botões (apenas das campanhas filtradas)
      let totalButtonClicks = 0;
      let uniqueButtons = 0;
      let uniqueClickContacts = 0;
      
      if (filteredCampaigns.length > 0) {
        const campaignIds = filteredCampaigns.map((c) => c.id);
        const buttonClicksQuery = 'SELECT COUNT(*) as total_clicks, COUNT(DISTINCT button_text) as unique_buttons, COUNT(DISTINCT phone_number) as unique_contacts FROM button_clicks WHERE campaign_id = ANY($1)';
        const buttonClicksResult = await tenantQuery(req, buttonClicksQuery, [campaignIds]);
        const buttonClicks = buttonClicksResult.rows[0];
        totalButtonClicks = parseInt(buttonClicks.total_clicks) || 0;
        uniqueButtons = parseInt(buttonClicks.unique_buttons) || 0;
        uniqueClickContacts = parseInt(buttonClicks.unique_contacts) || 0;
      }

      // Buscar total de números sem WhatsApp (erro 131026) - apenas das campanhas filtradas
      let totalNoWhatsapp = 0;
      
      if (filteredCampaigns.length > 0) {
        const campaignIds = filteredCampaigns.map((c) => c.id);
        const noWhatsappQuery = `SELECT COUNT(*) as count FROM messages 
           WHERE (error_message ILIKE '%131026%' 
           OR error_message ILIKE '%not registered%'
           OR error_message ILIKE '%no whatsapp%')
           AND campaign_id = ANY($1)`;
        const noWhatsappResult = await tenantQuery(req, noWhatsappQuery, [campaignIds]);
        totalNoWhatsapp = parseInt(noWhatsappResult.rows[0]?.count) || 0;
      }

      // Últimas 5 campanhas (com status real)
      const recentCampaignsRaw = filteredCampaigns.slice(0, 5);
      const recentCampaigns = recentCampaignsRaw.map((campaign: any) => {
        let currentStatus = campaign.status;
        
        // Se a campanha está rodando ou pausada, verificar condições
        if (campaign.status === 'running' || campaign.status === 'paused') {
          const scheduleConfig = campaign.schedule_config || {};
          
          // Verificar horário de trabalho
          if (scheduleConfig.work_start_time && scheduleConfig.work_end_time) {
            const now = new Date();
            const currentTime = now.toTimeString().slice(0, 5); // HH:MM
            const startTime = scheduleConfig.work_start_time;
            const endTime = scheduleConfig.work_end_time;
            
            const isWithinWorkHours = currentTime >= startTime && currentTime <= endTime;
            
            if (!isWithinWorkHours) {
              currentStatus = 'outside_hours';
            }
          }
          
          // Verificar pausa programada
          const pauseState = campaignWorker.getPauseState(campaign.id);
          const shouldBePaused = pauseState !== null;
          
          if (shouldBePaused && currentStatus !== 'outside_hours') {
            currentStatus = 'pause_programmed';
          }
        }
        
        return {
          ...campaign,
          realStatus: currentStatus // Status real considerando todas as condições
        };
      });

      console.log('✅ Estatísticas calculadas com sucesso');
      console.log(`   🔘 Cliques em botões: ${totalButtonClicks}`);
      console.log(`   📋 Botões únicos: ${uniqueButtons}`);
      console.log(`   👥 Contatos únicos que clicaram: ${uniqueClickContacts}`);
      console.log(`   📵 Sem WhatsApp: ${totalNoWhatsapp}`);

      res.json({
        success: true,
        data: {
          campaigns: {
            total: stats.total,
            active: stats.active,
            completed: stats.completed,
            paused: stats.paused,
            cancelled: stats.cancelled
          },
          messages: {
            total_sent: stats.total_sent,
            total_delivered: stats.total_delivered,
            total_read: stats.total_read,
            total_failed: stats.total_failed,
            total_no_whatsapp: totalNoWhatsapp,
            total_button_clicks: totalButtonClicks,
            total_contacts: stats.total_contacts,
            unique_buttons: uniqueButtons,
            unique_click_contacts: uniqueClickContacts
          },
          accounts: {
            total: accountStats.total,
            active: accountStats.active,
            inactive: accountStats.inactive
          },
          rates: {
            delivery: parseFloat(deliveryRate.toFixed(2)),
            read: parseFloat(readRate.toFixed(2)),
            failure: parseFloat(failureRate.toFixed(2))
          },
          recent_campaigns: recentCampaigns
        }
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar estatísticas do dashboard:', error);
      console.error('Stack:', error.stack);
      res.status(500).json({ success: false, error: error.message, stack: error.stack });
    }
  }

  /**
   * Buscar botões e ranking de cliques da campanha
   */
  async getButtonsStats(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);

      console.log(`🔘 Buscando botões e estatísticas de cliques da campanha ${campaignId}...`);

      // Buscar todos os botões únicos da campanha
      const buttonsResult = await tenantQuery(req, 
        `SELECT 
          button_text,
          button_payload,
          COUNT(*) as click_count,
          COUNT(DISTINCT phone_number) as unique_contacts,
          MIN(clicked_at) as first_click,
          MAX(clicked_at) as last_click
         FROM button_clicks
         WHERE campaign_id = $1
         GROUP BY button_text, button_payload
         ORDER BY click_count DESC`,
        [campaignId]
      );

      const buttons = buttonsResult.rows;

      // Buscar TOP 5 botões mais clicados
      const topButtonsResult = await tenantQuery(req, 
        `SELECT 
          button_text,
          button_payload,
          COUNT(*) as click_count,
          COUNT(DISTINCT phone_number) as unique_contacts,
          COUNT(DISTINCT contact_id) as registered_contacts
         FROM button_clicks
         WHERE campaign_id = $1
         GROUP BY button_text, button_payload
         ORDER BY click_count DESC
         LIMIT 5`,
        [campaignId]
      );

      const topButtons = topButtonsResult.rows;

      // Total de cliques
      const totalClicks = buttons.reduce((sum: number, b: any) => sum + parseInt(b.click_count), 0);
      const totalUniqueContacts = new Set(buttons.flatMap((b: any) => b.unique_contacts)).size;

      console.log(`✅ Encontrados ${buttons.length} botões com ${totalClicks} cliques`);

      res.json({
        success: true,
        data: {
          buttons: buttons.map((b: any) => ({
            text: b.button_text,
            payload: b.button_payload,
            clickCount: parseInt(b.click_count),
            uniqueContacts: parseInt(b.unique_contacts),
            firstClick: b.first_click,
            lastClick: b.last_click
          })),
          topButtons: topButtons.map((b: any, index: number) => ({
            rank: index + 1,
            text: b.button_text,
            payload: b.button_payload,
            clickCount: parseInt(b.click_count),
            uniqueContacts: parseInt(b.unique_contacts),
            registeredContacts: parseInt(b.registered_contacts)
          })),
          summary: {
            totalButtons: buttons.length,
            totalClicks: totalClicks,
            totalUniqueContacts: totalUniqueContacts
          }
        }
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar botões e estatísticas:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const campaignController = new CampaignController();

