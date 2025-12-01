# 📊 DIAGNÓSTICO VISUAL - WEBHOOK DO WHATSAPP

## 🔍 SITUAÇÃO ATUAL

```
┌──────────────────────────────────────────────────────────────┐
│                    FACEBOOK DEVELOPERS                       │
│                  (WhatsApp Business API)                     │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ 1. Tenta verificar webhook
                       │    GET /api/webhook?hub.mode=subscribe
                       │                    &hub.verify_token=???
                       ↓
┌──────────────────────────────────────────────────────────────┐
│                  SEU SERVIDOR (72.60.141.244)                │
│              https://sistemasnettsistemas.com.br             │
├──────────────────────────────────────────────────────────────┤
│  NGINX (Porta 80/443)                                        │
│    ↓ Redireciona para                                        │
│  BACKEND (Porta 3001)                                        │
│    ↓ Processa em                                             │
│  webhook.controller.ts                                       │
│    ↓ Verifica                                                │
│  ❌ process.env.WEBHOOK_VERIFY_TOKEN                         │
│     └─→ undefined (NÃO EXISTE!)                              │
│     └─→ Usa padrão: 'seu_token_secreto_aqui'                 │
│    ↓                                                          │
│  ❌ Token não bate                                            │
│  ❌ Retorna 403 Forbidden                                     │
└──────────────────────────────────────────────────────────────┘
                       │
                       │ 2. Recebe erro 403
                       ↓
┌──────────────────────────────────────────────────────────────┐
│                    FACEBOOK DEVELOPERS                       │
│              ❌ Webhook verification failed                   │
│              ❌ Não ativa o webhook                           │
│              ❌ Não envia eventos de mensagens                │
└──────────────────────────────────────────────────────────────┘
```

---

## ✅ APÓS CONFIGURAR

```
┌──────────────────────────────────────────────────────────────┐
│                    FACEBOOK DEVELOPERS                       │
│                  (WhatsApp Business API)                     │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ 1. Verifica webhook
                       │    GET /api/webhook?hub.mode=subscribe
                       │                    &hub.verify_token=SEU_TOKEN
                       ↓
┌──────────────────────────────────────────────────────────────┐
│                  SEU SERVIDOR (72.60.141.244)                │
│              https://sistemasnettsistemas.com.br             │
├──────────────────────────────────────────────────────────────┤
│  NGINX (Porta 80/443)                                        │
│    ↓ Redireciona para                                        │
│  BACKEND (Porta 3001)                                        │
│    ↓ Processa em                                             │
│  webhook.controller.ts                                       │
│    ↓ Verifica                                                │
│  ✅ process.env.WEBHOOK_VERIFY_TOKEN = 'SEU_TOKEN'           │
│    ↓                                                          │
│  ✅ Token bate!                                               │
│  ✅ Retorna 200 + challenge                                   │
│  ✅ Salva log no banco (webhook_logs)                         │
└──────────────────────────────────────────────────────────────┘
                       │
                       │ 2. Recebe 200 OK
                       ↓
┌──────────────────────────────────────────────────────────────┐
│                    FACEBOOK DEVELOPERS                       │
│              ✅ Webhook verified successfully!                │
│              ✅ Ativa o webhook                               │
│              ✅ Começa a enviar eventos                       │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ 3. Envia eventos de mensagens
                       │    POST /api/webhook
                       │    { "entry": [...], "object": "whatsapp_business_account" }
                       ↓
┌──────────────────────────────────────────────────────────────┐
│                  SEU SERVIDOR (72.60.141.244)                │
├──────────────────────────────────────────────────────────────┤
│  BACKEND (Porta 3001)                                        │
│    ↓ Processa em                                             │
│  webhook.controller.ts → receive()                           │
│    ↓                                                          │
│  ✅ Extrai status da mensagem (delivered/read/failed)        │
│  ✅ Atualiza tabela messages                                  │
│  ✅ Salva log no banco (webhook_logs)                         │
│  ✅ Retorna 200 OK                                            │
└──────────────────────────────────────────────────────────────┘
```

---

## 📋 O QUE ESTÁ FALTANDO?

### ❌ Arquivo: `backend/.env`

