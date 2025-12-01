import { query } from '../database/connection';
import { queryWithTenantId } from '../database/tenant-query';
import { whatsappService } from '../services/whatsapp.service';
import { whatsappHealthService } from '../services/whatsapp-health.service';
import { RestrictionListController } from '../controllers/restriction-list.controller';
import { getBrazilNow } from '../utils/timezone';

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

interface WorkerConfig {
  work_start_time: string;
  work_end_time: string;
  interval_seconds: number;
}

interface PauseConfig {
  pause_after: number;
  pause_duration_minutes: number;
}

interface Campaign {
  id: number;
  name: string;
  status: string;
  tenant_id: number;
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
  whatsapp_account_id: number;
  template_id: number;
  media_url: string | null;
  media_type: string | null;
  order_index: number;
  template_name: string;
  access_token: string;
  phone_number_id: string;
  account_id: number;
  account_name: string;
}

interface Contact {
  id: number;
  phone_number: string;
  variables: Record<string, any>;
}

class CampaignWorker {
  private isRunning = false;
  private currentCampaignId: number | null = null;
  private pauseState: Map<number, { startedAt: Date; durationMinutes: number }> = new Map();
  private autoPausedCampaigns: Set<number> = new Set(); // Campanhas pausadas automaticamente pelo worker
  
  // ⚡ NOVO: Cache de Health Check para evitar chamadas duplicadas na mesma conta
  private healthCheckCache: Map<number, { timestamp: number; checking: Promise<void> | null }> = new Map();
  private readonly HEALTH_CHECK_CACHE_TTL = 30000; // 30 segundos
  
  // 🔥 CORREÇÃO: Contador de mensagens do ciclo atual POR CAMPANHA
  // Cada campanha tem seu próprio contador isolado para a pausa programada
  private campaignCycleCounters: Map<number, number> = new Map();

  /**
   * ⭐ VERSÃO ASSÍNCRONA: Busca estado da pausa do banco (persistente)
   */
  async getPauseStateAsync(campaignId: number): Promise<{ remainingSeconds: number } | null> {
    try {
      // Buscar do banco de dados
      const result = await query(
        'SELECT pause_started_at, pause_config FROM campaigns WHERE id = $1',
        [campaignId]
      );
      
      if (result.rows.length === 0 || !result.rows[0].pause_started_at) {
        return null;
      }
      
      const campaign = result.rows[0];
      const pauseStartedAt = new Date(campaign.pause_started_at);
      const pauseDurationMinutes = campaign.pause_config?.pause_duration_minutes || 1;
      
      const now = new Date();
      const elapsedMs = now.getTime() - pauseStartedAt.getTime();
      const totalMs = pauseDurationMinutes * 60 * 1000;
      const remainingMs = Math.max(0, totalMs - elapsedMs);
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      
      // Se a pausa já acabou, limpar o campo
      if (remainingSeconds <= 0) {
        console.log(`▶️  ═══════════════════════════════════════════════════`);
        console.log(`▶️  RETOMANDO CAMPANHA ${campaignId} - Pausa terminou!`);
        console.log(`▶️  ✅ Limpando estado de pausa do banco de dados`);
        console.log(`▶️  ═══════════════════════════════════════════════════`);
        
        await query(
          'UPDATE campaigns SET pause_started_at = NULL WHERE id = $1',
          [campaignId]
        );
        
        // Limpar também da memória
        this.pauseState.delete(campaignId);
        
        return null;
      }
      
      return { remainingSeconds };
    } catch (error) {
      console.error(`Erro ao buscar pause state da campanha ${campaignId}:`, error);
      return null;
    }
  }

  /**
   * ⭐ VERSÃO SÍNCRONA (mantida para compatibilidade): Busca do Map em memória
   */
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

  /**
   * Verifica o health de todas as contas da campanha e atualiza is_active
   */
  async checkCampaignAccountsHealth(campaignId: number): Promise<void> {
    try {
      console.log(`🏥 Verificando health das contas da campanha ${campaignId}...`);

      // Buscar todas as contas da campanha
      const accountsResult = await query(
        `SELECT DISTINCT ct.whatsapp_account_id, ct.is_active, ct.consecutive_failures, 
         ct.last_error, ct.removed_at, ct.removal_count, ct.permanent_removal, ct.removal_history,
         w.access_token, w.phone_number_id, w.id as account_id, w.name as account_name
         FROM campaign_templates ct
         LEFT JOIN whatsapp_accounts w ON ct.whatsapp_account_id = w.id
         WHERE ct.campaign_id = $1`,
        [campaignId]
      );

      if (accountsResult.rows.length === 0) {
        return;
      }

      // ⚡ NOVO: Processar health checks em paralelo COM cache
      await Promise.all(accountsResult.rows.map(account => this.checkAccountHealthWithCache(account)));
      
    } catch (error: any) {
      console.error(`❌ Erro ao verificar health da campanha ${campaignId}:`, error.message);
    }
  }

  /**
   * Verifica health de UMA conta com cache para evitar chamadas duplicadas
   */
  private async checkAccountHealthWithCache(account: any): Promise<void> {
    const { 
      whatsapp_account_id, 
      is_active, 
      consecutive_failures,
      last_error,
      removed_at,
      removal_count,
      permanent_removal,
      removal_history,
      access_token, 
      phone_number_id 
    } = account;

    // ⚡ Verificar cache
    const now = Date.now();
    const cached = this.healthCheckCache.get(whatsapp_account_id);
    
    // Se já está checando esta conta, aguardar
    if (cached && cached.checking) {
      console.log(`⏳ Conta ${whatsapp_account_id} já está sendo verificada, aguardando...`);
      await cached.checking;
      return;
    }
    
    // Se checkou recentemente (< 30s), pular
    if (cached && (now - cached.timestamp) < this.HEALTH_CHECK_CACHE_TTL) {
      console.log(`✅ Conta ${whatsapp_account_id} verificada recentemente (${Math.round((now - cached.timestamp)/1000)}s atrás), pulando`);
      return;
    }

    try {
      // Criar promise de verificação
      const checkingPromise = this.performHealthCheck(account);
      
      // Salvar no cache
      this.healthCheckCache.set(whatsapp_account_id, {
        timestamp: now,
        checking: checkingPromise
      });
      
      // Executar verificação
      await checkingPromise;
      
      // Atualizar cache
      this.healthCheckCache.set(whatsapp_account_id, {
        timestamp: Date.now(),
        checking: null
      });
      
    } catch (error: any) {
      console.error(`❌ Erro ao verificar conta ${whatsapp_account_id}:`, error.message);
      
      // Remover do cache em caso de erro
      this.healthCheckCache.delete(whatsapp_account_id);
    }
  }

