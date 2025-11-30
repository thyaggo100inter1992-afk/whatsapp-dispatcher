import { Request, Response } from 'express';
import { QrCampaignModel } from '../models/QrCampaign';
import { ContactModel } from '../models/Contact';
import { tenantQuery } from '../database/tenant-query';
import ExcelJS from 'exceljs';

export class QrCampaignController {
  /**
   * Criar nova campanha QR Connect
   * ✅ UPDATED: Agora inclui tenant_id corretamente [RELOADED]
   */
  async create(req: Request, res: Response) {
    try {
      // 🔒 OBTER TENANT_ID PRIMEIRO
      const tenantId = (req as any).tenant?.id;
      console.log('🔍 [INÍCIO] DEBUG tenant:', {
        tenant: (req as any).tenant,
        tenantId: tenantId,
        user: (req as any).user
      });

      if (!tenantId) {
        console.error('❌ ERRO: Tenant não identificado na requisição!');
        return res.status(401).json({
          success: false,
          error: 'Tenant não identificado'
        });
      }

      const {
        name,
        instance_ids,    // NOVO: Array de IDs de instâncias
        template_ids,    // NOVO: Array de IDs de templates
        contacts,
        scheduled_at,
        schedule_config,
        pause_config,
      } = req.body;

      // ✅ FIX: Adicionando tenant_id ao criar campanha
      console.log('🚀 Criando campanha QR Connect (ROTATIVIDADE DUPLA):', {
        name,
        tenantId,  // Adicionado
        instancesCount: instance_ids?.length || 0,
        templatesCount: template_ids?.length || 0,
        contactsCount: contacts.length,
        scheduled_at,
      });

      // Validações
      if (!instance_ids || instance_ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Selecione pelo menos uma instância'
        });
      }

