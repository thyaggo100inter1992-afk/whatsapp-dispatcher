import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { query } from '../database/connection';
import { CampaignModel } from '../models/Campaign';

const reportErrorLogPath = path.resolve(__dirname, '../..', 'report-errors.log');

function appendReportError(message: string, data?: any) {
  try {
    const timestamp = new Date().toISOString();
    const payload = data ? `${message} ${JSON.stringify(data, null, 2)}` : message;
    fs.appendFileSync(reportErrorLogPath, `${timestamp} ${payload}\n`);
  } catch (logError) {
    console.error('❌ Falha ao registrar erro de relatório:', logError);
  }
}

export class ReportService {
  async generateCampaignReport(campaignId: number, tenantId?: number): Promise<ExcelJS.Buffer> {
    try {
      console.log(`📊 Gerando relatório Excel para campanha ${campaignId}...`);

      // 🔒 SEGURANÇA: tenant_id é OBRIGATÓRIO
      if (!tenantId) {
        throw new Error('tenant_id é obrigatório para gerar relatório');
      }

      // Buscar dados da campanha
      const campaign = await CampaignModel.findById(campaignId, tenantId);
      
      if (!campaign) {
        throw new Error('Campanha não encontrada');
      }

      console.log(`📋 Tipo de campanha: ${campaign.campaign_type || 'oficial (null)'}`);

      // Buscar templates da campanha
      // ⚠️ IMPORTANTE: campaign_templates pode ter whatsapp_account_id (Oficial) ou instance_id (QR Connect)
      let templates = [];
      
      try {
        if (campaign.campaign_type === 'qr_connect') {
          // Templates QR Connect
          console.log('🔍 Buscando templates QR Connect...');
          const templatesQuery = `
            SELECT ct.id, ct.campaign_id, ct.template_id, ct.instance_id, 
                   ct.order_index, ct.created_at,
                   t.template_name, i.name as account_name, i.instance_name as phone_number
            FROM campaign_templates ct
            LEFT JOIN templates t ON ct.template_id = t.id
            LEFT JOIN qr_instances i ON ct.instance_id = i.id
            WHERE ct.campaign_id = $1
            ORDER BY ct.order_index`;
          const templatesResult = await query(templatesQuery, [campaignId]);
          templates = templatesResult.rows;
          console.log(`✅ ${templates.length} templates QR Connect encontrados`);
        } else {
          // Templates API Oficial
          console.log('🔍 Buscando templates API Oficial...');
          const templatesQuery = `
            SELECT ct.id, ct.campaign_id, ct.template_id, ct.whatsapp_account_id, 
                   ct.order_index, ct.created_at,
                   t.template_name, w.name as account_name, w.phone_number
            FROM campaign_templates ct
            LEFT JOIN templates t ON ct.template_id = t.id
            LEFT JOIN whatsapp_accounts w ON ct.whatsapp_account_id = w.id
            WHERE ct.campaign_id = $1
            ORDER BY ct.order_index`;
          const templatesResult = await query(templatesQuery, [campaignId]);
          templates = templatesResult.rows;
          console.log(`✅ ${templates.length} templates API Oficial encontrados`);
        }
      } catch (templatesError) {
        console.error('❌ Erro ao buscar templates:', templatesError.message);
        appendReportError(`Erro ao buscar templates da campanha ${campaignId}`, {
          type: campaign.campaign_type || 'oficial',
          error: templatesError.message,
          stack: templatesError.stack
        });
        throw new Error(`Erro ao buscar templates: ${templatesError.message}`);
      }

      // Buscar mensagens da campanha
      // ⚠️ IMPORTANTE: API Oficial usa tabela 'messages', QR Connect usa 'qr_campaign_messages'
      let messages = [];
      
      try {
        if (campaign.campaign_type === 'qr_connect') {
          // Mensagens QR Connect
          console.log('🔍 Buscando mensagens QR Connect...');
          const messagesResult = await query(
            `SELECT m.*, c.name as contact_name, c.phone_number as contact_phone,
                    i.name as account_name, i.instance_name as account_phone
             FROM qr_campaign_messages m
             LEFT JOIN qr_campaign_contacts c ON m.contact_id = c.id
             LEFT JOIN qr_instances i ON m.instance_id = i.id
             WHERE m.campaign_id = $1
             ORDER BY m.created_at`,
            [campaignId]
          );
          messages = messagesResult.rows;
          console.log(`✅ ${messages.length} mensagens QR Connect encontradas`);
        } else {
          // Mensagens API Oficial
          console.log('🔍 Buscando mensagens API Oficial...');
          const messagesResult = await query(
            `SELECT m.*, c.name as contact_name, c.phone_number as contact_phone,
                    w.name as account_name, w.phone_number as account_phone
             FROM messages m
             LEFT JOIN contacts c ON m.contact_id = c.id
             LEFT JOIN whatsapp_accounts w ON m.whatsapp_account_id = w.id
             WHERE m.campaign_id = $1
             ORDER BY m.created_at`,
            [campaignId]
          );
          messages = messagesResult.rows;
          console.log(`✅ ${messages.length} mensagens API Oficial encontradas`);
        }
      } catch (messagesError) {
        console.error('❌ Erro ao buscar mensagens:', messagesError.message);
        appendReportError(`Erro ao buscar mensagens da campanha ${campaignId}`, {
          type: campaign.campaign_type || 'oficial',
          error: messagesError.message,
          stack: messagesError.stack
        });
        throw new Error(`Erro ao buscar mensagens: ${messagesError.message}`);
      }

      // Buscar estatísticas por conta
      let accountStats = [];
      
      try {
        if (campaign.campaign_type === 'qr_connect') {
          // Estatísticas QR Connect
          console.log('🔍 Buscando estatísticas QR Connect...');
          const accountStatsResult = await query(
            `SELECT 
              i.id,
              i.name,
              i.instance_name as phone_number,
              COUNT(DISTINCT m.id) as total_messages,
              COUNT(DISTINCT CASE WHEN m.status = 'sent' THEN m.id END) as sent_count,
              COUNT(DISTINCT CASE WHEN m.status = 'delivered' THEN m.id END) as delivered_count,
              COUNT(DISTINCT CASE WHEN m.status = 'read' THEN m.id END) as read_count,
              COUNT(DISTINCT CASE WHEN m.status = 'failed' THEN m.id END) as failed_count,
              STRING_AGG(DISTINCT m.template_name, ', ') as templates_used
             FROM qr_instances i
             LEFT JOIN qr_campaign_messages m ON m.instance_id = i.id AND m.campaign_id = $1
             WHERE i.id IN (SELECT DISTINCT instance_id FROM qr_campaign_contacts WHERE campaign_id = $1)
             GROUP BY i.id, i.name, i.instance_name`,
            [campaignId]
          );
          accountStats = accountStatsResult.rows;
          console.log(`✅ ${accountStats.length} instâncias QR Connect encontradas`);
        } else {
          // Estatísticas API Oficial
          console.log('🔍 Buscando estatísticas API Oficial...');
          const accountStatsResult = await query(
            `SELECT 
              w.id,
              w.name,
              w.phone_number,
              COUNT(DISTINCT m.id) as total_messages,
              COUNT(DISTINCT CASE WHEN m.status = 'sent' THEN m.id END) as sent_count,
              COUNT(DISTINCT CASE WHEN m.status = 'delivered' THEN m.id END) as delivered_count,
              COUNT(DISTINCT CASE WHEN m.status = 'read' THEN m.id END) as read_count,
              COUNT(DISTINCT CASE WHEN m.status = 'failed' THEN m.id END) as failed_count,
              STRING_AGG(DISTINCT m.template_name, ', ') as templates_used
             FROM whatsapp_accounts w
             LEFT JOIN messages m ON m.whatsapp_account_id = w.id AND m.campaign_id = $1
             WHERE w.id IN (SELECT DISTINCT whatsapp_account_id FROM campaign_templates WHERE campaign_id = $1)
             GROUP BY w.id, w.name, w.phone_number`,
            [campaignId]
          );
          accountStats = accountStatsResult.rows;
          console.log(`✅ ${accountStats.length} contas API Oficial encontradas`);
        }
      } catch (statsError) {
        console.error('❌ Erro ao buscar estatísticas:', statsError.message);
        appendReportError(`Erro ao buscar estatísticas da campanha ${campaignId}`, {
          type: campaign.campaign_type || 'oficial',
          error: statsError.message,
          stack: statsError.stack
        });
        throw new Error(`Erro ao buscar estatísticas: ${statsError.message}`);
      }

      // Buscar contatos únicos
      let contacts = [];
      
      try {
        if (campaign.campaign_type === 'qr_connect') {
          // Contatos QR Connect
          console.log('🔍 Buscando contatos QR Connect...');
          const contactsResult = await query(
            `SELECT DISTINCT 
              c.name,
              c.phone_number,
              m.status,
              m.template_name
             FROM qr_campaign_contacts c
             LEFT JOIN qr_campaign_messages m ON m.contact_id = c.id AND m.campaign_id = $1
             WHERE c.campaign_id = $1
             ORDER BY c.name`,
            [campaignId]
          );
          contacts = contactsResult.rows;
          console.log(`✅ ${contacts.length} contatos QR Connect encontrados`);
        } else {
          // Contatos API Oficial
          console.log('🔍 Buscando contatos API Oficial...');
          console.log(`   📋 Campaign ID: ${campaignId}`);
          
          // Primeiro verificar quantas mensagens existem para esta campanha
          const messagesCountResult = await query(
            `SELECT COUNT(*) as total, 
                    COUNT(DISTINCT contact_id) as distinct_contacts,
                    COUNT(CASE WHEN contact_id IS NOT NULL THEN 1 END) as with_contact_id
             FROM messages 
             WHERE campaign_id = $1`,
            [campaignId]
          );
          console.log(`   📊 Mensagens da campanha:`, messagesCountResult.rows[0]);
          
          // LOG ARQUIVO: Garantir que aparece
          appendReportError(`[DEBUG] Campanha ${campaignId} - Mensagens`, messagesCountResult.rows[0]);
          
          // 🔥 CORREÇÃO: Adicionar tenant_id na busca de contatos!
          const contactsResult = await query(
            `SELECT 
              c.id,
              c.name,
              c.phone_number,
              m_latest.status,
              m_latest.template_name
             FROM contacts c
             INNER JOIN (
               SELECT DISTINCT contact_id 
               FROM messages 
               WHERE campaign_id = $1 AND contact_id IS NOT NULL
             ) cm ON cm.contact_id = c.id
             LEFT JOIN LATERAL (
               SELECT status, template_name
               FROM messages
               WHERE contact_id = c.id AND campaign_id = $1
               ORDER BY created_at DESC
               LIMIT 1
             ) m_latest ON true
             WHERE c.tenant_id = $2
             ORDER BY c.name NULLS LAST, c.phone_number`,
            [campaignId, tenantId]
          );
          contacts = contactsResult.rows;
          console.log(`✅ ${contacts.length} contatos API Oficial encontrados`);
          
          // LOG ARQUIVO: Resultado
          appendReportError(`[DEBUG] Campanha ${campaignId} - ${contacts.length} contatos encontrados`);
          
          if (contacts.length === 0 && messagesCountResult.rows[0].total > 0) {
            console.error('⚠️ AVISO: Existem mensagens mas nenhum contato foi encontrado!');
            console.error('   Isso pode indicar que contact_id não está sendo salvo corretamente');
            
            // LOG ARQUIVO: Problema detectado!
            appendReportError(`[PROBLEMA] Campanha ${campaignId} - ${messagesCountResult.rows[0].total} mensagens mas 0 contatos! contact_id pode estar NULL`);
          }
        }
      } catch (contactsError) {
        console.error('❌ Erro ao buscar contatos:', contactsError.message);
        appendReportError(`Erro ao buscar contatos da campanha ${campaignId}`, {
          type: campaign.campaign_type || 'oficial',
          error: contactsError.message,
          stack: contactsError.stack
        });
        throw new Error(`Erro ao buscar contatos: ${contactsError.message}`);
      }

      // Buscar apenas falhas
      const failedMessages = messages.filter(m => m.status === 'failed');

      // Buscar cliques em botões
      let buttonClicks = [];
      try {
        if (campaign.campaign_type === 'qr_connect') {
          // Button clicks para QR Connect (se implementado)
          const buttonClicksResult = await query(
            `SELECT 
              bc.id,
              bc.phone_number,
              bc.contact_name,
              bc.button_text,
              bc.button_payload,
              bc.clicked_at,
              c.name as contact_name_full,
              m.template_name,
              m.sent_at as message_sent_at,
              i.name as account_name
             FROM button_clicks bc
             LEFT JOIN qr_campaign_contacts c ON bc.contact_id = c.id
             LEFT JOIN qr_campaign_messages m ON bc.message_id = m.id
             LEFT JOIN qr_instances i ON m.instance_id = i.id
             WHERE bc.campaign_id = $1
             ORDER BY bc.clicked_at DESC`,
            [campaignId]
          );
          buttonClicks = buttonClicksResult.rows;
        } else {
          // Button clicks para API Oficial
          const buttonClicksResult = await query(
            `SELECT 
              bc.id,
              bc.phone_number,
              bc.contact_name,
              bc.button_text,
              bc.button_payload,
              bc.clicked_at,
              c.name as contact_name_full,
              m.template_name,
              m.sent_at as message_sent_at,
              w.name as account_name
             FROM button_clicks bc
             LEFT JOIN contacts c ON bc.contact_id = c.id
             LEFT JOIN messages m ON bc.message_id = m.id
             LEFT JOIN whatsapp_accounts w ON m.whatsapp_account_id = w.id
             WHERE bc.campaign_id = $1
             ORDER BY bc.clicked_at DESC`,
            [campaignId]
          );
          buttonClicks = buttonClicksResult.rows;
        }
      } catch (buttonError) {
        console.warn('⚠️ Erro ao buscar cliques de botões (pode ser normal se não houver cliques):', buttonError.message);
        buttonClicks = [];
      }

      // Criar workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Disparador WhatsApp API';
      workbook.created = new Date();

    // ========================================
    // ABA 1: Resumo da Campanha
    // ========================================
    const resumoSheet = workbook.addWorksheet('Resumo da Campanha');
    
    // Estilo do cabeçalho
    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0066CC' } },
      alignment: { vertical: 'middle', horizontal: 'left' }
    };

    resumoSheet.columns = [
      { header: 'Campo', key: 'campo', width: 30 },
      { header: 'Valor', key: 'valor', width: 50 }
    ];

    // Aplicar estilo no cabeçalho
    resumoSheet.getRow(1).eachCell(cell => {
      cell.style = headerStyle;
    });

    // Adicionar dados
    const scheduleConfig = campaign.schedule_config || {};
    const pauseConfig = campaign.pause_config || {};

    resumoSheet.addRow({ campo: 'Nome da Campanha', valor: campaign.name });
    resumoSheet.addRow({ campo: 'Data de Criação', valor: this.formatDate(campaign.created_at) });
    resumoSheet.addRow({ campo: 'Data de Início', valor: this.formatDate(campaign.started_at) });
    resumoSheet.addRow({ campo: 'Data de Conclusão', valor: this.formatDate(campaign.completed_at) });
    resumoSheet.addRow({ campo: 'Status Final', valor: this.translateStatus(campaign.status) });
    resumoSheet.addRow({ campo: 'Horário de Funcionamento', valor: `${scheduleConfig.work_start_time || 'N/A'} - ${scheduleConfig.work_end_time || 'N/A'}` });
    resumoSheet.addRow({ campo: 'Intervalo entre Mensagens', valor: `${scheduleConfig.interval_seconds || 'N/A'} segundos` });
    resumoSheet.addRow({ campo: 'Pausar após', valor: `${pauseConfig.pause_after || 'N/A'} mensagens` });
    resumoSheet.addRow({ campo: 'Duração da Pausa', valor: `${pauseConfig.pause_duration_minutes || 'N/A'} minutos` });

    // ========================================
    // ABA 2: Estatísticas
    // ========================================
    const statsSheet = workbook.addWorksheet('Estatísticas');
    
    statsSheet.columns = [
      { header: 'Métrica', key: 'metrica', width: 30 },
      { header: 'Valor', key: 'valor', width: 20 },
      { header: 'Percentual', key: 'percentual', width: 15 }
    ];

    statsSheet.getRow(1).eachCell(cell => {
      cell.style = headerStyle;
    });

    const taxaEntrega = campaign.sent_count > 0 ? (campaign.delivered_count / campaign.sent_count * 100).toFixed(2) : '0.00';
    const taxaLeitura = campaign.delivered_count > 0 ? (campaign.read_count / campaign.delivered_count * 100).toFixed(2) : '0.00';

    statsSheet.addRow({ metrica: 'Total de Contatos', valor: campaign.total_contacts, percentual: '100.00%' });
    statsSheet.addRow({ metrica: 'Mensagens Enviadas', valor: campaign.sent_count, percentual: `${(campaign.sent_count / campaign.total_contacts * 100).toFixed(2)}%` });
    statsSheet.addRow({ metrica: 'Mensagens Entregues', valor: campaign.delivered_count, percentual: `${taxaEntrega}%` });
    statsSheet.addRow({ metrica: 'Mensagens Lidas', valor: campaign.read_count, percentual: `${taxaLeitura}%` });
    statsSheet.addRow({ metrica: 'Mensagens Falhadas', valor: campaign.failed_count, percentual: `${(campaign.failed_count / campaign.total_contacts * 100).toFixed(2)}%` });
    statsSheet.addRow({ metrica: 'Taxa de Entrega', valor: `${taxaEntrega}%`, percentual: '-' });
    statsSheet.addRow({ metrica: 'Taxa de Leitura', valor: `${taxaLeitura}%`, percentual: '-' });

    // ========================================
    // ABA 3: Contas Utilizadas
    // ========================================
    const contasSheet = workbook.addWorksheet('Contas Utilizadas');
    
    contasSheet.columns = [
      { header: 'Nome da Conta', key: 'nome', width: 25 },
      { header: 'Número de Telefone', key: 'telefone', width: 20 },
      { header: 'Telefone com 9', key: 'telefone_com_9', width: 18 },
      { header: 'Templates Usados', key: 'templates', width: 40 },
      { header: 'Mensagens Enviadas', key: 'enviadas', width: 18 },
      { header: 'Taxa de Sucesso', key: 'taxa', width: 15 }
    ];

    contasSheet.getRow(1).eachCell(cell => {
      cell.style = headerStyle;
    });

    accountStats.forEach(account => {
      const taxaSucesso = account.total_messages > 0 
        ? ((account.delivered_count / account.total_messages) * 100).toFixed(2) 
        : '0.00';
      
      contasSheet.addRow({
        nome: account.name,
        telefone: account.phone_number,
        telefone_com_9: this.addNinthDigit(account.phone_number),
        templates: account.templates_used || 'N/A',
        enviadas: account.total_messages || 0,
        taxa: `${taxaSucesso}%`
      });
    });

    // ========================================
    // ABA 4: Mensagens Detalhadas
    // ========================================
    const mensagensSheet = workbook.addWorksheet('Mensagens Detalhadas');
    
    mensagensSheet.columns = [
      { header: 'Contato', key: 'contato', width: 25 },
      { header: 'Telefone', key: 'telefone', width: 18 },
      { header: 'Telefone com 9', key: 'telefone_com_9', width: 18 },
      { header: 'Template', key: 'template', width: 30 },
      { header: 'Conta', key: 'conta', width: 25 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Data Envio', key: 'envio', width: 18 },
      { header: 'Data Entrega', key: 'entrega', width: 18 },
      { header: 'Data Leitura', key: 'leitura', width: 18 }
    ];

    mensagensSheet.getRow(1).eachCell(cell => {
      cell.style = headerStyle;
    });

    messages.forEach(msg => {
      mensagensSheet.addRow({
        contato: msg.contact_name || 'N/A',
        telefone: msg.contact_phone || msg.phone_number,
        telefone_com_9: this.addNinthDigit(msg.contact_phone || msg.phone_number),
        template: msg.template_name,
        conta: msg.account_name,
        status: this.translateStatus(msg.status),
        envio: this.formatDate(msg.sent_at),
        entrega: this.formatDate(msg.delivered_at),
        leitura: this.formatDate(msg.read_at)
      });
    });

    // ========================================
    // ABA 5: Contatos
    // ========================================
    const contatosSheet = workbook.addWorksheet('Contatos');
    
    contatosSheet.columns = [
      { header: 'Nome', key: 'nome', width: 30 },
      { header: 'Telefone', key: 'telefone', width: 20 },
      { header: 'Telefone com 9', key: 'telefone_com_9', width: 18 },
      { header: 'Status Envio', key: 'status', width: 15 },
      { header: 'Template Recebido', key: 'template', width: 35 }
    ];

    contatosSheet.getRow(1).eachCell(cell => {
      cell.style = headerStyle;
    });

    contacts.forEach(contact => {
      contatosSheet.addRow({
        nome: contact.name || 'N/A',
        telefone: contact.phone_number,
        telefone_com_9: this.addNinthDigit(contact.phone_number),
        status: this.translateStatus(contact.status),
        template: contact.template_name || 'N/A'
      });
    });

    // ========================================
    // ABA 6: Falhas e Erros
    // ========================================
    const falhasSheet = workbook.addWorksheet('Falhas e Erros');
    
    falhasSheet.columns = [
      { header: 'Contato', key: 'contato', width: 25 },
      { header: 'Telefone', key: 'telefone', width: 18 },
      { header: 'Telefone com 9', key: 'telefone_com_9', width: 18 },
      { header: 'Template', key: 'template', width: 30 },
      { header: 'Conta', key: 'conta', width: 25 },
      { header: 'Data da Falha', key: 'data', width: 18 },
      { header: 'Motivo do Erro', key: 'erro', width: 50 }
    ];

    falhasSheet.getRow(1).eachCell(cell => {
      cell.style = headerStyle;
    });

    if (failedMessages.length === 0) {
      falhasSheet.addRow({
        contato: 'Nenhuma falha registrada',
        telefone: '-',
        telefone_com_9: '-',
        template: '-',
        conta: '-',
        data: '-',
        erro: '✅ Todas as mensagens foram enviadas com sucesso!'
      });
    } else {
      failedMessages.forEach(msg => {
        falhasSheet.addRow({
          contato: msg.contact_name || 'N/A',
          telefone: msg.contact_phone || msg.phone_number,
          telefone_com_9: this.addNinthDigit(msg.contact_phone || msg.phone_number),
          template: msg.template_name,
          conta: msg.account_name,
          data: this.formatDate(msg.failed_at),
          erro: this.formatErrorMessage(msg.error_message)
        });
      });
    }

    // ========================================
    // ABA 7: Cliques de Botões
    // ========================================
    const cliquesSheet = workbook.addWorksheet('Cliques de Botões');
    
    cliquesSheet.columns = [
      { header: 'Quem Clicou', key: 'contato', width: 30 },
      { header: 'Telefone', key: 'telefone', width: 18 },
      { header: 'Telefone com 9', key: 'telefone_com_9', width: 18 },
      { header: 'Nome do Botão', key: 'botao', width: 35 },
      { header: 'Template Usado', key: 'template', width: 30 },
      { header: 'Mensagem Enviada Em', key: 'envio', width: 18 },
      { header: 'Clique Em (Data)', key: 'data_clique', width: 15 },
      { header: 'Clique Em (Hora)', key: 'hora_clique', width: 12 },
      { header: 'Ação/Payload', key: 'payload', width: 25 }
    ];

    cliquesSheet.getRow(1).eachCell(cell => {
      cell.style = headerStyle;
    });

    if (buttonClicks.length === 0) {
      cliquesSheet.addRow({
        contato: 'Nenhum clique registrado',
        telefone: '-',
        telefone_com_9: '-',
        botao: '-',
        template: '-',
        envio: '-',
        data_clique: '-',
        hora_clique: '-',
        payload: 'ℹ️ Os cliques em botões são rastreados via webhook do WhatsApp'
      });
    } else {
      buttonClicks.forEach(click => {
        const clickDate = click.clicked_at ? new Date(click.clicked_at) : null;
        const dataClique = clickDate ? this.formatDate(click.clicked_at).split(' ')[0] : '-';
        const horaClique = clickDate ? this.formatDate(click.clicked_at).split(' ')[1] : '-';
        const mensagemEnvio = this.formatDate(click.message_sent_at);
        
        cliquesSheet.addRow({
          contato: click.contact_name_full || click.contact_name || 'N/A',
          telefone: click.phone_number,
          telefone_com_9: this.addNinthDigit(click.phone_number),
          botao: click.button_text || 'N/A',
          template: click.template_name || 'N/A',
          envio: mensagemEnvio,
          data_clique: dataClique,
          hora_clique: horaClique,
          payload: click.button_payload || '-'
        });
      });
    }

    // Aplicar bordas em todas as células de todas as abas
    [resumoSheet, statsSheet, contasSheet, mensagensSheet, contatosSheet, falhasSheet, cliquesSheet].forEach(sheet => {
      sheet.eachRow((row, rowNumber) => {
        row.eachCell(cell => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });
    });

      console.log('✅ Relatório Excel gerado com sucesso!');

      // Gerar buffer
      const buffer = await workbook.xlsx.writeBuffer();
      return buffer as ExcelJS.Buffer;
    } catch (error: any) {
      appendReportError(`Erro ao gerar relatório da campanha ${campaignId}`, {
        tenantId,
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  private formatDate(date: any): string {
    if (!date) return '-';
    try {
      const d = new Date(date);
      return d.toLocaleString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '-';
    }
  }

  private formatErrorMessage(errorMessage: string | null | undefined): string {
    if (!errorMessage) return 'Erro não especificado';
    
    // Verificar se é erro 131026 (sem WhatsApp)
    if (errorMessage.includes('131026') || errorMessage.toLowerCase().includes('undeliverable')) {
      return 'Sem WhatsApp';
    }
    
    // Verificar outros erros comuns
    if (errorMessage.toLowerCase().includes('not registered')) {
      return 'Número não registrado no WhatsApp';
    }
    
    if (errorMessage.toLowerCase().includes('invalid phone')) {
      return 'Número inválido';
    }
    
    // Retornar mensagem original se não for erro conhecido
    return errorMessage;
  }

  private addNinthDigit(phoneNumber: string): string {
    if (!phoneNumber) return '-';
    
    // Remover caracteres não numéricos
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    
    // Se o número já tem 13 dígitos (55 + DDD + 9 dígitos), retornar como está
    if (cleanNumber.length === 13) {
      return phoneNumber;
    }
    
    // Se o número tem 12 dígitos (55 + DDD + 8 dígitos) e não começa com 9
    if (cleanNumber.length === 12) {
      // Adicionar o 9 após o DDD (posição 4)
      return cleanNumber.slice(0, 4) + '9' + cleanNumber.slice(4);
    }
    
    // Se o número tem 11 dígitos (DDD + 9 dígitos), já tem o 9
    if (cleanNumber.length === 11) {
      return phoneNumber;
    }
    
    // Se o número tem 10 dígitos (DDD + 8 dígitos)
    if (cleanNumber.length === 10) {
      // Adicionar o 9 após o DDD (posição 2)
      return cleanNumber.slice(0, 2) + '9' + cleanNumber.slice(2);
    }
    
    // Para outros casos, retornar o número original
    return phoneNumber;
  }

  private translateStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'pending': 'Pendente',
      'scheduled': 'Agendada',
      'running': 'Em Execução',
      'paused': 'Pausada',
      'completed': 'Concluída',
      'cancelled': 'Cancelada',
      'failed': 'Falhou',
      'sent': 'Enviada',
      'delivered': 'Entregue',
      'read': 'Lida'
    };
    return statusMap[status] || status;
  }
}

export const reportService = new ReportService();

