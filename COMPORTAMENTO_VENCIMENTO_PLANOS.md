# 📋 COMPORTAMENTO DO SISTEMA - VENCIMENTO DE PLANOS PAGOS

## 🎯 RESUMO EXECUTIVO

Quando um cliente **com plano pago** chega na data de vencimento (`proximo_vencimento`), o sistema **BLOQUEIA AUTOMATICAMENTE** o acesso e dá **7 dias** para pagamento antes da deleção permanente.

---

## 🔄 FLUXO COMPLETO - DO PAGAMENTO AO VENCIMENTO

### 1️⃣ **CLIENTE PAGA O PLANO**

**O que acontece:**
- ✅ Status muda para `active`
- ✅ Campo `proximo_vencimento` é definido para **30 dias** após o pagamento
- ✅ Campo `blocked_at` é limpo (NULL)
- ✅ Campo `will_be_deleted_at` é limpo (NULL)
- ✅ Limites do plano são aplicados

**Exemplo:**
```sql
-- Cliente pagou hoje (03/12/2025)
UPDATE tenants SET
  status = 'active',
  proximo_vencimento = NOW() + INTERVAL '30 days',  -- 02/01/2026
  blocked_at = NULL,
  will_be_deleted_at = NULL
WHERE id = 4;
```

---

### 2️⃣ **DURANTE OS 30 DIAS (PLANO ATIVO)**

**O que acontece:**
- ✅ Cliente usa o sistema **normalmente**
- ✅ Todos os recursos do plano estão **liberados**
- ✅ Nenhuma restrição é aplicada

**Notificações:**
- 📧 **5 dias antes** do vencimento: Sistema detecta e pode enviar email de lembrete
  - ⚠️ Atualmente apenas loga no console (email não implementado)

---

### 3️⃣ **DIA DO VENCIMENTO (`proximo_vencimento` <= NOW())**

**O que acontece AUTOMATICAMENTE:**

#### 🤖 **Worker de Pagamentos** (`payment-renewal.worker.ts`)
- ⏰ **Executa a cada 6 horas** (configurado no `server.ts`)
- 🔍 Busca tenants com:
  - `status = 'active'`
  - `proximo_vencimento < NOW()`

#### 🔒 **BLOQUEIO IMEDIATO**

```sql
-- Tenant com pagamento vencido é BLOQUEADO
UPDATE tenants 
SET 
  status = 'blocked',
  blocked_at = NOW(),
  will_be_deleted_at = NOW() + INTERVAL '7 days',  -- 7 dias para pagar
  updated_at = NOW()
WHERE id = 4;
```

**Resultado:**
- ❌ Cliente **NÃO consegue mais acessar** o sistema
- 📧 Vê mensagem: *"Seu plano expirou. Renove para continuar."*
- 🔄 É redirecionado para `/gestao` (página de pagamento)
- ⏰ Tem **7 dias** para renovar antes da deleção

---

### 4️⃣ **DURANTE O BLOQUEIO (7 DIAS DE CARÊNCIA)**

**O que o cliente pode fazer:**
- ✅ Fazer login no sistema
- ✅ Acessar a página `/gestao`
- ✅ Visualizar seu plano e histórico de pagamentos
- ✅ Clicar no botão **"Renovar"** para gerar novo boleto/PIX
- ✅ Realizar o pagamento

**O que o cliente NÃO pode fazer:**
- ❌ Enviar mensagens
- ❌ Criar campanhas
- ❌ Acessar contatos
- ❌ Usar qualquer funcionalidade do sistema

**Middleware de bloqueio:**
```typescript
// backend/src/middleware/auth.ts
if (req.tenant.status === 'blocked') {
  return res.status(403).json({
    success: false,
    error: 'Seu plano expirou. Renove para continuar.',
    redirect: '/gestao'
  });
}
```

---

### 5️⃣ **SE O CLIENTE PAGAR DURANTE OS 7 DIAS**

**Webhook do Asaas recebe confirmação:**