      if (!template_ids || template_ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Selecione pelo menos um template'
        });
      }

      // 🚨 VERIFICAR LISTA DE RESTRIÇÃO **ANTES** DE CRIAR A CAMPANHA
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔍 VERIFICANDO LISTA DE RESTRIÇÃO (QR ENVIO EM ANDAMENTO)');
      console.log('═══════════════════════════════════════════════════════');
      console.log(`   📋 Total de contatos: ${contacts.length}`);
      console.log(`   🏢 Tenant ID: ${tenantId}`);
      
      try {
        const { RestrictionListController } = require('./restriction-list.controller');
        const restrictionController = new RestrictionListController();
        
        // Extrair números dos contatos
        const phoneNumbers = contacts.map((c: any) => c.phone || c.phone_number);
        console.log(`   📞 Números para verificar: ${phoneNumbers.length}`);
        
        // Criar request fake para o controller
        const fakeReq: any = {
          body: {
            phone_numbers: phoneNumbers,
            whatsapp_account_ids: instance_ids, // Passar as instâncias
          },
          tenant: { id: tenantId },
        };
        
        let restrictionResult: any = null;
        const fakeRes: any = {
          json: (data: any) => {
            restrictionResult = data;
          },
          status: () => fakeRes,
        };
        
        await restrictionController.checkBulk(fakeReq, fakeRes);
        
        if (restrictionResult && restrictionResult.restricted_count > 0) {
          console.log('🚫 ═══════════════════════════════════════════════════');
          console.log(`🚫 ${restrictionResult.restricted_count} NÚMERO(S) BLOQUEADO(S)!`);
          console.log('🚫 ═══════════════════════════════════════════════════');
          
          const blockedNumbers = restrictionResult.restricted_details.map((d: any) => ({
            numero: d.phone_number_found,
            listas: d.list_names.join(', ')
          }));
          
          blockedNumbers.forEach((bn: any, i: number) => {
            console.log(`   ${i+1}. ${bn.numero} → Bloqueado em: ${bn.listas}`);
          });
          
          console.log('   ❌ ENVIO CANCELADO!');
          console.log('═══════════════════════════════════════════════════\n');
          
          // Retornar erro 403 com detalhes
          return res.status(403).json({
            success: false,
            error: `${restrictionResult.restricted_count} número(s) bloqueado(s) na Lista de Restrição`,
            restricted: true,
            blocked_count: restrictionResult.restricted_count,
            blocked_numbers: blockedNumbers,
            details: restrictionResult.restricted_details
          });
        }
        
        console.log('✅ ═══════════════════════════════════════════════════');
        console.log('✅ TODOS OS NÚMEROS ESTÃO LIVRES');
        console.log('✅ ═══════════════════════════════════════════════════');
        console.log(`   📞 ${phoneNumbers.length} números verificados`);
        console.log(`   ✅ PROSSEGUINDO COM CRIAÇÃO DA CAMPANHA...`);
        console.log('═══════════════════════════════════════════════════\n');
      } catch (error: any) {
        console.error('❌ ═══════════════════════════════════════════════════');
        console.error('❌ ERRO AO VERIFICAR LISTA DE RESTRIÇÃO!');
        console.error('❌ ═══════════════════════════════════════════════════');
        console.error('   Erro:', error.message);
        console.error('═══════════════════════════════════════════════════\n');
        
        // ⚠️ SE DER ERRO NA VERIFICAÇÃO, BLOQUEAR POR SEGURANÇA
        return res.status(500).json({
          success: false,
          error: `Erro ao verificar lista de restrição: ${error.message}`,
          security_block: true,
        });
      }

      // Ajustar timezone para horário de Brasília (UTC-3)
      let scheduledDate = undefined;
      if (scheduled_at) {
        scheduledDate = new Date(scheduled_at);
        // Se a data não tem informação de timezone, assumir que é horário local de Brasília
        // e converter para UTC subtraindo 3 horas
        if (!scheduled_at.includes('Z') && !scheduled_at.includes('+') && !scheduled_at.includes('-')) {
          scheduledDate = new Date(scheduledDate.getTime() - (3 * 60 * 60 * 1000));
        }
        console.log('🕐 Horário agendado ajustado (QR):', {
          original: scheduled_at,
          converted: scheduledDate.toISOString(),
          localString: scheduledDate.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        });
      }

      // Criar campanha (tenant_id já foi validado no início)
      const campaign = await QrCampaignModel.create({
        name,
        tenant_id: tenantId, // ✅ ADICIONAR TENANT_ID
        status: scheduled_at ? 'scheduled' : 'pending',
        scheduled_at: scheduledDate,
        total_contacts: contacts?.length || 0,
        schedule_config: schedule_config || {},
        pause_config: pause_config || {},
        sent_count: 0,
        delivered_count: 0,
        read_count: 0,
        failed_count: 0,
        no_whatsapp_count: 0,
        button_clicks_count: 0,
        auto_remove_account_failures: 0,
      });

      console.log('✅ Campanha QR criada com ID:', campaign.id);

      // Validar contatos
      if (!contacts || contacts.length === 0) {
        throw new Error('Nenhum contato foi fornecido');
      }

      console.log(`📞 Processando ${contacts.length} contatos...`);

      // Mapear contacts para o formato correto (phone -> phone_number)
      const mappedContacts = contacts.map((c) => {
        const phoneNumber = c.phone || c.phone_number;
        
        if (!phoneNumber) {
          throw new Error('Contato sem número de telefone detectado');
        }
        
        return {
          phone_number: phoneNumber,
          name: c.name || '',
          variables: c.variables || {}
        };
      });

      console.log('📞 Exemplo de contato mapeado:', mappedContacts[0]);

      // Criar/atualizar contatos em massa (passar tenantId)
      const createdContacts = await ContactModel.createBulk(mappedContacts, tenantId);
      console.log(`✅ ${createdContacts.length} contatos criados/atualizados`);

      // Associar contatos à campanha
      for (const contact of createdContacts) {
        await tenantQuery(req, 
          'INSERT INTO qr_campaign_contacts (campaign_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [campaign.id, contact.id]
        );
      }
      console.log('✅ Contatos associados à campanha QR');

      // NOVO SISTEMA DE ROTATIVIDADE DUPLA
      // Criar combinações: instâncias × templates
      let orderIndex = 0;
      const totalCombinations = instance_ids.length * template_ids.length;

      console.log(`🔄 Criando ${totalCombinations} combinações (rotatividade dupla)...`);
      console.log(`   📱 ${instance_ids.length} instâncias`);
      console.log(`   📄 ${template_ids.length} templates`);

      // ✅ CORRIGIDO: Para cada TEMPLATE, rotacionar todas as INSTÂNCIAS
      // Isso garante que as instâncias se alternem primeiro, depois os templates
      // Exemplo com 5 inst. e 10 temp.:
      //   0: Inst1+Temp1, 1: Inst2+Temp1, 2: Inst3+Temp1, 3: Inst4+Temp1, 4: Inst5+Temp1
      //   5: Inst1+Temp2, 6: Inst2+Temp2, 7: Inst3+Temp2, 8: Inst4+Temp2, 9: Inst5+Temp2
      //   ... e assim por diante
      for (const templateId of template_ids) {
        for (const instanceId of instance_ids) {
          await tenantQuery(req, 
            `INSERT INTO qr_campaign_templates 
             (campaign_id, instance_id, qr_template_id, order_index, is_active)
             VALUES ($1, $2, $3, $4, true)`,
            [campaign.id, instanceId, templateId, orderIndex]
          );
          orderIndex++;
        }
      }

      console.log(`✅ ${totalCombinations} combinações criadas com sucesso!`);
      console.log(`   💡 Rotatividade CORRIGIDA: Instâncias alternam primeiro, depois templates`);

      res.status(201).json({
        success: true,
        data: {
          ...campaign,
          combinations: totalCombinations,
          instances_count: instance_ids.length,
          templates_count: template_ids.length,
        },
        message: scheduled_at 
          ? `Campanha QR agendada com ${totalCombinations} combinações!` 
          : `Campanha QR criada com ${totalCombinations} combinações!`,
      });
    } catch (error: any) {
      console.error('❌ ERRO AO CRIAR CAMPANHA QR:');
      console.error('❌ Mensagem:', error.message);
      console.error('❌ Stack:', error.stack);
      console.error('❌ Dados recebidos:', {
        name: req.body.name,
        instance_ids: req.body.instance_ids,
        template_ids: req.body.template_ids,
        contacts_count: req.body.contacts?.length,
      });
      res.status(500).json({ 
        success: false, 
        error: error.message,
        details: error.stack 
      });
    }
  }

  /**
   * 🔧 Reordenar templates de uma campanha (FIX)
   * Corrige campanhas criadas com a ordem errada
   */
  async reorderTemplates(req: Request, res: Response) {
    try {
      const { id } = req.params;

      console.log(`🔧 Reordenando templates da campanha ${id}...`);

      // Reordenar templates: agrupa por template_id primeiro, depois por instance_id
      // Isso faz as instâncias alternarem primeiro, depois os templates
      const result = await tenantQuery(req, `
        WITH ranked_templates AS (
          SELECT 
            ct.id,
            ROW_NUMBER() OVER (
              ORDER BY ct.qr_template_id, ct.instance_id
            ) - 1 as new_order_index
          FROM qr_campaign_templates ct
          WHERE ct.campaign_id = $1
        )
        UPDATE qr_campaign_templates ct
        SET order_index = rt.new_order_index
        FROM ranked_templates rt
        WHERE ct.id = rt.id
        RETURNING ct.id
      `, [id]);

      console.log(`✅ ${result.rows.length} templates reordenados com sucesso!`);

      // Verificar nova ordem
      const verification = await tenantQuery(req, `
        SELECT 
          ct.order_index,
          i.phone_number as instance_phone,
          i.name as instance_name,
          t.name as template_name
        FROM qr_campaign_templates ct
        LEFT JOIN qr_templates t ON ct.qr_template_id = t.id
        LEFT JOIN uaz_instances i ON ct.instance_id = i.id
        WHERE ct.campaign_id = $1
        ORDER BY ct.order_index
        LIMIT 10
      `, [id]);

      console.log('\n🔍 Nova ordem (primeiros 10):');
      verification.rows.forEach((row) => {
        console.log(`   ${row.order_index}: ${row.instance_name} (${row.instance_phone}) → ${row.template_name}`);
      });

      res.json({
        success: true,
        message: `Templates da campanha ${id} reordenados com sucesso!`,
        reordered_count: result.rows.length,
        sample: verification.rows.slice(0, 5)
      });
    } catch (error: any) {
      console.error('❌ Erro ao reordenar templates:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Listar todas as campanhas QR
   */
  async findAll(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }
      
      const campaigns = await QrCampaignModel.findAll(tenantId);
      
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
          
          // Verificar pausa programada (quando worker estiver implementado)
          // const pauseConfig = campaign.pause_config || {};
          // const pauseState = qrCampaignWorker.getPauseState(campaign.id);
          // const shouldBePaused = pauseState !== null;
          
          // if (shouldBePaused && currentStatus !== 'outside_hours') {
          //   currentStatus = 'pause_programmed';
          // }
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

  /**
   * Buscar campanha QR por ID
   */
  async findById(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }
      
      const campaign = await QrCampaignModel.findById(parseInt(req.params.id), tenantId);
      
      if (!campaign) {
        return res.status(404).json({ success: false, error: 'Campanha não encontrada' });
      }

      // Buscar templates da campanha
      const templatesResult = await tenantQuery(req, 
        `SELECT ct.*, t.name as template_name, t.type as template_type, 
                i.name as instance_name, i.phone_number as instance_phone
         FROM qr_campaign_templates ct
         LEFT JOIN qr_templates t ON ct.qr_template_id = t.id
         LEFT JOIN uaz_instances i ON ct.instance_id = i.id
         WHERE ct.campaign_id = $1
         ORDER BY ct.order_index`,
        [campaign.id]
      );

      res.json({
        success: true,
        data: {
          ...campaign,
          templates: templatesResult.rows,
        },
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar campanha QR:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Buscar mensagens da campanha QR
   */
  async getMessages(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await tenantQuery(req, 
        `SELECT m.*, c.name as contact_name, i.name as instance_name
         FROM qr_campaign_messages m
         LEFT JOIN contacts c ON m.contact_id = c.id
         LEFT JOIN uaz_instances i ON m.instance_id = i.id
         WHERE m.campaign_id = $1
         ORDER BY m.created_at DESC
         LIMIT $2 OFFSET $3`,
        [campaignId, limit, offset]
      );

      res.json({ success: true, data: result.rows });
    } catch (error: any) {
      console.error('❌ Erro ao buscar mensagens da campanha QR:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Buscar contatos da campanha QR
   */
  async getContacts(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);

      const result = await tenantQuery(req, 
        `SELECT c.id, c.phone_number as phone, c.name
         FROM contacts c
         INNER JOIN qr_campaign_contacts cc ON c.id = cc.contact_id
         WHERE cc.campaign_id = $1
         ORDER BY cc.id ASC`,
        [campaignId]
      );

      res.json({ success: true, data: result.rows });
    } catch (error: any) {
      console.error('Erro ao buscar contatos da campanha QR:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Pausar campanha QR
   */
  async pause(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);
      const campaign = await QrCampaignModel.update(campaignId, { status: 'paused' });

      console.log(`⏸️ Campanha QR ${campaignId} pausada manualmente`);

      res.json({ 
        success: true, 
        data: campaign,
        message: 'Campanha pausada com sucesso' 
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Retomar campanha QR
   */
  async resume(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);
      
      // ✅ Ao retomar, limpar scheduled_at para garantir que será processada imediatamente
      const campaign = await QrCampaignModel.update(campaignId, { 
        status: 'running',
        scheduled_at: undefined  // ← LIMPAR AGENDAMENTO
      });

      console.log(`▶️ Campanha QR ${campaignId} retomada manualmente (scheduled_at limpo)`);

      res.json({ 
        success: true, 
        data: campaign,
        message: 'Campanha retomada com sucesso' 
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Cancelar campanha QR
   */
  async cancel(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);
      const campaign = await QrCampaignModel.update(campaignId, { status: 'cancelled' });

      console.log(`🛑 Campanha QR ${campaignId} cancelada manualmente`);

      res.json({ 
        success: true, 
        data: campaign,
        message: 'Campanha cancelada com sucesso' 
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Editar campanha QR
   */
  async edit(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);
      const {
        name,
        scheduled_at,
        schedule_config,
        pause_config,
      } = req.body;

      console.log(`✏️ Editando campanha QR ${campaignId}`);

      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }

      const currentCampaign = await QrCampaignModel.findById(campaignId, tenantId);

      if (!currentCampaign) {
        return res.status(404).json({ success: false, error: 'Campanha não encontrada' });
      }

      if (currentCampaign.status === 'completed' || currentCampaign.status === 'cancelled') {
        return res.status(400).json({ 
          success: false, 
          error: 'Não é possível editar uma campanha concluída ou cancelada' 
        });
      }

      const updateData: any = {};
      if (name) updateData.name = name;
      
      if (scheduled_at !== undefined) {
        if (scheduled_at) {
          // Ajustar timezone para horário de Brasília (UTC-3)
          let scheduledDate = new Date(scheduled_at);
          if (!scheduled_at.includes('Z') && !scheduled_at.includes('+') && !scheduled_at.includes('-')) {
            scheduledDate = new Date(scheduledDate.getTime() - (3 * 60 * 60 * 1000));
          }
          console.log('🕐 Horário agendado ajustado (QR EDIT):', {
            original: scheduled_at,
            converted: scheduledDate.toISOString(),
            localString: scheduledDate.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
          });
          updateData.scheduled_at = scheduledDate;
        } else {
          updateData.scheduled_at = null;
        }
      }
      
      if (schedule_config) updateData.schedule_config = schedule_config;
      if (pause_config) updateData.pause_config = pause_config;

      const campaign = await QrCampaignModel.update(campaignId, updateData);

      console.log(`✅ Campanha QR ${campaignId} editada com sucesso`);

      res.json({ 
        success: true, 
        data: campaign,
        message: 'Campanha editada com sucesso' 
      });
    } catch (error: any) {
      console.error('❌ Erro ao editar campanha QR:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Deletar campanha QR
   */
  async delete(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);
      
      console.log(`🗑️ Excluindo campanha QR ${campaignId}`);

      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }

      const campaign = await QrCampaignModel.findById(campaignId, tenantId);
      if (!campaign) {
        return res.status(404).json({ success: false, error: 'Campanha não encontrada' });
      }

      await tenantQuery(req, 'DELETE FROM qr_campaign_messages WHERE campaign_id = $1', [campaignId]);
      await tenantQuery(req, 'DELETE FROM qr_campaign_templates WHERE campaign_id = $1', [campaignId]);
      await tenantQuery(req, 'DELETE FROM qr_campaign_contacts WHERE campaign_id = $1', [campaignId]);
      await QrCampaignModel.delete(campaignId, tenantId);

      console.log(`✅ Campanha QR ${campaignId} excluída com sucesso`);

      res.json({ success: true, message: 'Campanha excluída com sucesso' });
    } catch (error: any) {
      console.error('❌ Erro ao excluir campanha QR:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Deletar campanhas finalizadas
   */
  async deleteFinished(req: Request, res: Response) {
    try {
      console.log('🗑️ Excluindo campanhas QR finalizadas...');

      const campaignsResult = await tenantQuery(req, 
        `SELECT id, name, status, completed_at 
         FROM qr_campaigns 
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

      const campaignIds = campaigns.map((c) => c.id);

      await tenantQuery(req, 'DELETE FROM qr_campaign_messages WHERE campaign_id = ANY($1::int[])', [campaignIds]);
      await tenantQuery(req, 'DELETE FROM qr_campaign_templates WHERE campaign_id = ANY($1::int[])', [campaignIds]);
      await tenantQuery(req, 'DELETE FROM qr_campaign_contacts WHERE campaign_id = ANY($1::int[])', [campaignIds]);
      const result = await tenantQuery(req, 'DELETE FROM qr_campaigns WHERE id = ANY($1::int[])', [campaignIds]);

      const deletedCount = result.rowCount || 0;

      console.log(`✅ ${deletedCount} campanhas QR excluídas com sucesso`);

      res.json({ 
        success: true, 
        message: `${deletedCount} campanha(s) excluída(s) com sucesso`,
        data: { 
          deleted_count: deletedCount,
          campaigns: campaigns.map((c) => ({ id: c.id, name: c.name, status: c.status }))
        }
      });
    } catch (error: any) {
      console.error('❌ Erro ao excluir campanhas QR finalizadas:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Obter estatísticas da campanha QR
   */
  async getStats(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);

      const result = await tenantQuery(req, 
        `SELECT 
          COUNT(*) FILTER (WHERE status = 'sent') as sent,
          COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
          COUNT(*) FILTER (WHERE status = 'read') as read,
          COUNT(*) FILTER (WHERE status = 'failed') as failed
         FROM qr_campaign_messages
         WHERE campaign_id = $1`,
        [campaignId]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Obter log de atividades da campanha QR
   */
  async getActivityLog(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);
      
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }
      
      const campaign = await QrCampaignModel.findById(campaignId, tenantId);
      if (!campaign) {
        return res.status(404).json({ success: false, error: 'Campanha não encontrada' });
      }

      // Buscar todas as instâncias (ativas e inativas)
      const activeInstances = await tenantQuery(req, 
        `SELECT DISTINCT ON (ct.instance_id) 
         ct.instance_id, 
         i.id as instance_id,
         i.name as instance_name, 
         i.phone_number,
         ct.is_active,
         ct.consecutive_failures,
         ct.last_error,
         ct.removed_at,
         ct.removal_count,
         ct.permanent_removal,
         ct.removal_history
         FROM qr_campaign_templates ct
         LEFT JOIN uaz_instances i ON ct.instance_id = i.id
         WHERE ct.campaign_id = $1
         ORDER BY ct.instance_id`,
        [campaignId]
      );

      // Buscar última mensagem enviada
      const lastMessage = await tenantQuery(req, 
        `SELECT m.*, i.name as instance_name, i.phone_number
         FROM qr_campaign_messages m
         LEFT JOIN uaz_instances i ON m.instance_id = i.id
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

      // Obter informações de intervalo
      const intervalSeconds = scheduleConfig.interval_seconds || 5;
      const pauseConfig = campaign.pause_config || {};
      const pauseAfter = pauseConfig.pause_after || 0;
      const pauseDurationMinutes = pauseConfig.pause_duration_minutes || 0;
      
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

      // Calcular tempo restante da pausa (se estiver em pausa programada)
      let pauseRemainingSeconds = 0;
      let currentStatus = isWithinWorkHours ? 'sending' : 'outside_hours';
      
      // Verificar se está em pausa automática
      if (pauseAfter > 0 && campaign.sent_count > 0) {
        const sentSinceLastPause = campaign.sent_count % pauseAfter;
        if (sentSinceLastPause === 0 && lastMessage.rows[0]) {
          // Acabou de completar um ciclo, pode estar em pausa
          const lastSentAt = new Date(lastMessage.rows[0].sent_at || lastMessage.rows[0].created_at);
          const pauseEndTime = new Date(lastSentAt.getTime() + (pauseDurationMinutes * 60 * 1000));
          const secondsRemaining = Math.max(0, Math.floor((pauseEndTime.getTime() - now.getTime()) / 1000));
          
          if (secondsRemaining > 0) {
            pauseRemainingSeconds = secondsRemaining;
            currentStatus = 'pause_programmed';
          }
        }
      }

      const activityLog = {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
        },
        currentStatus: currentStatus,
        statusDetails: {
          isWithinWorkHours,
          shouldBePaused: pauseRemainingSeconds > 0,
          pauseRemainingSeconds: pauseRemainingSeconds,
          currentTime,
          workHours: `${scheduleConfig.work_start_time || 'N/A'} - ${scheduleConfig.work_end_time || 'N/A'}`,
        },
        intervalInfo: {
          intervalSeconds,
          nextMessageIn: nextMessageIn,
          messagesUntilPause,
          pauseAfter,
          pauseDurationMinutes,
        },
        activeInstances: await Promise.all(
          activeInstances.rows.map(async (inst) => {
            // Contar mensagens enviadas HOJE por esta instância
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const messagesResult = await tenantQuery(req, 
              `SELECT COUNT(*) as sent_today
               FROM qr_campaign_messages
               WHERE instance_id = $1
               AND sent_at >= $2
               AND status IN ('sent', 'delivered', 'read')`,
              [inst.instance_id, today]
            );
            const sentToday = parseInt(messagesResult.rows[0]?.sent_today || '0');

            // Parse removal history
            let removalHistory = [];
            try {
              removalHistory = inst.removal_history ? 
                (typeof inst.removal_history === 'string' ? 
                  JSON.parse(inst.removal_history) : 
                  inst.removal_history) : 
                [];
            } catch (e) {
              removalHistory = [];
            }

            let instanceStatus = 'ATIVA E ENVIANDO';
            if (!inst.is_active) {
              if (inst.permanent_removal) {
                instanceStatus = `🚫 REMOVIDA PERMANENTEMENTE (${inst.removal_count}x remoções)`;
              } else if (inst.last_error) {
                instanceStatus = `PAUSADA - ${inst.last_error}`;
              } else if (inst.consecutive_failures >= 5) {
                instanceStatus = `PAUSADA - ${inst.consecutive_failures} falhas consecutivas`;
              } else {
                instanceStatus = 'PAUSADA - Removida manualmente';
              }
            }

            return {
              id: inst.instance_id,
              name: inst.instance_name,
              phone: inst.phone_number,
              isActive: inst.is_active,
              consecutiveFailures: inst.consecutive_failures || 0,
              lastError: inst.last_error,
              qualityRating: 'GREEN',
              accountStatus: 'CONECTADO',
              dailyLimit: 1000,
              sentToday: sentToday,
              remaining: Math.max(0, 1000 - sentToday),
              campaignStatus: instanceStatus,
              removedAt: inst.removed_at,
              removalCount: inst.removal_count || 0,
              permanentRemoval: inst.permanent_removal || false,
              removalHistory: removalHistory,
            };
          })
        ),
        lastMessage: lastMessage.rows[0] ? {
          instanceName: lastMessage.rows[0].instance_name,
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

  /**
   * Obter estatísticas de botões clicados
   */
  async getButtonsStats(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);

      console.log(`🔘 Buscando botões e estatísticas de cliques da campanha QR ${campaignId}...`);

      // Buscar todos os botões únicos da campanha QR Connect (com filtro de tipo)
      const buttonsResult = await tenantQuery(req, 
        `SELECT 
          button_text,
          button_payload,
          COUNT(*) as click_count,
          COUNT(DISTINCT phone_number) as unique_contacts,
          MIN(clicked_at) as first_click,
          MAX(clicked_at) as last_click
         FROM button_clicks
         WHERE campaign_id = $1 AND campaign_type = 'qr_connect'
         GROUP BY button_text, button_payload
         ORDER BY click_count DESC`,
        [campaignId]
      );

      const buttons = buttonsResult.rows;

      // Buscar TOP 5 botões mais clicados (apenas QR Connect)
      const topButtonsResult = await tenantQuery(req, 
        `SELECT 
          button_text,
          button_payload,
          COUNT(*) as click_count,
          COUNT(DISTINCT phone_number) as unique_contacts,
          COUNT(DISTINCT contact_id) as registered_contacts
         FROM button_clicks
         WHERE campaign_id = $1 AND campaign_type = 'qr_connect'
         GROUP BY button_text, button_payload
         ORDER BY click_count DESC
         LIMIT 5`,
        [campaignId]
      );

      const topButtons = topButtonsResult.rows;

      const totalClicks = buttons.reduce((sum: number, b: any) => sum + parseInt(b.click_count), 0);
      const totalUniqueContacts = new Set(buttons.flatMap((b) => b.unique_contacts)).size;

      console.log(`✅ Encontrados ${buttons.length} botões com ${totalClicks} cliques`);

      res.json({
        success: true,
        data: {
          buttons: buttons.map((b) => ({
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

  /**
   * Obter status das instâncias da campanha
   */
  async getAccountsStatus(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);

      console.log(`📊 Obtendo status das instâncias da campanha QR ${campaignId}`);

      const result = await tenantQuery(req, 
        `SELECT 
          ct.id,
          ct.instance_id,
          ct.is_active,
          ct.consecutive_failures,
          ct.last_error,
          ct.removed_at,
          ct.qr_template_id,
          i.name as instance_name,
          i.phone_number,
          i.profile_pic_url,
          i.profile_name,
          i.is_connected,
          t.name as template_name,
          (SELECT COUNT(*) FROM qr_campaign_messages WHERE campaign_id = $1 AND instance_id = ct.instance_id AND status = 'sent') as sent_count,
          (SELECT COUNT(*) FROM qr_campaign_messages WHERE campaign_id = $1 AND instance_id = ct.instance_id AND status = 'failed') as failed_count
         FROM qr_campaign_templates ct
         JOIN uaz_instances i ON ct.instance_id = i.id
         LEFT JOIN qr_templates t ON ct.qr_template_id = t.id
         WHERE ct.campaign_id = $1
         ORDER BY ct.order_index`,
        [campaignId]
      );

      // Agrupar por instância
      const instancesMap = new Map();
      
      result.rows.forEach((row) => {
        if (!instancesMap.has(row.instance_id)) {
          instancesMap.set(row.instance_id, {
            instance_id: row.instance_id,
            instance_name: row.instance_name,
            phone_number: row.phone_number,
            profile_pic_url: row.profile_pic_url,
            profile_name: row.profile_name,
            is_connected: row.is_connected,
            is_active: row.is_active,
            consecutive_failures: row.consecutive_failures,
            last_error: row.last_error,
            removed_at: row.removed_at,
            sent_count: parseInt(row.sent_count) || 0,
            failed_count: parseInt(row.failed_count) || 0,
            templates: []
          });
        }
        
        const instance = instancesMap.get(row.instance_id);
        instance.templates.push({
          template_id: row.qr_template_id,
          template_name: row.template_name,
          campaign_template_id: row.id
        });
      });

      const instances = Array.from(instancesMap.values());

      console.log(`✅ Status de ${instances.length} instâncias obtido`);

      res.json({
        success: true,
        data: instances
      });
    } catch (error: any) {
      console.error('❌ Erro ao obter status das instâncias:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Remover instância da campanha
   */
  async removeAccount(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);
      const { accountId } = req.body;

      console.log(`🗑️ Removendo instância ${accountId} da campanha QR ${campaignId}`);

      const campaignResult = await tenantQuery(req, 
        'SELECT status FROM qr_campaigns WHERE id = $1',
        [campaignId]
      );

      if (campaignResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Campanha não encontrada'
        });
      }

      const updateResult = await tenantQuery(req, 
        `UPDATE qr_campaign_templates 
         SET is_active = false, removed_at = NOW()
         WHERE campaign_id = $1 AND instance_id = $2
         RETURNING *`,
        [campaignId, accountId]
      );

      if (updateResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Instância não encontrada nesta campanha'
        });
      }

      const activeCountResult = await tenantQuery(req, 
        `SELECT COUNT(DISTINCT instance_id) as active_count
         FROM qr_campaign_templates
         WHERE campaign_id = $1 AND is_active = true`,
        [campaignId]
      );

      const activeCount = parseInt(activeCountResult.rows[0].active_count);

      console.log(`✅ Instância ${accountId} removida da campanha QR ${campaignId}`);
      console.log(`📊 Instâncias ativas restantes: ${activeCount}`);

      if (activeCount === 0) {
        console.log('⚠️ AVISO: Nenhuma instância ativa restante! Pausando campanha...');
        await tenantQuery(req, 
          'UPDATE qr_campaigns SET status = $1 WHERE id = $2',
          ['paused', campaignId]
        );
      }

      res.json({
        success: true,
        message: 'Instância removida com sucesso',
        data: {
          removed_templates: updateResult.rows.length,
          active_accounts_remaining: activeCount,
          campaign_paused: activeCount === 0
        }
      });
    } catch (error: any) {
      console.error('❌ Erro ao remover instância:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Re-adicionar instância à campanha
   */
  async addAccount(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);
      const { accountId } = req.body;

      console.log(`✅ Re-adicionando MANUALMENTE instância ${accountId} à campanha QR ${campaignId}`);

      const current = await tenantQuery(req, 
        `SELECT removal_history FROM qr_campaign_templates 
         WHERE campaign_id = $1 AND instance_id = $2 
         LIMIT 1`,
        [campaignId, accountId]
      );

      if (current.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Instância não encontrada nesta campanha'
        });
      }

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

      const updateResult = await tenantQuery(req, 
        `UPDATE qr_campaign_templates 
         SET is_active = true, 
             consecutive_failures = 0, 
             last_error = NULL, 
             removed_at = NULL,
             permanent_removal = false,
             removal_history = $1
         WHERE campaign_id = $2 AND instance_id = $3
         RETURNING *`,
        [JSON.stringify(history), campaignId, accountId]
      );

      if (updateResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Instância não encontrada nesta campanha'
        });
      }

      const activeCountResult = await tenantQuery(req, 
        `SELECT COUNT(DISTINCT instance_id) as active_count
         FROM qr_campaign_templates
         WHERE campaign_id = $1 AND is_active = true`,
        [campaignId]
      );

      const activeCount = parseInt(activeCountResult.rows[0].active_count);

      console.log(`✅ Instância ${accountId} re-adicionada à campanha QR ${campaignId}`);
      console.log(`📊 Total de instâncias ativas: ${activeCount}`);

      res.json({
        success: true,
        message: 'Instância re-adicionada com sucesso',
        data: {
          reactivated_templates: updateResult.rows.length,
          active_accounts_total: activeCount
        }
      });
    } catch (error: any) {
      console.error('❌ Erro ao re-adicionar instância:', error);
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

      console.log(`⚙️ Atualizando config de remoção automática da campanha QR ${campaignId}: ${auto_remove_account_failures} falhas`);

      const result = await tenantQuery(req, 
        'UPDATE qr_campaigns SET auto_remove_account_failures = $1 WHERE id = $2 RETURNING *',
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
   * Traduzir status para português
   */
  private translateStatus(status: string): string {
    const translations: Record<string, string> = {
      'sent': 'ENVIADO',
      'delivered': 'ENTREGUE',
      'read': 'LIDO',
      'failed': 'FALHOU',
      'no_whatsapp': 'SEM WHATSAPP',
      'pending': 'PENDENTE'
    };
    return translations[status.toLowerCase()] || status.toUpperCase();
  }

  /**
   * Gerar e baixar relatório Excel da campanha QR
   */
  async downloadReport(req: Request, res: Response) {
    try {
      const campaignId = parseInt(req.params.id);

      console.log(`📊 Gerando relatório Excel para campanha QR ${campaignId}...`);

      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }
      
      // Verificar se a campanha existe
      const campaign = await QrCampaignModel.findById(campaignId, tenantId);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          error: 'Campanha não encontrada'
        });
      }

      // Criar workbook
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

      // ===============================================
      // ABA 1: RESUMO DA CAMPANHA
      // ===============================================
      const summarySheet = workbook.addWorksheet('Resumo da Campanha');
      
      summarySheet.columns = [
        { key: 'label', width: 30 },
        { key: 'value', width: 50 }
      ];

      // Adicionar informações
      summarySheet.addRow({ label: 'NOME DA CAMPANHA', value: campaign.name });
      summarySheet.addRow({ label: 'STATUS', value: campaign.status.toUpperCase() });
      summarySheet.addRow({ label: 'DATA DE CRIAÇÃO', value: campaign.created_at });
      summarySheet.addRow({ label: 'DATA DE INÍCIO', value: campaign.started_at || 'Não iniciada' });
      summarySheet.addRow({ label: 'DATA DE CONCLUSÃO', value: campaign.completed_at || 'Em andamento' });
      summarySheet.addRow({});
      summarySheet.addRow({ label: 'TOTAL DE CONTATOS', value: campaign.total_contacts });
      summarySheet.addRow({ label: 'MENSAGENS ENVIADAS', value: campaign.sent_count });
      summarySheet.addRow({ label: 'MENSAGENS ENTREGUES', value: campaign.delivered_count });
      summarySheet.addRow({ label: 'MENSAGENS LIDAS', value: campaign.read_count });
      summarySheet.addRow({ label: 'MENSAGENS FALHADAS', value: campaign.failed_count });
      summarySheet.addRow({ label: 'SEM WHATSAPP', value: campaign.no_whatsapp_count || 0 });
      summarySheet.addRow({ label: 'CLIQUES EM BOTÕES', value: campaign.button_clicks_count || 0 });
      summarySheet.addRow({});

      // Calcular taxas
      const totalSent = campaign.sent_count || 1;
      const deliveryRate = ((campaign.delivered_count / totalSent) * 100).toFixed(2);
      const readRate = ((campaign.read_count / totalSent) * 100).toFixed(2);
      const failureRate = ((campaign.failed_count / totalSent) * 100).toFixed(2);

      summarySheet.addRow({ label: 'TAXA DE ENTREGA', value: `${deliveryRate}%` });
      summarySheet.addRow({ label: 'TAXA DE LEITURA', value: `${readRate}%` });
      summarySheet.addRow({ label: 'TAXA DE FALHA', value: `${failureRate}%` });

      // Estilizar cabeçalhos
      summarySheet.getColumn('A').font = { bold: true };
      summarySheet.getColumn('A').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE7E6E6' }
      };

      // ===============================================
      // ABA 2: MENSAGENS ENVIADAS
      // ===============================================
      const messagesSheet = workbook.addWorksheet('Mensagens');
      
      messagesSheet.columns = [
        { key: 'phone', header: 'TELEFONE', width: 20 },
        { key: 'instance', header: 'INSTÂNCIA', width: 25 },
        { key: 'template', header: 'TEMPLATE', width: 30 },
        { key: 'status', header: 'STATUS', width: 15 },
        { key: 'sent_at', header: 'ENVIADO EM', width: 20 },
        { key: 'delivered_at', header: 'ENTREGUE EM', width: 20 },
        { key: 'read_at', header: 'LIDO EM', width: 20 },
        { key: 'error', header: 'ERRO', width: 50 }
      ];

      // Header style
      messagesSheet.getRow(1).eachCell((cell) => {
        cell.style = headerStyle;
      });

      // Buscar mensagens
      console.log(`📨 Buscando mensagens para campanha QR ${campaignId}...`);
      
      let messagesResult;
      try {
        messagesResult = await tenantQuery(req, 
          `SELECT 
            m.phone_number,
            i.name as instance_name,
            t.name as template_name,
            m.status,
            m.sent_at,
            m.delivered_at,
            m.read_at,
            m.error_message
           FROM qr_campaign_messages m
           LEFT JOIN uaz_instances i ON m.instance_id = i.id
           LEFT JOIN qr_templates t ON m.qr_template_id = t.id
           WHERE m.campaign_id = $1
           ORDER BY m.created_at DESC`,
          [campaignId]
        );
        
        console.log(`✅ Encontradas ${messagesResult.rows.length} mensagens`);
      } catch (queryError: any) {
        console.error('❌ Erro ao buscar mensagens:', queryError.message);
        messagesResult = { rows: [] };
      }

      if (messagesResult.rows.length > 0) {
        messagesResult.rows.forEach((msg) => {
          messagesSheet.addRow({
            phone: msg.phone_number,
            instance: msg.instance_name || 'N/A',
            template: msg.template_name || 'N/A',
            status: this.translateStatus(msg.status),
            sent_at: msg.sent_at ? new Date(msg.sent_at).toLocaleString('pt-BR') : '',
            delivered_at: msg.delivered_at ? new Date(msg.delivered_at).toLocaleString('pt-BR') : '',
            read_at: msg.read_at ? new Date(msg.read_at).toLocaleString('pt-BR') : '',
            error: msg.error_message || ''
          });
        });
      } else {
        messagesSheet.addRow({
          phone: 'Nenhuma mensagem encontrada',
          instance: '-',
          template: '-',
          status: '-',
          sent_at: '',
          delivered_at: '',
          read_at: '',
          error: ''
        });
      }

      // ===============================================
      // ABA 3: INSTÂNCIAS USADAS
      // ===============================================
      const instancesSheet = workbook.addWorksheet('Instâncias');
      
      instancesSheet.columns = [
        { key: 'instance_name', header: 'INSTÂNCIA', width: 25 },
        { key: 'phone', header: 'TELEFONE', width: 20 },
        { key: 'template_name', header: 'TEMPLATE', width: 30 },
        { key: 'is_active', header: 'ATIVA', width: 10 },
        { key: 'sent_count', header: 'ENVIADAS', width: 12 },
        { key: 'failed_count', header: 'FALHAS', width: 12 }
      ];

      instancesSheet.getRow(1).eachCell((cell) => {
        cell.style = headerStyle;
      });

      // Buscar instâncias
      console.log(`📱 Buscando instâncias para campanha QR ${campaignId}...`);
      
      let instancesResult;
      try {
        instancesResult = await tenantQuery(req, 
          `SELECT 
            i.name as instance_name,
            i.phone_number,
            t.name as template_name,
            ct.is_active,
            (SELECT COUNT(*) FROM qr_campaign_messages WHERE campaign_id = $1 AND instance_id = i.id AND status = 'sent') as sent_count,
            (SELECT COUNT(*) FROM qr_campaign_messages WHERE campaign_id = $1 AND instance_id = i.id AND status = 'failed') as failed_count
           FROM qr_campaign_templates ct
           JOIN uaz_instances i ON ct.instance_id = i.id
           LEFT JOIN qr_templates t ON ct.qr_template_id = t.id
           WHERE ct.campaign_id = $1
           GROUP BY i.id, i.name, i.phone_number, t.name, ct.is_active
           ORDER BY i.name`,
          [campaignId]
        );
        
        console.log(`✅ Encontradas ${instancesResult.rows.length} instâncias`);
      } catch (queryError: any) {
        console.error('❌ Erro ao buscar instâncias:', queryError.message);
        instancesResult = { rows: [] };
      }

      if (instancesResult.rows.length > 0) {
        instancesResult.rows.forEach((inst) => {
          instancesSheet.addRow({
            instance_name: inst.instance_name,
            phone: inst.phone_number,
            template_name: inst.template_name || 'N/A',
            is_active: inst.is_active ? 'SIM' : 'NÃO',
            sent_count: inst.sent_count || 0,
            failed_count: inst.failed_count || 0
          });
        });
      } else {
        instancesSheet.addRow({
          instance_name: 'Nenhuma instância encontrada',
          phone: '-',
          template_name: '-',
          is_active: '-',
          sent_count: 0,
          failed_count: 0
        });
      }

      // ===============================================
      // ABA 4: CONTATOS DA CAMPANHA
      // ===============================================
      const contactsSheet = workbook.addWorksheet('Contatos');
      
      contactsSheet.columns = [
        { key: 'name', header: 'NOME', width: 30 },
        { key: 'phone', header: 'TELEFONE', width: 20 },
        { key: 'status', header: 'STATUS ENVIO', width: 15 }
      ];

      contactsSheet.getRow(1).eachCell((cell) => {
        cell.style = headerStyle;
      });

      // Buscar contatos (direto das mensagens para garantir que apareçam)
      console.log(`📞 Buscando contatos para campanha QR ${campaignId}...`);
      
      let contactsResult;
      try {
        // Buscar diretamente das mensagens, com LEFT JOIN em contacts para pegar nome
        contactsResult = await tenantQuery(req, 
          `SELECT DISTINCT
            m.phone_number as phone,
            c.name,
            m.status as message_status
           FROM qr_campaign_messages m
           LEFT JOIN contacts c ON c.phone_number = m.phone_number
           WHERE m.campaign_id = $1
           ORDER BY c.name NULLS LAST, m.phone_number`,
          [campaignId]
        );
        
        console.log(`✅ Encontrados ${contactsResult.rows.length} contatos nas mensagens`);
        console.log(`🔍 DEBUG - Primeiros contatos:`, contactsResult.rows.slice(0, 3));
      } catch (queryError: any) {
        console.error('❌ Erro ao buscar contatos:', queryError.message);
        console.error('❌ Stack trace:', queryError.stack);
        // Se falhar, retornar array vazio
        contactsResult = { rows: [] };
      }

      if (contactsResult.rows.length > 0) {
        contactsResult.rows.forEach((contact) => {
          contactsSheet.addRow({
            name: contact.name || 'Sem nome cadastrado',
            phone: contact.phone,
            status: this.translateStatus(contact.message_status || 'pending')
          });
        });
      } else {
        // Se não há contatos, adicionar linha indicativa
        contactsSheet.addRow({
          name: 'Nenhum contato encontrado',
          phone: '-',
          status: '-'
        });
      }

      // Gerar buffer do Excel
      const buffer = await workbook.xlsx.writeBuffer();

      // Configurar headers para download
      const fileName = `Relatorio_CampanhaQR_${campaign.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      console.log(`✅ Relatório Excel QR gerado com sucesso: ${fileName}`);

      // Enviar arquivo
      res.send(buffer);
    } catch (error: any) {
      console.error('❌ Erro ao gerar relatório Excel QR:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const qrCampaignController = new QrCampaignController();

