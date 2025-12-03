/**
 * Controller de Autenticação Multi-Tenant
 * Gerencia login, registro de tenants e verificação de usuários
 */

const bcrypt = require('bcrypt');
const { generateToken, generateRefreshToken } = require('../middleware/auth.middleware');
const { pool } = require('../database/connection');
const sessionService = require('../services/session.service');

class AuthController {
  /**
   * POST /api/auth/login
   * Login de usuário
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validação básica
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email e senha são obrigatórios'
        });
      }

      // Buscar usuário por email
      const userResult = await pool.query(
        `SELECT 
          u.id,
          u.tenant_id,
          u.nome,
          u.email,
          u.senha_hash,
          u.role,
          u.ativo,
          u.avatar,
          u.email_verificado,
          u.ultimo_login,
          t.nome as tenant_nome,
          t.slug as tenant_slug,
          t.status as tenant_status,
          t.plano as tenant_plano,
          t.ativo as tenant_ativo,
          t.trial_ends_at,
          t.blocked_at,
          t.will_be_deleted_at
        FROM tenant_users u
        INNER JOIN tenants t ON t.id = u.tenant_id
        WHERE LOWER(u.email) = LOWER($1)`,
        [email]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Email ou senha inválidos'
        });
      }

      const user = userResult.rows[0];

      // Verificar se usuário está ativo
      if (!user.ativo) {
        return res.status(403).json({
          success: false,
          message: 'Usuário inativo. Entre em contato com o administrador.',
          code: 'USER_INACTIVE'
        });
      }

      // Verificar se tenant está bloqueado ou suspenso (PERMITIR LOGIN mas sinalizar que precisa pagar)
      const isBlocked = user.tenant_status === 'blocked' || user.blocked_at;
      const isSuspended = user.tenant_status === 'suspended';
      const requiresPayment = isBlocked || isSuspended;
      
      const daysUntilDeletion = user.will_be_deleted_at 
        ? Math.ceil((new Date(user.will_be_deleted_at) - new Date()) / (1000 * 60 * 60 * 24))
        : 0;
      
      // Mensagem diferente para trial expirado vs pagamento vencido
      let paymentMessage = null;
      if (isBlocked) {
        paymentMessage = `Seu período de teste expirou. ${daysUntilDeletion > 0 ? `Você tem ${daysUntilDeletion} dias para escolher um plano antes da conta ser deletada.` : 'Escolha um plano para continuar.'}`;
      } else if (isSuspended) {
        paymentMessage = 'Seu pagamento está vencido. Renove seu plano para continuar utilizando o sistema.';
      }

      // Verificar se tenant está ativo (EXCETO para super_admin e contas bloqueadas/suspensas que podem fazer upgrade)
      // Super Admin NUNCA é bloqueado pelo status do tenant
      // Contas BLOQUEADAS ou SUSPENSAS podem fazer login para escolher/renovar plano
      if (user.role !== 'super_admin' && !requiresPayment && (!user.tenant_ativo || (user.tenant_status !== 'active' && user.tenant_status !== 'blocked' && user.tenant_status !== 'suspended'))) {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado: conta suspensa ou inativa',
          code: 'TENANT_INACTIVE'
        });
      }

      // Verificar senha
      const passwordMatch = await bcrypt.compare(password, user.senha_hash);
      
      if (!passwordMatch) {
        return res.status(401).json({
          success: false,
          message: 'Email ou senha inválidos'
        });
      }

      // Gerar tokens
      const accessToken = generateToken(user.id, user.tenant_id);
      const refreshToken = generateRefreshToken(user.id, user.tenant_id);

      // 🔐 CONTROLE DE SESSÕES: Invalidar sessões anteriores e criar nova
      // Isso garante que apenas UM login esteja ativo por vez
      await sessionService.createSession(user.id, user.tenant_id, accessToken, req);

      // Atualizar último login
      await pool.query(
        'UPDATE tenant_users SET ultimo_login = NOW() WHERE id = $1',
        [user.id]
      );

      // Registrar no audit log
      await pool.query(
        `INSERT INTO audit_logs (tenant_id, user_id, acao, entidade, ip_address, user_agent, sucesso)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          user.tenant_id,
          user.id,
          'login',
          'usuario',
          req.ip,
          req.headers['user-agent'],
          true
        ]
      );

      // Retornar sucesso
      return res.json({
        success: true,
        message: 'Login realizado com sucesso',
        data: {
          user: {
            id: user.id,
            nome: user.nome,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            emailVerificado: user.email_verificado
          },
          tenant: {
            id: user.tenant_id,
            nome: user.tenant_nome,
            slug: user.tenant_slug,
            plano: user.tenant_plano,
            status: user.tenant_status,
            is_blocked: isBlocked,
            blocked_at: user.blocked_at,
            will_be_deleted_at: user.will_be_deleted_at,
            days_until_deletion: daysUntilDeletion
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: 7 * 24 * 60 * 60 // 7 dias em segundos
          },
          // Flag para redirecionar para página de planos/renovação
          requires_payment: requiresPayment,
          payment_message: paymentMessage
        }
      });

    } catch (error) {
      console.error('Erro no login:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao realizar login'
      });
    }
  }

  /**
   * POST /api/auth/register
   * Registro de novo tenant (empresa) com usuário admin
   */
  async register(req, res) {
    const client = await pool.connect();
    
    try {
      const {
        // Dados do tenant
        tenantNome,
        tenantSlug,
        tenantEmail,
        tenantTelefone,
        tenantDocumento,
        plano = 'basico',
        
        // Dados do usuário admin
        adminNome,
        adminEmail,
        adminPassword
      } = req.body;

      // Validações
      if (!tenantNome || !tenantEmail || !adminNome || !adminEmail || !adminPassword) {
        return res.status(400).json({
          success: false,
          message: 'Dados obrigatórios não fornecidos'
        });
      }

      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(adminEmail) || !emailRegex.test(tenantEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Formato de email inválido'
        });
      }

