/**
 * Serviço para gerenciar contas de email e envio
 */

import { pool } from '../database/connection';
import nodemailer from 'nodemailer';

interface EmailAccount {
  id: number;
  name: string;
  provider: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_pass: string;
  email_from: string;
  is_default: boolean;
  is_active: boolean;
}

class EmailAccountService {
  /**
   * Busca uma conta de email por ID
   */
  async getAccountById(accountId: number): Promise<EmailAccount | null> {
    try {
      const result = await pool.query(
        'SELECT * FROM email_accounts WHERE id = $1 AND is_active = true',
        [accountId]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Erro ao buscar conta de email:', error);
      return null;
    }
  }

  /**
   * Busca a conta de email padrão
   */
  async getDefaultAccount(): Promise<EmailAccount | null> {
    try {
      const result = await pool.query(
        'SELECT * FROM email_accounts WHERE is_default = true AND is_active = true LIMIT 1'
      );
      
      // Se não houver padrão, pega a primeira ativa
      if (result.rows.length === 0) {
        const fallback = await pool.query(
          'SELECT * FROM email_accounts WHERE is_active = true ORDER BY id ASC LIMIT 1'
        );
        return fallback.rows[0] || null;
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('❌ Erro ao buscar conta padrão:', error);
      return null;
    }
  }

  /**
   * Cria um transporter para uma conta específica
   */
  createTransporter(account: EmailAccount) {
    return nodemailer.createTransporter({
      host: account.smtp_host,
      port: account.smtp_port,
      secure: account.smtp_secure,
      auth: {
        user: account.smtp_user,
        pass: account.smtp_pass
      }
    });
  }

  /**
   * Envia um email usando uma conta específica ou a padrão
   */
  async sendEmail(
    to: string,
    subject: string,
    html: string,
    accountId?: number
  ): Promise<boolean> {
    try {
      let account: EmailAccount | null;

      if (accountId) {
        account = await this.getAccountById(accountId);
        if (!account) {
          console.warn(`⚠️ Conta ${accountId} não encontrada, usando padrão`);
          account = await this.getDefaultAccount();
        }
      } else {
        account = await this.getDefaultAccount();
      }

      if (!account) {
        console.error('❌ Nenhuma conta de email configurada');
        return false;
      }

      const transporter = this.createTransporter(account);

      await transporter.sendMail({
        from: account.email_from,
        to,
        subject,
        html
      });

      console.log(`✅ Email enviado com sucesso usando conta: ${account.name}`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar email:', error);
      return false;
    }
  }

  /**
   * Busca a conta associada a um template
   */
  async getAccountForTemplate(eventType: string): Promise<EmailAccount | null> {
    try {
      const result = await pool.query(
        `SELECT ea.* 
         FROM email_templates et
         LEFT JOIN email_accounts ea ON et.email_account_id = ea.id
         WHERE et.event_type = $1 AND ea.is_active = true`,
        [eventType]
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      // Se não houver conta associada, retorna a padrão
      return await this.getDefaultAccount();
    } catch (error) {
      console.error('❌ Erro ao buscar conta do template:', error);
      return await this.getDefaultAccount();
    }
  }
}

const emailAccountService = new EmailAccountService();
export default emailAccountService;

