-- Tabela para templates de email personalizáveis
-- Permite configurar emails para cada evento do sistema

CREATE TABLE IF NOT EXISTS email_templates (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL UNIQUE, -- 'welcome', 'trial_start', 'expiry_3days', 'expiry_2days', 'expiry_1day', 'blocked', 'deletion_warning'
  name VARCHAR(100) NOT NULL,
  description TEXT,
  subject VARCHAR(255) NOT NULL,
  html_content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  variables JSONB DEFAULT '[]', -- Lista de variáveis disponíveis: {{nome}}, {{email}}, {{data_vencimento}}, etc
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para busca rápida por tipo de evento
CREATE INDEX IF NOT EXISTS idx_email_templates_event_type ON email_templates(event_type);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active);

-- Inserir templates padrão
INSERT INTO email_templates (event_type, name, description, subject, html_content, variables) VALUES

-- 1. Boas-vindas (Cadastro)
('welcome', 'Boas-vindas', 'Email de boas-vindas quando o cliente se cadastra', 
'🎉 Bem-vindo ao Nett Sistemas!',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #4CAF50;">Bem-vindo, {{nome}}!</h1>
  <p>Obrigado por se cadastrar no <strong>Nett Sistemas</strong>!</p>
  <p>Sua conta foi criada com sucesso e você já pode começar a usar nossa plataforma.</p>
  <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
    <p><strong>📧 Email:</strong> {{email}}</p>
    <p><strong>📦 Plano:</strong> {{plano}}</p>
    <p><strong>🎯 Período de teste:</strong> {{dias_teste}} dias</p>
    <p><strong>📅 Teste válido até:</strong> {{data_fim_teste}}</p>
  </div>
  <p><a href="{{url_sistema}}" style="background: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Acessar Sistema</a></p>
  <p>Atenciosamente,<br><strong>Equipe Nett Sistemas</strong></p>
</div>',
'["nome", "email", "plano", "dias_teste", "data_fim_teste", "url_sistema"]'::jsonb),

-- 2. Início do Trial
('trial_start', 'Início do Período de Teste', 'Email enviado no início do período de teste', 
'🚀 Seu período de teste começou!',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #2196F3;">Período de Teste Iniciado!</h1>
  <p>Olá, {{nome}}!</p>
  <p>Seu período de teste de <strong>{{dias_teste}} dias</strong> começou hoje!</p>
  <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196F3;">
    <p><strong>📅 Início:</strong> {{data_inicio}}</p>
    <p><strong>⏰ Término:</strong> {{data_fim_teste}}</p>
    <p><strong>⏳ Dias restantes:</strong> {{dias_teste}} dias</p>
  </div>
  <p>Aproveite este período para explorar todos os recursos da plataforma!</p>
  <p><a href="{{url_sistema}}" style="background: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Começar Agora</a></p>
  <p>Atenciosamente,<br><strong>Equipe Nett Sistemas</strong></p>
</div>',
'["nome", "email", "dias_teste", "data_inicio", "data_fim_teste", "url_sistema"]'::jsonb),

-- 3. 3 dias antes do vencimento
('expiry_3days', 'Vencimento em 3 Dias', 'Notificação 3 dias antes do vencimento', 
'⚠️ Seu plano vence em 3 dias',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #FF9800;">⚠️ Seu plano vence em 3 dias!</h1>
  <p>Olá, {{nome}}!</p>
  <p>Seu plano <strong>{{plano}}</strong> vence em <strong>3 dias</strong>.</p>
  <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FF9800;">
    <p><strong>📅 Data de vencimento:</strong> {{data_vencimento}}</p>
    <p><strong>💰 Valor:</strong> R$ {{valor}}</p>
  </div>
  <p style="color: #F57C00;"><strong>⚠️ Importante:</strong> Após o vencimento, seu acesso será bloqueado automaticamente.</p>
  <p><a href="{{url_renovacao}}" style="background: #FF9800; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Renovar Agora</a></p>
  <p>Atenciosamente,<br><strong>Equipe Nett Sistemas</strong></p>
</div>',
'["nome", "email", "plano", "data_vencimento", "valor", "url_renovacao"]'::jsonb),

-- 4. 2 dias antes do vencimento
('expiry_2days', 'Vencimento em 2 Dias', 'Notificação 2 dias antes do vencimento', 
'⚠️ Seu plano vence em 2 dias',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #FF9800;">⚠️ Seu plano vence em 2 dias!</h1>
  <p>Olá, {{nome}}!</p>
  <p>Seu plano <strong>{{plano}}</strong> vence em <strong>2 dias</strong>.</p>
  <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FF9800;">
    <p><strong>📅 Data de vencimento:</strong> {{data_vencimento}}</p>
    <p><strong>💰 Valor:</strong> R$ {{valor}}</p>
  </div>
  <p style="color: #F57C00; font-weight: bold;">⚠️ Ação necessária! Renove agora para evitar interrupção do serviço.</p>
  <p><a href="{{url_renovacao}}" style="background: #FF9800; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Renovar Agora</a></p>
  <p>Atenciosamente,<br><strong>Equipe Nett Sistemas</strong></p>
</div>',
'["nome", "email", "plano", "data_vencimento", "valor", "url_renovacao"]'::jsonb),

