import { EventEmitter } from 'events';
import { whatsappService } from './whatsapp.service';
import { query } from '../database/connection';

interface QueueItem {
  id: string;
  type: 'create' | 'delete' | 'edit' | 'clone';
  status: 'pending' | 'processing' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELETED' | 'CLONED' | 'failed';
  accountId: number;
  accountPhone: string;
  templateName: string;
  templateData?: any;
  originalTemplateName?: string; // Para edições e clonagens
  targetAccountIds?: number[]; // Para clonagens
  error?: string;
  createdAt: Date;
  processedAt?: Date;
  tenantId?: number;
}

class TemplateQueueService extends EventEmitter {
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private intervalSeconds = 5; // Intervalo padrão de 5 segundos

  constructor() {
    super();
  }

  // Adicionar criação de template à fila
  addCreateTemplate(params: {
    accountId: number;
    accountPhone: string;
    templateName: string;
    templateData: any;
    tenantId?: number;
  }) {
    const item: QueueItem = {
      id: `create_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'create',
      status: 'pending',
      accountId: params.accountId,
      accountPhone: params.accountPhone,
      templateName: params.templateName,
      templateData: params.templateData,
      createdAt: new Date(),
      tenantId: params.tenantId || 1,
    };

    this.queue.push(item);
    this.emit('queueUpdated', this.getQueueStatus());
    
    console.log(`📋 Template adicionado à fila: ${item.id}`);
    console.log(`   Tipo: CREATE`);
    console.log(`   Template: ${params.templateName}`);
    console.log(`   Conta: ${params.accountPhone}`);
    console.log(`   Posição na fila: ${this.queue.length}`);

    // Iniciar processamento se não estiver processando
    if (!this.isProcessing) {
      this.processQueue();
    }

    return item.id;
  }

  // Adicionar deleção de template à fila
  addDeleteTemplate(params: {
    accountId: number;
    accountPhone: string;
    templateName: string;
    tenantId?: number;
  }) {
    const item: QueueItem = {
      id: `delete_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'delete',
      status: 'pending',
      accountId: params.accountId,
      accountPhone: params.accountPhone,
      templateName: params.templateName,
      createdAt: new Date(),
      tenantId: params.tenantId || 1,
    };

    this.queue.push(item);
    this.emit('queueUpdated', this.getQueueStatus());
    
    console.log(`📋 Template adicionado à fila: ${item.id}`);
    console.log(`   Tipo: DELETE`);
    console.log(`   Template: ${params.templateName}`);
    console.log(`   Conta: ${params.accountPhone}`);
    console.log(`   Posição na fila: ${this.queue.length}`);

    // Iniciar processamento se não estiver processando
    if (!this.isProcessing) {
      this.processQueue();
    }

    return item.id;
  }

  // Processar fila
  private async processQueue() {
    if (this.isProcessing) {
      return;
    }

    if (this.queue.length === 0) {
      console.log('✅ Fila de templates vazia');
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue[0];
      
      console.log(`\n🔄 Processando item da fila: ${item.id}`);
      console.log(`   Tipo: ${item.type}`);
      console.log(`   Template: ${item.templateName}`);
      console.log(`   Conta: ${item.accountPhone}`);
      console.log(`   Faltam: ${this.queue.length - 1} na fila`);

      // Atualizar status para processing
      item.status = 'processing';
      this.emit('queueUpdated', this.getQueueStatus());

      // Salvar no histórico (processing)
      await this.saveToHistory(item);

      try {
        let whatsappStatus = 'PENDING'; // Status padrão retornado pelo WhatsApp
        
        if (item.type === 'create') {
          whatsappStatus = await this.processCreate(item);
        } else if (item.type === 'delete') {
          whatsappStatus = await this.processDelete(item);
        } else if (item.type === 'edit') {
          whatsappStatus = await this.processEdit(item);
        } else if (item.type === 'clone') {
          whatsappStatus = await this.processClone(item);
        }

        // ✅ Usar o status REAL do WhatsApp (PENDING, APPROVED, REJECTED)
        item.status = whatsappStatus as any;
        item.processedAt = new Date();
        console.log(`✅ Item processado com sucesso: ${item.id} - Status WhatsApp: ${whatsappStatus}`);
      } catch (error: any) {
        item.status = 'failed';
        item.error = error.message;
        item.processedAt = new Date();
        console.error(`❌ Erro ao processar item ${item.id}:`, error.message);
      }

      this.emit('queueUpdated', this.getQueueStatus());

      // Atualizar no histórico (completed ou failed)
      await this.saveToHistory(item);

      // Remover item da fila
      this.queue.shift();

      // Aguardar intervalo antes do próximo item
      if (this.queue.length > 0) {
        console.log(`⏳ Aguardando ${this.intervalSeconds} segundos antes do próximo item...`);
        await this.sleep(this.intervalSeconds * 1000);
      }
    }

    this.isProcessing = false;
    console.log('\n✅ Fila de templates processada completamente');
  }

