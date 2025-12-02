import { query } from '../database/connection';
import * as fs from 'fs';
import * as path from 'path';
import { RestrictionListController } from '../controllers/restriction-list.controller';
import { getBrazilNow } from '../utils/timezone';
const UazService = require('../services/uazService');
const { getTenantUazapCredentials } = require('../helpers/uaz-credentials.helper');

// ========================================
// 🔄 FUNÇÕES AUXILIARES PARA SPIN TEXT
// ========================================

/**
 * Processa Spin Text no formato [[opção1|opção2|opção3]]
 * Escolhe uma opção aleatória para cada variável
 */
function processSpinText(text: string): string {
  if (!text) return text;
  
  // Regex para encontrar [[opção1|opção2|opção3]]
  const spinTextRegex = /\[\[([^\]]+)\]\]/g;
  
  return text.replace(spinTextRegex, (match, content) => {
    // Dividir opções pelo pipe |
    const options = content.split('|').map((opt: string) => opt.trim()).filter((opt: string) => opt.length > 0);
    
    if (options.length === 0) return match; // Se não tiver opções, mantém original
    
    // Escolher opção aleatória
    const randomIndex = Math.floor(Math.random() * options.length);
    return options[randomIndex];
  });
}

/**
 * Detecta se um texto contém Spin Text
 */
function hasSpinText(text: string): boolean {
  if (!text) return false;
  return /\[\[([^\]]+)\]\]/.test(text);
}

// ========================================
// 🔤 FUNÇÕES AUXILIARES PARA SUBSTITUIÇÃO DE VARIÁVEIS
// ========================================

/**
 * Substitui variáveis no formato {{nome}} pelos valores do contato
 * Exemplo: "Olá {{nome}}" + {nome: "João"} → "Olá João"
 */
function replaceVariables(text: string, variables: Record<string, any>): string {
  if (!text || !variables) return text;
  
  let result = text;
  
  // Para cada variável do contato
  Object.entries(variables).forEach(([varName, varValue]) => {
    if (varValue !== null && varValue !== undefined) {
      // Substituir {{nome}} ou {{ nome }} (com espaços opcionais)
      const regex = new RegExp(`{{\\s*${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*}}`, 'g');
      result = result.replace(regex, String(varValue));
    }
  });
  
  return result;
}

/**
 * Substitui variáveis em um objeto template completo
 * Aplica substituição em text_content, poll names, carousel cards, etc.
 */
function replaceVariablesInTemplate(template: CampaignTemplate, variables: Record<string, any>): CampaignTemplate {
  if (!variables || Object.keys(variables).length === 0) {
    return template; // Sem variáveis, retorna template original
  }
  
  // Criar cópia do template para não modificar o original
  const processedTemplate = { ...template };
  
  // 1. Substituir no text_content principal
  if (processedTemplate.text_content) {
    processedTemplate.text_content = replaceVariables(processedTemplate.text_content, variables);
  }
  
  // 2. Substituir em list_config (title, description, footer, sections)
  if (processedTemplate.list_config) {
    const listConfig = typeof processedTemplate.list_config === 'string' 
      ? JSON.parse(processedTemplate.list_config) 
      : { ...processedTemplate.list_config };
    
    if (listConfig.title) listConfig.title = replaceVariables(listConfig.title, variables);
    if (listConfig.description) listConfig.description = replaceVariables(listConfig.description, variables);
    if (listConfig.footer) listConfig.footer = replaceVariables(listConfig.footer, variables);
    if (listConfig.buttonText) listConfig.buttonText = replaceVariables(listConfig.buttonText, variables);
    
    // Substituir em cada seção e linha
    if (listConfig.sections && Array.isArray(listConfig.sections)) {
      listConfig.sections = listConfig.sections.map((section: any) => {
        const newSection = { ...section };
        if (newSection.title) newSection.title = replaceVariables(newSection.title, variables);
        if (newSection.rows && Array.isArray(newSection.rows)) {
          newSection.rows = newSection.rows.map((row: any) => {
            const newRow = { ...row };
            if (newRow.title) newRow.title = replaceVariables(newRow.title, variables);
            if (newRow.description) newRow.description = replaceVariables(newRow.description, variables);
            return newRow;
          });
        }
        return newSection;
      });
    }
    
    processedTemplate.list_config = listConfig;
  }
  
  // 3. Substituir em buttons_config (text, footer, button texts)
  if (processedTemplate.buttons_config) {
    const buttonsConfig = typeof processedTemplate.buttons_config === 'string'
      ? JSON.parse(processedTemplate.buttons_config)
      : { ...processedTemplate.buttons_config };
    
    if (buttonsConfig.footer) buttonsConfig.footer = replaceVariables(buttonsConfig.footer, variables);
    
    if (buttonsConfig.buttons && Array.isArray(buttonsConfig.buttons)) {
      buttonsConfig.buttons = buttonsConfig.buttons.map((button: any) => {
        const newButton = { ...button };
        if (newButton.text) newButton.text = replaceVariables(newButton.text, variables);
        return newButton;
      });
    }
    
    processedTemplate.buttons_config = buttonsConfig;
  }
  
  // 4. Substituir em poll_config (name, options)
  if (processedTemplate.poll_config) {
    const pollConfig = typeof processedTemplate.poll_config === 'string'
      ? JSON.parse(processedTemplate.poll_config)
      : { ...processedTemplate.poll_config };
    
    if (pollConfig.name) pollConfig.name = replaceVariables(pollConfig.name, variables);
    
    if (pollConfig.options && Array.isArray(pollConfig.options)) {
      pollConfig.options = pollConfig.options.map((option: string) => 
        replaceVariables(option, variables)
      );
    }
    
    processedTemplate.poll_config = pollConfig;
  }
  
  // 5. Substituir em carousel_config (cards)
  if (processedTemplate.carousel_config) {
    const carouselConfig = typeof processedTemplate.carousel_config === 'string'
      ? JSON.parse(processedTemplate.carousel_config)
      : { ...processedTemplate.carousel_config };
    
    if (carouselConfig.cards && Array.isArray(carouselConfig.cards)) {
      carouselConfig.cards = carouselConfig.cards.map((card: any) => {
        const newCard = { ...card };
        if (newCard.text) newCard.text = replaceVariables(newCard.text, variables);
        if (newCard.buttons && Array.isArray(newCard.buttons)) {
          newCard.buttons = newCard.buttons.map((button: any) => {
            const newButton = { ...button };
            if (newButton.text) newButton.text = replaceVariables(newButton.text, variables);
            return newButton;
          });
        }
        return newCard;
      });
    }
    
    processedTemplate.carousel_config = carouselConfig;
  }
  
  // 6. Substituir em combined_blocks (todos os blocos)
  if (processedTemplate.combined_blocks) {
    const combinedBlocks = typeof processedTemplate.combined_blocks === 'string'
      ? JSON.parse(processedTemplate.combined_blocks)
      : { ...processedTemplate.combined_blocks };
    
    if (combinedBlocks.blocks && Array.isArray(combinedBlocks.blocks)) {
      combinedBlocks.blocks = combinedBlocks.blocks.map((block: any) => {
        const newBlock = { ...block };
        
        // Substituir no texto do bloco
        if (newBlock.text) newBlock.text = replaceVariables(newBlock.text, variables);
        
        // Substituir em poll name (se for bloco de enquete)
        if (newBlock.pollName) newBlock.pollName = replaceVariables(newBlock.pollName, variables);
        
        // Substituir em caption de mídia
        if (newBlock.caption) newBlock.caption = replaceVariables(newBlock.caption, variables);
        
        // Substituir em botões (se houver)
        if (newBlock.buttons && Array.isArray(newBlock.buttons)) {
          newBlock.buttons = newBlock.buttons.map((button: any) => {
            const newButton = { ...button };
            if (newButton.text) newButton.text = replaceVariables(newButton.text, variables);
            return newButton;
          });
        }
        
        // Substituir em opções de enquete
        if (newBlock.pollOptions && Array.isArray(newBlock.pollOptions)) {
          newBlock.pollOptions = newBlock.pollOptions.map((option: string) =>
            replaceVariables(option, variables)
          );
        }
        
        return newBlock;
      });
    }
    
    processedTemplate.combined_blocks = combinedBlocks;
  }
  
  // 7. Substituir em media_files (caption)
  if (processedTemplate.media_files && Array.isArray(processedTemplate.media_files)) {
    processedTemplate.media_files = processedTemplate.media_files.map((media: any) => {
      const newMedia = { ...media };
      if (newMedia.caption) newMedia.caption = replaceVariables(newMedia.caption, variables);
      return newMedia;
    });
  }
  
  return processedTemplate;
}

// ========================================

interface WorkerConfig {
  work_start_time: string;
  work_end_time: string;
  interval_seconds: number;
}

interface PauseConfig {
  pause_after: number;
  pause_duration_minutes: number;
}

interface QrCampaign {
  id: number;
  name: string;
  status: string;
  tenant_id?: number;
  schedule_config: WorkerConfig;
  pause_config: PauseConfig;
  sent_count: number;
  total_contacts: number;
  created_at?: Date;
  scheduled_at?: Date;
}

