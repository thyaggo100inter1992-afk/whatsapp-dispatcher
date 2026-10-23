import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { query } from '../database/connection';
import axios from 'axios';
import { getProxyConfigFromAccount, applyProxyToRequest, formatProxyInfo } from '../helpers/proxy.helper';
import { whatsappService } from './whatsapp.service';

interface QueueItem {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  accountId: number;
  accountPhone: string;
  accountName: string;
  profileData: {
    about?: string;
    description?: string;
    email?: string;
    address?: string;
    vertical?: string;
    websites?: string[];
    username?: string;
    username_append_last4?: boolean;
    logoPath?: string;
    logoMimeType?: string;
    logoFileName?: string;
  };
  fieldsToUpdate: string[]; // Quais campos atualizar
  error?: string;
  createdAt: Date;
  processedAt?: Date;
}

export class ProfileQueueService extends EventEmitter {
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private intervalSeconds = 5; // Intervalo padrão de 5 segundos

  constructor() {
    super();
  }

  // Adicionar atualização de perfil à fila
  addUpdateProfile(params: {
    accountId: number;
    accountPhone: string;
    accountName: string;
    profileData: any;
    fieldsToUpdate: string[];
  }) {
    const item: QueueItem = {
      id: `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      accountId: params.accountId,
      accountPhone: params.accountPhone,
      accountName: params.accountName,
      profileData: params.profileData,
      fieldsToUpdate: params.fieldsToUpdate,
      createdAt: new Date(),
    };

    this.queue.push(item);
    this.emit('queueUpdated', this.getQueueStatus());
    
    console.log(`📋 Perfil adicionado à fila: ${item.id}`);
    console.log(`   Conta: ${params.accountPhone} (${params.accountName})`);
    console.log(`   Campos a atualizar: ${params.fieldsToUpdate.join(', ')}`);
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
      console.log('✅ Fila de perfis vazia');
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue[0];
      
      console.log(`\n🔄 Processando item da fila: ${item.id}`);
      console.log(`   Conta: ${item.accountPhone} (${item.accountName})`);
      console.log(`   Campos: ${item.fieldsToUpdate.join(', ')}`);
      console.log(`   Faltam: ${this.queue.length - 1} na fila`);

      // Atualizar status para processing
      item.status = 'processing';
      this.emit('queueUpdated', this.getQueueStatus());

      // Salvar no histórico (processing)
      await this.saveToHistory(item);

      try {
        await this.processUpdate(item);
        item.status = 'completed';
        item.processedAt = new Date();
        console.log(`✅ Perfil atualizado com sucesso: ${item.accountPhone}`);
      } catch (error: any) {
        item.status = 'failed';
        item.error = error.message;
        item.processedAt = new Date();
        console.error(`❌ Erro ao atualizar perfil ${item.accountPhone}:`, error.message);
      }

      this.emit('queueUpdated', this.getQueueStatus());

      // Atualizar no histórico (completed ou failed)
      await this.saveToHistory(item);

      // Remover item da fila
      this.queue.shift();

      // Aguardar intervalo antes do próximo item
      if (this.queue.length > 0) {
        console.log(`⏳ Aguardando ${this.intervalSeconds} segundos antes do próximo perfil...`);
        await this.sleep(this.intervalSeconds * 1000);
      }
    }

    this.isProcessing = false;
    console.log('\n✅ Fila de perfis processada completamente');
  }

  private metaErrorMessage(error: any): string {
    const data = error?.response?.data;
    const details = data?.error?.error_data?.details;
    return (
      details ||
      data?.error?.error_user_msg ||
      data?.error?.message ||
      (typeof data === 'string' ? data : null) ||
      error?.message ||
      'Erro desconhecido na Meta'
    );
  }

  /** Regras oficiais de business username da Meta. */
  static validateBusinessUsername(raw: string): { ok: true; username: string } | { ok: false; error: string } {
    const username = String(raw || '').trim().replace(/^@+/, '');
    if (username.length < 3 || username.length > 35) {
      return { ok: false, error: 'Nome de usuário deve ter entre 3 e 35 caracteres' };
    }
    if (!/^[a-zA-Z0-9._]+$/.test(username)) {
      return { ok: false, error: 'Use apenas letras (a-z), números, ponto (.) e underscore (_)' };
    }
    if (!/[a-zA-Z]/.test(username)) {
      return { ok: false, error: 'Nome de usuário precisa ter pelo menos uma letra' };
    }
    if (username.startsWith('.') || username.endsWith('.') || username.includes('..')) {
      return { ok: false, error: 'Não pode começar/terminar com ponto nem ter dois pontos seguidos' };
    }
    if (/^www\./i.test(username)) {
      return { ok: false, error: 'Não pode começar com www.' };
    }
    if (/\.(com|org|net|int|edu|gov|mil|arpa|html|htm|txt|xml)$/i.test(username)) {
      return { ok: false, error: 'Não pode terminar com domínio (.com, .org, etc.)' };
    }
    return { ok: true, username };
  }

  private resolveUsernameForAccount(base: string, phoneNumber: string, appendLast4?: boolean): string {
    let username = String(base || '').trim().replace(/^@+/, '');
    const digits = String(phoneNumber || '').replace(/\D/g, '');
    const last4 = digits.slice(-4) || '0000';

    if (username.includes('{last4}')) {
      username = username.replace(/\{last4\}/g, last4);
    } else if (appendLast4) {
      const suffix = `_${last4}`;
      if (!username.toLowerCase().endsWith(suffix.toLowerCase())) {
        const maxBase = Math.max(1, 35 - suffix.length);
        username = `${username.slice(0, maxBase)}${suffix}`;
      }
    }
    return username;
  }

  private async postBusinessUsername(account: any, accountId: number, username: string) {
    let requestConfig: any = {
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        'Content-Type': 'application/json',
      },
    };

    const proxyConfig = account.tenant_id
      ? await getProxyConfigFromAccount(accountId, account.tenant_id)
      : null;
    if (proxyConfig) {
      console.log(`🌐 Proxy username: ${formatProxyInfo(proxyConfig)} - ${account.name}`);
      requestConfig = applyProxyToRequest(requestConfig, proxyConfig, account.name);
    }

    console.log(`👤 Definindo username @${username} — ${account.name}`);
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v21.0/${account.phone_number_id}/username`,
        { username, transfer_action: 'none' },
        requestConfig
      );
      console.log('✅ Username API:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Meta username:', error.response?.data || error.message);
      throw new Error(this.metaErrorMessage(error));
    }
  }

  /** Meta aceita só JPEG na foto de perfil; normaliza PNG/etc para JPG quadrado. */
  private async prepareProfileJpeg(logoPath: string): Promise<{ buffer: Buffer; fileName: string }> {
    const sharp = require('sharp');
    const meta = await sharp(logoPath).metadata();
    const side = Math.min(meta.width || 640, meta.height || 640, 640);
    const size = Math.max(side, 192);

    const buffer: Buffer = await sharp(logoPath)
      .rotate()
      .resize(size, size, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();

    return { buffer, fileName: 'profile.jpg' };
  }

  private async postBusinessProfile(account: any, accountId: number, dataToSend: any) {
    let requestConfig: any = {
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        'Content-Type': 'application/json',
      },
    };

    const proxyConfig = account.tenant_id
      ? await getProxyConfigFromAccount(accountId, account.tenant_id)
      : null;
    if (proxyConfig) {
      console.log(`🌐 Aplicando proxy: ${formatProxyInfo(proxyConfig)} - Conta: ${account.name}`);
      requestConfig = applyProxyToRequest(requestConfig, proxyConfig, account.name);
    }

    console.log(
      '📤 Enviando para API:',
      JSON.stringify(
        {
          ...dataToSend,
          profile_picture_handle: dataToSend.profile_picture_handle ? '[handle]' : undefined,
        },
        null,
        2
      )
    );

    try {
      const response = await axios.post(
        `https://graph.facebook.com/v21.0/${account.phone_number_id}/whatsapp_business_profile`,
        dataToSend,
        requestConfig
      );
      console.log('✅ Resposta da API:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Meta business_profile:', error.response?.data || error.message);
      throw new Error(this.metaErrorMessage(error));
    }
  }

  // Processar atualização
  private async processUpdate(item: QueueItem) {
    const accountResult = await query(
      'SELECT * FROM whatsapp_accounts WHERE id = $1',
      [item.accountId]
    );

    if (accountResult.rows.length === 0) {
      throw new Error('Conta não encontrada');
    }

    const account = accountResult.rows[0];

    // Campos de texto do business profile (sem logo / username)
    const textPayload: any = {
      messaging_product: 'whatsapp',
    };

    item.fieldsToUpdate.forEach((field: any) => {
      if (field === 'profile_picture' || field === 'username') return;
      if (item.profileData[field] !== undefined && item.profileData[field] !== null && item.profileData[field] !== '') {
        textPayload[field] = item.profileData[field];
      }
    });

    const hasText = Object.keys(textPayload).some((k) => k !== 'messaging_product');
    if (hasText) {
      await this.postBusinessProfile(account, item.accountId, textPayload);
    }

    // Nome de usuário (@) — endpoint separado da Meta
    if (item.fieldsToUpdate.includes('username')) {
      const base = String(item.profileData.username || '').trim();
      if (!base) {
        throw new Error('Nome de usuário não informado');
      }
      const resolved = this.resolveUsernameForAccount(
        base,
        account.phone_number || item.accountPhone,
        !!item.profileData.username_append_last4
      );
      const validated = ProfileQueueService.validateBusinessUsername(resolved);
      if (!validated.ok) {
        throw new Error(validated.error);
      }
      await this.postBusinessUsername(account, item.accountId, validated.username);
    }

    // Logo / foto de perfil: JPEG via Resumable Upload → profile_picture_handle
    if (item.fieldsToUpdate.includes('profile_picture')) {
      const logoPath = item.profileData.logoPath;
      if (!logoPath || !fs.existsSync(logoPath)) {
        throw new Error('Arquivo da logo não encontrado no servidor');
      }
      const appId = String(account.app_id || '').trim();
      if (!appId) {
        throw new Error('App ID é obrigatório nesta conta para enviar a logo (Resumable Upload)');
      }

      console.log(`🖼️ Preparando JPEG da logo — ${account.name}`);
      const prepared = await this.prepareProfileJpeg(logoPath);

      console.log(`🖼️ Upload Resumable — ${account.name} (${prepared.buffer.length} bytes JPEG)`);
      const upload = await whatsappService.uploadMediaWithAppId(
        appId,
        account.access_token,
        prepared.buffer,
        'image/jpeg',
        prepared.fileName,
        item.accountId,
        account.name,
        account.tenant_id
      );

      if (!upload.success || !upload.mediaHandle) {
        throw new Error(upload.error || 'Falha no upload da logo (Resumable API)');
      }

      await this.postBusinessProfile(account, item.accountId, {
        messaging_product: 'whatsapp',
        profile_picture_handle: upload.mediaHandle,
      });

      await query(
        `UPDATE whatsapp_accounts SET updated_at = NOW() WHERE id = $1`,
        [item.accountId]
      ).catch(() => undefined);
    }

    if (
      !hasText &&
      !item.fieldsToUpdate.includes('profile_picture') &&
      !item.fieldsToUpdate.includes('username')
    ) {
      throw new Error('Nenhum dado de perfil para enviar');
    }
  }

  // Salvar item no histórico
  private async saveToHistory(item: QueueItem) {
    try {
      await query(
        `INSERT INTO profile_queue_history 
         (queue_id, status, whatsapp_account_id, profile_data, fields_updated, error_message, processed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (queue_id) DO UPDATE SET
           status = EXCLUDED.status,
           error_message = EXCLUDED.error_message,
           processed_at = EXCLUDED.processed_at`,
        [
          item.id,
          item.status,
          item.accountId,
          JSON.stringify(item.profileData),
          item.fieldsToUpdate,
          item.error || null,
          item.processedAt || null,
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
           h.status,
           h.whatsapp_account_id,
           h.profile_data,
           h.fields_updated,
           h.error_message,
           h.created_at,
           h.processed_at,
           wa.phone_number as account_phone,
           wa.name as account_name
         FROM profile_queue_history h
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
  async retryFailedItem(historyId: number) {
    try {
      // Buscar item do histórico
      const result = await query(
        `SELECT 
           h.*,
           wa.phone_number as account_phone,
           wa.name as account_name
         FROM profile_queue_history h
         JOIN whatsapp_accounts wa ON h.whatsapp_account_id = wa.id
         WHERE h.id = $1`,
        [historyId]
      );

      if (result.rows.length === 0) {
        throw new Error('Item não encontrado no histórico');
      }

      const historyItem = result.rows[0];

      // Adicionar à fila novamente
      return this.addUpdateProfile({
        accountId: historyItem.whatsapp_account_id,
        accountPhone: historyItem.account_phone,
        accountName: historyItem.account_name,
        profileData: historyItem.profile_data,
        fieldsToUpdate: historyItem.fields_updated,
      });
    } catch (error: any) {
      throw new Error(`Erro ao re-tentar: ${error.message}`);
    }
  }

  // Configurar intervalo
  setInterval(seconds: number) {
    if (seconds < 1) {
      throw new Error('Intervalo deve ser no mínimo 1 segundo');
    }
    this.intervalSeconds = seconds;
    console.log(`⏱️ Intervalo entre perfis configurado para: ${seconds} segundos`);
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
        status: item.status,
        accountPhone: item.accountPhone,
        accountName: item.accountName,
        fieldsToUpdate: item.fieldsToUpdate,
        error: item.error,
        createdAt: item.createdAt,
      })),
    };
  }

  // Sleep helper
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const profileQueueService = new ProfileQueueService();