  // Salvar item no histórico
  private async saveToHistory(item: QueueItem) {
    try {
      await query(
        `INSERT INTO template_queue_history 
         (queue_id, type, status, whatsapp_account_id, template_name, template_data, error_message, processed_at, tenant_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (queue_id) DO UPDATE SET
           status = EXCLUDED.status,
           error_message = EXCLUDED.error_message,
           processed_at = EXCLUDED.processed_at`,
        [
          item.id,
          item.type,
          item.status,
          item.accountId,
          item.templateName,
          item.templateData ? JSON.stringify(item.templateData) : null,
          item.error || null,
          item.processedAt || null,
          item.tenantId || 1,
        ]
      );
    } catch (error: any) {
      console.error('⚠️ Erro ao salvar histórico:', error.message);
    }
  }

  // Obter falhas recentes
  async getRecentFailures(limit = 50) {
    try {
      const result = await query(
        `SELECT 
           h.id,
           h.queue_id,
           h.type,
           h.status,
           h.whatsapp_account_id,
           h.template_name,
           h.template_data,
           h.error_message,
           h.created_at,
           h.processed_at,
           wa.phone_number as account_phone,
           wa.name as account_name
         FROM template_queue_history h
         JOIN whatsapp_accounts wa ON h.whatsapp_account_id = wa.id
         WHERE h.status = 'failed'
         ORDER BY h.created_at DESC
         LIMIT $1`,
        [limit]
      );

      return result.rows;
    } catch (error: any) {
      console.error('❌ Erro ao buscar falhas:', error.message);
      return [];
    }
  }

  // Re-tentar item que falhou
  async retryFailedItem(historyId: number, newTemplateName?: string, newTemplateData?: any) {
    try {
      // Buscar item do histórico
      const result = await query(
        `SELECT 
           h.*,
           wa.phone_number as account_phone
         FROM template_queue_history h
         JOIN whatsapp_accounts wa ON h.whatsapp_account_id = wa.id
         WHERE h.id = $1`,
        [historyId]
      );

      if (result.rows.length === 0) {
        throw new Error('Item não encontrado no histórico');
      }

      const historyItem = result.rows[0];

      // Usar novo nome/dados se fornecido, senão usar o original
      const templateName = newTemplateName || historyItem.template_name;
      const templateData = newTemplateData || historyItem.template_data;

      // Adicionar à fila novamente
      if (historyItem.type === 'create') {
        return this.addCreateTemplate({
          accountId: historyItem.whatsapp_account_id,
          accountPhone: historyItem.account_phone,
          templateName: templateName,
          templateData: templateData,
        });
      } else if (historyItem.type === 'delete') {
        return this.addDeleteTemplate({
          accountId: historyItem.whatsapp_account_id,
          accountPhone: historyItem.account_phone,
          templateName: templateName,
        });
      }

      throw new Error('Tipo de operação desconhecido');
    } catch (error: any) {
      console.error('❌ Erro ao re-tentar item:', error.message);
      throw error;
    }
  }

  // Re-tentar todas as falhas
  async retryAllFailures() {
    try {
      const failures = await this.getRecentFailures(100);
      const queueIds: string[] = [];

      for (const failure of failures) {
        const queueId = await this.retryFailedItem(failure.id);
        queueIds.push(queueId);
      }

      return {
        success: true,
        total: queueIds.length,
        queueIds,
      };
    } catch (error: any) {
      console.error('❌ Erro ao re-tentar todas as falhas:', error.message);
      throw error;
    }
  }

  // Processar criação
  private async processCreate(item: QueueItem): Promise<string> {
    // Buscar dados da conta
    const accountResult = await query(
      'SELECT id, name, access_token, business_account_id FROM whatsapp_accounts WHERE id = $1',
      [item.accountId]
    );

    if (accountResult.rows.length === 0) {
      throw new Error('Conta não encontrada');
    }

    const account = accountResult.rows[0];

    // Criar template via API (com proxy se configurado)
    const result = await whatsappService.createTemplate({
      accessToken: account.access_token,
      businessAccountId: account.business_account_id,
      templateData: item.templateData,
      accountId: account.id,
      accountName: account.name,
      tenantId: item.tenantId,
    });

    if (!result.success) {
      throw new Error(result.error || 'Erro ao criar template');
    }

    const whatsappStatus = result.data.status || 'PENDING';

    // 🔒 Salvar no banco de dados local COM TENANT_ID
    await query(
      `INSERT INTO templates 
       (whatsapp_account_id, template_name, status, category, language, components, has_media, media_type, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (whatsapp_account_id, template_name) 
       DO UPDATE SET 
         status = EXCLUDED.status,
         category = EXCLUDED.category,
         updated_at = NOW()`,
      [
        item.accountId,
        item.templateData.name,
        whatsappStatus,
        result.data.category || item.templateData.category,
        item.templateData.language,
        JSON.stringify(item.templateData.components),
        false,
        null,
        item.tenantId,
      ]
    );

    // Retornar o status real do WhatsApp
    return whatsappStatus;
  }

