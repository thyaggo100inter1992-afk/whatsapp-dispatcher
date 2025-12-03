-- Adicionar novos templates de email
-- 1. Trial Expirado/Bloqueio
-- 2. PIX Gerado
-- 3. Pagamento Confirmado

INSERT INTO email_templates (event_type, name, description, subject, html_content, variables, is_active) VALUES

-- 1. Trial Expirado (quando o trial de 3 dias acabar)
('trial_expired', 'Trial Expirado', 'Email enviado quando o período de teste de 3 dias expira e a conta é bloqueada', 
'🔒 Seu período de teste expirou',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #D32F2F;">🔒 Seu período de teste expirou</h1>
  <p>Olá, {{nome}}!</p>
  <p>Seu período de teste de <strong>3 dias</strong> no Nett Sistemas chegou ao fim.</p>
  <div style="background: #ffebee; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F44336;">
    <p><strong>📅 Trial iniciado em:</strong> {{data_inicio_trial}}</p>
    <p><strong>⏰ Trial expirou em:</strong> {{data_fim_trial}}</p>
    <p><strong>🔒 Status:</strong> Conta bloqueada</p>
  </div>
  <p style="font-size: 16px; color: #D32F2F;"><strong>Seu acesso foi temporariamente bloqueado.</strong></p>
  <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0; font-weight: bold;">✨ Continue usando o Nett Sistemas!</p>
    <p>Escolha um plano e reative seu acesso imediatamente:</p>
    <ul style="margin: 10px 0;">
      <li>📦 <strong>Básico:</strong> R$ {{valor_basico}}/mês</li>
      <li>🚀 <strong>Profissional:</strong> R$ {{valor_profissional}}/mês</li>
      <li>💎 <strong>Empresarial:</strong> R$ {{valor_empresarial}}/mês</li>
    </ul>
  </div>
  <p><a href="{{url_planos}}" style="background: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">ESCOLHER PLANO E REATIVAR</a></p>
  <p style="font-size: 12px; color: #666; margin-top: 30px;">⚠️ <strong>Atenção:</strong> Após {{dias_para_exclusao}} dias sem renovação, todos os seus dados serão deletados permanentemente.</p>
  <p>Atenciosamente,<br><strong>Equipe Nett Sistemas</strong></p>
</div>',
'["nome", "email", "data_inicio_trial", "data_fim_trial", "valor_basico", "valor_profissional", "valor_empresarial", "url_planos", "dias_para_exclusao"]'::jsonb,
TRUE),

-- 2. PIX Gerado (quando gerar um PIX para pagamento)
('pix_generated', 'PIX Gerado', 'Email enviado quando um PIX é gerado para pagamento', 
'💰 Seu PIX foi gerado - Nett Sistemas',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #00C853;">💰 PIX Gerado com Sucesso!</h1>
  <p>Olá, {{nome}}!</p>
  <p>Seu PIX para pagamento do plano <strong>{{plano}}</strong> foi gerado com sucesso!</p>
  
  <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #4CAF50;">
    <p style="margin-top: 0; font-weight: bold; font-size: 18px;">📋 Detalhes do Pagamento:</p>
    <p><strong>💰 Valor:</strong> R$ {{valor}}</p>
    <p><strong>📦 Plano:</strong> {{plano}}</p>
    <p><strong>📅 Vencimento:</strong> {{data_vencimento}}</p>
    <p><strong>🔢 ID do Pagamento:</strong> {{payment_id}}</p>
  </div>

  <div style="background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #4CAF50; text-align: center;">
    <p style="margin-top: 0; font-weight: bold; font-size: 16px;">📱 QR Code PIX:</p>
    <img src="{{qr_code_url}}" alt="QR Code PIX" style="max-width: 250px; margin: 10px auto; display: block;" />
    <p style="font-size: 12px; color: #666;">Escaneie com o app do seu banco</p>
  </div>

  <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
    <p style="margin-top: 0; font-weight: bold;">🔑 Chave PIX Copia e Cola:</p>
    <div style="background: #fff; padding: 10px; border-radius: 4px; border: 1px dashed #999; word-break: break-all; font-family: monospace; font-size: 12px; margin: 10px 0;">
      {{pix_code}}
    </div>
    <p style="font-size: 12px; color: #666; margin-bottom: 0;">Copie o código acima e cole no app do seu banco</p>
  </div>

  <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FF9800;">
    <p style="margin: 0; font-weight: bold;">⏰ Importante:</p>
    <ul style="margin: 10px 0;">
      <li>O PIX expira em <strong>{{horas_expiracao}} horas</strong></li>
      <li>Após o pagamento, a confirmação é <strong>automática</strong></li>
      <li>Seu acesso será liberado em até <strong>5 minutos</strong></li>
    </ul>
  </div>

  <p style="text-align: center; margin: 30px 0;">
    <a href="{{url_sistema}}" style="background: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">ACESSAR PAINEL</a>
  </p>

  <p>Atenciosamente,<br><strong>Equipe Nett Sistemas</strong></p>
</div>',
'["nome", "email", "plano", "valor", "data_vencimento", "payment_id", "qr_code_url", "pix_code", "horas_expiracao", "url_sistema"]'::jsonb,
TRUE),

