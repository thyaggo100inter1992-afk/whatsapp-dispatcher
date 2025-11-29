# 🚨 URGENTE: ATUALIZAR URL DO WEBHOOK

## ❌ PROBLEMA IDENTIFICADO:

Os contadores **NÃO estão atualizando** porque a **URL do webhook mudou**!

---

## 📡 **URL ATUAL DO WEBHOOK:**

```
https://9261d78d27ac.ngrok-free.app/api/webhook
```

**⚠️ IMPORTANTE:** O NGROK gera uma **nova URL** toda vez que reinicia!

---

## 🔧 **COMO CORRIGIR (PASSO A PASSO):**

### **1. Acesse o Meta Business (Facebook):**

```
https://business.facebook.com/
```

### **2. Para CADA conta WhatsApp:**

#### **Passo 1:** Vá em **"Configurações"** da conta

#### **Passo 2:** Clique em **"Configuração"** (esquerda)

#### **Passo 3:** Clique em **"Webhooks"**

#### **Passo 4:** Clique em **"Editar"** ou **"Configurar"**

#### **Passo 5:** Cole a nova URL:

```
https://9261d78d27ac.ngrok-free.app/api/webhook
```

#### **Passo 6:** Campos do Webhook:

| Campo | Valor |
|-------|-------|
| **URL de Retorno de Chamada** | `https://9261d78d27ac.ngrok-free.app/api/webhook` |
| **Token de Verificação** | `your-verify-token` (deixe como está) |
| **Campos Inscritos** | ✅ **messages** ✅ **message_status** |

#### **Passo 7:** Clique em **"Verificar e Salvar"**

---

## 📋 **CONTAS QUE PRECISAM SER ATUALIZADAS:**

### **Conta 1: 8141-2569**
- Phone Number ID: `772680659260321`
- Status: ❌ Webhook desatualizado

### **Conta 2: 8143-7760**
- Phone Number ID: `716417551557903`
- Status: ❌ Webhook desatualizado

### **Conta 3: 681742951**
- Phone Number ID: `501407573051782`
- Status: ❌ Webhook desatualizado

---

## ✅ **COMO SABER SE FUNCIONOU:**

Após atualizar:

1. **Envie uma mensagem de teste** da campanha
2. **Marque como lida** no seu WhatsApp
3. **Recarregue a página** da campanha
4. Os contadores devem **atualizar** automaticamente! ✨

---

## 🔄 **PARA EVITAR ESSE PROBLEMA NO FUTURO:**

### **Opção 1: NGROK com Domínio Fixo (RECOMENDADO)**

Se você tem uma conta paga do NGROK, configure um **domínio fixo**:

```bash
ngrok http 3001 --domain=seu-dominio.ngrok-free.app
```

Assim a URL **nunca muda**!

### **Opção 2: Usar Servidor Próprio**

Deploy em um servidor real (Heroku, AWS, etc.) com domínio fixo.

---

## 📊 **O QUE ACONTECE DEPOIS:**

Após atualizar o webhook, o sistema vai:

✅ Receber notificações de **"delivered"** (entregue)
✅ Receber notificações de **"read"** (lida)
✅ Receber notificações de **"button clicks"** (cliques)
✅ Atualizar os contadores **automaticamente**
✅ Atualizar o **relatório Excel**

---

## 🎯 **TESTE RÁPIDO:**

Depois de configurar, teste:

1. Envie uma mensagem
2. Abra no WhatsApp
3. Marque como lida
4. Recarregue a página da campanha
5. Veja o contador de "👁️ Lidas" aumentar! ✅

---

## ⚠️ **ATENÇÃO:**

**Toda vez que você reiniciar o NGROK**, a URL muda!

Você precisa:
1. Pegar a nova URL (rodando `check-webhook.js`)
2. Atualizar nas 3 contas do Meta Business

---

## 📞 **ONDE ATUALIZAR:**

**Meta Business Manager:**
```
https://business.facebook.com/
→ Sua Empresa
→ Contas de WhatsApp Business
→ [Selecione a conta]
→ Configuração
→ Webhooks
→ Editar
```

---

## ✅ **STATUS APÓS ATUALIZAÇÃO:**

| Funcionalidade | Antes | Depois |
|----------------|-------|--------|
| Mensagens enviadas | ✅ | ✅ |
| Mensagens entregues | ❌ | ✅ |
| Mensagens lidas | ❌ | ✅ |
| Cliques em botões | ❌ | ✅ |
| Relatório completo | ❌ | ✅ |

---

## 🚀 **URL ATUAL (COPIE E COLE):**

```
https://9261d78d27ac.ngrok-free.app/api/webhook
```

**Token de Verificação:**
```
your-verify-token
```

---

**⚠️ URGENTE: Atualize AGORA para os contadores voltarem a funcionar!**