interface CampaignTemplate {
  id: number;
  campaign_id: number;
  instance_id: number;
  qr_template_id: number;
  order_index: number;
  is_active: boolean;
  instance_token: string;
  instance_name: string;
  template_name: string;
  template_type: string;
  text_content: string;
  list_config: any;
  buttons_config: any;
  carousel_config: any;
  poll_config: any;
  combined_blocks: any;
  variables_map: any;
  media_files: any[];
  // Proxy config
  proxy_host?: string;
  proxy_port?: number;
  proxy_username?: string;
  proxy_password?: string;
}

interface Contact {
  id: number;
  phone_number: string;
  variables: Record<string, any>;
}

class QrCampaignWorker {
  private isRunning = false;
  private currentCampaignId: number | null = null;
  private pauseState: Map<number, { startedAt: Date; durationMinutes: number }> = new Map();
  private autoPausedCampaigns: Set<number> = new Set();

  getPauseState(campaignId: number): { remainingSeconds: number } | null {
    const pauseInfo = this.pauseState.get(campaignId);
    if (!pauseInfo) return null;

    const now = new Date();
    const elapsedMs = now.getTime() - pauseInfo.startedAt.getTime();
    const totalMs = pauseInfo.durationMinutes * 60 * 1000;
    const remainingMs = Math.max(0, totalMs - elapsedMs);
    const remainingSeconds = Math.ceil(remainingMs / 1000);

    if (remainingSeconds <= 0) {
      this.pauseState.delete(campaignId);
      return null;
    }

    return { remainingSeconds };
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️  QR Campaign Worker já está rodando');
      return;
    }

    console.log('🚀 Iniciando QR Campaign Worker...');
    this.isRunning = true;

    // Processar campanhas a cada 5 segundos
    setInterval(async () => {
      if (this.currentCampaignId) {
        console.log(`⏳ [QR Worker] Ainda processando campanha ${this.currentCampaignId}, aguardando...`);
        return;
      }

      try {
        await this.processCampaigns();
      } catch (error) {
        console.error('❌ [QR Worker] Erro ao processar campanhas:', error);
      }
    }, 5000);