```typescript
// backend/src/controllers/payment.controller.ts
// Quando pagamento é confirmado:
await pool.query(`
  UPDATE tenants
  SET
    status = 'active',
    blocked_at = NULL,
    will_be_deleted_at = NULL,
    proximo_vencimento = NOW() + INTERVAL '30 days',  -- Novo ciclo de 30 dias
    updated_at = NOW()
  WHERE id = $1
`, [tenantId]);
```

**Resultado:**
- ✅ Acesso **REATIVADO IMEDIATAMENTE**
- ✅ Novo vencimento em **30 dias**
- ✅ Todos os dados **preservados**
- ✅ Cliente volta a usar normalmente

---

### 6️⃣ **SE O CLIENTE NÃO PAGAR EM 7 DIAS**

**Worker de Trial Cleanup** (`trial-cleanup.worker.ts`):
- ⏰ **Executa a cada 6 horas**
- 🔍 Busca tenants com:
  - `status = 'blocked'`
  - `will_be_deleted_at <= NOW()`
  - **SEM pagamentos confirmados**

#### 🗑️ **DELEÇÃO PERMANENTE**

```typescript
// backend/src/workers/trial-cleanup.worker.js
async deletePermanently(tenantId) {
  // DELETA TUDO:
  await pool.query('DELETE FROM campaign_messages WHERE tenant_id = $1', [tenantId]);
  await pool.query('DELETE FROM campaigns WHERE tenant_id = $1', [tenantId]);
  await pool.query('DELETE FROM qr_campaign_messages WHERE tenant_id = $1', [tenantId]);
  await pool.query('DELETE FROM qr_campaigns WHERE tenant_id = $1', [tenantId]);
  await pool.query('DELETE FROM contacts WHERE tenant_id = $1', [tenantId]);
  await pool.query('DELETE FROM whatsapp_connections WHERE tenant_id = $1', [tenantId]);
  await pool.query('DELETE FROM uaz_instances WHERE tenant_id = $1', [tenantId]);
  await pool.query('DELETE FROM users WHERE tenant_id = $1', [tenantId]);
  await pool.query('DELETE FROM payments WHERE tenant_id = $1', [tenantId]);
  await pool.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
}
```

**Resultado:**
- 🗑️ **TODOS OS DADOS SÃO DELETADOS PERMANENTEMENTE**
- ❌ Campanhas, mensagens, contatos, usuários, conexões
- ❌ Histórico de pagamentos
- ❌ **NÃO HÁ RECUPERAÇÃO POSSÍVEL**

---

## 📊 EXEMPLO PRÁTICO

### **Tenant ID 4: NETTCRED FINANCEIRA**

**Estado atual (03/12/2025):**
```
status: active
plano: empresarial
proximo_vencimento: 2026-01-02 (02/01/2026)
blocked_at: NULL
will_be_deleted_at: NULL
```

**Timeline:**

| Data | Evento | Status | Acesso |
|------|--------|--------|--------|
| **03/12/2025** | Cliente pagou plano | `active` | ✅ Total |
| **28/12/2025** | 5 dias antes do vencimento | `active` | ✅ Total + 📧 Notificação |
| **02/01/2026** | Vencimento do plano | `active` | ✅ Total (até worker rodar) |
| **02/01/2026** | Worker executa (próximo ciclo de 6h) | `blocked` | ❌ Bloqueado |
| **02-09/01/2026** | Período de carência (7 dias) | `blocked` | ❌ Bloqueado + Pode pagar |
| **09/01/2026** | Se NÃO pagou | `DELETADO` | ❌ Dados perdidos |
| **Qualquer momento** | Se PAGAR | `active` | ✅ Reativado |

---

## ⚙️ CONFIGURAÇÃO DOS WORKERS

### **Payment Renewal Worker**

**Arquivo:** `backend/src/workers/payment-renewal.worker.ts`

**Frequência:** A cada 6 horas

**Cron:** `0 */6 * * *` (00:00, 06:00, 12:00, 18:00)

