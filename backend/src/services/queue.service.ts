import Queue from 'bull';
import Redis from 'ioredis';
import { whatsappService } from './whatsapp.service';
import { MessageModel } from '../models/Message';
import { ContactModel } from '../models/Contact';
import { CampaignModel } from '../models/Campaign';
import { WhatsAppAccountModel } from '../models/WhatsAppAccount';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

// Criar cliente Redis para Bull
const createRedisClient = () => {
  return new Redis(redisConfig);
};

// Fila de mensagens
export const messageQueue = new Queue('message-queue', {
  createClient: (type) => {
    switch (type) {
      case 'client':
        return createRedisClient();
      case 'subscriber':
        return createRedisClient();
      case 'bclient':
        return createRedisClient();
      default:
        return createRedisClient();
    }
  },
});

// Fila de campanhas
export const campaignQueue = new Queue('campaign-queue', {
  createClient: (type) => {
    switch (type) {
      case 'client':
        return createRedisClient();
      case 'subscriber':
        return createRedisClient();
      case 'bclient':
        return createRedisClient();
      default:
        return createRedisClient();
    }
  },
});

interface MessageJobData {
  messageId: number;
  campaignId?: number;
  contactId: number;
  whatsappAccountId: number;
  templateName: string;
  phoneNumber: string;
  variables?: Record<string, any>;
  mediaUrl?: string;
  mediaType?: string;
  delay?: number;
}

interface CampaignJobData {
  campaignId: number;
  templates: Array<{
    id: number;
    whatsapp_account_id: number;
    template_id: number;
    template_name: string;
    media_url?: string;
    media_type?: string;
  }>;
  contacts: Array<{
    id: number;
    phone_number: string;
    name?: string;
    variables?: Record<string, any>;
  }>;
  pauseConfig?: {
    pauseAfterMessages: number;
    pauseDuration: number;
  };
  scheduleConfig?: {
    delayMin: number;
    delayMax: number;
    startHour?: number;
    endHour?: number;
  };
}

// Processar mensagem individual
messageQueue.process(async (job) => {
  const data: MessageJobData = job.data;

  try {
    console.log(`📤 Processing message ${data.messageId} to ${data.phoneNumber}`);

    // Buscar conta WhatsApp
    const account = await WhatsAppAccountModel.findById(data.whatsappAccountId);
    if (!account) {
      throw new Error('WhatsApp account not found');
    }

    // Formatar número de telefone
    const formattedPhone = whatsappService.formatPhoneNumber(data.phoneNumber);

    // Construir componentes do template com variáveis
    const components = whatsappService.buildTemplateComponents(data.variables || {});

    // Enviar mensagem
    const result = await whatsappService.sendTemplateMessage({
      accessToken: account.access_token,
      phoneNumberId: account.phone_number_id,
      to: formattedPhone,
      templateName: data.templateName,
      components: components,
      mediaUrl: data.mediaUrl,
      mediaType: data.mediaType,
      accountId: account.id,
      accountName: account.name,
    });

    if (result.success) {
      await MessageModel.updateStatus(data.messageId, 'sent', result.messageId);
      console.log(`✅ Message ${data.messageId} sent successfully`);
      
      // Atualizar contadores da campanha se houver
      if (data.campaignId) {
        const campaign = await CampaignModel.findById(data.campaignId);
        if (campaign && campaign.tenant_id) {
          await CampaignModel.updateStats(data.campaignId, {
            sent_count: (campaign.sent_count || 0) + 1,
          }, campaign.tenant_id);
        }
      }

      return { success: true, messageId: result.messageId };
    } else {
      await MessageModel.updateStatus(data.messageId, 'failed', undefined, result.error);
      console.error(`❌ Message ${data.messageId} failed:`, result.error);
      
      // Atualizar contadores de falha
      if (data.campaignId) {
        const campaign = await CampaignModel.findById(data.campaignId);
        if (campaign && campaign.tenant_id) {
          await CampaignModel.updateStats(data.campaignId, {
            failed_count: (campaign.failed_count || 0) + 1,
          }, campaign.tenant_id);
        }
      }

      throw new Error(result.error);
    }
  } catch (error: any) {
    console.error(`Error processing message ${data.messageId}:`, error);
    await MessageModel.updateStatus(data.messageId, 'failed', undefined, error.message);
    throw error;
  }
});

