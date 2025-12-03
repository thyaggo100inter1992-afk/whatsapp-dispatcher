# 📧 CONFIGURAR NOTIFICAÇÕES POR EMAIL

## ✅ O QUE FOI IMPLEMENTADO:

1. ✅ **Período de carência:** 7 dias → **20 dias**
2. ✅ **Frequência dos workers:** 6 horas → **2 horas**
3. ✅ **Notificações automáticas:**
   - 📧 **3 dias antes** do vencimento
   - 📧 **2 dias antes** do vencimento
   - 📧 **1 dia antes** do vencimento
   - 📧 **No bloqueio** (quando o plano vence)
4. ✅ **Serviço de Email** com suporte a:
   - SMTP (Nodemailer)
   - SendGrid
   - AWS SES
   - Mailgun

---

## 🔧 COMO CONFIGURAR O EMAIL:

### **Opção 1: SMTP (Recomendado - Funciona com Gmail, Outlook, etc)**

Adicione estas variáveis no arquivo `.env` do backend:

```bash
# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-de-app
EMAIL_FROM=noreply@sistemasnettsistemas.com.br
```

**Para Gmail:**
1. Acesse: https://myaccount.google.com/apppasswords
2. Crie uma "Senha de app"
3. Use essa senha no `SMTP_PASS`

**Para Outlook/Hotmail:**
```bash
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=seu-email@outlook.com
SMTP_PASS=sua-senha
```

**Para outros provedores:**
- **Hostinger:** `smtp.hostinger.com` (porta 587)
- **Locaweb:** `smtp.locaweb.com.br` (porta 587)
- **UOL Host:** `smtp.uol.com.br` (porta 587)

---

### **Opção 2: SendGrid**

```bash
# Email Configuration (SendGrid)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@sistemasnettsistemas.com.br
```

1. Crie conta em: https://sendgrid.com/
2. Gere uma API Key
3. Instale: `npm install @sendgrid/mail`

---

### **Opção 3: AWS SES**

```bash
# Email Configuration (AWS SES)
AWS_SES_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
EMAIL_FROM=noreply@sistemasnettsistemas.com.br
```

1. Configure SES na AWS Console
2. Verifique o domínio ou email
3. Instale: `npm install aws-sdk`

---

### **Opção 4: Mailgun**

```bash
# Email Configuration (Mailgun)
MAILGUN_API_KEY=key-xxxxxxxxxxxxxxxxxxxxxxxxxx
MAILGUN_DOMAIN=mg.sistemasnettsistemas.com.br
EMAIL_FROM=noreply@sistemasnettsistemas.com.br
```

1. Crie conta em: https://www.mailgun.com/
2. Configure seu domínio
3. Instale: `npm install mailgun-js`

---

## 🚀 APLICAR CONFIGURAÇÃO NO SERVIDOR:

### **1. Editar .env no servidor:**

```bash
ssh root@72.60.141.244
cd /root/whatsapp-dispatcher/backend
nano .env
```

Adicione as variáveis de email (escolha uma das opções acima).

### **2. Reiniciar o servidor:**

```bash
pm2 restart whatsapp-backend
```

### **3. Verificar se funcionou:**

```bash
pm2 logs whatsapp-backend | grep -i "email service"
```

Você deve ver:
```
✅ Email Service configurado: SMTP (smtp.gmail.com)
```

---

## 📊 COMO FUNCIONA:

### **Worker de Payment Renewal** (executa a cada 2 horas):

1. **Verifica vencimentos próximos:**
   - Busca tenants que vencem em 3, 2 ou 1 dias
   - Envia email de notificação
   - Registra na tabela `payment_notifications` (evita duplicatas)

2. **Bloqueia tenants com pagamento vencido:**
   - Busca tenants com `proximo_vencimento < NOW()`
   - Bloqueia (`status = 'blocked'`)
   - Define `will_be_deleted_at = NOW() + 20 dias`
   - Envia email de bloqueio

3. **Processa downgrades agendados**

### **Worker de Trial Cleanup** (executa a cada 2 horas):

1. **Bloqueia trials expirados:**
   - Busca tenants com `trial_ends_at <= NOW()`
   - Bloqueia com 20 dias de carência