**FALTA:**
```env
WEBHOOK_VERIFY_TOKEN=seu_token_secreto
WEBHOOK_BASE_URL=https://sistemasnettsistemas.com.br
WEBHOOK_URL=https://sistemasnettsistemas.com.br/api/webhook
```

**ATUAL:**
```env
PORT=3001
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5432
DB_NAME=whatsapp_dispatcher
DB_USER=whatsapp_user
DB_PASSWORD=Senhaforte123!@#
JWT_SECRET=chave-super-secreta...
FRONTEND_URL=https://sistemasnettsistemas.com.br
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
# ❌ FALTAM AS VARIÁVEIS DE WEBHOOK AQUI!
```

---

## 🔧 COMO RESOLVER?

### Opção 1: Automático (Recomendado)

```bash
ADICIONAR-WEBHOOK-ENV.bat
```

### Opção 2: Manual

Edite `backend/.env` e adicione:

```env
# Webhook do WhatsApp
WEBHOOK_VERIFY_TOKEN=webhook_token_12345_xyz_2024
WEBHOOK_BASE_URL=https://sistemasnettsistemas.com.br
WEBHOOK_URL=https://sistemasnettsistemas.com.br/api/webhook
```

---

## 🧪 COMO TESTAR?

### 1. Verificar se as variáveis foram adicionadas:

```bash
VERIFICAR-WEBHOOK-CONFIGURADO.bat
```

### 2. Reiniciar o backend:

```bash
pm2 restart backend
```

### 3. Testar manualmente:

```bash
TESTAR-WEBHOOK-MANUALMENTE.bat
```

### 4. Verificar no banco de dados:

```bash
psql -U whatsapp_user -d whatsapp_dispatcher -f VERIFICAR-WEBHOOKS-BANCO.sql
```

---

## 📊 FLUXO DE MENSAGEM COMPLETO

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USUÁRIO ENVIA MENSAGEM PELO SISTEMA                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. BACKEND ENVIA PARA WHATSAPP API                         │
│    - Salva na tabela messages (status: 'sent')             │
│    - Recebe whatsapp_message_id                            │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. WHATSAPP PROCESSA E ENVIA                               │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. WHATSAPP ENVIA WEBHOOK (Status Update)                  │
│    POST /api/webhook                                        │
│    {                                                        │
│      "entry": [{                                            │
│        "changes": [{                                        │
│          "value": {                                         │
│            "statuses": [{                                   │
│              "id": "wamid.HBgN...",                         │
│              "status": "delivered",                         │
│              "timestamp": "1234567890"                      │
│            }]                                               │
│          }                                                  │
│        }]                                                   │
│      }]                                                     │
│    }                                                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. BACKEND PROCESSA WEBHOOK                                │
│    - Busca mensagem pelo whatsapp_message_id               │
│    - Atualiza status para 'delivered'                      │
│    - Atualiza delivered_at com timestamp                   │
│    - Salva log em webhook_logs                             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. FRONTEND MOSTRA STATUS ATUALIZADO                       │
│    ✅ Entregue às 14:35                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 CHECKLIST DE VERIFICAÇÃO

- [ ] Variáveis adicionadas no `backend/.env`
- [ ] Backend reiniciado
- [ ] Webhook configurado no Facebook Developers
- [ ] Campo "messages" subscrito
- [ ] Teste manual funcionou (retornou challenge)
- [ ] Logs do backend mostram "✅ Webhook verificado"
- [ ] Mensagem de teste enviada
- [ ] Status atualizado no banco de dados
- [ ] Logs mostram "🔔 WEBHOOK RECEBIDO"

---

## 📞 SUPORTE

Se após seguir todos os passos ainda não funcionar:

1. **Verifique os logs:**
   ```bash
   pm2 logs backend --lines 100
   ```

2. **Verifique o banco:**
   ```sql
   SELECT * FROM webhook_logs ORDER BY id DESC LIMIT 5;
   ```

3. **Teste manualmente:**
   ```bash
   curl -X GET "https://sistemasnettsistemas.com.br/api/webhook?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=teste"
   ```

---

**✅ Após configurar corretamente, todos os webhooks serão recebidos e processados automaticamente!**



