/**
 * Serviço de Envio de Emails
 * 
 * Suporta múltiplos provedores:
 * - Nodemailer (SMTP)
 * - SendGrid
 * - Amazon SES
 * - Mailgun
 * 
 * Configuração via variáveis de ambiente
 */

import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

class EmailService {
  private transporter: any;
  public isConfigured: boolean = false;
  private provider: string = 'none';

  constructor() {
    this.initialize();
  }

  /**
   * Inicializar serviço de email baseado nas variáveis de ambiente
   */
  private initialize() {
    // Verificar qual provedor está configurado
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.initializeSMTP();
    } else if (process.env.SENDGRID_API_KEY) {
      this.initializeSendGrid();
    } else if (process.env.AWS_SES_REGION && process.env.AWS_ACCESS_KEY_ID) {
      this.initializeAWS_SES();
    } else if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
      this.initializeMailgun();
    } else {
      console.log('⚠️  Nenhum provedor de email configurado');
      console.log('   Configure SMTP_HOST, SMTP_USER e SMTP_PASS no .env');
      this.isConfigured = false;
    }
  }

  /**
   * Configurar Nodemailer (SMTP)
   */
  private initializeSMTP() {
    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true para 465, false para outras portas
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      this.isConfigured = true;
      this.provider = 'SMTP';
      console.log(`✅ Email Service configurado: SMTP (${process.env.SMTP_HOST})`);
    } catch (error: any) {
      console.error('❌ Erro ao configurar SMTP:', error.message);
      this.isConfigured = false;
    }
  }

  /**
   * Configurar SendGrid
   */
  private initializeSendGrid() {
    try {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      this.transporter = sgMail;
      this.isConfigured = true;
      this.provider = 'SendGrid';
      console.log('✅ Email Service configurado: SendGrid');
    } catch (error: any) {
      console.error('❌ Erro ao configurar SendGrid:', error.message);
      console.log('   Instale: npm install @sendgrid/mail');
      this.isConfigured = false;
    }
  }

  /**
   * Configurar AWS SES
   */
  private initializeAWS_SES() {
    try {
      const AWS = require('aws-sdk');
      AWS.config.update({
        region: process.env.AWS_SES_REGION,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      });
      this.transporter = new AWS.SES({ apiVersion: '2010-12-01' });
      this.isConfigured = true;
      this.provider = 'AWS SES';
      console.log('✅ Email Service configurado: AWS SES');
    } catch (error: any) {
      console.error('❌ Erro ao configurar AWS SES:', error.message);
      console.log('   Instale: npm install aws-sdk');
      this.isConfigured = false;
    }
  }

  /**
   * Configurar Mailgun
   */
  private initializeMailgun() {
    try {
      const mailgun = require('mailgun-js');
      this.transporter = mailgun({
        apiKey: process.env.MAILGUN_API_KEY,
        domain: process.env.MAILGUN_DOMAIN,
      });
      this.isConfigured = true;
      this.provider = 'Mailgun';
      console.log('✅ Email Service configurado: Mailgun');
    } catch (error: any) {
      console.error('❌ Erro ao configurar Mailgun:', error.message);
      console.log('   Instale: npm install mailgun-js');
      this.isConfigured = false;
    }
  }

  /**
   * Enviar email
   */
  async sendEmail(to: string, subject: string, html: string, from?: string): Promise<boolean> {
    if (!this.isConfigured) {
      console.log(`⚠️  Email não enviado (provedor não configurado)`);
      console.log(`   Para: ${to}`);
      console.log(`   Assunto: ${subject}`);
      return false;
    }

    const fromAddress = from || process.env.EMAIL_FROM || 'noreply@sistemasnettsistemas.com.br';

    try {
      if (this.provider === 'SMTP') {
        await this.sendViaSMTP(to, subject, html, fromAddress);
      } else if (this.provider === 'SendGrid') {
        await this.sendViaSendGrid(to, subject, html, fromAddress);
      } else if (this.provider === 'AWS SES') {
        await this.sendViaAWS_SES(to, subject, html, fromAddress);
      } else if (this.provider === 'Mailgun') {
        await this.sendViaMailgun(to, subject, html, fromAddress);
      }

      console.log(`✅ Email enviado via ${this.provider}: ${to}`);
      return true;
    } catch (error: any) {
      console.error(`❌ Erro ao enviar email via ${this.provider}:`, error.message);
      return false;
    }
  }

  /**
   * Enviar via SMTP (Nodemailer)
   */
  private async sendViaSMTP(to: string, subject: string, html: string, from: string) {
    await this.transporter.sendMail({
      from,
      to,
      subject,
      html,
    });
  }

  /**
   * Enviar via SendGrid
   */
  private async sendViaSendGrid(to: string, subject: string, html: string, from: string) {
    await this.transporter.send({
      to,
      from,
      subject,
      html,
    });
  }

  /**
   * Enviar via AWS SES
   */
  private async sendViaAWS_SES(to: string, subject: string, html: string, from: string) {
    const params = {
      Source: from,
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Subject: {
          Data: subject,
        },
        Body: {
          Html: {
            Data: html,
          },
        },
      },
    };

    await this.transporter.sendEmail(params).promise();
  }

  /**
   * Enviar via Mailgun
   */
  private async sendViaMailgun(to: string, subject: string, html: string, from: string) {
    const data = {
      from,
      to,
      subject,
      html,
    };

    await this.transporter.messages().send(data);
  }

  /**
   * Verificar se o serviço está configurado
   */
  isReady(): boolean {
    return this.isConfigured;
  }

  /**
   * Obter provedor atual
   */
  getProvider(): string {
    return this.provider;
  }
}

export default new EmailService();