  /**
   * Realiza o health check real da conta
   */
  private async performHealthCheck(account: any): Promise<void> {
    const { 
      whatsapp_account_id, 
      access_token, 
      phone_number_id,
      account_id,
      account_name,
      tenant_id
    } = account;

    console.log(`🔍 Consultando API da Meta para conta ${whatsapp_account_id}...`);

    try {
      // Buscar health da API do WhatsApp (com proxy se configurado)
      const health = await whatsappHealthService.getPhoneNumberHealth(
        phone_number_id,
        access_token,
        account_id,
        account_name,
        tenant_id
      );

      const isHealthy = whatsappHealthService.isHealthy(health);

      // ⭐ NOVO: Health Check APENAS INFORMATIVO
      // NÃO desativa contas - apenas loga o status
      if (!isHealthy) {
        const reason = whatsappHealthService.getUnhealthyReason(health);
        console.log(`⚠️ [INFO] Conta ${whatsapp_account_id} com health não ideal: ${reason}`);
        console.log(`   🔄 Mas continuará ativa - apenas erros reais de envio desativam contas`);
        // NÃO desativa a conta
      } else {
        console.log(`✅ Conta ${whatsapp_account_id} com health OK (${health.quality_rating})`);
      }

      // ====== REATIVAÇÃO ======
      const { 
        is_active, 
        consecutive_failures,
        last_error,
        removed_at,
        removal_count,
        permanent_removal,
        removal_history 
      } = account;

      // Se a conta estava inativa e não é remoção permanente
      if (!is_active && !permanent_removal && isHealthy) {
          let canReactivate = false;
          let reactivationReason = '';

          // Verificar tipo de remoção
          const isHealthRemoval = last_error && (
            last_error.includes('Qualidade') || 
            last_error.includes('Conta DISCONNECTED') ||
            last_error.includes('Conta FLAGGED') ||
            last_error.includes('Conta RESTRICTED') ||
            last_error.includes('Conta BANNED')
          );

          const isFailureRemoval = last_error && last_error.includes('5 falhas');

          if (isHealthRemoval) {
            // Remoção por HEALTH: volta imediatamente se health bom
            canReactivate = true;
            reactivationReason = 'Health melhorou (GREEN + CONNECTED)';
          } else if (isFailureRemoval && removed_at) {
            // Remoção por FALHAS: precisa aguardar 10 minutos + health bom
            const now = new Date();
            const removedDate = new Date(removed_at);
            const minutesPassed = (now.getTime() - removedDate.getTime()) / (1000 * 60);

            if (minutesPassed >= 10) {
              canReactivate = true;
              reactivationReason = `10 minutos passados + health bom (${Math.floor(minutesPassed)}min)`;
            } else {
              console.log(`⏱️ Conta ${whatsapp_account_id} aguardando: ${Math.floor(minutesPassed)}/10 minutos`);
            }
          }

          if (canReactivate) {
            console.log(`✅ Reativando conta ${whatsapp_account_id}: ${reactivationReason}`);
            
            // Atualizar histórico com reativação
            const history = removal_history || [];
            if (history.length > 0) {
              history[history.length - 1].reactivated_at = new Date().toISOString();
              history[history.length - 1].reactivation_reason = reactivationReason;
            }

            // Buscar campanha_id dessa conta (pode ser qualquer campanha que a use)
            const campaignResult = await query(
              `SELECT campaign_id FROM campaign_templates WHERE whatsapp_account_id = $1 LIMIT 1`,
              [whatsapp_account_id]
            );
            const campaignIdForUpdate = campaignResult.rows[0]?.campaign_id;

            await query(
              `UPDATE campaign_templates 
               SET is_active = true, consecutive_failures = 0, last_error = NULL, 
                   removed_at = NULL, removal_history = $1
               WHERE campaign_id = $2 AND whatsapp_account_id = $3`,
              [JSON.stringify(history), campaignIdForUpdate, whatsapp_account_id]
            );
          }
        }
      
      console.log(`✅ Health check concluído para conta ${whatsapp_account_id}`);
      
    } catch (error: any) {
      console.error(`❌ Erro ao realizar health check da conta ${whatsapp_account_id}:`, error.message);
      throw error;
    }
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️ Worker já está rodando');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Campaign Worker iniciado!');
    console.log('🔄 Verificando campanhas a cada 5 segundos...');

