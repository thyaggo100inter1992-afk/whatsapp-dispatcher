/**
 * Templates padrão de email
 * Usado para restaurar templates ao estado original
 */

interface EmailTemplate {
  subject: string;
  html_content: string;
}

interface DefaultTemplates {
  [key: string]: EmailTemplate;
}

export const DEFAULT_TEMPLATES: DefaultTemplates = {
  welcome: {
    subject: '🎉 Bem-vindo ao Nett Sistemas!',
    html_content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #4CAF50;">🎉 Bem-vindo ao Nett Sistemas!</h1>
  <p>Olá, <strong>{{nome}}</strong>!</p>
  <p>É um prazer ter você conosco! Sua conta foi criada com sucesso.</p>
  
  <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0;"><strong>📧 Email:</strong> {{email}}</p>
    <p style="margin: 10px 0 0 0;"><strong>🎁 Período de teste:</strong> {{dias_teste}} dias</p>
    <p style="margin: 10px 0 0 0;"><strong>📅 Válido até:</strong> {{data_fim_teste}}</p>
  </div>

  <p style="text-align: center; margin: 30px 0;">
    <a href="{{url_sistema}}" style="background: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">ACESSAR PLATAFORMA</a>
  </p>

  <p>Atenciosamente,<br><strong>Equipe Nett Sistemas</strong></p>
</div>`
  },

  trial_start: {
    subject: '🚀 Seu período de teste começou!',
    html_content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #2196F3;">🚀 Seu período de teste começou!</h1>
  <p>Olá, <strong>{{nome}}</strong>!</p>
  <p>Seu período de teste de <strong>{{dias_teste}} dias</strong> está ativo!</p>
  
  <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0;"><strong>📅 Início:</strong> {{data_inicio}}</p>
    <p style="margin: 10px 0 0 0;"><strong>⏰ Término:</strong> {{data_fim_teste}}</p>
  </div>

  <p>Aproveite ao máximo todos os recursos da plataforma!</p>

  <p style="text-align: center; margin: 30px 0;">
    <a href="{{url_sistema}}" style="background: #2196F3; color: white; padding: 15px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">COMEÇAR AGORA</a>
  </p>

  <p>Atenciosamente,<br><strong>Equipe Nett Sistemas</strong></p>
</div>`
  },

  trial_expired: {
    subject: '⚠️ Seu período de teste expirou',
    html_content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #D32F2F;">⚠️ Seu período de teste expirou</h1>
  <p>Olá, <strong>{{nome}}</strong>!</p>
  <p>Seu período de teste de <strong>3 dias</strong> no Nett Sistemas chegou ao fim.</p>
  
  <div style="background: #ffebee; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #D32F2F;">
    <p style="margin-top: 0; font-weight: bold;">📅 Trial iniciado em:</p> {{data_inicio_trial}}
    <p style="margin-top: 0; font-weight: bold;">⏰ Trial expirou em:</p> {{data_fim_trial}}
    <p style="margin-top: 0; font-weight: bold;">🔒 Status:</p> Conta bloqueada
  </div>

  <p style="font-size: 16px; color: #D32F2F;"><strong>Seu acesso foi temporariamente bloqueado.</strong></p>

  <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FF9800;">
    <p style="margin: 0; font-weight: bold;">✨ Continue usando o Nett Sistemas!</p>
    <p>Escolha um plano e reative seu acesso imediatamente:</p>
    <ul style="margin: 10px 0;">
      <li>💎 <strong>Básico:</strong> R$ {{valor_basico}}/mês</li>
      <li>🚀 <strong>Profissional:</strong> R$ {{valor_profissional}}/mês</li>
      <li>💼 <strong>Empresarial:</strong> R$ {{valor_empresarial}}/mês</li>
      <li>🔥 <strong>Mega Top:</strong> R$ {{valor_megatop}}/mês</li>
    </ul>
  </div>

  <p style="text-align: center; margin: 30px 0;">
    <a href="{{url_planos}}" style="background: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">ESCOLHER PLANO E REATIVAR</a>
  </p>

  <div style="background: #ffebee; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #D32F2F;">
    <p style="margin: 0; font-weight: bold;">⚠️ Atenção:</p>
    <p>Após {{dias_para_exclusao}} dias sem renovação, todos os seus dados serão deletados permanentemente.</p>
  </div>

  <p>Atenciosamente,<br><strong>Equipe Nett Sistemas</strong></p>
</div>`
  },

  expiry_3days: {
    subject: '⚠️ Seu plano vence em 3 dias',
    html_content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #FF9800;">⚠️ Seu plano vence em 3 dias</h1>
  <p>Olá, <strong>{{nome}}</strong>!</p>
  <p>Seu plano <strong>{{plano}}</strong> está próximo do vencimento.</p>
  
  <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0;"><strong>📅 Vencimento:</strong> {{data_vencimento}}</p>
    <p style="margin: 10px 0 0 0;"><strong>💰 Valor:</strong> R$ {{valor}}</p>
  </div>

  <p>Renove agora para não perder o acesso!</p>

  <p style="text-align: center; margin: 30px 0;">
    <a href="{{url_renovacao}}" style="background: #FF9800; color: white; padding: 15px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">RENOVAR AGORA</a>
  </p>

  <p>Atenciosamente,<br><strong>Equipe Nett Sistemas</strong></p>
</div>`
  },

  expiry_2days: {
    subject: '🚨 Seu plano vence em 2 dias',
    html_content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #FF5722;">🚨 Seu plano vence em 2 dias</h1>
  <p>Olá, <strong>{{nome}}</strong>!</p>
  <p>⚠️ <strong>URGENTE:</strong> Seu plano <strong>{{plano}}</strong> vence em apenas 2 dias!</p>
  
  <div style="background: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #FF5722;">
    <p style="margin: 0;"><strong>📅 Vencimento:</strong> {{data_vencimento}}</p>
    <p style="margin: 10px 0 0 0;"><strong>💰 Valor:</strong> R$ {{valor}}</p>
  </div>

  <p style="font-size: 18px; color: #D32F2F;"><strong>Não perca o acesso à plataforma!</strong></p>

  <p style="text-align: center; margin: 30px 0;">
    <a href="{{url_renovacao}}" style="background: #FF5722; color: white; padding: 15px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">RENOVAR AGORA</a>
  </p>

  <p>Atenciosamente,<br><strong>Equipe Nett Sistemas</strong></p>
</div>`
  },

  expiry_1day: {
    subject: '🔴 URGENTE: Seu plano vence AMANHÃ',
    html_content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #D32F2F;">🔴 URGENTE: Seu plano vence AMANHÃ</h1>
  <p>Olá, <strong>{{nome}}</strong>!</p>
  <p>🚨 <strong>ÚLTIMA CHANCE:</strong> Seu plano <strong>{{plano}}</strong> vence amanhã!</p>
  
  <div style="background: #ffcdd2; padding: 20px; border-radius: 8px; margin: 20px 0; border: 3px solid #D32F2F;">
    <p style="margin: 0; font-size: 18px; font-weight: bold; color: #D32F2F;">⏰ VENCE AMANHÃ</p>
    <p style="margin: 10px 0 0 0;"><strong>📅 Data:</strong> {{data_vencimento}}</p>
    <p style="margin: 10px 0 0 0;"><strong>💰 Valor:</strong> R$ {{valor}}</p>
  </div>

  <p style="font-size: 18px; color: #D32F2F;"><strong>Renove AGORA para não perder o acesso!</strong></p>

  <p style="text-align: center; margin: 30px 0;">
    <a href="{{url_renovacao}}" style="background: #D32F2F; color: white; padding: 20px 40px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold; font-size: 18px;">RENOVAR AGORA</a>
  </p>

  <p>Atenciosamente,<br><strong>Equipe Nett Sistemas</strong></p>
</div>`
  },

  blocked: {
    subject: '🔒 Acesso Bloqueado - Pagamento Pendente',
    html_content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #D32F2F;">🔒 Acesso Bloqueado</h1>
  <p>Olá, <strong>{{nome}}</strong>!</p>
  <p>Seu acesso foi bloqueado por falta de pagamento.</p>
  
  <div style="background: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #D32F2F;">
    <p style="margin: 0;"><strong>📅 Vencimento:</strong> {{data_vencimento}}</p>
    <p style="margin: 10px 0 0 0;"><strong>🔒 Status:</strong> Bloqueado</p>
    <p style="margin: 10px 0 0 0;"><strong>⏰ Carência:</strong> {{dias_carencia}} dias</p>
    <p style="margin: 10px 0 0 0;"><strong>🗑️ Exclusão em:</strong> {{data_exclusao}}</p>
  </div>

  <p style="font-size: 16px; color: #D32F2F;"><strong>Regularize seu pagamento para reativar o acesso!</strong></p>

  <p style="text-align: center; margin: 30px 0;">
    <a href="{{url_renovacao}}" style="background: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">PAGAR AGORA</a>
  </p>

  <p>Atenciosamente,<br><strong>Equipe Nett Sistemas</strong></p>
</div>`
  },

  deletion_warning: {
    subject: '🗑️ Aviso de Exclusão Iminente',
    html_content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #D32F2F;">🗑️ Aviso de Exclusão Iminente</h1>
  <p>Olá, <strong>{{nome}}</strong>!</p>
  <p>⚠️ Sua conta será <strong>DELETADA PERMANENTEMENTE</strong> em {{dias_restantes}} dias!</p>
  
  <div style="background: #ffcdd2; padding: 20px; border-radius: 8px; margin: 20px 0; border: 3px solid #D32F2F;">
    <p style="margin: 0; font-size: 18px; font-weight: bold; color: #D32F2F;">⚠️ ÚLTIMA CHANCE</p>
    <p style="margin: 10px 0 0 0;"><strong>🗑️ Exclusão em:</strong> {{data_exclusao}}</p>
    <p style="margin: 10px 0 0 0;"><strong>⏰ Dias restantes:</strong> {{dias_restantes}}</p>
  </div>

  <p style="font-size: 16px; color: #D32F2F;"><strong>Após a exclusão, todos os seus dados serão deletados permanentemente!</strong></p>

  <p style="text-align: center; margin: 30px 0;">
    <a href="{{url_renovacao}}" style="background: #D32F2F; color: white; padding: 20px 40px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold; font-size: 18px;">REATIVAR CONTA AGORA</a>
  </p>

  <p>Atenciosamente,<br><strong>Equipe Nett Sistemas</strong></p>
</div>`
  },

  pix_generated: {
    subject: '💰 PIX Gerado com Sucesso!',
    html_content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
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
</div>`
  },

  payment_confirmed: {
    subject: '✅ Pagamento Confirmado!',
    html_content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #4CAF50;">✅ Pagamento Confirmado!</h1>
  <p>Olá, {{nome}}!</p>
  <p>🎉 Seu pagamento foi confirmado com sucesso!</p>
  
  <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #4CAF50;">
    <p style="margin-top: 0; font-weight: bold; font-size: 18px;">📋 Detalhes do Pagamento:</p>
    <p><strong>💰 Valor:</strong> R$ {{valor}}</p>
    <p><strong>📦 Plano:</strong> {{plano}}</p>
    <p><strong>📅 Próximo vencimento:</strong> {{data_vencimento}}</p>
    <p><strong>🔢 ID do Pagamento:</strong> {{payment_id}}</p>
  </div>

  <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196F3;">
    <p style="margin: 0; font-weight: bold;">✨ Seu acesso está ativo!</p>
    <p style="margin: 10px 0 0 0;">Você já pode utilizar todos os recursos da plataforma.</p>
  </div>

  <p style="text-align: center; margin: 30px 0;">
    <a href="{{url_sistema}}" style="background: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">ACESSAR PLATAFORMA</a>
  </p>

  <p>Obrigado por escolher o Nett Sistemas!</p>
  <p>Atenciosamente,<br><strong>Equipe Nett Sistemas</strong></p>
</div>`
  }
};

