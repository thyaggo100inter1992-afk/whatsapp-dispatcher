/**
 * Controller para gerenciamento de templates de email
 */

const { pool } = require('../../database/connection');
const query = async (text, params) => {
  const result = await pool.query(text, params);
  return result;
};
const EmailService = require('../../services/email.service').default;
const emailService = new EmailService();

/**
 * Lista todos os templates de email
 */
const getAllTemplates = async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        id,
        event_type,
        name,
        description,
        subject,
        html_content,
        is_active,
        variables,
        created_at,
        updated_at
      FROM email_templates
      ORDER BY 
        CASE event_type
          WHEN 'welcome' THEN 1
          WHEN 'trial_start' THEN 2
          WHEN 'expiry_3days' THEN 3
          WHEN 'expiry_2days' THEN 4
          WHEN 'expiry_1day' THEN 5
          WHEN 'blocked' THEN 6
          WHEN 'deletion_warning' THEN 7
          ELSE 99
        END
    `);

    res.json({
      success: true,
      templates: result.rows
    });
  } catch (error) {
    console.error('❌ Erro ao listar templates:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar templates',
      error: error.message
    });
  }
};

/**
 * Busca um template específico
 */
const getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM email_templates WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template não encontrado'
      });
    }

    res.json({
      success: true,
      template: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao buscar template:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar template',
      error: error.message
    });
  }
};

/**
 * Atualiza um template
 */
const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, html_content } = req.body;

    if (!subject || !html_content) {
      return res.status(400).json({
        success: false,
        message: 'Assunto e conteúdo HTML são obrigatórios'
      });
    }

    const result = await query(
      `UPDATE email_templates 
       SET subject = $1, 
           html_content = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [subject, html_content, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template não encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Template atualizado com sucesso',
      template: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar template:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar template',
      error: error.message
    });
  }
};

/**
 * Ativa/desativa um template
 */
const toggleTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE email_templates 
       SET is_active = NOT is_active,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template não encontrado'
      });
    }

    res.json({
      success: true,
      message: result.rows[0].is_active 
        ? 'Template ativado com sucesso' 
        : 'Template desativado com sucesso',
      template: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao alterar status do template:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao alterar status do template',
      error: error.message
    });
  }
};

/**
 * Gera preview de um template com variáveis de exemplo
 */
const previewTemplate = async (req, res) => {
  try {
    const { html_content, event_type } = req.body;

    if (!html_content) {
      return res.status(400).json({
        success: false,
        message: 'Conteúdo HTML é obrigatório'
      });
    }

    // Dados de exemplo para cada tipo de evento
    const exampleData = {
      welcome: {
        nome: 'João Silva',
        email: 'joao@exemplo.com',
        plano: 'Premium',
        dias_teste: '20',
        data_fim_teste: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        url_sistema: 'https://sistemasnettsistemas.com.br'
      },
      trial_start: {
        nome: 'Maria Santos',
        email: 'maria@exemplo.com',
        dias_teste: '20',
        data_inicio: new Date().toLocaleDateString('pt-BR'),
        data_fim_teste: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        url_sistema: 'https://sistemasnettsistemas.com.br'
      },
      expiry_3days: {
        nome: 'Carlos Oliveira',
        email: 'carlos@exemplo.com',
        plano: 'Premium',
        data_vencimento: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        valor: '99,90',
        url_renovacao: 'https://sistemasnettsistemas.com.br/renovar'
      },
      expiry_2days: {
        nome: 'Ana Costa',
        email: 'ana@exemplo.com',
        plano: 'Premium',
        data_vencimento: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        valor: '99,90',
        url_renovacao: 'https://sistemasnettsistemas.com.br/renovar'
      },
      expiry_1day: {
        nome: 'Pedro Almeida',
        email: 'pedro@exemplo.com',
        plano: 'Premium',
        data_vencimento: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        valor: '99,90',
        url_renovacao: 'https://sistemasnettsistemas.com.br/renovar'
      },
      blocked: {
        nome: 'Fernanda Lima',
        email: 'fernanda@exemplo.com',
        plano: 'Premium',
        data_vencimento: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        dias_carencia: '20',
        data_exclusao: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        url_renovacao: 'https://sistemasnettsistemas.com.br/renovar'
      },
      deletion_warning: {
        nome: 'Roberto Souza',
        email: 'roberto@exemplo.com',
        dias_restantes: '5',
        data_exclusao: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        url_renovacao: 'https://sistemasnettsistemas.com.br/renovar'
      }
    };

    const data = exampleData[event_type] || exampleData.welcome;

    // Substituir variáveis no template
    let preview = html_content;
    Object.entries(data).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      preview = preview.replace(regex, value);
    });

    res.json({
      success: true,
      preview
    });
  } catch (error) {
    console.error('❌ Erro ao gerar preview:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao gerar preview',
      error: error.message
    });
  }
};