-- 3. Pagamento Confirmado (quando o pagamento for confirmado)
('payment_confirmed', 'Pagamento Confirmado', 'Email enviado quando o pagamento é confirmado', 
'✅ Pagamento Confirmado - Acesso Liberado!',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
    <h1 style="color: white; margin: 0; font-size: 32px;">✅ Pagamento Confirmado!</h1>
    <p style="color: white; font-size: 18px; margin: 10px 0 0 0;">Seu acesso foi liberado</p>
  </div>

  <p style="font-size: 18px;">Olá, <strong>{{nome}}</strong>!</p>
  <p style="font-size: 16px;">Recebemos a confirmação do seu pagamento! 🎉</p>

  <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50;">
    <p style="margin-top: 0; font-weight: bold; font-size: 18px;">📋 Detalhes do Pagamento:</p>
    <p><strong>💰 Valor Pago:</strong> R$ {{valor}}</p>
    <p><strong>📦 Plano:</strong> {{plano}}</p>
    <p><strong>📅 Data do Pagamento:</strong> {{data_pagamento}}</p>
    <p><strong>🔢 ID da Transação:</strong> {{transaction_id}}</p>
    <p><strong>📅 Próximo Vencimento:</strong> {{proximo_vencimento}}</p>
  </div>

  <div style="background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #4CAF50;">
    <p style="margin-top: 0; font-weight: bold; font-size: 16px;">✨ Seu acesso está ativo!</p>
    <ul style="margin: 10px 0;">
      <li>✅ Todas as funcionalidades liberadas</li>
      <li>✅ Sem restrições de uso</li>
      <li>✅ Suporte técnico disponível</li>
      <li>✅ Válido até {{proximo_vencimento}}</li>
    </ul>
  </div>

  <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196F3;">
    <p style="margin: 0; font-weight: bold;">💡 Dica:</p>
    <p style="margin: 10px 0 0 0;">Configure a renovação automática para não perder acesso no próximo mês!</p>
  </div>

  <p style="text-align: center; margin: 30px 0;">
    <a href="{{url_sistema}}" style="background: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold; font-size: 16px;">ACESSAR SISTEMA AGORA</a>
  </p>

  <p style="font-size: 12px; color: #666; text-align: center; margin-top: 30px;">
    📧 Dúvidas? Entre em contato com nosso suporte<br>
    🎯 Aproveite ao máximo sua assinatura!
  </p>

  <p>Atenciosamente,<br><strong>Equipe Nett Sistemas</strong></p>
</div>',
'["nome", "email", "plano", "valor", "data_pagamento", "transaction_id", "proximo_vencimento", "url_sistema"]'::jsonb,
TRUE)

ON CONFLICT (event_type) DO NOTHING;

