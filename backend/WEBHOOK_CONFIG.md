# 📡 Configuração de Webhooks do WhatsApp Business

Este guia explica como configurar os Webhooks para receber atualizações de status das mensagens (entregue, lida, falhou).

---

## 🎯 O que são Webhooks?

Webhooks são notificações que o WhatsApp envia para seu servidor quando algo acontece com uma mensagem:

- ✅ **delivered** - Mensagem foi entregue no WhatsApp do destinatário
- ✅ **read** - Mensagem foi lida (usuário abriu)
- ❌ **failed** - Mensagem falhou (número bloqueado, inválido, etc.)

---

## 🔧 Passo 1: Configurar Token no Backend

### 1.1 Editar arquivo `.env`

Adicione esta linha no arquivo `backend/.env`:

```env
WEBHOOK_VERIFY_TOKEN=seu_token_secreto_mude_para_algo_complexo
```

**⚠️ IMPORTANTE:** 
- Escolha um token **aleatório e complexo** (ex: `meu_webhook_token_12345_abc`)
- **NUNCA compartilhe** este token publicamente
- Use o **MESMO token** nas configurações do Facebook

### 1.2 Reiniciar o Backend

```bash
cd backend
npm run dev
```

---

## 🌐 Passo 2: Expor o Servidor Publicamente

O WhatsApp precisa acessar seu servidor pela internet. Você tem 3 opções:

### Opção A: ngrok (Recomendado para testes) 🚀

1. Baixe o ngrok: https://ngrok.com/download
2. Execute:
```bash
ngrok http 3001
```
3. Copie a URL gerada (ex: `https://abc123.ngrok.io`)
4. Sua URL do webhook será: `https://abc123.ngrok.io/api/webhook`

### Opção B: Servidor em Produção (Deploy) 🖥️

1. Faça deploy em um servidor (AWS, DigitalOcean, Heroku, etc.)
2. Use um domínio próprio (ex: `https://api.seusite.com`)
3. Sua URL do webhook será: `https://api.seusite.com/api/webhook`

### Opção C: LocalTunnel (Alternativa gratuita) 🔓

```bash
npm install -g localtunnel
lt --port 3001
```

---

## 🔔 Passo 3: Configurar no Facebook Business

### 3.1 Acessar o Meta App Dashboard

1. Acesse: https://developers.facebook.com/apps
2. Selecione seu App do WhatsApp Business
3. No menu lateral, clique em **"WhatsApp" → "Configuration"**

### 3.2 Configurar o Webhook

1. Na seção **"Webhooks"**, clique em **"Edit"** ou **"Configure Webhook"**
2. Preencha:
   - **Callback URL**: `https://sua-url-publica/api/webhook`
     - Exemplo: `https://abc123.ngrok.io/api/webhook`
   - **Verify Token**: O mesmo token que você colocou no `.env`
     - Exemplo: `meu_webhook_token_12345_abc`
3. Clique em **"Verify and Save"**

### 3.3 Subscrever aos Eventos

Na lista **"Webhook Fields"**, marque:
- ✅ **messages** (OBRIGATÓRIO)

Clique em **"Subscribe"**

---

## ✅ Passo 4: Testar

### 4.1 Verificar Logs do Backend

No terminal do backend, você deve ver:

```
🔔 Webhook Verification Request: { mode: 'subscribe', token: '...' }
✅ Webhook verificado com sucesso!
```

### 4.2 Enviar uma Mensagem de Teste

1. Crie uma campanha ou envie uma mensagem via "Envio Imediato"
2. Aguarde alguns segundos
3. Verifique os logs do backend:

```
🔔 ===== WEBHOOK RECEBIDO =====
📨 Status Update:
   Message ID: wamid.HBgNNTU2...
   Novo Status: delivered
   Para: 556291785664
   ✅ Status atualizado: delivered
✅ Webhook processado com sucesso!
```

### 4.3 Verificar no Banco de Dados

Execute esta query no PostgreSQL:

```sql
SELECT 
    id,
    phone_number,
    template_name,
    status,
    sent_at,
    delivered_at,
    read_at,
    failed_at
FROM messages
WHERE campaign_id = SEU_CAMPAIGN_ID
ORDER BY id DESC
LIMIT 10;
```

Você deve ver:
- `status` atualizado para `delivered`, `read` ou `failed`
- `delivered_at`, `read_at` ou `failed_at` preenchidos

---

## 🐛 Troubleshooting

### Erro: "Webhook verification failed"

**Causa:** O token no Facebook não é o mesmo do `.env`

**Solução:**
1. Verifique se o token no `.env` está correto
2. Reinicie o backend
3. Tente novamente

### Erro: "Invalid webhook callback URL"

**Causa:** O Facebook não consegue acessar sua URL

**Solução:**
1. Certifique-se que o ngrok/localtunnel está rodando
2. A URL deve ser **HTTPS** (não HTTP)
3. Teste manualmente: `curl https://sua-url/api/webhook`

### Não está recebendo webhooks

**Possíveis causas:**
1. Você não se inscreveu no campo `messages`
2. O ngrok/localtunnel caiu (gera nova URL a cada reinício)
3. Firewall bloqueando

**Solução:**
1. Verifique se está inscrito em `messages`
2. Sempre que reiniciar ngrok, **reconfigure a URL no Facebook**
3. Teste: `curl -X POST https://sua-url/api/webhook`

---

## 📊 Monitorando Status em Tempo Real

### Ver últimas mensagens entregues:

```sql
SELECT 
    phone_number,
    template_name,
    status,
    delivered_at
FROM messages
WHERE status = 'delivered'
ORDER BY delivered_at DESC
LIMIT 20;
```

### Ver mensagens falhadas:

```sql
SELECT 
    phone_number,
    template_name,
    error_message,
    failed_at
FROM messages
WHERE status = 'failed'
ORDER BY failed_at DESC
LIMIT 20;
```

### Ver taxa de leitura:

```sql
SELECT 
    COUNT(*) FILTER (WHERE status = 'sent') as enviadas,
    COUNT(*) FILTER (WHERE status = 'delivered') as entregues,
    COUNT(*) FILTER (WHERE status = 'read') as lidas,
    COUNT(*) FILTER (WHERE status = 'failed') as falhadas,
    ROUND(COUNT(*) FILTER (WHERE status = 'read')::numeric / 
          NULLIF(COUNT(*) FILTER (WHERE status = 'delivered'), 0) * 100, 2) as taxa_leitura
FROM messages
WHERE campaign_id = SEU_CAMPAIGN_ID;
```

---

## 🚀 Próximos Passos

Após configurar os webhooks:

1. ✅ Todas as mensagens terão status REAL atualizado
2. ✅ Você saberá quais foram entregues, lidas ou falharam
3. ✅ Poderá identificar números bloqueados automaticamente
4. ✅ Terá estatísticas precisas de engajamento

---

## 📚 Referências

- [Documentação Oficial do WhatsApp Business API - Webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components)
- [Códigos de Erro do WhatsApp](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes)