  // Processar deleção
  private async processDelete(item: QueueItem): Promise<string> {
    // 🔒 Buscar dados da conta FILTRADO POR TENANT
    if (!item.tenantId) {
      throw new Error('tenantId é obrigatório');
    }
    
    const accountResult = await query(
      'SELECT id, name, access_token, business_account_id FROM whatsapp_accounts WHERE id = $1 AND tenant_id = $2',
      [item.accountId, item.tenantId]
    );

    if (accountResult.rows.length === 0) {
      throw new Error('Conta não encontrada ou não pertence ao tenant');
    }

    const account = accountResult.rows[0];

    // Deletar via API (com proxy se configurado)
    const result = await whatsappService.deleteTemplate({
      accessToken: account.access_token,
      businessAccountId: account.business_account_id,
      templateName: item.templateName,
      accountId: account.id,
      accountName: account.name,
      tenantId: item.tenantId,
    });

    if (!result.success) {
      throw new Error(result.error || 'Erro ao deletar template');
    }

    // Deletar do banco de dados local
    await query(
      'DELETE FROM templates WHERE whatsapp_account_id = $1 AND template_name = $2',
      [item.accountId, item.templateName]
    );

    // Retornar status de deletado
    return 'DELETED';
  }

  // Processar edição
  private async processEdit(item: QueueItem): Promise<string> {
    console.log(`\n✏️ ===== EDITANDO TEMPLATE =====`);
    console.log(`   Template: ${item.originalTemplateName} → ${item.templateName}`);
    console.log(`   Conta: ${item.accountPhone}`);

    // Buscar dados da conta
    const accountResult = await query(
      'SELECT id, name, access_token, business_account_id FROM whatsapp_accounts WHERE id = $1',
      [item.accountId]
    );

    if (accountResult.rows.length === 0) {
      throw new Error('Conta não encontrada');
    }

    const account = accountResult.rows[0];

    // NOTA: O WhatsApp não permite editar templates diretamente
    // A solução é: DELETAR o antigo e CRIAR o novo
    console.log('   📝 Estratégia: Deletar template antigo e criar novo');

    // 1. Deletar template antigo (se o nome mudou)
    if (item.originalTemplateName && item.originalTemplateName !== item.templateName) {
      console.log(`   🗑️  Deletando template antigo: ${item.originalTemplateName}`);
      try {
        await whatsappService.deleteTemplate({
          accessToken: account.access_token,
          businessAccountId: account.business_account_id,
          templateName: item.originalTemplateName,
          accountId: account.id,
          accountName: account.name,
        });
      } catch (error: any) {
        console.log(`   ⚠️  Aviso: Não foi possível deletar template antigo: ${error.message}`);
        // Continua mesmo se não conseguir deletar
      }
    }

    // 2. Criar novo template
    console.log(`   ➕ Criando template novo: ${item.templateName}`);
    const result = await whatsappService.createTemplate({
      accessToken: account.access_token,
      businessAccountId: account.business_account_id,
      templateData: item.templateData,
      accountId: account.id,
      accountName: account.name,
    });

    if (!result.success) {
      throw new Error(result.error || 'Erro ao editar template');
    }

    // 🔒 3. Atualizar no banco de dados local COM TENANT_ID
    const whatsappStatus = result.data.status || 'PENDING';
    
    await query(
      `INSERT INTO templates 
       (whatsapp_account_id, template_name, status, category, language, components, has_media, media_type, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (whatsapp_account_id, template_name) 
       DO UPDATE SET 
         status = EXCLUDED.status,
         category = EXCLUDED.category,
         updated_at = NOW()`,
      [
        item.accountId,
        item.templateData.name,
        whatsappStatus,
        result.data.category || item.templateData.category,
        item.templateData.language,
        JSON.stringify(item.templateData.components),
        false,
        null,
        item.tenantId,
      ]
    );

    console.log('   ✅ Template editado com sucesso!');
    
    // Retornar o status real do WhatsApp
    return whatsappStatus;
  }