/**
 * Envia um email de teste
 */
const sendTestEmail = async (req, res) => {
  try {
    const { to, subject, html_content, event_type } = req.body;

    if (!to || !subject || !html_content) {
      return res.status(400).json({
        success: false,
        message: 'Destinatário, assunto e conteúdo são obrigatórios'
      });
    }

    if (!emailService.isConfigured()) {
      return res.status(400).json({
        success: false,
        message: 'Serviço de email não está configurado'
      });
    }

    // Dados de exemplo para teste
    const exampleData = {
      welcome: {
        nome: 'João Silva (TESTE)',
        email: 'joao@exemplo.com',
        plano: 'Premium',
        dias_teste: '20',
        data_fim_teste: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        url_sistema: 'https://sistemasnettsistemas.com.br'
      },
      trial_start: {
        nome: 'Maria Santos (TESTE)',
        email: 'maria@exemplo.com',
        dias_teste: '20',
        data_inicio: new Date().toLocaleDateString('pt-BR'),
        data_fim_teste: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        url_sistema: 'https://sistemasnettsistemas.com.br'
      },
      expiry_3days: {
        nome: 'Carlos Oliveira (TESTE)',
        email: 'carlos@exemplo.com',
        plano: 'Premium',
        data_vencimento: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        valor: '99,90',
        url_renovacao: 'https://sistemasnettsistemas.com.br/renovar'
      },
      expiry_2days: {
        nome: 'Ana Costa (TESTE)',
        email: 'ana@exemplo.com',
        plano: 'Premium',
        data_vencimento: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        valor: '99,90',
        url_renovacao: 'https://sistemasnettsistemas.com.br/renovar'
      },
      expiry_1day: {
        nome: 'Pedro Almeida (TESTE)',
        email: 'pedro@exemplo.com',
        plano: 'Premium',
        data_vencimento: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        valor: '99,90',
        url_renovacao: 'https://sistemasnettsistemas.com.br/renovar'
      },
      blocked: {
        nome: 'Fernanda Lima (TESTE)',
        email: 'fernanda@exemplo.com',
        plano: 'Premium',
        data_vencimento: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        dias_carencia: '20',
        data_exclusao: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        url_renovacao: 'https://sistemasnettsistemas.com.br/renovar'
      },
      deletion_warning: {
        nome: 'Roberto Souza (TESTE)',
        email: 'roberto@exemplo.com',
        dias_restantes: '5',
        data_exclusao: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        url_renovacao: 'https://sistemasnettsistemas.com.br/renovar'
      }
    };

    const data = exampleData[event_type] || exampleData.welcome;

    // Substituir variáveis no template
    let finalHtml = html_content;
    Object.entries(data).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      finalHtml = finalHtml.replace(regex, value);
    });

    const sent = await emailService.sendEmail(to, `[TESTE] ${subject}`, finalHtml);

    if (sent) {
      res.json({
        success: true,
        message: 'Email de teste enviado com sucesso!'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Falha ao enviar email de teste'
      });
    }
  } catch (error) {
    console.error('❌ Erro ao enviar email de teste:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao enviar email de teste',
      error: error.message
    });
  }
};

module.exports = {
  getAllTemplates,
  getTemplateById,
  updateTemplate,
  toggleTemplate,
  previewTemplate,
  sendTestEmail
};