    // Loop principal do worker
    while (this.isRunning) {
      try {
        await this.processPendingCampaigns();
      } catch (error) {
        console.error('❌ Erro no worker:', error);
      }

      // Aguardar 5 segundos antes da próxima verificação (reduzido para detectar novas campanhas mais rápido)
      await this.sleep(5000);
    }
  }

  stop() {
    this.isRunning = false;
    console.log('🛑 Campaign Worker parado');
  }

  private async processPendingCampaigns() {
    console.log('🔍 [DEBUG] Buscando campanhas pendentes...');
    
    // 🔒 SEGURANÇA: Buscar tenants ativos primeiro para garantir isolamento
    const tenantsResult = await query(
      `SELECT DISTINCT id FROM tenants WHERE status != 'deleted' AND blocked_at IS NULL`
    );
    
    const tenantIds = tenantsResult.rows.map(t => t.id);
    
    if (tenantIds.length === 0) {
      console.log('⚠️ Nenhum tenant ativo encontrado');
      return;
    }
    
    // 🔒 SEGURANÇA: Buscar campanhas APENAS de tenants ativos
    const result = await query(
      `SELECT * FROM campaigns 
       WHERE tenant_id = ANY($1)
       AND status IN ('pending', 'scheduled', 'running')
       AND (scheduled_at IS NULL OR scheduled_at <= NOW())
       ORDER BY tenant_id ASC, created_at ASC`,
      [tenantIds]
    );

    console.log(`🔍 [DEBUG] Encontradas ${result.rows.length} campanhas elegíveis`);

    if (result.rows.length === 0) {
      return;
    }

    const campaigns: Campaign[] = result.rows;
    
    if (campaigns.length > 1) {
      console.log(`🔥 Processando ${campaigns.length} campanhas simultaneamente!`);
    } else if (campaigns.length === 1) {
      console.log(`📋 Processando campanha ID ${campaigns[0].id}: ${campaigns[0].name}`);
    }

    // ⭐ NOVO: Processar todas as campanhas em PARALELO
    console.log(`🚀 [DEBUG] Iniciando processamento PARALELO de ${campaigns.length} campanha(s)...`);
    const startTime = Date.now();
    
    await Promise.all(campaigns.map(campaign => this.processSingleCampaign(campaign)));
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ [DEBUG] Processamento de campanhas concluído em ${elapsed}s`);
  }

  private async processSingleCampaign(campaign: Campaign) {
    console.log(`\n⏩ [INÍCIO] Campanha ${campaign.id} (${campaign.name}) - Status: ${campaign.status}`);
    console.log(`   📅 Criada em: ${campaign.created_at}`);
    console.log(`   ⏰ Agendada para: ${campaign.scheduled_at || 'IMEDIATA'}`);
    console.log(`   ⚙️  schedule_config:`, JSON.stringify(campaign.schedule_config));
    const campaignStartTime = Date.now();
    
    try {
      // ⚠️ Health Check NÃO-BLOQUEANTE: Erros não param a campanha
      console.log(`🔍 [DEBUG] Iniciando health check para campanha ${campaign.id}...`);
      try {
        await this.checkCampaignAccountsHealth(campaign.id);
        console.log(`✅ [DEBUG] Health check concluído para campanha ${campaign.id}`);
      } catch (error: any) {
        console.log(`⚠️ Health check falhou para campanha ${campaign.id}, mas continuando...`);
        console.log(`   Erro: ${error.message}`);
        // CONTINUA sem parar a campanha
      }

      // Verificar se está no horário de trabalho
      console.log(`🔍 [DEBUG] Verificando horário de trabalho para campanha ${campaign.id}...`);
      const inWorkingHours = this.isWorkingHours(campaign.schedule_config);
      console.log(`   ✅ Dentro do horário? ${inWorkingHours ? 'SIM' : 'NÃO'}`);
      
      if (!inWorkingHours) {
        console.log(`⏰ Campanha ${campaign.id} FORA do horário de trabalho - aguardando...`);
        console.log(`   📋 Status da campanha continua: ${campaign.status}`);
        console.log(`   ⏱️ A campanha NÃO será pausada, apenas aguardará o horário`);
        // NÃO pausar a campanha - apenas não enviar mensagens
        return;
      }
      
      console.log(`✅ Campanha ${campaign.id} está dentro do horário de trabalho!`)

      // Iniciar campanha se estiver pending ou scheduled
      console.log(`🔍 [DEBUG] Status da campanha ${campaign.id}: ${campaign.status}`);
      if (campaign.status === 'pending' || campaign.status === 'scheduled') {
        console.log(`🚀 [DEBUG] Iniciando campanha ${campaign.id}: ${campaign.name}`);
        
        // 🔥 CORREÇÃO: Inicializar contador do ciclo em 0 para nova campanha
        this.campaignCycleCounters.set(campaign.id, 0);
        console.log(`🔢 [Campanha ${campaign.id}] Contador do ciclo inicializado em 0`);
        
        await this.updateCampaignStatus(campaign.id, 'running', campaign.tenant_id);
        await query('UPDATE campaigns SET started_at = NOW() WHERE id = $1 AND tenant_id = $2', [campaign.id, campaign.tenant_id]);
        campaign.status = 'running'; // ⭐ CORRIGIDO: Atualizar objeto local também!
        console.log(`✅ [DEBUG] Campanha ${campaign.id} mudou para RUNNING`);
      } else {
        console.log(`ℹ️  [DEBUG] Campanha ${campaign.id} já está em status: ${campaign.status}`);
      }

      // ⏸️ VERIFICAR SE ESTÁ EM PAUSA PROGRAMADA
      console.log(`🔍 [DEBUG] Verificando pausa programada da campanha ${campaign.id}...`);
      const pauseState = await this.getPauseStateAsync(campaign.id);
      
      if (pauseState && pauseState.remainingSeconds > 0) {
        const remainingMinutes = Math.ceil(pauseState.remainingSeconds / 60);
        console.log(`⏸️ ═══════════════════════════════════════════════════`);
        console.log(`⏸️  CAMPANHA ${campaign.id} EM PAUSA PROGRAMADA`);
        console.log(`⏸️  Tempo restante: ${remainingMinutes} minuto(s) (${pauseState.remainingSeconds}s)`);
        console.log(`⏸️  ✅ Esta campanha será retomada automaticamente`);
        console.log(`⏸️  ✅ OUTRAS campanhas continuam rodando normalmente!`);
        console.log(`⏸️ ═══════════════════════════════════════════════════`);
        return; // ✅ Sair sem processar, deixar outras campanhas rodarem
      }
      
      // 🔥 CORREÇÃO: Se a pausa acabou, garantir que o contador do ciclo está zerado
      if (!pauseState || pauseState.remainingSeconds <= 0) {
        const cycleCount = this.campaignCycleCounters.get(campaign.id) || 0;
        if (cycleCount > 0) {
          console.log(`✅ [Campanha ${campaign.id}] Pausa concluída! Resetando contador do ciclo (era ${cycleCount}, agora 0)`);
          this.campaignCycleCounters.set(campaign.id, 0);
        }
      }
      
      console.log(`✅ [DEBUG] Campanha ${campaign.id} não está em pausa programada`);

      // Processar envios
      if (campaign.status === 'running') {
        console.log(`📤 [DEBUG] Processando envios da campanha ${campaign.id}...`);
        this.currentCampaignId = campaign.id;
        await this.processCampaign(campaign);
        this.currentCampaignId = null;
      } else {
        console.log(`⏸️ [DEBUG] Campanha ${campaign.id} não está em RUNNING, pulando envios`);
      }
      
      const campaignElapsed = ((Date.now() - campaignStartTime) / 1000).toFixed(2);
      console.log(`⏸️ [FIM] Campanha ${campaign.id} processada em ${campaignElapsed}s\n`);
      
    } catch (error: any) {
      console.error(`❌ Erro ao processar campanha ${campaign.id}:`, error.message);
      // Não para outras campanhas
    }
  }

  private async processCampaign(campaign: Campaign) {
    // Buscar templates da campanha (APENAS ATIVOS)
    const templatesResult = await query(
      `SELECT 
        ct.*,
        t.template_name,
        w.access_token,
        w.phone_number_id,
        w.id as account_id,
        w.name as account_name
       FROM campaign_templates ct
       JOIN templates t ON ct.template_id = t.id
       JOIN whatsapp_accounts w ON ct.whatsapp_account_id = w.id
       WHERE ct.campaign_id = $1 AND ct.is_active = true
       ORDER BY ct.order_index`,
      [campaign.id]
    );

    const templates: CampaignTemplate[] = templatesResult.rows;

    if (templates.length === 0) {
      console.log(`⚠️ Campanha ${campaign.id} sem templates`);
      await this.updateCampaignStatus(campaign.id, 'completed', campaign.tenant_id);
      return;
    }

    // REORGANIZAR TEMPLATES: Agrupar por conta para rotação inteligente
    // Objetivo: Rotacionar CONTAS primeiro, nunca enviar mensagens consecutivas da mesma conta
    const templatesByAccount: Record<number, CampaignTemplate[]> = {};
    templates.forEach(template => {
      if (!templatesByAccount[template.whatsapp_account_id]) {
        templatesByAccount[template.whatsapp_account_id] = [];
      }
      templatesByAccount[template.whatsapp_account_id].push(template);
    });

    // Garantir ordem consistente dos IDs das contas (ordem numérica)
    const accountIds = Object.keys(templatesByAccount).map(Number).sort((a, b) => a - b);
    const totalAccounts = accountIds.length;
    
    console.log(`🔍 DEBUG: Account IDs em ordem: [${accountIds.join(', ')}]`);

    // LOG: Mostrar todos os templates da campanha AGRUPADOS POR CONTA
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📋 TEMPLATES DA CAMPANHA ${campaign.id}: ${campaign.name}`);
    console.log(`📱 Total de Contas: ${totalAccounts}`);
    console.log('═══════════════════════════════════════════════════════════');
    accountIds.forEach((accountId, accIndex) => {
      const accountTemplates = templatesByAccount[accountId];
      console.log(`\n🔹 Conta ${accIndex + 1} (ID: ${accountId}):`);
      accountTemplates.forEach((t, tIndex) => {
        console.log(`   [${tIndex}] "${t.template_name}" | Phone: ${t.phone_number_id.substring(0, 10)}...`);
      });
    });
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    // LÓGICA SIMPLES: 1 mensagem por entrada na lista
    // Se o número está duplicado, ele recebe múltiplas mensagens automaticamente
    const totalMessages = campaign.total_contacts;
    
    console.log(`🎯 META DA CAMPANHA:`);
    console.log(`   Total de entradas na lista: ${campaign.total_contacts}`);
    console.log(`   Total de contas: ${totalAccounts}`);
    console.log(`   Total de templates: ${templates.length}`);
    console.log(`   Já enviadas: ${campaign.sent_count}/${totalMessages}`);
    console.log(`   Faltam: ${totalMessages - campaign.sent_count}`);

    // Verificar se todas as mensagens foram enviadas
    if (campaign.sent_count >= totalMessages) {
      console.log(`✅ Campanha ${campaign.id} CONCLUÍDA!`);
      console.log(`   ✅ Todas as ${totalMessages} mensagens foram enviadas!`);
      
      // 🔥 CORREÇÃO: Limpar contador do ciclo ao completar campanha
      this.campaignCycleCounters.delete(campaign.id);
      console.log(`🧹 [Campanha ${campaign.id}] Contador do ciclo removido (campanha concluída)`);
      
      await this.updateCampaignStatus(campaign.id, 'completed', campaign.tenant_id);
      await query('UPDATE campaigns SET completed_at = NOW() WHERE id = $1 AND tenant_id = $2', [campaign.id, campaign.tenant_id]);
      return;
    }

    // Buscar os próximos contatos para processar
    // ⚡ AJUSTE: Lote de apenas 1 mensagem por vez para permitir detecção rápida de novas campanhas
    const batchSize = 1;
    const contactsResult = await queryWithTenantId(
      campaign.tenant_id,
      `SELECT c.*, cc.id as cc_id
       FROM contacts c
       JOIN campaign_contacts cc ON c.id = cc.contact_id
       WHERE cc.campaign_id = $1
       ORDER BY cc.id
       LIMIT $2 OFFSET $3`,
      [campaign.id, batchSize, campaign.sent_count]
    );

    const contacts: Contact[] = contactsResult.rows;
    
    if (contacts.length === 0) {
      console.log(`⚠️ Sem mais contatos para processar`);
      return;
    }

    console.log(`📤 Processando ${contacts.length} contatos da campanha ${campaign.id}`);
    console.log(`📊 Total de contas: ${totalAccounts}`);
    console.log(`📊 Total de templates: ${templates.length}`);
    console.log(`📈 Progresso: ${campaign.sent_count}/${totalMessages} (${Math.round(campaign.sent_count/totalMessages*100)}%)`);

    // LÓGICA DE ROTAÇÃO: 
    // 1. Rotaciona CONTAS a cada mensagem (para nunca enviar consecutivo da mesma conta)
    // 2. Quando volta pra mesma conta, usa o próximo template
    
    for (const contact of contacts) {
      // Verificar se foi pausada ou cancelada
      const statusCheck = await query('SELECT status FROM campaigns WHERE id = $1 AND tenant_id = $2', [campaign.id, campaign.tenant_id]);
      if (statusCheck.rows[0]?.status !== 'running') {
        console.log(`⏸️ Campanha ${campaign.id} foi pausada/cancelada`);
        return;
      }

      // Verificar se ainda está no horário de trabalho
      if (!this.isWorkingHours(campaign.schedule_config)) {
        console.log(`⏸️ Campanha ${campaign.id} saiu do horário de trabalho`);
        
        // 🔥 CORREÇÃO: Manter contador do ciclo ao pausar por horário (será retomado depois)
        // NÃO deletar o contador, apenas deixar pausado
        
        await this.updateCampaignStatus(campaign.id, 'paused', campaign.tenant_id);
        return;
      }

      // CALCULAR QUAL TEMPLATE USAR COM ROTAÇÃO INTELIGENTE
      // Rotaciona CONTAS primeiro, depois templates dentro da conta
      const currentSentCount = campaign.sent_count;
      const accountIndex = currentSentCount % totalAccounts; // Qual conta usar
      const selectedAccountId = accountIds[accountIndex];
      const accountTemplates = templatesByAccount[selectedAccountId];
      const templateIndexInAccount = Math.floor(currentSentCount / totalAccounts) % accountTemplates.length;
      const template = accountTemplates[templateIndexInAccount];
      
      console.log(`🔍 DEBUG ROTAÇÃO:`);
      console.log(`   sent_count: ${currentSentCount}`);
      console.log(`   totalAccounts: ${totalAccounts}`);
      console.log(`   accountIndex calculado: ${currentSentCount} % ${totalAccounts} = ${accountIndex}`);
      console.log(`   selectedAccountId: ${selectedAccountId}`);

      try {
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📨 ENVIANDO MENSAGEM #${currentSentCount + 1}`);
        console.log(`📞 Contato: ${contact.phone_number}`);
        console.log(`🔄 ROTAÇÃO:`);
        console.log(`   └─ Conta: ${accountIndex + 1} de ${totalAccounts} (ID: ${selectedAccountId})`);
        console.log(`   └─ Template: ${templateIndexInAccount + 1} de ${accountTemplates.length} desta conta`);
        console.log(`📄 Template: "${template.template_name}"`);
        console.log(`📱 Conta WhatsApp ID: ${template.whatsapp_account_id}`);
        console.log(`🎯 Phone Number ID: ${template.phone_number_id}`);
        if (template.media_url) {
          console.log(`🖼️ Mídia: ${template.media_type} - ${template.media_url}`);
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // 🚨 VERIFICAR LISTA DE RESTRIÇÃO ANTES DE ENVIAR
        console.log('🔍 [CAMPANHA] Verificando lista de restrição...');
        console.log(`   ⚠️  REGRA: Se número está na lista, bloqueia em TODAS as contas!`);
        console.log(`   📞 Número: ${contact.phone_number}`);
        console.log(`   📱 Conta da campanha: ${template.whatsapp_account_id}`);
        
        const isRestricted = await this.checkRestrictionList(contact.phone_number, template.whatsapp_account_id, campaign.tenant_id);
        
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
            `INSERT INTO messages 
             (campaign_id, campaign_template_id, contact_id, whatsapp_account_id, phone_number, template_name, status, error_message, tenant_id)
             VALUES ($1, $2, $3, $4, $5, $6, 'failed', $7, $8)`,
            [
              campaign.id,
              template.id,
              contact.id,
              template.whatsapp_account_id,
              contact.phone_number,
              template.template_name,
              `Bloqueado - Lista de Restrição: ${isRestricted.listNames}`,
              campaign.tenant_id
            ]
          );
          
          // Atualizar contador de failed
          await query(
            'UPDATE campaigns SET sent_count = sent_count + 1, failed_count = failed_count + 1, updated_at = NOW() WHERE id = $1 AND tenant_id = $2',
            [campaign.id, campaign.tenant_id]
          );
          
          campaign.sent_count++;
          console.log(`📊 Progresso: ${campaign.sent_count}/${totalMessages} (${Math.round(campaign.sent_count/totalMessages*100)}%)`);
          
          // Aguardar intervalo antes do próximo
          await this.sleep(campaign.schedule_config.interval_seconds * 1000);
          continue; // Pular para o próximo contato
        }
        
        console.log('✅ ═══════════════════════════════════════════════════');
        console.log('✅ NÚMERO LIVRE - NÃO ESTÁ NA LISTA DE RESTRIÇÃO');
        console.log('✅ ═══════════════════════════════════════════════════');
        console.log(`   📞 Número: ${contact.phone_number}`);
        console.log(`   ✅ PROSSEGUINDO COM ENVIO...`);
        console.log('═══════════════════════════════════════════════════\n');
        
        // 📱 VERIFICAR SE O NÚMERO TEM WHATSAPP ANTES DE ENVIAR (API OFICIAL)
        console.log('📱 ═══════════════════════════════════════════════════');
        console.log('📱 VERIFICANDO SE NÚMERO TEM WHATSAPP (API OFICIAL)...');
        console.log('📱 ═══════════════════════════════════════════════════');
        console.log(`   📞 Número: ${contact.phone_number}`);
        
        const hasWhatsAppCheck = await this.checkIfNumberHasWhatsAppOfficial(
          template.access_token,
          template.phone_number_id,
          contact.phone_number,
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
            `INSERT INTO messages 
             (campaign_id, campaign_template_id, contact_id, whatsapp_account_id, phone_number, template_name, status, error_message, tenant_id)
             VALUES ($1, $2, $3, $4, $5, $6, 'no_whatsapp', 'SEM WHATSAPP', $7)`,
            [
              campaign.id,
              template.id,
              contact.id,
              template.whatsapp_account_id,
              contact.phone_number,
              template.template_name,
              campaign.tenant_id
            ]
          );
          
          // Atualizar contador
          await query(
            'UPDATE campaigns SET sent_count = sent_count + 1, failed_count = failed_count + 1, updated_at = NOW() WHERE id = $1 AND tenant_id = $2',
            [campaign.id, campaign.tenant_id]
          );
          
          campaign.sent_count++;
          console.log(`📊 [API Oficial] Número marcado como "sem WhatsApp" (não foi enviado)`);
          console.log(`📊 Progresso: ${campaign.sent_count}/${totalMessages} (${Math.round(campaign.sent_count/totalMessages*100)}%)`);
          
          // Aguardar intervalo antes do próximo
          await this.sleep(campaign.schedule_config.interval_seconds * 1000);
          continue; // Pular para o próximo contato
        } else {
          console.log('✅ ═══════════════════════════════════════════════════');
          console.log('✅ NÚMERO TEM WHATSAPP - PROSSEGUINDO COM ENVIO');
          console.log('✅ ═══════════════════════════════════════════════════');
          console.log(`   📞 Número: ${contact.phone_number}`);
          if (hasWhatsAppCheck.verifiedName) {
            console.log(`   ✅ Nome verificado: ${hasWhatsAppCheck.verifiedName}`);
          }
          console.log('═══════════════════════════════════════════════════\n');
        }
        
        // Enviar mensagem
        await this.sendMessage(campaign, template, contact);

        // Atualizar contador
        await query(
          'UPDATE campaigns SET sent_count = sent_count + 1, updated_at = NOW() WHERE id = $1 AND tenant_id = $2',
          [campaign.id, campaign.tenant_id]
        );

        // Resetar contador de falhas consecutivas em caso de sucesso
        await query(
          'UPDATE campaign_templates SET consecutive_failures = 0, last_error = NULL WHERE id = $1',
          [template.id]
        );

        console.log(`✅ Mensagem enviada com sucesso!`);
        
        // Atualizar o contador local da campanha para próxima iteração
        campaign.sent_count++;
        
        // 🔥 CORREÇÃO: Incrementar contador do ciclo atual ISOLADO por campanha
        const currentCycleCount = (this.campaignCycleCounters.get(campaign.id) || 0) + 1;
        this.campaignCycleCounters.set(campaign.id, currentCycleCount);
        
        // A rotação é automática baseada no sent_count
        const nextAccountIndex = campaign.sent_count % totalAccounts;
        const nextAccountId = accountIds[nextAccountIndex];
        console.log(`🔄 Próximo envio usará: Conta ${nextAccountIndex + 1} (ID: ${nextAccountId})`);
        console.log(`📊 Progresso: ${campaign.sent_count}/${totalMessages} (${Math.round(campaign.sent_count/totalMessages*100)}%)`);
        console.log(`🔢 Contador do ciclo atual (Campanha ${campaign.id}): ${currentCycleCount} mensagens`);

        // ⭐ RECARREGAR configurações da campanha antes de cada iteração
        // Isso garante que edições feitas durante a execução sejam respeitadas
        const updatedCampaignResult = await query(
          'SELECT pause_config, schedule_config FROM campaigns WHERE id = $1 AND tenant_id = $2',
          [campaign.id, campaign.tenant_id]
        );
        
        if (updatedCampaignResult.rows.length > 0) {
          campaign.pause_config = updatedCampaignResult.rows[0].pause_config || {};
          campaign.schedule_config = updatedCampaignResult.rows[0].schedule_config || {};
          console.log(`🔄 Config atualizada: intervalo=${campaign.schedule_config.interval_seconds}s, pause_after=${campaign.pause_config.pause_after}, pause_duration=${campaign.pause_config.pause_duration_minutes}min`);
        }

        // Aguardar intervalo configurado (agora com valor atualizado)
        console.log(`⏳ [Campanha ${campaign.id}] Aguardando ${campaign.schedule_config.interval_seconds}s antes da próxima mensagem...`);
        await this.sleep(campaign.schedule_config.interval_seconds * 1000);

        // 🔥 CORREÇÃO: Verificar pause_config usando contador ISOLADO do ciclo atual
        // Agora cada campanha tem seu próprio contador independente!
        if (campaign.pause_config.pause_after > 0 && currentCycleCount >= campaign.pause_config.pause_after) {
          console.log('');
          console.log('⏸️ ═══════════════════════════════════════════');
          console.log(`⏸️  PAUSA AUTOMÁTICA - NÃO-BLOQUEANTE`);
          console.log(`⏸️  Campanha ID: ${campaign.id}`);
          console.log(`⏸️  Mensagens no ciclo atual: ${currentCycleCount}`);
          console.log(`⏸️  Total enviadas: ${campaign.sent_count}/${totalMessages}`);
          console.log(`⏸️  Duração da pausa: ${campaign.pause_config.pause_duration_minutes} minutos`);
          console.log(`⏸️  ✅ Esta campanha será retomada automaticamente em ${campaign.pause_config.pause_duration_minutes} min`);
          console.log(`⏸️  ✅ OUTRAS campanhas continuarão rodando normalmente!`);
          console.log('⏸️ ═══════════════════════════════════════════');
          console.log('');
          
          // 🔥 RESETAR contador do ciclo para zero (novo ciclo após a pausa)
          this.campaignCycleCounters.set(campaign.id, 0);
          
          // ⭐ Registrar início da pausa NO BANCO DE DADOS (persistente)
          await query(
            'UPDATE campaigns SET pause_started_at = NOW() WHERE id = $1 AND tenant_id = $2',
            [campaign.id, campaign.tenant_id]
          );
          
          // Também manter no Map para compatibilidade
          this.pauseState.set(campaign.id, {
            startedAt: new Date(),
            durationMinutes: campaign.pause_config.pause_duration_minutes,
          });
          
          // ⭐ MUDANÇA CRÍTICA: NÃO fazer await sleep aqui!
          // Em vez disso, SAIR do loop e deixar o worker verificar novamente em 5s
          // Quando a pausa terminar, o worker retomará automaticamente
          console.log(`⏸️  SAINDO do loop - worker verificará novamente em 5s`);
          console.log(`⏸️  Pausa termina em: ${new Date(Date.now() + campaign.pause_config.pause_duration_minutes * 60 * 1000).toLocaleString('pt-BR')}`);
          return; // ✅ SAIR do método sem bloquear outras campanhas
        }

      } catch (error: any) {
        console.error(`❌ Erro ao enviar para ${contact.phone_number}:`, error.message);

        // Registrar erro no banco
        await query(
          `INSERT INTO messages 
           (campaign_id, contact_id, whatsapp_account_id, phone_number, template_name, status, error_message, sent_at, tenant_id)
           VALUES ($1, $2, $3, $4, $5, 'failed', $6, NOW(), $7)`,
          [campaign.id, contact.id, template.whatsapp_account_id, contact.phone_number, template.template_name, error.message, campaign.tenant_id]
        );

        await query(
          'UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = $1 AND tenant_id = $2',
          [campaign.id, campaign.tenant_id]
        );

        // Incrementar contador de falhas consecutivas
        const updateFailureResult = await query(
          `UPDATE campaign_templates 
           SET consecutive_failures = consecutive_failures + 1, last_error = $1
           WHERE id = $2
           RETURNING consecutive_failures, whatsapp_account_id`,
          [error.message, template.id]
        );

        const consecutiveFailures = updateFailureResult.rows[0]?.consecutive_failures || 0;
        const accountId = updateFailureResult.rows[0]?.whatsapp_account_id;

        console.log(`⚠️ Falhas consecutivas da conta ${accountId}: ${consecutiveFailures}`);

        // Verificar se deve remover automaticamente
        const campaignResult = await query(
          'SELECT auto_remove_account_failures FROM campaigns WHERE id = $1 AND tenant_id = $2',
          [campaign.id, campaign.tenant_id]
        );
        
        const autoRemoveLimit = campaignResult.rows[0]?.auto_remove_account_failures || 5;

        if (autoRemoveLimit > 0 && consecutiveFailures >= autoRemoveLimit) {
          // Buscar removal_count atual
          const countResult = await query(
            `SELECT removal_count, removal_history, permanent_removal 
             FROM campaign_templates 
             WHERE campaign_id = $1 AND whatsapp_account_id = $2 
             LIMIT 1`,
            [campaign.id, accountId]
          );

          const currentRemovalCount = countResult.rows[0]?.removal_count || 0;
          const currentHistory = countResult.rows[0]?.removal_history || [];
          const isPermanent = countResult.rows[0]?.permanent_removal || false;

          // Se já é permanente, não faz nada (não deveria estar ativa)
          if (isPermanent) {
            console.log(`⚠️ Conta ${accountId} já está com remoção permanente`);
            return;
          }

          const newRemovalCount = currentRemovalCount + 1;
          const isPermanentNow = newRemovalCount >= 2;

          console.log('');
          console.log('🚨 ═══════════════════════════════════════════════════');
          console.log(`🚨 REMOÇÃO AUTOMÁTICA DE CONTA`);
          console.log(`🚨 Conta ${accountId} atingiu ${consecutiveFailures} falhas consecutivas`);
          console.log(`🚨 Limite configurado: ${autoRemoveLimit} falhas`);
          console.log(`🚨 Remoção #${newRemovalCount}`);
          if (isPermanentNow) {
            console.log(`🚨 ⚠️ REMOÇÃO PERMANENTE - Só reativa manualmente!`);
          } else {
            console.log(`🚨 Aguardará 10 minutos + health bom para reativar`);
          }
          console.log('🚨 ═══════════════════════════════════════════════════');
          console.log('');

          // Adicionar ao histórico
          const history = [...currentHistory];
          history.push({
            timestamp: new Date().toISOString(),
            reason: `${consecutiveFailures} falhas consecutivas${isPermanentNow ? ' - PERMANENTE' : ''}`,
            type: 'consecutive_failures',
            removal_number: newRemovalCount,
            is_permanent: isPermanentNow,
          });

          // Desativar todas as entradas desta conta na campanha
          await query(
            `UPDATE campaign_templates 
             SET is_active = false, removed_at = NOW(), 
                 removal_count = $1, permanent_removal = $2, 
                 removal_history = $3, 
                 last_error = $4
             WHERE campaign_id = $5 AND whatsapp_account_id = $6`,
            [
              newRemovalCount,
              isPermanentNow,
              JSON.stringify(history),
              `${consecutiveFailures} falhas consecutivas${isPermanentNow ? ' - PERMANENTE' : ''}`,
              campaign.id,
              accountId
            ]
          );

          // Verificar quantas contas ativas restam
          const activeCountResult = await query(
            `SELECT COUNT(DISTINCT whatsapp_account_id) as active_count
             FROM campaign_templates
             WHERE campaign_id = $1 AND is_active = true`,
            [campaign.id]
          );

          const activeCount = parseInt(activeCountResult.rows[0]?.active_count || '0');

          console.log(`✅ Conta ${accountId} REMOVIDA automaticamente da campanha`);
          console.log(`📊 Contas ativas restantes: ${activeCount}`);
          console.log(`🔄 Redistribuição automática ativada para próximo envio`);
          console.log('');

          if (activeCount === 0) {
            console.log('🚨 AVISO CRÍTICO: Nenhuma conta ativa restante!');
            console.log('⏸️ Pausando campanha...');
            await this.updateCampaignStatus(campaign.id, 'paused', campaign.tenant_id);
            return; // Parar processamento
          }
        }
        
        // Incrementar sent_count mesmo com erro para manter rotação correta
        campaign.sent_count++;
      }
    }
  }

  private async sendMessage(campaign: Campaign, template: CampaignTemplate, contact: Contact) {
    // Preparar variáveis do template como array de valores
    const variableValues: string[] = [];
    
    // Converter variáveis do contato para array ordenado
    if (contact.variables) {
      // Supondo que as variáveis sejam um objeto com keys numéricas: {0: "valor1", 1: "valor2"}
      const keys = Object.keys(contact.variables).sort();
      keys.forEach(key => {
        let value = String(contact.variables[key]);
        
        // 🔄 PROCESSAR SPIN TEXT nas variáveis
        if (hasSpinText(value)) {
          value = processSpinText(value);
          console.log('🔄 Spin Text processado na variável:', value);
        }
        
        variableValues.push(value);
      });
    }

    // Se a mídia for local (upload), fazer upload para WhatsApp API primeiro
    let finalMediaUrl = template.media_url;
    let finalMediaType = template.media_type;
    
    if (template.media_url && template.media_url.includes('localhost')) {
      console.log('📤 Mídia local detectada, fazendo upload para WhatsApp API...');
      
      try {
        const fs = await import('fs');
        const path = await import('path');
        
        // Extrair o caminho do arquivo da URL
        const urlPath = template.media_url.split('/uploads/')[1];
        const filePath = path.join(__dirname, '../../uploads', urlPath);
        
        console.log('📁 Lendo arquivo:', filePath);
        
        if (fs.existsSync(filePath)) {
          const fileBuffer = fs.readFileSync(filePath);
          
          // Detectar MIME type
          let mimeType = 'image/jpeg';
          if (filePath.endsWith('.png')) mimeType = 'image/png';
          else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) mimeType = 'image/jpeg';
          else if (filePath.endsWith('.gif')) mimeType = 'image/gif';
          else if (filePath.endsWith('.mp4')) mimeType = 'video/mp4';
          else if (filePath.endsWith('.pdf')) mimeType = 'application/pdf';
          else if (filePath.endsWith('.mp3')) mimeType = 'audio/mpeg';
          else if (filePath.endsWith('.3gp')) mimeType = 'video/3gpp';
          
          console.log('📤 Fazendo upload para WhatsApp (tamanho:', fileBuffer.length, 'bytes, tipo:', mimeType, ')');
          
          const uploadResult = await whatsappService.uploadMedia(
            template.access_token,
            template.phone_number_id,
            fileBuffer,
            mimeType,
            template.account_id,
            template.account_name,
            campaign.tenant_id
          );
          
          if (uploadResult.success) {
            console.log('✅ Upload concluído! Media ID:', uploadResult.mediaId);
            
            // Determinar o tipo correto baseado no MIME type
            let mediaTypeFromMime = 'image';
            if (mimeType.startsWith('video/')) mediaTypeFromMime = 'video';
            else if (mimeType.startsWith('audio/')) mediaTypeFromMime = 'audio';
            else if (mimeType.startsWith('application/')) mediaTypeFromMime = 'document';
            else if (mimeType.startsWith('image/')) mediaTypeFromMime = 'image';
            
            console.log('📋 Tipo detectado:', mediaTypeFromMime);
            
            // Usar o media_id e indicar que é ID, não URL
            finalMediaUrl = uploadResult.mediaId;
            finalMediaType = mediaTypeFromMime + '_id'; // Ex: 'video_id', 'image_id'
          } else {
            console.error('❌ Erro no upload:', uploadResult.error);
            throw new Error('Falha ao fazer upload da mídia: ' + uploadResult.error);
          }
        } else {
          console.error('❌ Arquivo não encontrado:', filePath);
          throw new Error('Arquivo de mídia não encontrado no servidor');
        }
      } catch (uploadError: any) {
        console.error('❌ Erro ao processar upload:', uploadError);
        throw new Error('Erro ao processar mídia: ' + uploadError.message);
      }
    }

    // Enviar mensagem via WhatsApp API
    console.log('📋 Preparando envio:');
    console.log('   Template:', template.template_name);
    console.log('   Número original:', contact.phone_number);
    console.log('   Variáveis:', variableValues);
    console.log('   Mídia:', finalMediaUrl ? 'Sim (' + finalMediaType + ')' : 'Não');

    const result = await whatsappService.sendTemplateMessage({
      accessToken: template.access_token,
      phoneNumberId: template.phone_number_id,
      to: whatsappService.formatPhoneNumber(contact.phone_number),  // ← FORMATAR NÚMERO!
      templateName: template.template_name,
      variableValues, // Agora é um array
      mediaUrl: finalMediaUrl || undefined,
      mediaType: finalMediaType || undefined,
      accountId: (template as any).account_id,
      accountName: (template as any).account_name,
      tenantId: campaign.tenant_id,
    });

    // ⚠️ VERIFICAR SE O ENVIO FOI BEM-SUCEDIDO
    if (!result.success) {
      console.error('❌ Falha ao enviar mensagem via WhatsApp API:', result.error);
      throw new Error(result.error || 'Erro desconhecido ao enviar mensagem');
    }

    // Registrar mensagem enviada com informações de proxy
    await queryWithTenantId(
      campaign.tenant_id,
      `INSERT INTO messages 
       (campaign_id, campaign_template_id, contact_id, whatsapp_account_id, whatsapp_message_id, 
        phone_number, template_name, status, sent_at, media_url, proxy_used, proxy_host, proxy_type, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'sent', NOW(), $8, $9, $10, $11, $12)`,
      [
        campaign.id,
        template.id,
        contact.id,
        template.whatsapp_account_id,
        result.messageId, // Usar messageId ao invés de messages[0].id
        contact.phone_number,
        template.template_name,
        template.media_url,
        result.proxyUsed || false,
        result.proxyHost || null,
        result.proxyType || null,
        campaign.tenant_id // ✅ ADICIONAR TENANT_ID DA CAMPANHA
      ]
    );
  }

  private isWorkingHours(config: WorkerConfig): boolean {
    // ✅ Se não há config ou não há horário definido, considerar sempre no horário (24/7)
    if (!config || !config.work_start_time || !config.work_end_time) {
      console.log('🔍 [DEBUG] Sem config de horário, rodando 24/7');
      return true;
    }

    const brazilNow = getBrazilNow();
    const currentTime = brazilNow.getHours() * 60 + brazilNow.getMinutes();

    const [startHour, startMin] = config.work_start_time.split(':').map(Number);
    const [endHour, endMin] = config.work_end_time.split(':').map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    const inWorkingHours = currentTime >= startTime && currentTime <= endTime;
    
    console.log(
      `🔍 [DEBUG] Horário (Brasília): ${brazilNow.getHours()}:${brazilNow.getMinutes()} - Trabalho: ${config.work_start_time} às ${config.work_end_time} - Dentro: ${inWorkingHours}`
    );
    
    return inWorkingHours;
  }

  private async updateCampaignStatus(campaignId: number, status: string, tenantId?: number) {
    if (tenantId) {
      await query(
        'UPDATE campaigns SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3',
        [status, campaignId, tenantId]
      );
    } else {
      // Fallback sem tenant_id (não recomendado, mas mantém compatibilidade)
      await query(
        'UPDATE campaigns SET status = $1, updated_at = NOW() WHERE id = $2',
        [status, campaignId]
      );
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 📱 VERIFICAR SE NÚMERO TEM WHATSAPP ANTES DE ENVIAR (API OFICIAL)
   * Retorna objeto com success, hasWhatsApp e verifiedName
   */
  private async checkIfNumberHasWhatsAppOfficial(
    accessToken: string,
    phoneNumberId: string,
    phoneNumber: string,
    tenantId: number
  ): Promise<{ success: boolean; hasWhatsApp: boolean; verifiedName?: string; error?: string }> {
    try {
      console.log(`   🔎 [API Oficial] Verificando se ${phoneNumber} tem WhatsApp...`);
      
      // Limpar número (remover caracteres especiais, manter apenas dígitos e +)
      const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
      
      // Chamar API do WhatsApp Business para verificar número
      const result = await whatsappService.checkPhoneNumber(
        phoneNumberId,
        cleanPhone,
        accessToken,
        tenantId
      );
      
      if (!result.success) {
        console.log(`   ⚠️ [API Oficial] Erro ao verificar: ${result.error}`);
        return {
          success: false,
          hasWhatsApp: false,
          error: result.error
        };
      }
      
      const hasWhatsApp = result.exists || false;
      const verifiedName = result.wa_id || null;
      
      console.log(`   ${hasWhatsApp ? '✅' : '❌'} [API Oficial] ${phoneNumber}: ${hasWhatsApp ? 'TEM WhatsApp' : 'NÃO tem WhatsApp'}`);
      if (verifiedName) {
        console.log(`   📱 [API Oficial] WA ID: ${verifiedName}`);
      }
      
      return {
        success: true,
        hasWhatsApp: hasWhatsApp,
        verifiedName: verifiedName
      };
    } catch (error: any) {
      console.error('❌ ═══════════════════════════════════════════════════');
      console.error('❌ ERRO AO VERIFICAR SE NÚMERO TEM WHATSAPP (API OFICIAL)!');
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
  private async checkRestrictionList(phoneNumber: string, whatsappAccountId: number, tenantId: number): Promise<false | { listNames: string, types: string[] }> {
    try {
      console.log(`   🔎 Chamando RestrictionListController.checkBulk...`);
      console.log(`      Número: ${phoneNumber}`);
      console.log(`      Conta: ${whatsappAccountId}`);
      console.log(`      Tenant: ${tenantId}`);
      
      const restrictionController = new RestrictionListController();
      
      // Criar request fake para o controller
      const fakeReq: any = {
        body: {
          phone_numbers: [phoneNumber],
          whatsapp_account_ids: [whatsappAccountId],
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
      
      console.log(`   📊 Resultado da verificação:`, restrictionResult);
      
      if (restrictionResult && restrictionResult.restricted_count > 0) {
        const detail = restrictionResult.restricted_details[0];
        console.log(`   🚫 NÚMERO RESTRITO!`);
        console.log(`      Listas: ${detail.list_names.join(', ')}`);
        console.log(`      Tipos: ${detail.types.join(', ')}`);
        
        return {
          listNames: detail.list_names.join(', '),
          types: detail.types
        };
      }
      
      console.log(`   ✅ Número livre`);
      return false; // Número livre
    } catch (error: any) {
      console.error('❌ ═══════════════════════════════════════════════════');
      console.error('❌ ERRO AO VERIFICAR LISTA DE RESTRIÇÃO (CAMPANHA)!');
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

export const campaignWorker = new CampaignWorker();