2. **Deleta tenants bloqueados há 20 dias:**
   - Busca tenants com `will_be_deleted_at <= NOW()`
   - Deleta TUDO permanentemente

---

## 📧 TEMPLATES DE EMAIL:

### **1. Notificação de Vencimento (3, 2 ou 1 dias antes):**

**Assunto:** `⚠️ Seu plano vence em X dias`

**Conteúdo:**
- Nome do tenant
- Plano atual
- Data de vencimento
- Valor da renovação
- Botão "Renovar Agora"
- Link: `https://sistemasnettsistemas.com.br/gestao`

---

### **2. Notificação de Bloqueio:**

**Assunto:** `🔒 Seu acesso foi bloqueado - Pagamento vencido`

**Conteúdo:**
- Aviso de bloqueio
- Plano e data de vencimento
- **20 dias** para renovar
- Lista do que será deletado
- Botão "Renovar Agora e Reativar Acesso"
- Link: `https://sistemasnettsistemas.com.br/gestao`

---

## 🔍 VERIFICAR NOTIFICAÇÕES ENVIADAS:

```sql
-- Ver notificações enviadas
SELECT 
  pn.id,
  t.nome,
  t.email,
  pn.notification_type,
  pn.days_before,
  pn.sent_at
FROM payment_notifications pn
JOIN tenants t ON t.id = pn.tenant_id
ORDER BY pn.sent_at DESC
LIMIT 20;
```

---

## ⚠️ IMPORTANTE:

### **Se o Email Service NÃO estiver configurado:**
- ✅ Workers continuam funcionando normalmente
- ✅ Bloqueios e deleções acontecem automaticamente
- ⚠️ Emails NÃO são enviados (apenas logados no console)

**Mensagem no log:**
```
⚠️  Nenhum provedor de email configurado
   Configure SMTP_HOST, SMTP_USER e SMTP_PASS no .env
⚠️  Email não enviado (provedor não configurado)
   Para: cliente@email.com
   Assunto: ⚠️ Seu plano vence em 3 dias
```

---

## 🧪 TESTAR ENVIO DE EMAIL:

### **Criar script de teste:**

```bash
cd /root/whatsapp-dispatcher/backend
cat > test-email.js << 'EOF'
const emailService = require('./dist/services/email.service').default;

async function test() {
  console.log('🧪 Testando envio de email...\n');
  console.log('Provedor:', emailService.getProvider());
  console.log('Configurado:', emailService.isReady());
  
  if (!emailService.isReady()) {
    console.log('\n❌ Email service não configurado!');
    console.log('Configure SMTP_HOST, SMTP_USER e SMTP_PASS no .env');
    process.exit(1);
  }
  
  const result = await emailService.sendEmail(
    'seu-email@gmail.com',
    '🧪 Teste de Email - Nett Sistemas',
    '<h1>Teste de Email</h1><p>Se você recebeu este email, o sistema está funcionando! ✅</p>'
  );
  
  if (result) {
    console.log('\n✅ Email enviado com sucesso!');
    console.log('Verifique sua caixa de entrada.');
  } else {
    console.log('\n❌ Erro ao enviar email.');
  }
  
  process.exit(0);
}

test();
EOF

node test-email.js
```

---

## 📝 RESUMO DAS MUDANÇAS:

| Item | Antes | Depois |
|------|-------|--------|
| **Período de carência** | 7 dias | **20 dias** |
| **Frequência dos workers** | 6 horas | **2 horas** |
| **Notificações de vencimento** | Nenhuma | **3, 2 e 1 dias antes** |
| **Email de bloqueio** | Não | **Sim** |
| **Provedor de email** | Nenhum | **SMTP/SendGrid/AWS/Mailgun** |

---

## ✅ STATUS ATUAL:

- ✅ **Código implementado e deployado**
- ✅ **Workers rodando a cada 2 horas**
- ✅ **Período de carência de 20 dias**
- ✅ **Tabela `payment_notifications` criada**
- ✅ **Serviço de email pronto**
- ⚠️ **Falta configurar variáveis de email no .env**

---

**Próximo passo:** Configure as variáveis de email no `.env` do servidor para ativar o envio de notificações!

