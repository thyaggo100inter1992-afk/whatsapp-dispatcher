# 🔔 CONFIGURAR WEBHOOK DO ASAAS

## ⚠️ PROBLEMA IDENTIFICADO:

Quando um pagamento é confirmado no Asaas (PIX, Boleto, etc.), o sistema **NÃO está sendo notificado automaticamente**. Isso causa:

- ❌ Usuário paga mas a conta não é ativada
- ❌ Necessidade de ativação manual
- ❌ Má experiência do usuário

---

## ✅ SOLUÇÃO: Configurar Webhook no Asaas

### **1. Entrar no Painel do Asaas**

https://www.asaas.com/ (ou https://sandbox.asaas.com/ se estiver em sandbox)

### **2. Acessar Configurações de Webhook**

1. Fazer login
2. Ir em **Configurações** → **Integrações** → **Webhooks**
3. Clicar em **"Criar Webhook"** ou **"Novo Webhook"**

### **3. Configurar o Webhook**

**URL do Webhook:**
```
https://SEU-DOMINIO.com/api/payments/webhook
```

**OU se estiver testando localmente (usando ngrok ou similar):**
```
https://SEU-NGROK-URL.ngrok.io/api/payments/webhook
```

**Eventos para marcar (✅):**
- ✅ **PAYMENT_RECEIVED** - Pagamento recebido
- ✅ **PAYMENT_CONFIRMED** - Pagamento confirmado
- ✅ **PAYMENT_RECEIVED_IN_CASH** - Pagamento recebido em dinheiro

**Método:** `POST`

**Versão da API:** `v3` (ou a mais recente disponível)

### **4. Salvar e Testar**

1. Clicar em **"Salvar"**
2. O Asaas vai enviar um webhook de teste
3. Verificar se aparece como **"Ativo"** ou **"✅"**

---

## 🧪 TESTAR O WEBHOOK

### **Opção 1: Fazer um pagamento teste**

1. Gerar uma nova cobrança PIX de R$ 1,00
2. Pagar
3. Verificar os logs do backend para ver se o webhook foi recebido:

```
📨 Webhook recebido: PAYMENT_RECEIVED pay_abc123
✅ Pagamento confirmado!
🎉 Conta ativada automaticamente!
```

### **Opção 2: Testar manualmente no Postman/Insomnia**

**URL:** `http://localhost:3001/api/payments/webhook`

**Method:** `POST`

**Body (JSON):**
```json
{
  "event": "PAYMENT_RECEIVED",
  "payment": {
    "id": "pay_test123",
    "value": 17.00,
    "customer": "cus_test",
    "billingType": "PIX",
    "status": "RECEIVED"
  }
}
```

**Resposta esperada:**
```json
{
  "received": true
}
```

---

## 📋 ENDPOINT DO WEBHOOK (Backend)

**Arquivo:** `backend/src/controllers/payment.controller.ts`

**Rota:** `POST /api/payments/webhook`

**O que o webhook faz:**

1. ✅ Recebe notificação do Asaas
2. ✅ Busca o pagamento no banco de dados
3. ✅ Atualiza status do pagamento para "confirmed"
4. ✅ **ATIVA A CONTA DO TENANT** automaticamente
5. ✅ Define o plano do tenant
6. ✅ Remove bloqueio e data de deleção

**Eventos aceitos:**
- `PAYMENT_CONFIRMED`
- `PAYMENT_RECEIVED`
- `PAYMENT_RECEIVED_IN_CASH`

---

## 🔍 VERIFICAR SE O WEBHOOK ESTÁ FUNCIONANDO

### **Nos logs do backend:**

Quando um pagamento é confirmado, você deve ver:

```
📨 Webhook recebido: PAYMENT_RECEIVED pay_abc123
✅ Pagamento encontrado no banco: ID 62
✅ Pagamento atualizado para: confirmed
🎉 Liberando acesso do tenant 3
✅ Tenant ativado com sucesso!
```

### **Se NÃO aparecer nada:**

Significa que o webhook não está chegando. Verifique:

1. ✅ URL do webhook está correta no Asaas?
2. ✅ Servidor está acessível publicamente (não localhost)?
3. ✅ Firewall/cloudflare não está bloqueando?
4. ✅ Certificado SSL está válido (HTTPS)?

---

## 🚨 SOLUÇÃO TEMPORÁRIA (Ativação Manual)

Enquanto o webhook não está configurado, você pode ativar contas manualmente com o script:

```bash
cd backend
node verificar-e-ativar-pagamento.js
```

**O que o script faz:**
1. Busca pagamentos pendentes no banco
2. Consulta status no Asaas
3. Se estiver CONFIRMADO/RECEIVED, ativa a conta automaticamente

---

## 📊 COMPARAÇÃO:

| Situação | Sem Webhook | Com Webhook |
|----------|-------------|-------------|
| **Usuário paga** | ✅ | ✅ |
| **Asaas confirma** | ✅ | ✅ |
| **Sistema notificado** | ❌ Não | ✅ Sim (automático) |
| **Conta ativada** | ❌ Manual | ✅ Automático |
| **Tempo** | Depende do admin | Instantâneo |
| **Experiência** | ❌ Ruim | ✅ Excelente |

---

## ✅ CHECKLIST:

- [ ] Acessar painel do Asaas
- [ ] Ir em Configurações → Integrações → Webhooks
- [ ] Criar novo webhook
- [ ] URL: `https://SEU-DOMINIO.com/api/payments/webhook`
- [ ] Marcar eventos: PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_RECEIVED_IN_CASH
- [ ] Salvar
- [ ] Testar com pagamento de R$ 1,00
- [ ] Verificar logs do backend
- [ ] ✅ Webhook funcionando!

---

## 🔗 REFERÊNCIAS:

- **Documentação Asaas Webhooks:** https://docs.asaas.com/docs/webhooks
- **Endpoint do Webhook (Backend):** `backend/src/controllers/payment.controller.ts` (linha 545)
- **Rota do Webhook:** `backend/src/routes/payments.routes.ts` (linha 16)

---

**Data:** 25/11/2025  
**Status:** ⚠️ **WEBHOOK NÃO CONFIGURADO - NECESSÁRIO CONFIGURAR NO PAINEL DO ASAAS**





