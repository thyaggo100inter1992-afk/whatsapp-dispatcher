/**
 * Controller para gerenciamento de contas de email
 */

const { pool } = require('../../database/connection');
const nodemailer = require('nodemailer');

const query = async (text, params) => {
  const result = await pool.query(text, params);
  return result;
};

/**
 * Lista todas as contas de email
 */
const getAllAccounts = async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        id,
        name,
        provider,
        smtp_host,
        smtp_port,
        smtp_secure,
        smtp_user,
        email_from,
        is_default,
        is_active,
        created_at,
        updated_at
      FROM email_accounts
      ORDER BY is_default DESC, name ASC
    `);

    res.json({
      success: true,
      accounts: result.rows
    });
  } catch (error) {
    console.error('❌ Erro ao listar contas de email:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar contas de email',
      error: error.message
    });
  }
};

/**
 * Busca uma conta específica
 */
const getAccountById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT * FROM email_accounts WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conta não encontrada'
      });
    }

    res.json({
      success: true,
      account: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao buscar conta:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar conta',
      error: error.message
    });
  }
};

/**
 * Cria uma nova conta de email
 */
const createAccount = async (req, res) => {
  try {
    const {
      name,
      provider,
      smtp_host,
      smtp_port,
      smtp_secure,
      smtp_user,
      smtp_pass,
      email_from,
      is_default
    } = req.body;

    // Validação
    if (!name || !provider || !email_from) {
      return res.status(400).json({
        success: false,
        message: 'Nome, provedor e email são obrigatórios'
      });
    }

    // Se for marcada como padrão, remover o padrão das outras
    if (is_default) {
      await query('UPDATE email_accounts SET is_default = false');
    }

    const result = await query(
      `INSERT INTO email_accounts (
        name, provider, smtp_host, smtp_port, smtp_secure,
        smtp_user, smtp_pass, email_from, is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [name, provider, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, email_from, is_default || false]
    );

    console.log(`✅ Conta de email criada: ${name}`);

    res.json({
      success: true,
      message: 'Conta criada com sucesso',
      account: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao criar conta:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar conta',
      error: error.message
    });
  }
};

/**
 * Atualiza uma conta de email
 */
const updateAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      provider,
      smtp_host,
      smtp_port,
      smtp_secure,
      smtp_user,
      smtp_pass,
      email_from,
      is_default,
      is_active
    } = req.body;

    // Se for marcada como padrão, remover o padrão das outras
    if (is_default) {
      await query('UPDATE email_accounts SET is_default = false WHERE id != $1', [id]);
    }

    const result = await query(
      `UPDATE email_accounts SET
        name = $1,
        provider = $2,
        smtp_host = $3,
        smtp_port = $4,
        smtp_secure = $5,
        smtp_user = $6,
        smtp_pass = COALESCE($7, smtp_pass),
        email_from = $8,
        is_default = $9,
        is_active = $10,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $11
      RETURNING *`,
      [name, provider, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, email_from, is_default, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conta não encontrada'
      });
    }

    console.log(`✅ Conta atualizada: ${name}`);

    res.json({
      success: true,
      message: 'Conta atualizada com sucesso',
      account: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar conta:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar conta',
      error: error.message
    });
  }
};

/**
 * Deleta uma conta de email
 */
const deleteAccount = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se não é a única conta
    const countResult = await query('SELECT COUNT(*) as count FROM email_accounts');
    if (parseInt(countResult.rows[0].count) <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Não é possível deletar a última conta de email'
      });
    }

    // Verificar se é a conta padrão
    const accountResult = await query('SELECT is_default FROM email_accounts WHERE id = $1', [id]);
    if (accountResult.rows.length > 0 && accountResult.rows[0].is_default) {
      // Definir outra conta como padrão
      await query(`
        UPDATE email_accounts 
        SET is_default = true 
        WHERE id = (SELECT id FROM email_accounts WHERE id != $1 LIMIT 1)
      `, [id]);
    }

    const result = await query('DELETE FROM email_accounts WHERE id = $1 RETURNING name', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conta não encontrada'
      });
    }

    console.log(`✅ Conta deletada: ${result.rows[0].name}`);

    res.json({
      success: true,
      message: 'Conta deletada com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao deletar conta:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar conta',
      error: error.message
    });
  }
};

/**
 * Define uma conta como padrão
 */
const setAsDefault = async (req, res) => {
  try {
    const { id } = req.params;

    // Remover padrão de todas
    await query('UPDATE email_accounts SET is_default = false');

    // Definir nova padrão
    const result = await query(
      'UPDATE email_accounts SET is_default = true WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conta não encontrada'
      });
    }

    console.log(`✅ Conta definida como padrão: ${result.rows[0].name}`);

    res.json({
      success: true,
      message: 'Conta definida como padrão',
      account: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao definir conta padrão:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao definir conta padrão',
      error: error.message
    });
  }
};

/**
 * Testa uma conta de email
 */
const testAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { test_email } = req.body;

    if (!test_email) {
      return res.status(400).json({
        success: false,
        message: 'Email de teste é obrigatório'
      });
    }

    // Buscar configurações da conta
    const result = await query('SELECT * FROM email_accounts WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conta não encontrada'
      });
    }

    const account = result.rows[0];

    // Criar transporter
    const transporter = nodemailer.createTransport({
      host: account.smtp_host,
      port: account.smtp_port,
      secure: account.smtp_secure,
      auth: {
        user: account.smtp_user,
        pass: account.smtp_pass
      }
    });

    // Enviar email de teste
    await transporter.sendMail({
      from: account.email_from,
      to: test_email,
      subject: '✅ Teste de Configuração de Email - Nett Sistemas',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #4CAF50;">✅ Email de Teste</h1>
          <p>Este é um email de teste da conta: <strong>${account.name}</strong></p>
          <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Provedor:</strong> ${account.provider}</p>
            <p><strong>Servidor SMTP:</strong> ${account.smtp_host}:${account.smtp_port}</p>
            <p><strong>Email:</strong> ${account.email_from}</p>
          </div>
          <p>Se você recebeu este email, a configuração está funcionando corretamente! ✅</p>
          <p>Atenciosamente,<br><strong>Equipe Nett Sistemas</strong></p>
        </div>
      `
    });

    console.log(`✅ Email de teste enviado de ${account.name} para ${test_email}`);

    res.json({
      success: true,
      message: 'Email de teste enviado com sucesso!'
    });
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
  getAllAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
  setAsDefault,
  testAccount
};