-- 5. 1 dia antes do vencimento
('expiry_1day', 'Vencimento AMANHÃ', 'Notificação 1 dia antes do vencimento', 
'🚨 Seu plano vence AMANHÃ!',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #F44336;">🚨 Seu plano vence AMANHÃ!</h1>
  <p>Olá, {{nome}}!</p>
  <p>Seu plano <strong>{{plano}}</strong> vence <strong>AMANHÃ</strong>!</p>
  <div style="background: #ffebee; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F44336;">
    <p><strong>📅 Data de vencimento:</strong> {{data_vencimento}}</p>
    <p><strong>💰 Valor:</strong> R$ {{valor}}</p>
    <p style="color: #D32F2F; font-weight: bold;">⏰ Última chance para evitar bloqueio!</p>
  </div>
  <p><a href="{{url_renovacao}}" style="background: #F44336; color: white; padding: 15px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">RENOVAR URGENTE</a></p>
  <p>Atenciosamente,<br><strong>Equipe Nett Sistemas</strong></p>
</div>',
'["nome", "email", "plano", "data_vencimento", "valor", "url_renovacao"]'::jsonb),

-- 6. Bloqueio (plano vencido)
('blocked', 'Acesso Bloqueado', 'Email quando o acesso é bloqueado por falta de pagamento', 
'🔒 Seu acesso foi bloqueado',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #D32F2F;">🔒 Seu acesso foi bloqueado</h1>
  <p>Olá, {{nome}}!</p>
  <p style="font-size: 16px; color: #D32F2F;"><strong>Seu acesso ao sistema foi bloqueado devido ao vencimento do plano.</strong></p>
  <div style="background: #ffebee; padding: 15px; border-radius: 8px; margin: 20px 0; border: 2px solid #F44336;">
    <p><strong>📅 Plano vencido em:</strong> {{data_vencimento}}</p>
    <p><strong>⏰ Prazo para renovação:</strong> {{dias_carencia}} dias</p>
    <p><strong>🗑️ Exclusão em:</strong> {{data_exclusao}}</p>
  </div>
  <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0; font-weight: bold;">⚠️ O que será deletado:</p>
    <ul>
      <li>Todas as campanhas e mensagens</li>
      <li>Todos os contatos e listas</li>
      <li>Todas as conexões WhatsApp</li>
      <li>Todo o histórico</li>
    </ul>
  </div>
  <p><a href="{{url_renovacao}}" style="background: #D32F2F; color: white; padding: 15px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">RENOVAR E REATIVAR ACESSO</a></p>
  <p>Atenciosamente,<br><strong>Equipe Nett Sistemas</strong></p>
</div>',
'["nome", "email", "plano", "data_vencimento", "dias_carencia", "data_exclusao", "url_renovacao"]'::jsonb),

-- 7. Aviso de exclusão
('deletion_warning', 'Aviso de Exclusão', 'Email avisando sobre exclusão iminente', 
'🗑️ Sua conta será deletada em breve!',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #D32F2F;">🗑️ ÚLTIMA CHANCE!</h1>
  <p>Olá, {{nome}}!</p>
  <p style="font-size: 18px; color: #D32F2F; font-weight: bold;">Sua conta será DELETADA PERMANENTEMENTE em {{dias_restantes}} dias!</p>
  <div style="background: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0; border: 3px solid #D32F2F;">
    <p style="font-size: 16px; font-weight: bold; margin-top: 0;">⚠️ ALERTA CRÍTICO</p>
    <p><strong>🗑️ Data de exclusão:</strong> {{data_exclusao}}</p>
    <p><strong>⏰ Tempo restante:</strong> {{dias_restantes}} dias</p>
    <p style="color: #D32F2F; margin-bottom: 0;"><strong>Todos os seus dados serão deletados permanentemente!</strong></p>
  </div>
  <p>Renove agora para:</p>
  <ul>
    <li>✅ Reativar seu acesso imediatamente</li>
    <li>✅ Manter todos os seus dados</li>
    <li>✅ Continuar usando normalmente</li>
  </ul>
  <p><a href="{{url_renovacao}}" style="background: #D32F2F; color: white; padding: 15px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold; font-size: 16px;">RENOVAR AGORA E SALVAR DADOS</a></p>
  <p>Atenciosamente,<br><strong>Equipe Nett Sistemas</strong></p>
</div>',
'["nome", "email", "dias_restantes", "data_exclusao", "url_renovacao"]'::jsonb)

ON CONFLICT (event_type) DO NOTHING;

COMMENT ON TABLE email_templates IS 'Templates de email personalizáveis para cada evento do sistema';
COMMENT ON COLUMN email_templates.event_type IS 'Tipo do evento: welcome, trial_start, expiry_3days, expiry_2days, expiry_1day, blocked, deletion_warning';
COMMENT ON COLUMN email_templates.variables IS 'Lista de variáveis disponíveis para substituição no template';