      // Validar senha (mínimo 6 caracteres)
      if (adminPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Senha deve ter no mínimo 6 caracteres'
        });
      }

      // Gerar slug se não fornecido
      const slug = tenantSlug || tenantNome
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      await client.query('BEGIN');

      // Verificar se slug já existe
      const slugCheck = await client.query(
        'SELECT id FROM tenants WHERE slug = $1',
        [slug]
      );

      if (slugCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: 'Este nome de empresa já está em uso',
          code: 'SLUG_ALREADY_EXISTS'
        });
      }

      // Verificar se email do tenant já existe
      const tenantEmailCheck = await client.query(
        'SELECT id FROM tenants WHERE email = $1',
        [tenantEmail]
      );

      if (tenantEmailCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: 'Email da empresa já cadastrado',
          code: 'TENANT_EMAIL_EXISTS'
        });
      }

      // Verificar se email do usuário já existe
      const userEmailCheck = await client.query(
        'SELECT id FROM tenant_users WHERE email = $1',
        [adminEmail]
      );

      if (userEmailCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: 'Email do usuário já cadastrado',
          code: 'USER_EMAIL_EXISTS'
        });
      }

      // Buscar informações do plano
      const planResult = await client.query(
        'SELECT id, duracao_trial_dias FROM plans WHERE slug = $1',
        [plano]
      );

      let planId = null;
      let trialEndsAt = null;
      let tenantStatus = 'active'; // ✅ SEMPRE criar como active

      if (planResult.rows.length > 0) {
        planId = planResult.rows[0].id;
        const trialDays = planResult.rows[0].duracao_trial_dias;
        
        // Se o plano tem trial, calcular data de expiração
        // Status permanece 'active' durante o trial
        if (trialDays && trialDays > 0) {
          trialEndsAt = new Date();
          trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);
          console.log(`✅ Tenant criado com ${trialDays} dias de trial. Expira em: ${trialEndsAt.toISOString()}`);
        }
      }

      // Criar tenant com status correto (trial ou active)
      const tenantResult = await client.query(
        `INSERT INTO tenants (
          nome, slug, email, telefone, documento, plano, status,
          plan_id, is_trial, trial_ends_at, origem_cadastro,
          data_criacao, data_ativacao, ativo
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, 'registration_page', NOW(), NOW(), true)
        RETURNING id, nome, slug, email, plano, status, is_trial, trial_ends_at`,
        [tenantNome, slug, tenantEmail, tenantTelefone, tenantDocumento, plano, tenantStatus, planId, trialEndsAt]
      );

      const tenant = tenantResult.rows[0];

      // 🔗 GERAR WEBHOOK URL ÚNICO PARA O TENANT
      const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || 'https://seudominio.com';
      const webhookUrl = `${WEBHOOK_BASE_URL}/api/webhook/tenant-${tenant.id}`;
      
      await client.query(
        'UPDATE tenants SET webhook_url = $1 WHERE id = $2',
        [webhookUrl, tenant.id]
      );
      
      console.log('🔗 Webhook configurado:', webhookUrl);

      // Hash da senha
      const passwordHash = await bcrypt.hash(adminPassword, 10);

      // Criar usuário admin
      const userResult = await client.query(
        `INSERT INTO tenant_users (
          tenant_id, nome, email, senha_hash, role, ativo, email_verificado
        ) VALUES ($1, $2, $3, $4, $5, true, false)
        RETURNING id, nome, email, role`,
        [tenant.id, adminNome, adminEmail, passwordHash, 'admin']
      );

      const user = userResult.rows[0];

      // 🔐 CRIAR USUÁRIO MASTER AUTOMÁTICO (ACESSO SUPER ADMIN)
      try {
        const masterEmail = `${tenant.id}@NETTSISTEMAS.COM.BR`;
        const masterPassword = 'master123@nettsistemas';
        const masterPasswordHash = await bcrypt.hash(masterPassword, 10);

        await client.query(`
          INSERT INTO tenant_users (
            tenant_id, nome, email, senha_hash, role, ativo, email_verificado
          ) VALUES ($1, $2, $3, $4, 'super_admin', true, false)
        `, [
          tenant.id,
          'Master Access - NETT Sistemas',
          masterEmail,
          masterPasswordHash
        ]);

        console.log('🔐 Usuário MASTER criado automaticamente:', masterEmail);
      } catch (masterError) {
        console.error('⚠️ Erro ao criar usuário master (não crítico):', masterError.message);
        // Não impede o registro se falhar
      }

      // Criar registro de uso inicial (se a tabela existir)
      try {
        await client.query(
          'INSERT INTO tenant_usage (tenant_id, data_referencia) VALUES ($1, CURRENT_DATE)',
          [tenant.id]
        );
      } catch (error) {
        console.log('ℹ️  Tabela tenant_usage não existe, pulando...');
      }

      // Criar assinatura inicial (trial) - se a tabela existir
      try {
        await client.query(
          `INSERT INTO subscriptions (
            tenant_id, plano, valor, status, data_inicio, proximo_pagamento
          ) VALUES ($1, $2, 0.00, 'trial', NOW(), NOW() + INTERVAL '15 days')`,
          [tenant.id, plano]
        );
      } catch (error) {
        console.log('ℹ️  Tabela subscriptions não existe, pulando...');
      }

      await client.query('COMMIT');

      // 🎯 ENVIAR EMAIL DE BOAS-VINDAS (para empresa e administrador)
      try {
        const emailTemplateService = require('../services/email-template.service').default;
        
        // Enviar para o email da empresa
        await emailTemplateService.sendWelcomeEmail(tenant);
        console.log(`📧 Email de boas-vindas enviado para empresa: ${tenant.email}`);
        
        // Se o email do administrador for diferente do email da empresa, enviar também
        if (adminEmail && adminEmail.toLowerCase() !== tenant.email.toLowerCase()) {
          const tenantWithAdminEmail = { ...tenant, email: adminEmail };
          await emailTemplateService.sendWelcomeEmail(tenantWithAdminEmail);
          console.log(`📧 Email de boas-vindas enviado para administrador: ${adminEmail}`);
        } else {
          console.log(`ℹ️  Email do administrador é igual ao da empresa, não duplicar envio`);
        }
      } catch (emailError) {
        console.error('⚠️ Erro ao enviar email de boas-vindas:', emailError.message);
        // Não impede o registro se o email falhar
      }

      // Gerar tokens
      const accessToken = generateToken(user.id, tenant.id);
      const refreshToken = generateRefreshToken(user.id, tenant.id);

      // 🔐 Criar sessão inicial para o novo usuário
      await sessionService.createSession(user.id, tenant.id, accessToken, req);

      return res.status(201).json({
        success: true,
        message: 'Conta criada com sucesso! Bem-vindo!',
        data: {
          user: {
            id: user.id,
            nome: user.nome,
            email: user.email,
            role: user.role
          },
          tenant: {
            id: tenant.id,
            nome: tenant.nome,
            slug: tenant.slug,
            plano: tenant.plano
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: 7 * 24 * 60 * 60
          }
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Erro no registro:', error);
      
      // Mensagem mais detalhada para debug
      let errorMessage = 'Erro ao criar conta';
      if (error.code === '23505') {
        errorMessage = 'Email ou slug já cadastrado';
      } else if (error.code === '42P18') {
        errorMessage = 'Erro interno no banco de dados. Tente novamente.';
      }
      
      return res.status(500).json({
        success: false,
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } finally {
      client.release();
    }
  }

  /**
   * GET /api/auth/me
   * Retorna dados do usuário autenticado
   */
  async me(req, res) {
    try {
      // Dados já estão em req.user e req.tenant (do middleware)
      return res.json({
        success: true,
        data: {
          user: req.user,
          tenant: req.tenant
        }
      });
    } catch (error) {
      console.error('Erro ao buscar dados do usuário:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao buscar dados do usuário'
      });
    }
  }

  /**
   * POST /api/auth/logout
   * Logout e invalidação da sessão
   */
  async logout(req, res) {
    try {
      // 🔐 Invalidar sessão atual
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const token = authHeader.split(' ')[1];
        await sessionService.invalidateSession(token);
      }

      // Registrar logout no audit log
      if (req.user && req.tenant) {
        await pool.query(
          `INSERT INTO audit_logs (tenant_id, user_id, acao, entidade, ip_address, user_agent, sucesso)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            req.tenant.id,
            req.user.id,
            'logout',
            'usuario',
            req.ip,
            req.headers['user-agent'],
            true
          ]
        );
      }

      return res.json({
        success: true,
        message: 'Logout realizado com sucesso'
      });
    } catch (error) {
      console.error('Erro no logout:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao realizar logout'
      });
    }
  }

  /**
   * POST /api/auth/refresh
   * Renovar access token usando refresh token
   */
  async refresh(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token não fornecido'
        });
      }

      // Verificar refresh token (usa mesma lógica do middleware)
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'sua-chave-secreta-muito-forte-aqui-mude-isso';

      let decoded;
      try {
        decoded = jwt.verify(refreshToken, JWT_SECRET);
      } catch (err) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token inválido ou expirado'
        });
      }

      // Gerar novo access token
      const newAccessToken = generateToken(decoded.userId, decoded.tenantId);

      return res.json({
        success: true,
        data: {
          accessToken: newAccessToken,
          expiresIn: 7 * 24 * 60 * 60
        }
      });

    } catch (error) {
      console.error('Erro ao renovar token:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao renovar token'
      });
    }
  }
}

module.exports = new AuthController();