// Processar campanha
campaignQueue.process(async (job) => {
  const data: CampaignJobData = job.data;

  try {
    console.log(`📊 Processing campaign ${data.campaignId}`);

    await CampaignModel.update(data.campaignId, {
      status: 'running',
      started_at: new Date(),
    });

    const { templates, contacts, pauseConfig, scheduleConfig } = data;
    const delayMin = scheduleConfig?.delayMin || 2;
    const delayMax = scheduleConfig?.delayMax || 5;

    let messageCount = 0;
    let templateIndex = 0;

    for (const contact of contacts) {
      // Rotacionar templates
      const template = templates[templateIndex % templates.length];
      templateIndex++;

      // Criar registro de mensagem
      const message = await MessageModel.create({
        campaign_id: data.campaignId,
        campaign_template_id: template.id,
        contact_id: contact.id,
        whatsapp_account_id: template.whatsapp_account_id,
        phone_number: contact.phone_number,
        template_name: template.template_name,
        status: 'pending',
        media_url: template.media_url,
      });

      // Calcular delay aleatório
      const randomDelay = Math.floor(Math.random() * (delayMax - delayMin + 1) + delayMin) * 1000;

      // Adicionar mensagem na fila
      await messageQueue.add(
        {
          messageId: message.id,
          campaignId: data.campaignId,
          contactId: contact.id,
          whatsappAccountId: template.whatsapp_account_id,
          templateName: template.template_name,
          phoneNumber: contact.phone_number,
          variables: contact.variables,
          mediaUrl: template.media_url,
          mediaType: template.media_type,
        },
        {
          delay: randomDelay * messageCount,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        }
      );

      messageCount++;

      // Aplicar pausa automática se configurado
      if (pauseConfig && messageCount % pauseConfig.pauseAfterMessages === 0) {
        console.log(`⏸️  Pausing campaign ${data.campaignId} after ${messageCount} messages`);
        await new Promise((resolve) => setTimeout(resolve, pauseConfig.pauseDuration * 1000));
      }

      // Atualizar progresso
      await job.progress((messageCount / contacts.length) * 100);
    }

    console.log(`✅ Campaign ${data.campaignId} queued ${messageCount} messages`);
    return { success: true, messagesQueued: messageCount };
  } catch (error: any) {
    console.error(`Error processing campaign ${data.campaignId}:`, error);
    await CampaignModel.update(data.campaignId, {
      status: 'failed',
    });
    throw error;
  }
});

// Event listeners
messageQueue.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

messageQueue.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err);
});

campaignQueue.on('completed', async (job) => {
  console.log(`✅ Campaign job ${job.id} completed`);
  const data: CampaignJobData = job.data;
  await CampaignModel.update(data.campaignId, {
    status: 'completed',
    completed_at: new Date(),
  });
});

campaignQueue.on('failed', (job, err) => {
  console.error(`❌ Campaign job ${job?.id} failed:`, err);
});

export const queueService = {
  async addMessage(data: MessageJobData, options?: any) {
    return await messageQueue.add(data, options);
  },

  async addCampaign(data: CampaignJobData, options?: any) {
    return await campaignQueue.add(data, options);
  },

  async getMessageQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      messageQueue.getWaitingCount(),
      messageQueue.getActiveCount(),
      messageQueue.getCompletedCount(),
      messageQueue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  },

  async getCampaignQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      campaignQueue.getWaitingCount(),
      campaignQueue.getActiveCount(),
      campaignQueue.getCompletedCount(),
      campaignQueue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  },
};