  // Processar clonagem
  private async processClone(item: QueueItem): Promise<string> {
    console.log(`\n📋 ===== CLONANDO TEMPLATE =====`);
    console.log(`   Template: ${item.templateName}`);
    console.log(`   Conta origem: ${item.accountPhone}`);
    console.log(`   Contas destino: ${item.targetAccountIds?.length || 0}`);

    if (!item.targetAccountIds || item.targetAccountIds.length === 0) {
      throw new Error('Nenhuma conta de destino especificada para clonagem');
    }

    // 🔒 Buscar template original FILTRADO POR TENANT
    if (!item.tenantId) {
      throw new Error('tenantId é obrigatório');
    }
    
    const templateResult = await query(
      `SELECT t.* FROM templates t
       INNER JOIN whatsapp_accounts wa ON t.whatsapp_account_id = wa.id
       WHERE t.whatsapp_account_id = $1 AND t.template_name = $2 AND wa.tenant_id = $3`,
      [item.accountId, item.templateName, item.tenantId]
    );

    if (templateResult.rows.length === 0) {
      throw new Error('Template original não encontrado');
    }

    const originalTemplate = templateResult.rows[0];

    // Clonar para cada conta de destino
    for (const targetAccountId of item.targetAccountIds) {
      console.log(`   📤 Clonando para conta ${targetAccountId}...`);

      // 🔒 Buscar dados da conta de destino FILTRADO POR TENANT
      const accountResult = await query(
        'SELECT id, name, access_token, business_account_id FROM whatsapp_accounts WHERE id = $1 AND tenant_id = $2',
        [targetAccountId, item.tenantId]
      );

      if (accountResult.rows.length === 0) {
        console.log(`   ⚠️  Conta ${targetAccountId} não encontrada, pulando...`);
        continue;
      }

      const account = accountResult.rows[0];

      // Criar template na conta de destino
      const result = await whatsappService.createTemplate({
        accessToken: account.access_token,
        businessAccountId: account.business_account_id,
        templateData: {
          name: originalTemplate.template_name,
          category: originalTemplate.category,
          language: originalTemplate.language,
          components: JSON.parse(originalTemplate.components),
        },
        accountId: account.id,
        accountName: account.name,
      });

      if (!result.success) {
        console.log(`   ❌ Erro ao clonar para conta ${targetAccountId}: ${result.error}`);
        continue; // Continua para próxima conta
      }

      // 🔒 Salvar no banco de dados local COM TENANT_ID
      await query(
        `INSERT INTO templates 
         (whatsapp_account_id, template_name, status, category, language, components, has_media, media_type, tenant_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (whatsapp_account_id, template_name) 
         DO UPDATE SET 
           status = EXCLUDED.status,
           updated_at = NOW()`,
        [
          targetAccountId,
          originalTemplate.template_name,
          result.data.status || 'PENDING',
          originalTemplate.category,
          originalTemplate.language,
          originalTemplate.components,
          false,
          null,
          item.tenantId,
          originalTemplate.has_media,
          originalTemplate.media_type,
        ]
      );

      console.log(`   ✅ Template clonado para conta ${targetAccountId}!`);
    }

    console.log('   ✅ Clonagem concluída!');
    
    // Retornar status de clonado
    return 'CLONED';
  }

  // Configurar intervalo
  setInterval(seconds: number) {
    if (seconds < 1) {
      throw new Error('Intervalo deve ser no mínimo 1 segundo');
    }
    this.intervalSeconds = seconds;
    console.log(`⏱️ Intervalo entre templates configurado para: ${seconds} segundos`);
  }

  // Obter intervalo atual
  getInterval() {
    return this.intervalSeconds;
  }

  // Obter status da fila
  getQueueStatus() {
    return {
      total: this.queue.length,
      processing: this.queue.filter(item => item.status === 'processing').length,
      pending: this.queue.filter(item => item.status === 'pending').length,
      isProcessing: this.isProcessing,
      interval: this.intervalSeconds,
      items: this.queue.map(item => ({
        id: item.id,
        type: item.type,
        status: item.status,
        templateName: item.templateName,
        accountPhone: item.accountPhone,
        error: item.error,
        createdAt: item.createdAt,
      })),
    };
  }

  // Cancelar todos os itens pendentes da fila
  cancelQueue(): { cancelled: number; remaining: number } {
    const pendingItems = this.queue.filter(item => item.status === 'pending');
    const cancelledCount = pendingItems.length;
    
    // Remover todos os itens pendentes da fila
    this.queue = this.queue.filter(item => item.status !== 'pending');
    
    console.log(`🛑 Fila cancelada!`);
    console.log(`   ❌ ${cancelledCount} item(ns) pendente(s) removido(s)`);
    console.log(`   ⏳ ${this.queue.length} item(ns) ainda em processamento`);
    
    this.emit('queueUpdated', this.getQueueStatus());
    
    return {
      cancelled: cancelledCount,
      remaining: this.queue.length,
    };
  }

  // Sleep helper
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const templateQueueService = new TemplateQueueService();