    console.log('✅ QR Campaign Worker iniciado com suporte multi-tenant!');
    console.log('🔄 Verificando campanhas QR a cada 5 segundos...');
  }

  private async processCampaigns() {
    try {
      // 🔒 SEGURANÇA: Buscar tenants ativos primeiro
      const tenantsResult = await query(
        `SELECT DISTINCT id FROM tenants WHERE status != 'deleted' AND blocked_at IS NULL`
      );
      
      const tenantIds = tenantsResult.rows.map(t => t.id);
      
      if (tenantIds.length === 0) {
        return;
      }
      
      // 🔒 SEGURANÇA: Buscar campanhas QR APENAS de tenants ativos
      // ✅ As datas são salvas em UTC, então NOW() (também UTC) está correto
      const campaigns = await query(
        `SELECT * FROM qr_campaigns 
         WHERE tenant_id = ANY($1)
         AND status IN ('pending', 'scheduled', 'running')
         AND (scheduled_at IS NULL OR scheduled_at <= NOW())
         ORDER BY created_at ASC`,
        [tenantIds]
      );

      if (campaigns.rows.length === 0) {
        return;
      }

      for (const campaign of campaigns.rows) {
        if (!this.shouldProcessCampaign(campaign)) {
          continue;
        }

        // Processar campanha
        this.currentCampaignId = campaign.id;
        
        try {
          await this.processCampaign(campaign);
        } catch (error) {
          console.error(`❌ Erro ao processar campanha QR ${campaign.id}:`, error);
        } finally {
          this.currentCampaignId = null;
        }
      }
    } catch (error) {
      console.error('❌ [QR Worker] Erro geral:', error);
    }
  }

  private shouldProcessCampaign(campaign: QrCampaign): boolean {
    console.log(`\n🔍 [DEBUG] Verificando se deve processar campanha ${campaign.id} (${campaign.name})`);
    console.log(`   Status: ${campaign.status}`);
    
    // Verificar pausa programada
    const pauseInfo = this.getPauseState(campaign.id);
    if (pauseInfo) {
      console.log(`   ⏸️ Em pausa programada (${pauseInfo.remainingSeconds}s restantes)`);
      return false;
    }

    // Verificar horário de trabalho
    const scheduleConfig = (campaign.schedule_config || {}) as WorkerConfig;
    if (scheduleConfig.work_start_time && scheduleConfig.work_end_time) {
      const brazilNow = getBrazilNow();
      const currentTime = brazilNow.toTimeString().slice(0, 5);
      console.log(
        `   🕐 Horário atual (Brasília): ${currentTime} | Horário de trabalho: ${scheduleConfig.work_start_time} - ${scheduleConfig.work_end_time}`
      );
      
      if (currentTime < scheduleConfig.work_start_time || currentTime > scheduleConfig.work_end_time) {
        // Fora do horário de trabalho
        console.log(`   🌙 FORA do horário de trabalho`);
        if (campaign.status === 'running' && !this.autoPausedCampaigns.has(campaign.id)) {
          this.autoPauseCampaign(campaign.id);
        }
        return false;
      }
      console.log(`   ✅ DENTRO do horário de trabalho`);
    }

    // Dentro do horário, retomar se estava auto-pausada
    if (this.autoPausedCampaigns.has(campaign.id)) {
      console.log(`   ▶️ Estava auto-pausada, retomando...`);
      this.autoResumeCampaign(campaign.id);
    }

    console.log(`   ✅ DEVE PROCESSAR!\n`);
    return true;
  }

  private async autoPauseCampaign(campaignId: number, tenantId?: number) {
    try {
      if (tenantId) {
        await query(
          `UPDATE qr_campaigns SET status = 'paused' WHERE id = $1 AND tenant_id = $2`,
          [campaignId, tenantId]
        );
      } else {
        await query(
          `UPDATE qr_campaigns SET status = 'paused' WHERE id = $1`,
          [campaignId]
        );
      }
      this.autoPausedCampaigns.add(campaignId);
      console.log(`⏸️  [QR Worker] Campanha ${campaignId} pausada automaticamente (fora do horário)`);
    } catch (error) {
      console.error('❌ Erro ao auto-pausar campanha QR:', error);
    }
  }

  private async autoResumeCampaign(campaignId: number, tenantId?: number) {
    try {
      if (tenantId) {
        await query(
          `UPDATE qr_campaigns SET status = 'running' WHERE id = $1 AND tenant_id = $2`,
          [campaignId, tenantId]
        );
      } else {
        await query(
          `UPDATE qr_campaigns SET status = 'running' WHERE id = $1`,
          [campaignId]
        );
      }
      this.autoPausedCampaigns.delete(campaignId);
      console.log(`▶️  [QR Worker] Campanha ${campaignId} retomada automaticamente`);
    } catch (error) {
      console.error('❌ Erro ao auto-retomar campanha QR:', error);
    }
  }

  private async processCampaign(campaign: QrCampaign) {
    console.log(`📋 [QR Worker] Processando campanha: ${campaign.name} (ID: ${campaign.id})`);

    // Atualizar status para running se estiver pending
    if (campaign.status === 'pending' || campaign.status === 'scheduled') {
      if (campaign.tenant_id) {
        await query(
          `UPDATE qr_campaigns SET status = 'running', started_at = NOW() WHERE id = $1 AND tenant_id = $2`,
          [campaign.id, campaign.tenant_id]
        );
      } else {
        await query(
          `UPDATE qr_campaigns SET status = 'running', started_at = NOW() WHERE id = $1`,
          [campaign.id]
        );
      }
    }

    // ✅ VERIFICAR E REATIVAR INSTÂNCIAS QUE RECONECTARAM
    await this.checkAndReactivateInstances(campaign.id);
    
    // ✅ Buscar APENAS templates/instâncias ATIVOS E CONECTADOS
    const templatesResult = await query(
      `SELECT ct.*, i.instance_token, i.name as instance_name, i.is_connected,
       t.name as template_name, t.type as template_type,
       t.text_content, t.list_config, t.buttons_config, t.carousel_config,
       t.poll_config, t.combined_blocks, t.variables_map,
       p.host as proxy_host, p.port as proxy_port, 
       p.username as proxy_username, p.password as proxy_password,
       json_agg(json_build_object(
         'media_type', m.media_type,
         'url', m.url,
         'file_path', m.file_path,
         'caption', m.caption
       )) FILTER (WHERE m.id IS NOT NULL) as media_files
       FROM qr_campaign_templates ct
       LEFT JOIN uaz_instances i ON ct.instance_id = i.id
       LEFT JOIN qr_templates t ON ct.qr_template_id = t.id
       LEFT JOIN qr_template_media m ON t.id = m.template_id
       LEFT JOIN proxies p ON i.proxy_id = p.id
       WHERE ct.campaign_id = $1 
       AND ct.is_active = true
       AND i.is_connected = true  -- ✅ SÓ INSTÂNCIAS CONECTADAS
       AND i.is_active = true     -- ✅ SÓ INSTÂNCIAS ATIVAS (não pausadas)
       GROUP BY ct.id, i.id, t.id, p.id
       ORDER BY ct.order_index`,
      [campaign.id]
    );

    if (templatesResult.rows.length === 0) {
      console.log(`⚠️  [QR Worker] Nenhum template ativo para campanha ${campaign.id}`);
      return;
    }

    const allTemplates = templatesResult.rows;

    // 🔄 AGRUPAR TEMPLATES POR INSTÂNCIA (para distribuição round-robin entre instâncias)
    const templatesByInstance = new Map<number, CampaignTemplate[]>();
    for (const template of allTemplates) {
      if (!templatesByInstance.has(template.instance_id)) {
        templatesByInstance.set(template.instance_id, []);
      }
      templatesByInstance.get(template.instance_id)!.push(template);
    }

    const instanceIds = Array.from(templatesByInstance.keys());
    const numInstances = instanceIds.length;
    
    // ✅ OBTER TEMPLATES ÚNICOS (para mapeamento 1:1 quando possível)
    const uniqueTemplateIds = new Set(allTemplates.map(t => t.qr_template_id));
    const uniqueTemplates = Array.from(uniqueTemplateIds).map(templateId => {
      return allTemplates.find(t => t.qr_template_id === templateId)!;
    });
    const numUniqueTemplates = uniqueTemplates.length;

    console.log(`🔄 [QR Worker] ${numInstances} instância(s) ativa(s) para envio`);
    console.log(`📊 [DEBUG] Total de templates: ${allTemplates.length} (${Math.floor(allTemplates.length / numInstances)} templates por instância)`);
    console.log(`📊 [DEBUG] Templates únicos: ${numUniqueTemplates}`);
    
    // ✅ EXPLICAR LÓGICA DE ROTAÇÃO
    console.log(`\n✅ ROTAÇÃO DE TEMPLATES: Cada instância rotaciona entre templates diferentes`);
    console.log(`   Exemplo com ${numInstances} instâncias e ${numUniqueTemplates} templates:`);
    for (let cycle = 0; cycle < Math.min(3, numUniqueTemplates); cycle++) {
      console.log(`   Ciclo ${cycle}:`);
      for (let i = 0; i < numInstances; i++) {
        const instanceId = instanceIds[i];
        const instance = allTemplates.find(t => t.instance_id === instanceId)!;
        const templateIndex = (i + cycle) % numUniqueTemplates;
        const assignedTemplate = uniqueTemplates[templateIndex];
        console.log(`     - Instância ${instance.instance_name} → Template ${assignedTemplate.template_name}`);
      }
    }
    console.log('');
    
    // 🐛 DEBUG: Mostrar distribuição de templates por instância
    console.log('🔍 [DEBUG] Distribuição de templates por instância:');
    for (const [instanceId, templates] of templatesByInstance) {
      const instance = templates[0];
      console.log(`   Instância ${instance.instance_name} (ID: ${instanceId}): ${templates.length} template(s)`);
    }
    console.log('');

    // Buscar os próximos N contatos pendentes (N = número de instâncias)
    // Incluir contatos que nunca foram enviados OU que falharam e precisam ser reenviados
    const contactsResult = await query(
      `SELECT DISTINCT c.* FROM contacts c
       INNER JOIN qr_campaign_contacts cc ON c.id = cc.contact_id
       WHERE cc.campaign_id = $1
       AND (
         -- Contatos que nunca foram enviados
         c.id NOT IN (
           SELECT contact_id FROM qr_campaign_messages 
           WHERE campaign_id = $1 AND contact_id IS NOT NULL
         )
         -- OU contatos com mensagens pendentes (que precisam ser reenviadas)
         OR c.id IN (
           SELECT contact_id FROM qr_campaign_messages 
           WHERE campaign_id = $1 
           AND contact_id IS NOT NULL
           AND status = 'pending'
         )
       )
       LIMIT $2`,
      [campaign.id, numInstances]
    );

    console.log(`📊 [DEBUG] Query de contatos retornou ${contactsResult.rows.length} contato(s)`);
    
    if (contactsResult.rows.length === 0) {
      // Campanha concluída
      console.log(`✅ [DEBUG] Nenhum contato pendente, finalizando campanha ${campaign.id}`);
      await this.finishCampaign(campaign.id);
      return;
    }

    // Parsear variáveis de JSON para objeto
    const contacts = contactsResult.rows.map(contact => ({
      ...contact,
      variables: typeof contact.variables === 'string' 
        ? JSON.parse(contact.variables) 
        : (contact.variables || {})
    }));

    console.log(`📞 [QR Worker] ${contacts.length} contato(s) para processar SEQUENCIALMENTE`);

    // Buscar intervalo configurado
    const intervalSeconds = campaign.schedule_config?.interval_seconds || 5;
    const pauseAfter = campaign.pause_config?.pause_after || 0;
    const pauseDuration = campaign.pause_config?.pause_duration_minutes || 30;

    // ENVIAR MENSAGENS SEQUENCIALMENTE COM DELAY
    for (let index = 0; index < contacts.length; index++) {
      // ✅ VERIFICAR SE CAMPANHA FOI PAUSADA MANUALMENTE ANTES DE CADA ENVIO
      const statusCheck = await query(
        `SELECT status FROM qr_campaigns WHERE id = $1`,
        [campaign.id]
      );
      
      // ✅ VERIFICAR SE ESTÁ DENTRO DO HORÁRIO DE TRABALHO ANTES DE CADA ENVIO
      const scheduleConfig = (campaign.schedule_config || {}) as WorkerConfig;
      if (scheduleConfig.work_start_time && scheduleConfig.work_end_time) {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);
        
        if (currentTime < scheduleConfig.work_start_time || currentTime > scheduleConfig.work_end_time) {
          console.log(`⏸️ [QR Worker] FORA do horário de trabalho (${currentTime} não está entre ${scheduleConfig.work_start_time} e ${scheduleConfig.work_end_time})`);
          console.log(`⏸️ [QR Worker] Pausando campanha ${campaign.id} - ${index} de ${contacts.length} mensagens enviadas`);
          
          // Pausar campanha automaticamente
          await query(
            `UPDATE qr_campaigns SET status = 'paused' WHERE id = $1`,
            [campaign.id]
          );
          
          console.log(`⏸️ [QR Worker] Campanha ${campaign.id} pausada - Retomará automaticamente no próximo horário de trabalho`);
          return; // Parar o processamento
        }
      }
      
      if (statusCheck.rows[0]?.status === 'paused') {
        console.log('');
        console.log('⏸️ ═══════════════════════════════════════════');
        console.log(`⏸️  CAMPANHA PAUSADA MANUALMENTE`);
        console.log(`⏸️  Campanha: ${campaign.name} (ID: ${campaign.id})`);
        console.log(`⏸️  Mensagens já enviadas: ${index} de ${contacts.length} do lote atual`);
        console.log('⏸️ ═══════════════════════════════════════════');
        console.log('');
        return; // ← SAI DO LOOP E PARA DE ENVIAR
      }
      
      if (statusCheck.rows[0]?.status === 'cancelled') {
        console.log('');
        console.log('🛑 ═══════════════════════════════════════════');
        console.log(`🛑  CAMPANHA CANCELADA`);
        console.log(`🛑  Campanha: ${campaign.name} (ID: ${campaign.id})`);
        console.log('🛑 ═══════════════════════════════════════════');
        console.log('');
        return; // ← SAI DO LOOP E PARA DE ENVIAR
      }
      
      const contact = contacts[index];
      
      // 🔄 ROUND-ROBIN: Distribuir mensagens entre as instâncias de forma rotativa
      // Calculamos qual instância usar baseado no sent_count total da campanha
      const currentSentCount = campaign.sent_count + index;
      const instanceIndex = currentSentCount % numInstances;
      const selectedInstanceId = instanceIds[instanceIndex];
      const instanceTemplates = templatesByInstance.get(selectedInstanceId)!;
      
      // ✅ NOVA LÓGICA: Cada instância rotaciona entre templates diferentes
      // Exemplo com 3 instâncias e 3 templates:
      //   Mensagem 1: Instância A → Template A
      //   Mensagem 2: Instância B → Template B
      //   Mensagem 3: Instância C → Template C
      //   Mensagem 4: Instância A → Template B (não Template A!)
      //   Mensagem 5: Instância B → Template C
      //   Mensagem 6: Instância C → Template A
      //   E assim por diante...
      
      // Calcular qual template usar baseado no ciclo atual
      // Cada instância deve usar um template diferente a cada ciclo
      const cycleNumber = Math.floor(currentSentCount / numInstances); // Qual ciclo estamos (0, 1, 2...)
      const templateIndex = (instanceIndex + cycleNumber) % numUniqueTemplates;
      const assignedTemplate = uniqueTemplates[templateIndex];
      
      // Buscar a combinação correta (instância + template) na lista de templates
      let template = allTemplates.find(t => 
        t.instance_id === selectedInstanceId && 
        t.qr_template_id === assignedTemplate.qr_template_id
      ) || instanceTemplates[0]; // Fallback para o primeiro template da instância
      
      console.log(`🎯 [QR Worker] Contato ${contact.phone_number} → Instância ${template.instance_name} (ID: ${template.instance_id}) → Template ${template.template_name} [instanceIdx=${instanceIndex}, cycle=${cycleNumber}, templateIdx=${templateIndex}]`);
      
      // 🚨 VERIFICAR LISTA DE RESTRIÇÃO ANTES DE ENVIAR
      console.log('🔍 [QR CAMPANHA] Verificando lista de restrição...');
      console.log(`   ⚠️  REGRA: Se número está na lista, bloqueia em TODAS as contas!`);
      console.log(`   📞 Número: ${contact.phone_number}`);
      console.log(`   📱 Instância da campanha: ${template.instance_name} (ID: ${template.instance_id})`);
      
      const isRestricted = await this.checkRestrictionList(contact.phone_number, template.instance_id, campaign.tenant_id);
      
      if (isRestricted) {
        console.log(`🚫 ═══════════════════════════════════════════════════`);
        console.log(`🚫 NÚMERO BLOQUEADO - ESTÁ NA LISTA DE RESTRIÇÃO!`);
        console.log(`🚫 ═══════════════════════════════════════════════════`);
        console.log(`   📞 Número: ${contact.phone_number}`);
        console.log(`   📝 Lista(s): ${isRestricted.listNames}`);
        console.log(`   🏷️  Tipo(s): ${isRestricted.types.join(', ')}`);
        console.log(`   ❌ ENVIO CANCELADO - Pulando para o próximo`);
        console.log(`═══════════════════════════════════════════════════\n`);
        
        // Marcar como pulado/failed
        await query(
          `INSERT INTO qr_campaign_messages 
           (campaign_id, contact_id, instance_id, qr_template_id, phone_number, template_name, status, error_message, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'failed', $7, NOW())`,
          [
            campaign.id,
            contact.id,
            template.instance_id,
            template.qr_template_id,
            contact.phone_number,
            template.template_name || 'Template QR',
            `Bloqueado - Lista de Restrição: ${isRestricted.listNames}`
          ]
        );
        
        // Atualizar contador
        await query(
          `UPDATE qr_campaigns SET sent_count = sent_count + 1, failed_count = failed_count + 1, updated_at = NOW() WHERE id = $1`,
          [campaign.id]
        );
        
        console.log(`📊 [QR Worker] Mensagem bloqueada e marcada como failed`);
        
        // ⭐ NÃO aguardar intervalo após número bloqueado - continuar imediatamente
        // (O intervalo já será aplicado no próximo envio válido)
        continue; // Pular para o próximo contato
      }
      
      console.log('✅ ═══════════════════════════════════════════════════');
      console.log('✅ NÚMERO LIVRE - NÃO ESTÁ NA LISTA DE RESTRIÇÃO');
      console.log('✅ ═══════════════════════════════════════════════════');
      console.log(`   📞 Número: ${contact.phone_number}`);
      console.log(`   ✅ PROSSEGUINDO COM ENVIO...`);
      console.log('═══════════════════════════════════════════════════\n');
      
      // 📱 VERIFICAR SE O NÚMERO TEM WHATSAPP ANTES DE ENVIAR
      console.log('📱 ═══════════════════════════════════════════════════');
      console.log('📱 VERIFICANDO SE NÚMERO TEM WHATSAPP...');
      console.log('📱 ═══════════════════════════════════════════════════');
      console.log(`   📞 Número: ${contact.phone_number}`);
      
      const hasWhatsAppCheck = await this.checkIfNumberHasWhatsApp(
        template.instance_token,
        contact.phone_number,
        template.proxy_host ? {
          host: template.proxy_host,
          port: template.proxy_port,
          username: template.proxy_username,
          password: template.proxy_password
        } : null,
        campaign.tenant_id
      );
      
      if (!hasWhatsAppCheck.success) {
        console.log('⚠️ ═══════════════════════════════════════════════════');
        console.log('⚠️ ERRO AO VERIFICAR WHATSAPP - ENVIANDO MESMO ASSIM');
        console.log('⚠️ ═══════════════════════════════════════════════════');
        console.log(`   Erro: ${hasWhatsAppCheck.error}`);
        console.log('═══════════════════════════════════════════════════\n');
        // Continuar com envio mesmo se a verificação falhar
      } else if (!hasWhatsAppCheck.hasWhatsApp) {
        console.log('📵 ═══════════════════════════════════════════════════');
        console.log('📵 NÚMERO NÃO TEM WHATSAPP!');
        console.log('📵 ═══════════════════════════════════════════════════');
        console.log(`   📞 Número: ${contact.phone_number}`);
        console.log(`   ❌ ENVIO CANCELADO - Marcando como "sem WhatsApp"`);
        console.log('═══════════════════════════════════════════════════\n');
        
        // Marcar como "sem WhatsApp" SEM ENVIAR
        await query(
          `INSERT INTO qr_campaign_messages 
           (campaign_id, contact_id, instance_id, qr_template_id, phone_number, template_name, status, error_message, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'no_whatsapp', 'SEM WHATSAPP', NOW())`,
          [
            campaign.id,
            contact.id,
            template.instance_id,
            template.qr_template_id,
            contact.phone_number,
            template.template_name || 'Template QR'
          ]
        );
        
        // Atualizar contador
        await query(
          `UPDATE qr_campaigns SET sent_count = sent_count + 1, no_whatsapp_count = no_whatsapp_count + 1, updated_at = NOW() WHERE id = $1`,
          [campaign.id]
        );
        
        console.log(`📊 [QR Worker] Número marcado como "sem WhatsApp" (não foi enviado)`);
        
        // ⭐ NÃO aguardar intervalo após número sem WhatsApp - continuar imediatamente
        continue; // Pular para o próximo contato
      } else {
        console.log('✅ ═══════════════════════════════════════════════════');
        console.log('✅ NÚMERO TEM WHATSAPP - PROSSEGUINDO COM ENVIO');
        console.log('✅ ═══════════════════════════════════════════════════');
        console.log(`   📞 Número: ${contact.phone_number}`);
        console.log(`   ✅ Nome verificado: ${hasWhatsAppCheck.verifiedName || 'N/A'}`);
        console.log('═══════════════════════════════════════════════════\n');
      }
      
      // Enviar mensagem
      await this.sendMessage(campaign, contact, template);

      // ✅ VERIFICAR NOVAMENTE SE CAMPANHA FOI PAUSADA APÓS O ENVIO
      const statusCheck2 = await query(
        `SELECT status FROM qr_campaigns WHERE id = $1`,
        [campaign.id]
      );
      
      if (statusCheck2.rows[0]?.status === 'paused' || statusCheck2.rows[0]?.status === 'cancelled') {
        console.log(`⏸️ [QR Worker] Campanha ${statusCheck2.rows[0]?.status === 'paused' ? 'pausada' : 'cancelada'} após envio de ${index + 1} mensagem(ns)`);
        return; // ← SAI DO LOOP
      }

      // ⭐ RECARREGAR configurações da campanha antes de cada iteração
      // Isso garante que edições feitas durante a execução sejam respeitadas
      const updatedCampaignResult = await query(
        'SELECT pause_config, schedule_config FROM qr_campaigns WHERE id = $1',
        [campaign.id]
      );
      
      if (updatedCampaignResult.rows.length > 0) {
        campaign.pause_config = updatedCampaignResult.rows[0].pause_config || {};
        campaign.schedule_config = updatedCampaignResult.rows[0].schedule_config || {};
        console.log(`🔄 [QR Worker] Config atualizada: intervalo=${campaign.schedule_config?.interval_seconds}s, pause_after=${campaign.pause_config?.pause_after}, pause_duration=${campaign.pause_config?.pause_duration_minutes}min`);
      }
      
      // Pegar os valores atualizados das configurações
      const currentIntervalSeconds = campaign.schedule_config?.interval_seconds || 5;
      const currentPauseAfter = campaign.pause_config?.pause_after || 0;
      const currentPauseDuration = campaign.pause_config?.pause_duration_minutes || 30;

      // Aguardar delay ENTRE cada mensagem (exceto após a última)
      if (index < contacts.length - 1) {
        console.log(`⏳ [QR Worker] Aguardando ${currentIntervalSeconds}s antes da próxima mensagem...`);
        
        // ✅ DURANTE O DELAY, VERIFICAR A CADA SEGUNDO SE CAMPANHA FOI PAUSADA
        for (let sec = 0; sec < currentIntervalSeconds; sec++) {
          await this.sleep(1000); // 1 segundo
          
          const statusCheckDelay = await query(
            `SELECT status FROM qr_campaigns WHERE id = $1`,
            [campaign.id]
          );
          
          if (statusCheckDelay.rows[0]?.status === 'paused' || statusCheckDelay.rows[0]?.status === 'cancelled') {
            console.log(`⏸️ [QR Worker] Campanha ${statusCheckDelay.rows[0]?.status === 'paused' ? 'pausada' : 'cancelada'} durante delay (após ${sec + 1}s de ${currentIntervalSeconds}s)`);
            return; // ← SAI DO LOOP
          }
        }
      }

      // Verificar se precisa pausar (após X mensagens)
      if (currentPauseAfter > 0) {
        // Recarregar contador de mensagens enviadas
        const campaignData = await query(
          `SELECT sent_count FROM qr_campaigns WHERE id = $1`,
          [campaign.id]
        );
        const currentSentCount = campaignData.rows[0]?.sent_count || 0;

        if (currentSentCount > 0 && currentSentCount % currentPauseAfter === 0) {
          console.log('');
          console.log('⏸️ ═══════════════════════════════════════════');
          console.log(`⏸️  PAUSA AUTOMÁTICA`);
          console.log(`⏸️  Mensagens enviadas: ${currentSentCount}`);
          console.log(`⏸️  Duração da pausa: ${currentPauseDuration} minutos`);
          console.log('⏸️ ═══════════════════════════════════════════');
          console.log('');
          
          // ✅ DURANTE A PAUSA, VERIFICAR A CADA 5 SEGUNDOS SE CAMPANHA FOI PAUSADA/CANCELADA MANUALMENTE
          const pauseTotalSeconds = currentPauseDuration * 60;
          for (let sec = 0; sec < pauseTotalSeconds; sec += 5) {
            await this.sleep(5000); // 5 segundos
            
            const statusCheckPause = await query(
              `SELECT status FROM qr_campaigns WHERE id = $1`,
              [campaign.id]
            );
            
            if (statusCheckPause.rows[0]?.status === 'paused' || statusCheckPause.rows[0]?.status === 'cancelled') {
              console.log(`⏸️ [QR Worker] Campanha ${statusCheckPause.rows[0]?.status === 'paused' ? 'pausada' : 'cancelada'} durante pausa automática (${sec}s de ${pauseTotalSeconds}s)`);
              return; // ← SAI DO LOOP
            }
          }
          
          console.log('▶️  Retomando envios...');
        }
      }
    }

    console.log(`✅ [QR Worker] Lote de ${contacts.length} mensagem(ns) processado(s)`);
  }

  private async getActiveTemplatesCount(campaignId: number): Promise<number> {
    const result = await query(
      `SELECT COUNT(*) as count FROM qr_campaign_templates 
       WHERE campaign_id = $1 AND is_active = true`,
      [campaignId]
    );
    return parseInt(result.rows[0]?.count || '1');
  }

  private async sendMessage(campaign: QrCampaign, contact: Contact, template: CampaignTemplate) {
    try {
      console.log(`📤 [QR Worker] Enviando para ${contact.phone_number}...`);
      console.log(`   Token: ${template.instance_token ? template.instance_token.substring(0, 20) + '...' : 'NULL'}`);
      console.log(`   Template: ${template.template_name} (${template.template_type})`);

      // 🔤 SUBSTITUIR VARIÁVEIS DO CONTATO NO TEMPLATE
      const contactVariables = contact.variables || {};
      console.log(`🔤 [QR Worker] Variáveis do contato:`, contactVariables);
      
      const processedTemplate = replaceVariablesInTemplate(template, contactVariables);
      
      // Log do texto processado (apenas para debug)
      if (processedTemplate.text_content && processedTemplate.text_content !== template.text_content) {
        console.log(`🔤 [QR Worker] Texto original: ${template.text_content?.substring(0, 100)}...`);
        console.log(`🔤 [QR Worker] Texto processado: ${processedTemplate.text_content?.substring(0, 100)}...`);
      }

      // Criar registro de mensagem como pending
      const messageResult = await query(
        `INSERT INTO qr_campaign_messages 
         (campaign_id, contact_id, instance_id, qr_template_id, phone_number, template_name, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
         RETURNING id`,
        [
          campaign.id,
          contact.id,
          template.instance_id,
          template.qr_template_id,
          contact.phone_number,
          template.template_name || 'Template QR'
        ]
      );

      const messageId = messageResult.rows[0].id;

      // Enviar via UAZ API (usando template com variáveis substituídas)
      const sendResult = await this.sendViaUAZ(
        template.instance_token,
        contact.phone_number,
        processedTemplate,
        campaign.tenant_id // Passar tenant_id para buscar credenciais corretas
      );

      if (sendResult.success) {
        // Atualizar mensagem como enviada
        await query(
          `UPDATE qr_campaign_messages 
           SET status = 'sent', sent_at = NOW(), whatsapp_message_id = $1
           WHERE id = $2`,
          [sendResult.messageId, messageId]
        );

        // Atualizar contador da campanha
        await query(
          `UPDATE qr_campaigns 
           SET sent_count = sent_count + 1
           WHERE id = $1`,
          [campaign.id]
        );

        console.log(`✅ [QR Worker] Mensagem enviada para ${contact.phone_number}`);
      } else {
        // Verificar se é erro de "não tem WhatsApp"
        const errorMessage = sendResult.error || '';
        const isNoWhatsApp = errorMessage.toLowerCase().includes('not on whatsapp') || 
                            errorMessage.toLowerCase().includes('is not a whatsapp user');
        
        // ✅ VERIFICAR SE É ERRO DE INSTÂNCIA DESCONECTADA
        const isDisconnected = errorMessage.toLowerCase().includes('not connected') ||
                              errorMessage.toLowerCase().includes('session not found') ||
                              errorMessage.toLowerCase().includes('connection closed') ||
                              errorMessage.toLowerCase().includes('instance not found') ||
                              errorMessage.toLowerCase().includes('socket') ||
                              errorMessage.toLowerCase().includes('disconnected');
        
        if (isNoWhatsApp) {
          // Marcar como "sem WhatsApp"
          await query(
            `UPDATE qr_campaign_messages 
             SET status = 'no_whatsapp', failed_at = NOW(), error_message = 'SEM WHATSAPP'
             WHERE id = $1`,
            [messageId]
          );

          await query(
            `UPDATE qr_campaigns 
             SET no_whatsapp_count = no_whatsapp_count + 1
             WHERE id = $1`,
            [campaign.id]
          );

          console.log(`📵 [QR Worker] Número sem WhatsApp: ${contact.phone_number}`);
        } else if (isDisconnected) {
          // ✅ INSTÂNCIA DESCONECTADA - DESATIVAR DA CAMPANHA
          console.log('');
          console.log('⚠️ ═══════════════════════════════════════════');
          console.log(`⚠️  INSTÂNCIA DESCONECTADA DETECTADA`);
          console.log(`⚠️  Instância: ${template.instance_name} (ID: ${template.instance_id})`);
          console.log(`⚠️  Campanha: ${campaign.name} (ID: ${campaign.id})`);
          console.log(`⚠️  Erro: ${errorMessage}`);
          console.log('⚠️ ═══════════════════════════════════════════');
          console.log('');
          
          // Desativar instância da campanha
          await this.deactivateInstanceFromCampaign(campaign.id, template.instance_id, template.instance_name);
          
          // Marcar mensagem como pendente (não como falha) para reenvio
          await query(
            `UPDATE qr_campaign_messages 
             SET status = 'pending', error_message = $1
             WHERE id = $2`,
            [errorMessage, messageId]
          );
          
          console.log(`🔄 [QR Worker] Mensagem retornada para fila (será enviada por outra instância)`);
        } else {
          // Marcar como falha normal
          await query(
            `UPDATE qr_campaign_messages 
             SET status = 'failed', failed_at = NOW(), error_message = $1
             WHERE id = $2`,
            [sendResult.error, messageId]
          );

          await query(
            `UPDATE qr_campaigns 
             SET failed_count = failed_count + 1
             WHERE id = $1`,
            [campaign.id]
          );

          console.log(`❌ [QR Worker] Falha ao enviar para ${contact.phone_number}: ${sendResult.error}`);
        }
      }
    } catch (error: any) {
      console.error(`❌ [QR Worker] Erro ao enviar mensagem:`, error.message);
    }
  }

  private async convertFileToBase64(fileUrl: string): Promise<{ success: boolean; file?: string; error?: string }> {
    try {
      const filePath = fileUrl.startsWith('http') 
        ? fileUrl.replace('http://localhost:3001', '.')
        : '.' + fileUrl;
      
      console.log('📁 [Worker] Convertendo arquivo para Base64:', filePath);
      
      // Detecta MIME type pela extensão
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4',
        '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.pdf': 'application/pdf'
      };
      
      const mimeType = mimeTypes[ext] || 'application/octet-stream';
      
      const fileBuffer = fs.readFileSync(filePath);
      const base64 = fileBuffer.toString('base64');
      const dataUri = `data:${mimeType};base64,${base64}`;
      
      console.log(`✅ [Worker] Arquivo convertido: ${(fileBuffer.length / 1024).toFixed(2)} KB`);
      
      return {
        success: true,
        file: dataUri
      };
    } catch (error: any) {
      console.error('❌ [Worker] Erro ao converter arquivo:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async sendViaUAZ(instanceToken: string, phoneNumber: string, template: CampaignTemplate, tenantId: number | null | undefined): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Remover caracteres especiais do número (exceto +)
      const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
      
      console.log(`🌐 [UAZ API] Preparando envio...`);
      console.log(`   Token: ${instanceToken ? instanceToken.substring(0, 20) + '...' : 'NULL'}`);
      console.log(`   Tipo: ${template.template_type}`);
      console.log(`   Tenant ID: ${tenantId || 'N/A'}`);
      
      // 🔑 BUSCAR CREDENCIAIS DO TENANT
      if (!tenantId) {
        console.warn('⚠️ [UAZ API] Tenant ID não fornecido, usando credenciais padrão');
      }
      
      const credentials = await getTenantUazapCredentials(tenantId || 1);
      console.log(`🔑 [UAZ API] Usando credencial: "${credentials.credentialName}"`);
      
      // Criar instância do UazService com as credenciais corretas
      const uazService = new UazService(credentials.serverUrl, credentials.adminToken);
      
      // Montar proxy config se existir
      const proxyConfig = template.proxy_host ? {
        host: template.proxy_host,
        port: template.proxy_port,
        username: template.proxy_username,
        password: template.proxy_password
      } : null;

      let sendResult: any;

      // Enviar baseado no tipo de template - USANDO O MESMO SERVIÇO DOS OUTROS MENUS
      if (template.template_type === 'text') {
        // 🔄 PROCESSAR SPIN TEXT
        let textToSend = template.text_content || 'Mensagem de teste';
        if (hasSpinText(textToSend)) {
          textToSend = processSpinText(textToSend);
          console.log('🔄 Spin Text processado:', textToSend);
        }
        
        sendResult = await uazService.sendText(instanceToken, {
          number: cleanPhone,
          text: textToSend
        }, proxyConfig);
      } 
      else if (template.template_type === 'image' || template.template_type === 'video' || 
               template.template_type === 'audio' || template.template_type === 'audio_recorded' ||
               template.template_type === 'document') {
        const media = template.media_files && template.media_files.length > 0 ? template.media_files[0] : null;
        if (!media || !media.url) {
          return { success: false, error: `Template de ${template.template_type} sem mídia` };
        }
        
        // CONVERTER PARA BASE64 SE FOR URL LOCAL (MESMA LÓGICA DO ENVIO ÚNICO)
        let fileToSend = media.url;
        if (media.url.startsWith('http://localhost') || media.url.startsWith('/uploads/')) {
          console.log('🔄 [Worker] URL local detectada, convertendo para Base64...');
          const conversion = await this.convertFileToBase64(media.url);
          if (!conversion.success) {
            return { 
              success: false, 
              error: 'Erro ao processar arquivo: ' + conversion.error 
            };
          }
          fileToSend = conversion.file!;
        }
        
        // 🔄 PROCESSAR SPIN TEXT na legenda
        let captionToSend = media.caption || template.text_content || '';
        if (hasSpinText(captionToSend)) {
          captionToSend = processSpinText(captionToSend);
          console.log('🔄 Spin Text processado na legenda:', captionToSend);
        }
        
        sendResult = await uazService.sendMedia(instanceToken, {
          number: cleanPhone,
          type: template.template_type === 'audio_recorded' ? 'audio' : template.template_type,
          file: fileToSend,
          text: captionToSend,
          docname: template.template_type === 'document' ? 'document.pdf' : undefined
        }, proxyConfig);
      } 
      else if (template.template_type === 'list') {
        // 🔄 PROCESSAR SPIN TEXT
        let titleToSend = template.list_config?.title || 'Menu';
        let descriptionToSend = template.text_content || 'Selecione uma opção';
        if (hasSpinText(titleToSend)) {
          titleToSend = processSpinText(titleToSend);
          console.log('🔄 Spin Text processado no título da lista:', titleToSend);
        }
        if (hasSpinText(descriptionToSend)) {
          descriptionToSend = processSpinText(descriptionToSend);
          console.log('🔄 Spin Text processado na descrição da lista:', descriptionToSend);
        }
        
        // VALIDAR SEÇÕES
        const sections = template.list_config?.sections || [];
        if (sections.length === 0) {
          return { success: false, error: 'Template de lista sem seções configuradas' };
        }
        
        sendResult = await uazService.sendList(instanceToken, {
          number: cleanPhone,
          title: titleToSend,
          description: descriptionToSend,
          buttonText: template.list_config?.buttonText || 'Ver opções',
          footer: template.list_config?.footer || '',
          sections: sections
        }, proxyConfig);
      } 
      else if (template.template_type === 'buttons') {
        // 🔄 PROCESSAR SPIN TEXT
        let textToSend = template.text_content || 'Mensagem com botões';
        if (hasSpinText(textToSend)) {
          textToSend = processSpinText(textToSend);
          console.log('🔄 Spin Text processado no texto dos botões:', textToSend);
        }
        
        // VALIDAR BOTÕES
        const buttons = template.buttons_config?.buttons || [];
        if (buttons.length === 0) {
          return { success: false, error: 'Template de botões sem botões configurados' };
        }
        
        sendResult = await uazService.sendButtons(instanceToken, {
          number: cleanPhone,
          text: textToSend,
          buttons: buttons,
          footer: template.buttons_config?.footer || ''
        }, proxyConfig);
      } 
      else if (template.template_type === 'poll') {
        // 🔄 PROCESSAR SPIN TEXT - USAR text_content, NÃO poll_config.name!
        let pollnameToSend = template.text_content || template.poll_config?.name || 'Enquete';
        if (hasSpinText(pollnameToSend)) {
          pollnameToSend = processSpinText(pollnameToSend);
          console.log('🔄 Spin Text processado no nome da enquete:', pollnameToSend);
        }
        
        // VALIDAR OPÇÕES
        const options = template.poll_config?.options || [];
        if (options.length === 0) {
          return { success: false, error: 'Template de enquete sem opções configuradas' };
        }
        
        // USAR sendMenu com type: 'poll' (IGUAL AO ENVIO ÚNICO)
        sendResult = await uazService.sendMenu(instanceToken, {
          number: cleanPhone,
          type: 'poll',
          text: pollnameToSend,
          choices: options,
          selectableCount: template.poll_config?.selectableCount || 1
        }, proxyConfig);
      } 
      else if (template.template_type === 'carousel') {
        // 🔄 PROCESSAR SPIN TEXT
        let carouselText = template.text_content || '';
        if (hasSpinText(carouselText)) {
          carouselText = processSpinText(carouselText);
          console.log('🔄 Spin Text processado no texto do carrossel:', carouselText);
        }
        
        // Parsear carousel_config se for string
        let carouselConfig = template.carousel_config;
        if (typeof carouselConfig === 'string') {
          try {
            carouselConfig = JSON.parse(carouselConfig);
          } catch (e) {
            console.error('❌ [UAZ API] Erro ao parsear carousel_config:', e);
            return { success: false, error: 'Erro ao processar configuração do carrossel' };
          }
        }
        
        // VALIDAR CARDS
        const cards = carouselConfig?.cards || [];
        if (cards.length === 0) {
          return { success: false, error: 'Template de carrossel sem cards configurados' };
        }
        
        // Processar cards (converter imagens para base64 se necessário, substituir variáveis já foi feito)
        const processedCards = await Promise.all(cards.map(async (card: any) => {
          const processedCard = { ...card };
          
          // Converter imagem para base64 se for URL local
          if (card.image && (card.image.startsWith('http://localhost') || card.image.startsWith('/uploads/'))) {
            console.log(`🔄 [Worker] Convertendo imagem do card para Base64...`);
            const conversion = await this.convertFileToBase64(card.image);
            if (conversion.success) {
              processedCard.image = conversion.file;
            } else {
              console.warn(`⚠️ [Worker] Erro ao converter imagem do card: ${conversion.error}`);
            }
          }
          
          return processedCard;
        }));
        
        sendResult = await uazService.sendCarousel(
          instanceToken,
          cleanPhone,
          carouselText,
          processedCards,
          proxyConfig
        );
      } 
      else if (template.template_type === 'combined') {
        // MENSAGEM COMBINADA - Enviar TODOS os blocos sequencialmente
        console.log(`🔄 [UAZ API] Enviando mensagem combinada...`);
        
        // Parsear combined_blocks se for string
        let combinedBlocks = template.combined_blocks;
        if (typeof combinedBlocks === 'string') {
          try {
            combinedBlocks = JSON.parse(combinedBlocks);
          } catch (e) {
            console.error('❌ [UAZ API] Erro ao fazer parse de combined_blocks:', e);
            return { success: false, error: 'Erro ao processar mensagem combinada: formato inválido' };
          }
        }
        
        const blocks = combinedBlocks?.blocks || [];
        
        if (blocks.length === 0) {
          console.error('❌ [UAZ API] Mensagem combinada sem blocos');
          return { success: false, error: 'Mensagem combinada sem blocos' };
        }
        
        console.log(`📦 [UAZ API] ${blocks.length} bloco(s) para enviar`);
        console.log(`📋 [UAZ API] Estrutura dos blocos:`, JSON.stringify(blocks.map((b: any) => ({ type: b.type, hasText: !!b.text, hasMedia: !!b.media })), null, 2));
        
        let allSuccess = true;
        let lastMessageId = '';
        
        // Enviar cada bloco sequencialmente
        for (let i = 0; i < blocks.length; i++) {
          const block = blocks[i];
          console.log(`📤 [UAZ API] Enviando bloco ${i + 1}/${blocks.length} (${block.type})...`);
          
          let blockResult: any;
          
          if (block.type === 'text') {
            // 🔄 PROCESSAR SPIN TEXT
            let textToSend = block.text || 'Mensagem';
            
            // Validar se texto não está vazio após substituição
            if (!textToSend || textToSend.trim() === '') {
              console.log(`⚠️ [UAZ API] Bloco ${i + 1} de texto vazio após substituição, pulando...`);
              continue;
            }
            
            if (hasSpinText(textToSend)) {
              textToSend = processSpinText(textToSend);
              console.log(`🔄 Spin Text processado no bloco ${i + 1}:`, textToSend);
            }
            
            console.log(`📤 [UAZ API] Enviando bloco ${i + 1} (text): "${textToSend.substring(0, 50)}..."`);
            
            blockResult = await uazService.sendText(instanceToken, {
              number: cleanPhone,
              text: textToSend
            }, proxyConfig);
          }
          else if (block.type === 'image' || block.type === 'video' || block.type === 'audio' || block.type === 'document') {
            if (!block.media || !block.media.url) {
              console.log(`⚠️ [UAZ API] Bloco ${i + 1} sem mídia, pulando...`);
              continue;
            }
            
            let fileToSend = block.media.url;
            if (block.media.url.startsWith('http://localhost') || block.media.url.startsWith('/uploads/')) {
              const conversion = await this.convertFileToBase64(block.media.url);
              if (!conversion.success) {
                console.log(`❌ [UAZ API] Erro ao converter mídia do bloco ${i + 1}: ${conversion.error}`);
                allSuccess = false;
                continue;
              }
              fileToSend = conversion.file!;
            }
            
            // 🔄 PROCESSAR SPIN TEXT na legenda
            let captionToSend = block.text || block.media.caption || '';
            if (hasSpinText(captionToSend)) {
              captionToSend = processSpinText(captionToSend);
              console.log(`🔄 Spin Text processado na legenda do bloco ${i + 1}:`, captionToSend);
            }
            
            blockResult = await uazService.sendMedia(instanceToken, {
              number: cleanPhone,
              type: block.type,
              file: fileToSend,
              text: captionToSend,
              docname: block.type === 'document' ? 'document.pdf' : undefined
            }, proxyConfig);
          }
          else if (block.type === 'buttons' || block.type === 'button') {
            // 🔄 PROCESSAR SPIN TEXT
            let textToSend = block.text || 'Escolha uma opção';
            if (hasSpinText(textToSend)) {
              textToSend = processSpinText(textToSend);
              console.log(`🔄 Spin Text processado no bloco ${i + 1}:`, textToSend);
            }
            
            // VALIDAR BOTÕES
            const buttons = block.buttons || [];
            if (buttons.length === 0) {
              console.log(`⚠️ [UAZ API] Bloco ${i + 1} de botões sem botões, pulando...`);
              continue;
            }
            
            blockResult = await uazService.sendButtons(instanceToken, {
              number: cleanPhone,
              text: textToSend,
              buttons: buttons,
              footer: block.footer || ''
            }, proxyConfig);
          }
          else if (block.type === 'list') {
            // 🔄 PROCESSAR SPIN TEXT
            let titleToSend = block.listTitle || 'Menu';
            let descriptionToSend = block.text || 'Selecione uma opção';
            if (hasSpinText(titleToSend)) {
              titleToSend = processSpinText(titleToSend);
              console.log(`🔄 Spin Text processado no título do bloco ${i + 1}:`, titleToSend);
            }
            if (hasSpinText(descriptionToSend)) {
              descriptionToSend = processSpinText(descriptionToSend);
              console.log(`🔄 Spin Text processado na descrição do bloco ${i + 1}:`, descriptionToSend);
            }
            
            // VALIDAR SEÇÕES
            const sections = block.listSections || block.sections || [];
            if (sections.length === 0) {
              console.log(`⚠️ [UAZ API] Bloco ${i + 1} de lista sem seções, pulando...`);
              continue;
            }
            
            blockResult = await uazService.sendList(instanceToken, {
              number: cleanPhone,
              title: titleToSend,
              description: descriptionToSend,
              buttonText: block.listButton || 'Ver opções',
              footer: block.footer || '',
              sections: sections
            }, proxyConfig);
          }
          else if (block.type === 'poll') {
            // 🔄 PROCESSAR SPIN TEXT
            let pollnameToSend = block.text || block.pollName || 'Enquete';
            if (hasSpinText(pollnameToSend)) {
              pollnameToSend = processSpinText(pollnameToSend);
              console.log(`🔄 Spin Text processado no nome da enquete do bloco ${i + 1}:`, pollnameToSend);
            }
            
            // VALIDAR OPÇÕES
            const options = block.choices || [];
            if (options.length === 0) {
              console.log(`⚠️ [UAZ API] Bloco ${i + 1} de enquete sem opções, pulando...`);
              continue;
            }
            
            // USAR sendMenu com type: 'poll' (IGUAL AO ENVIO ÚNICO)
            blockResult = await uazService.sendMenu(instanceToken, {
              number: cleanPhone,
              type: 'poll',
              text: pollnameToSend,
              choices: options,
              selectableCount: block.maxChoices || 1
            }, proxyConfig);
          }
          else if (block.type === 'carousel') {
            // CAROUSEL dentro da mensagem combinada
            console.log(`🎡 [UAZ API] Enviando carousel (${block.cards?.length || 0} cards)...`);
            
            if (!block.cards || block.cards.length === 0) {
              console.log(`⚠️ [UAZ API] Carousel sem cards no bloco ${i + 1}, pulando...`);
              continue;
            }
            
            // Processar cada card do carousel
            const processedCards = await Promise.all(block.cards.map(async (card: any) => {
              // Converter imagem se for URL local
              let imageToSend = card.image || card.cardImageUrl;
              if (imageToSend && (imageToSend.startsWith('http://localhost') || imageToSend.startsWith('/uploads/'))) {
                const conversion = await this.convertFileToBase64(imageToSend);
                if (conversion.success) {
                  imageToSend = conversion.file;
                }
              }
              
              // 🔄 PROCESSAR SPIN TEXT no texto do card
              let cardText = card.text || '';
              if (hasSpinText(cardText)) {
                cardText = processSpinText(cardText);
              }
              
              return {
                text: cardText,
                image: imageToSend,
                buttons: card.buttons || []
              };
            }));
            
            // 🔄 PROCESSAR SPIN TEXT no texto principal do carousel
            let carouselText = block.text || '';
            if (hasSpinText(carouselText)) {
              carouselText = processSpinText(carouselText);
              console.log(`🔄 Spin Text processado no carousel do bloco ${i + 1}:`, carouselText);
            }
            
            // Validar tamanho do payload antes de enviar
            const payloadSize = JSON.stringify({
              number: cleanPhone,
              text: carouselText,
              carousel: processedCards
            }).length;
            
            if (payloadSize > 10 * 1024 * 1024) { // > 10MB
              console.error(`❌ [UAZ API] Carrossel muito grande: ${(payloadSize / 1024 / 1024).toFixed(2)} MB (máximo: 10MB)`);
              console.error(`❌ [UAZ API] Bloco ${i + 1} (carousel) falhou: Payload muito grande`);
              allSuccess = false;
              continue;
            }
            
            console.log(`📦 [UAZ API] Tamanho do payload do carrossel: ${(payloadSize / 1024).toFixed(2)} KB`);
            
            blockResult = await uazService.sendCarousel(
              instanceToken,
              cleanPhone,
              carouselText,
              processedCards,
              proxyConfig
            );
          }
          else {
            console.log(`⚠️ [UAZ API] Tipo de bloco desconhecido: ${block.type}`);
            console.log(`📋 [UAZ API] Estrutura do bloco:`, JSON.stringify(block, null, 2));
            continue;
          }
          
          if (blockResult && blockResult.success) {
            console.log(`✅ [UAZ API] Bloco ${i + 1}/${blocks.length} enviado com sucesso`);
            lastMessageId = blockResult.data?.key?.id || blockResult.data?.id || lastMessageId;
            
            // Aguardar 2 segundos entre os blocos (para não sobrecarregar a API)
            if (i < blocks.length - 1) {
              console.log(`⏳ [UAZ API] Aguardando 2s antes do próximo bloco...`);
              await this.sleep(2000);
            }
          } else {
            const errorMsg = blockResult?.error || 'Erro desconhecido';
            console.log(`❌ [UAZ API] Falha ao enviar bloco ${i + 1}/${blocks.length} (${block.type}): ${errorMsg}`);
            console.log(`📋 [UAZ API] Dados do bloco que falhou:`, JSON.stringify({
              type: block.type,
              text: block.text?.substring(0, 100),
              hasMedia: !!block.media,
              hasButtons: !!block.buttons,
              buttonsCount: block.buttons?.length || 0
            }, null, 2));
            
            // Se for erro de "Invalid payload", adicionar mais detalhes
            if (errorMsg.toLowerCase().includes('invalid payload') || errorMsg.toLowerCase().includes('invalid')) {
              console.error(`🚨 [UAZ API] ERRO CRÍTICO: Invalid payload no bloco ${i + 1}/${blocks.length}`);
              console.error(`🚨 [UAZ API] Tipo do bloco: ${block.type}`);
              
              // Se for carrossel, mostrar informações sobre tamanho
              if (block.type === 'carousel') {
                const carouselSize = JSON.stringify(block).length;
                console.error(`🚨 [UAZ API] Tamanho do carrossel: ${(carouselSize / 1024).toFixed(2)} KB`);
                console.error(`🚨 [UAZ API] Número de cards: ${block.cards?.length || 0}`);
                if (block.cards && block.cards.length > 0) {
                  block.cards.forEach((card: any, idx: number) => {
                    const cardSize = JSON.stringify(card).length;
                    console.error(`🚨 [UAZ API]   Card ${idx + 1}: ${(cardSize / 1024).toFixed(2)} KB, ${card.buttons?.length || 0} botões`);
                  });
                }
              }
              
              console.error(`🚨 [UAZ API] Conteúdo do bloco (primeiros 500 chars):`, JSON.stringify(block, null, 2).substring(0, 500));
            }
            
            allSuccess = false;
          }
        }
        
        // Retornar resultado final
        if (!allSuccess) {
          // Se algum bloco falhou, retornar erro detalhado
          const failedBlocks = blocks.filter((b: any, idx: number) => {
            // Verificar se houve erro (simplificado - na prática seria melhor rastrear)
            return true; // Por enquanto retornar todos para debug
          });
          
          console.error(`❌ [UAZ API] Mensagem combinada falhou: ${blocks.length} blocos, alguns falharam`);
          console.error(`📋 [UAZ API] Último messageId obtido: ${lastMessageId || 'Nenhum'}`);
        }
        
        sendResult = {
          success: allSuccess,
          data: { id: lastMessageId },
          error: allSuccess ? undefined : 'Invalid payload - Alguns blocos da mensagem combinada falharam'
        };
        
        console.log(`${allSuccess ? '✅' : '⚠️'} [UAZ API] Mensagem combinada finalizada (${blocks.length} blocos, ${allSuccess ? 'todos enviados' : 'alguns falharam'})`);
      } 
      else {
        // Fallback para texto simples
        sendResult = await uazService.sendText(instanceToken, {
          number: cleanPhone,
          text: template.text_content || 'Mensagem de campanha QR Connect'
        }, proxyConfig);
      }

      console.log(`📡 [UAZ API] Resultado:`, sendResult);

      if (sendResult.success) {
        return {
          success: true,
          messageId: sendResult.data?.key?.id || sendResult.data?.id || `msg_${Date.now()}`
        };
      } else {
        return {
          success: false,
          error: sendResult.error || 'Erro ao enviar'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Erro desconhecido'
      };
    }
  }

  private async checkAutoPause(campaign: QrCampaign) {
    const pauseConfig = (campaign.pause_config || {}) as PauseConfig;
    
    if (!pauseConfig.pause_after || pauseConfig.pause_after === 0) {
      return;
    }

    if (campaign.sent_count > 0 && campaign.sent_count % pauseConfig.pause_after === 0) {
      const pauseDurationMinutes = pauseConfig.pause_duration_minutes || 30;
      
      this.pauseState.set(campaign.id, {
        startedAt: new Date(),
        durationMinutes: pauseDurationMinutes
      });

      console.log(`⏸️  [QR Worker] Campanha ${campaign.id} em pausa automática por ${pauseDurationMinutes} minutos`);
    }
  }

  /**
   * ✅ Verificar e reativar instâncias que reconectaram OU foram despausadas
   */
  private async checkAndReactivateInstances(campaignId: number) {
    try {
      // Buscar instâncias que estão desativadas na campanha mas reconectaram E estão ativas
      const reconnectedInstances = await query(
        `SELECT ct.id as template_id, ct.instance_id, i.name as instance_name, 
                i.is_connected, i.is_active, ct.removed_at
         FROM qr_campaign_templates ct
         LEFT JOIN uaz_instances i ON ct.instance_id = i.id
         WHERE ct.campaign_id = $1 
         AND ct.is_active = false
         AND i.is_connected = true
         AND i.is_active = true`,
        [campaignId]
      );

      if (reconnectedInstances.rows.length > 0) {
        console.log('');
        console.log('✅ ═══════════════════════════════════════════');
        console.log(`✅  INSTÂNCIAS RECONECTADAS/DESPAUSADAS DETECTADAS`);
        console.log(`✅  Campanha ID: ${campaignId}`);
        console.log(`✅  Quantidade: ${reconnectedInstances.rows.length}`);
        console.log('✅ ═══════════════════════════════════════════');
        console.log('');

        for (const instance of reconnectedInstances.rows) {
          // Reativar instância na campanha
          await query(
            `UPDATE qr_campaign_templates 
             SET is_active = true,
                 removed_at = NULL
             WHERE id = $1`,
            [instance.template_id]
          );

          console.log(`✅ [QR Worker] Instância "${instance.instance_name}" (ID: ${instance.instance_id}) RECONECTADA/DESPAUSADA e REATIVADA na campanha ${campaignId}`);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao verificar instâncias reconectadas/despausadas:', error);
    }
  }

  /**
   * ⚠️ Desativar instância da campanha quando desconectar
   */
  private async deactivateInstanceFromCampaign(campaignId: number, instanceId: number, instanceName: string) {
    try {
      // Desativar instância na campanha
      await query(
        `UPDATE qr_campaign_templates 
         SET is_active = false 
         WHERE campaign_id = $1 AND instance_id = $2`,
        [campaignId, instanceId]
      );

      console.log(`⚠️ [QR Worker] Instância "${instanceName}" (ID: ${instanceId}) DESATIVADA da campanha ${campaignId}`);
      console.log(`🔄 [QR Worker] Campanha continuará com as demais instâncias conectadas`);
    } catch (error) {
      console.error('❌ Erro ao desativar instância da campanha:', error);
    }
  }

  private async finishCampaign(campaignId: number) {
    try {
      await query(
        `UPDATE qr_campaigns 
         SET status = 'completed', completed_at = NOW()
         WHERE id = $1`,
        [campaignId]
      );
      
      this.autoPausedCampaigns.delete(campaignId);
      this.pauseState.delete(campaignId);
      
      console.log(`✅ [QR Worker] Campanha ${campaignId} concluída!`);
    } catch (error) {
      console.error('❌ Erro ao finalizar campanha QR:', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 📱 VERIFICAR SE NÚMERO TEM WHATSAPP ANTES DE ENVIAR
   * Retorna objeto com success, hasWhatsApp e verifiedName
   */
  private async checkIfNumberHasWhatsApp(
    instanceToken: string,
    phoneNumber: string,
    proxyConfig: any,
    tenantId: number | null | undefined
  ): Promise<{ success: boolean; hasWhatsApp: boolean; verifiedName?: string; error?: string }> {
    try {
      console.log(`   🔎 [QR] Verificando se ${phoneNumber} tem WhatsApp...`);
      
      // Buscar credenciais do tenant
      const credentials = await getTenantUazapCredentials(tenantId || 1);
      const uazService = new UazService(credentials.serverUrl, credentials.adminToken);
      
      // Chamar checkNumber do UAZ Service
      const result = await uazService.checkNumber(instanceToken, phoneNumber, proxyConfig);
      
      if (!result.success) {
        console.log(`   ⚠️ [QR] Erro ao verificar: ${result.error}`);
        return {
          success: false,
          hasWhatsApp: false,
          error: result.error
        };
      }
      
      const hasWhatsApp = result.exists || false;
      const verifiedName = result.data?.verifiedName || null;
      
      console.log(`   ${hasWhatsApp ? '✅' : '❌'} [QR] ${phoneNumber}: ${hasWhatsApp ? 'TEM WhatsApp' : 'NÃO tem WhatsApp'}`);
      if (verifiedName) {
        console.log(`   👤 [QR] Nome verificado: ${verifiedName}`);
      }
      
      return {
        success: true,
        hasWhatsApp: hasWhatsApp,
        verifiedName: verifiedName
      };
    } catch (error: any) {
      console.error('❌ ═══════════════════════════════════════════════════');
      console.error('❌ ERRO AO VERIFICAR SE NÚMERO TEM WHATSAPP!');
      console.error('❌ ═══════════════════════════════════════════════════');
      console.error('   Erro:', error.message);
      console.error('   Stack:', error.stack);
      console.error('═══════════════════════════════════════════════════\n');
      
      // Se der erro, retornar que não conseguiu verificar (mas não bloquear)
      return {
        success: false,
        hasWhatsApp: false,
        error: error.message
      };
    }
  }

  /**
   * 🚨 VERIFICAR SE NÚMERO ESTÁ NA LISTA DE RESTRIÇÃO
   * Retorna false se número está livre, ou objeto com detalhes se está restrito
   */
  private async checkRestrictionList(phoneNumber: string, instanceId: number, tenantId: number): Promise<false | { listNames: string, types: string[] }> {
    try {
      console.log(`   🔎 [QR] Chamando RestrictionListController.checkBulk...`);
      console.log(`      Número: ${phoneNumber}`);
      console.log(`      Instância: ${instanceId}`);
      console.log(`      Tenant: ${tenantId}`);
      
      const restrictionController = new RestrictionListController();
      
      // Buscar IDs de conta WhatsApp associados a esta instância QR
      // Para QR, podemos verificar com todos os IDs ou apenas com a instância
      // Por simplicidade, vamos usar o instanceId como identificador
      const fakeReq: any = {
        body: {
          phone_numbers: [phoneNumber],
          whatsapp_account_ids: [instanceId], // Usar instance_id como identificador
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
      
      console.log(`   📊 [QR] Resultado da verificação:`, restrictionResult);
      
      if (restrictionResult && restrictionResult.restricted_count > 0) {
        const detail = restrictionResult.restricted_details[0];
        console.log(`   🚫 [QR] NÚMERO RESTRITO!`);
        console.log(`      Listas: ${detail.list_names.join(', ')}`);
        console.log(`      Tipos: ${detail.types.join(', ')}`);
        
        return {
          listNames: detail.list_names.join(', '),
          types: detail.types
        };
      }
      
      console.log(`   ✅ [QR] Número livre`);
      return false; // Número livre
    } catch (error: any) {
      console.error('❌ ═══════════════════════════════════════════════════');
      console.error('❌ ERRO AO VERIFICAR LISTA DE RESTRIÇÃO (QR CAMPANHA)!');
      console.error('❌ ═══════════════════════════════════════════════════');
      console.error('   Erro:', error.message);
      console.error('   Stack:', error.stack);
      console.error('═══════════════════════════════════════════════════\n');
      
      // ⚠️ SE DER ERRO, BLOQUEAR POR SEGURANÇA
      return {
        listNames: 'Erro na verificação - Bloqueado por segurança',
        types: ['error']
      };
    }
  }
}

// Exportar instância única (singleton)
export const qrCampaignWorker = new QrCampaignWorker();