**Ações:**
1. ✅ Verifica vencimentos próximos (5 dias antes)
2. ✅ Processa downgrades agendados
3. ✅ **Bloqueia tenants com pagamento vencido**
4. ℹ️ Criação automática de cobranças (DESABILITADA)

**Código:**
```typescript
// backend/src/server.ts
console.log('🚀 Iniciando Payment Renewal Worker...');
paymentRenewalWorker.run();
cron.schedule('0 */6 * * *', () => {
  console.log('⏰ Executando Payment Renewal Worker...');
  paymentRenewalWorker.run();
});
```

---

### **Trial Cleanup Worker**

**Arquivo:** `backend/src/workers/trial-cleanup.worker.js`

**Frequência:** A cada 6 horas

**Cron:** `0 */6 * * *`

**Ações:**
1. ✅ Bloqueia trials expirados (3 dias)
2. ✅ **Deleta tenants bloqueados há 7 dias**

---

## 🔍 VERIFICAÇÃO MANUAL

### **Consultar status de um tenant:**

```sql
SELECT 
  id, 
  nome, 
  email, 
  status, 
  plano,
  proximo_vencimento,
  blocked_at,
  will_be_deleted_at,
  NOW() as agora,
  CASE 
    WHEN status = 'active' AND proximo_vencimento > NOW() 
      THEN CONCAT('Vence em ', EXTRACT(DAY FROM (proximo_vencimento - NOW())), ' dias')
    WHEN status = 'blocked' AND will_be_deleted_at > NOW()
      THEN CONCAT('Será deletado em ', EXTRACT(DAY FROM (will_be_deleted_at - NOW())), ' dias')
    WHEN status = 'blocked' AND will_be_deleted_at <= NOW()
      THEN 'PRONTO PARA DELEÇÃO'
    ELSE 'OK'
  END as situacao
FROM tenants
WHERE id = 4;
```

### **Executar worker manualmente:**

```bash
# Payment Renewal Worker
cd /root/whatsapp-dispatcher/backend
node -e "require('./dist/workers/payment-renewal.worker.js').paymentRenewalWorker.run()"

# Trial Cleanup Worker
node -e "require('./dist/workers/trial-cleanup.worker.js').trialCleanupWorker.run()"
```

---

## ⚠️ PONTOS IMPORTANTES

### ✅ **O QUE ESTÁ FUNCIONANDO:**
- ✅ Bloqueio automático no vencimento
- ✅ Período de carência de 7 dias
- ✅ Deleção automática após 7 dias
- ✅ Reativação automática ao pagar
- ✅ Workers rodando a cada 6 horas

### ⚠️ **O QUE PRECISA SER IMPLEMENTADO:**
- 📧 Email de notificação 5 dias antes do vencimento
- 📧 Email de bloqueio com link de pagamento
- 📧 Email de lembrete durante os 7 dias de carência
- 📧 Email de aviso 1 dia antes da deleção

### 🔧 **CONFIGURAÇÕES:**
- ⏰ Frequência dos workers: **6 horas** (pode ser ajustada)
- ⏰ Período de carência: **7 dias** (pode ser ajustado)
- ⏰ Notificação prévia: **5 dias** (pode ser ajustada)

---

## 📝 RESUMO FINAL

**Quando o plano vence:**
1. 🔒 Sistema **BLOQUEIA** automaticamente (máximo 6h após vencimento)
2. ⏰ Cliente tem **7 DIAS** para pagar
3. 💳 Se pagar: **REATIVADO** imediatamente
4. 🗑️ Se NÃO pagar: **DELETADO** permanentemente após 7 dias

**Diferença entre Trial e Plano Pago:**
- **Trial (3 dias):** Bloqueia após 3 dias, deleta após 7 dias de bloqueio
- **Plano Pago (30 dias):** Bloqueia no vencimento, deleta após 7 dias de bloqueio

**Ambos seguem a mesma regra:** 7 dias de carência após bloqueio!

---

**Data deste documento:** 03/12/2025
**Versão do sistema:** 1.0
**Workers ativos:** ✅ Payment Renewal Worker, ✅ Trial Cleanup Worker

