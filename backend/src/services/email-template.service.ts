/**
 * Serviço para gerenciar templates de email
 * Carrega templates do banco e substitui variáveis
 */

import { pool } from '../database/connection';
import emailServiceInstance from './email.service';
import emailAccountService from './email-account.service';

interface TemplateData {
  [key: string]: string | number;
}

class EmailTemplateService {
  /**
   * Busca um template ativo por tipo de evento
   */
  async getActiveTemplate(eventType: string) {
    try {
      const result = await pool.query(
        'SELECT * FROM email_templates WHERE event_type = $1 AND is_active = true',
        [eventType]
      );

      if (result.rows.length === 0) {
        console.log(`⚠️ Template '${eventType}' não encontrado ou inativo`);
        return null;
      }

      return result.rows[0];
    } catch (error: any) {
      console.error('❌ Erro ao buscar template:', error);
      return null;
    }
  }

  /**
   * Substitui variáveis no template
   * Exemplo: {{nome}} -> João Silva
   */
  replaceVariables(content: string, data: TemplateData): string {
    let result = content;

    Object.entries(data).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value));
    });

    return result;
  }

  /**
   * Envia email usando um template
   */
  async sendTemplatedEmail(
    eventType: string,
    to: string,
    data: TemplateData
  ): Promise<boolean> {
    try {
      // Buscar template
      const template = await this.getActiveTemplate(eventType);
      if (!template) {
        console.log(`⚠️ Template '${eventType}' não disponível`);
        return false;
      }

      // Substituir variáveis no assunto e conteúdo
      const subject = this.replaceVariables(template.subject, data);
      const htmlContent = this.replaceVariables(template.html_content, data);

      // Enviar email usando a conta configurada no template (ou padrão)
      console.log(`📧 Enviando email '${eventType}' para ${to} usando conta ${template.email_account_id || 'padrão'}`);
      const sent = await emailAccountService.sendEmail(
        to,
        subject,
        htmlContent,
        template.email_account_id
      );

      if (sent) {
        console.log(`✅ Email '${eventType}' enviado com sucesso para ${to}`);
      } else {
        console.log(`❌ Falha ao enviar email '${eventType}' para ${to}`);
      }

      return sent;
    } catch (error: any) {
      console.error('❌ Erro ao enviar email templado:', error);
      return false;
    }
  }

  /**
   * Envia email de boas-vindas
   */
  async sendWelcomeEmail(tenant: any): Promise<boolean> {
    const data = {
      nome: tenant.nome,
      email: tenant.email || 'não informado',
      plano: tenant.plano || 'Padrão',
      dias_teste: '20',
      data_fim_teste: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
      url_sistema: process.env.FRONTEND_URL || 'https://sistemasnettsistemas.com.br'
    };

    return this.sendTemplatedEmail('welcome', tenant.email, data);
  }

  /**
   * Envia email de início de trial
   */
  async sendTrialStartEmail(tenant: any): Promise<boolean> {
    const data = {
      nome: tenant.nome,
      email: tenant.email || 'não informado',
      dias_teste: '20',
      data_inicio: new Date().toLocaleDateString('pt-BR'),
      data_fim_teste: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
      url_sistema: process.env.FRONTEND_URL || 'https://sistemasnettsistemas.com.br'
    };

    return this.sendTemplatedEmail('trial_start', tenant.email, data);
  }

  /**
   * Envia email de vencimento próximo (3, 2 ou 1 dias)
   */
  async sendExpiryWarningEmail(tenant: any, daysUntilDue: number): Promise<boolean> {
    const eventTypes: Record<number, string> = {
      3: 'expiry_3days',
      2: 'expiry_2days',
      1: 'expiry_1day'
    };

    const eventType = eventTypes[daysUntilDue];
    if (!eventType) {
      console.log(`⚠️ Dias inválidos para warning: ${daysUntilDue}`);
      return false;
    }

    const data = {
      nome: tenant.nome,
      email: tenant.email || 'não informado',
      plano: tenant.plano || 'Padrão',
      data_vencimento: new Date(tenant.proximo_vencimento).toLocaleDateString('pt-BR'),
      valor: tenant.valor_mensalidade ? tenant.valor_mensalidade.toFixed(2).replace('.', ',') : '0,00',
      url_renovacao: `${process.env.FRONTEND_URL || 'https://sistemasnettsistemas.com.br'}/renovar`
    };

    return this.sendTemplatedEmail(eventType, tenant.email, data);
  }

  /**
   * Envia email de bloqueio
   */
  async sendBlockedEmail(tenant: any, deletionDate: Date): Promise<boolean> {
    const data = {
      nome: tenant.nome,
      email: tenant.email || 'não informado',
      plano: tenant.plano || 'Padrão',
      data_vencimento: new Date(tenant.proximo_vencimento).toLocaleDateString('pt-BR'),
      dias_carencia: '20',
      data_exclusao: deletionDate.toLocaleDateString('pt-BR'),
      url_renovacao: `${process.env.FRONTEND_URL || 'https://sistemasnettsistemas.com.br'}/renovar`
    };

    return this.sendTemplatedEmail('blocked', tenant.email, data);
  }

  /**
   * Envia email de aviso de exclusão
   */
  async sendDeletionWarningEmail(tenant: any, daysRemaining: number): Promise<boolean> {
    const deletionDate = new Date(tenant.will_be_deleted_at || Date.now() + daysRemaining * 24 * 60 * 60 * 1000);

    const data = {
      nome: tenant.nome,
      email: tenant.email || 'não informado',
      dias_restantes: String(daysRemaining),
      data_exclusao: deletionDate.toLocaleDateString('pt-BR'),
      url_renovacao: `${process.env.FRONTEND_URL || 'https://sistemasnettsistemas.com.br'}/renovar`
    };

    return this.sendTemplatedEmail('deletion_warning', tenant.email, data);
  }
}

export default new EmailTemplateService();

