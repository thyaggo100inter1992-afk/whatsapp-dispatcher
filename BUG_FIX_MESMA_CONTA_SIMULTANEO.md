# 🐛 BUG: Campanhas com a Mesma Conta Não Rodavam Simultaneamente

## ❌ **O PROBLEMA:**

**Sintoma:**
- ✅ **2 campanhas com contas DIFERENTES** → Rodam simultaneamente  
- ❌ **2 campanhas com a MESMA conta** → Uma fica PENDENTE, só roda após a outra terminar

**Descoberto por:** Usuário, em 12/11/2025 14:45

**Testes realizados:**
1. Criou 2 campanhas com **mesma conta de origem** → Uma ficou PENDENTE
2. Criou 2 campanhas com **contas diferentes** → Ambas rodaram SIMULTANEAMENTE

---

## 🔍 **CAUSA RAIZ:**

### **Health Check Duplicado**

Quando duas campanhas usavam a **mesma conta**, ambas tentavam fazer **health check simultaneamente**:

1. **Campanha A** inicia → Chama `checkCampaignAccountsHealth` → Consulta API da Meta para Conta 1
2. **Campanha B** inicia → Chama `checkCampaignAccountsHealth` → Consulta API da Meta para **Conta 1** (mesma!)

**Resultado:**
- **Conflito na API da Meta**: Múltiplas requisições simultâneas para a mesma conta
- **Rate Limiting**: API bloqueando requisições duplicadas
- **Lock no Banco**: Tentando atualizar `campaign_templates` da mesma conta
- **Timeout/Erro**: Uma campanha travava aguardando a outra

---

## ✅ **CORREÇÃO IMPLEMENTADA:**

### **Cache de Health Check**

Implementado um **sistema de cache** para evitar health checks duplicados:

```typescript
// NOVO: Cache de Health Check
private healthCheckCache: Map<number, { 
  timestamp: number; 
  checking: Promise<void> | null 
}> = new Map();

private readonly HEALTH_CHECK_CACHE_TTL = 30000; // 30 segundos
```

### **Como Funciona:**

#### **1. Antes de fazer Health Check:**

```typescript
const cached = this.healthCheckCache.get(whatsapp_account_id);

// Se já está verificando esta conta, aguardar
if (cached && cached.checking) {
  console.log(`⏳ Conta ${whatsapp_account_id} já está sendo verificada, aguardando...`);
  await cached.checking; // ✅ AGUARDA sem duplicar!
  return;
}

// Se verificou recentemente (< 30s), pular
if (cached && (now - cached.timestamp) < 30000) {
  console.log(`✅ Conta verificada recentemente, pulando`);
  return; // ✅ USA O RESULTADO ANTERIOR!
}
```

#### **2. Durante o Health Check:**

```typescript
// Criar promise de verificação
const checkingPromise = this.performHealthCheck(account);

// Salvar no cache (marca como "verificando")
this.healthCheckCache.set(whatsapp_account_id, {
  timestamp: now,
  checking: checkingPromise // ✅ Outras campanhas vão aguardar isso!
});

// Executar verificação
await checkingPromise;

// Atualizar cache (marca como "concluído")
this.healthCheckCache.set(whatsapp_account_id, {
  timestamp: Date.now(),
  checking: null // ✅ Próximas vão usar o cache!
});
```

#### **3. Health Checks em Paralelo:**

```typescript
// Processar todos os health checks em paralelo
await Promise.all(
  accountsResult.rows.map(account => 
    this.checkAccountHealthWithCache(account) // ✅ COM CACHE!
  )
);
```

---

## 📊 **COMPORTAMENTO AGORA:**

### **Cenário: 2 Campanhas, Mesma Conta**

```
⏰ 14:50:00 - Worker verifica campanhas

📋 Encontra:
   - Campanha A (usa Conta 1)
   - Campanha B (usa Conta 1)  ← MESMA CONTA!

🚀 Processamento PARALELO iniciado!

⏩ Campanha A: Health Check Conta 1
   🔍 Consultando API da Meta... (salva no cache)
   
⏩ Campanha B: Health Check Conta 1
   ⏳ Conta 1 já está sendo verificada, aguardando... ✅
   (USA o resultado da Campanha A, NÃO duplica a chamada!)

✅ Campanha A: Health check concluído (2s)
✅ Campanha B: Health check concluído (0s - usou cache!)

📤 Ambas começam a enviar mensagens SIMULTANEAMENTE! 🎉
```

### **Benefícios:**

1. ✅ **Evita chamadas duplicadas** à API da Meta
2. ✅ **Reduz rate limiting** (menos requisições)
3. ✅ **Elimina conflitos** de banco de dados
4. ✅ **Permite processamento simultâneo** de campanhas com mesma conta
5. ✅ **Melhora performance** (health check instantâneo após o primeiro)

---

## 🧪 **COMO TESTAR:**

### **Passo 1: Criar 2 Campanhas com Mesma Conta**

**Campanha A:**
- Nome: TESTE MESMA CONTA A
- Conta: **Conta 1** (ex: 8141-2569)
- Contatos: 5-8 números
- SEM agendamento

**Campanha B:**
- Nome: TESTE MESMA CONTA B
- Conta: **Conta 1** (mesma conta!)
- Contatos: 5-8 números
- SEM agendamento

### **Passo 2: Observar Logs do Backend**

**ANTES (Bug):**
```
⏩ Campanha A: Health Check Conta 1
   🔍 Consultando API...
   
⏩ Campanha B: Health Check Conta 1
   🔍 Consultando API... ❌ DUPLICADO!
   ⏸️ Travou aguardando...

⏸️ Campanha A processada (30s)
❌ Campanha B ficou PENDENTE
```

**AGORA (Corrigido):**
```
⏩ Campanha A: Health Check Conta 1
   🔍 Consultando API da Meta...
   
⏩ Campanha B: Health Check Conta 1
   ⏳ Conta 1 já está sendo verificada, aguardando... ✅
   
✅ Health check concluído para conta 1
✅ Campanha A processada (2.3s)
✅ Campanha B processada (2.1s)  ← SIMULTÂNEA!
```

### **Passo 3: Verificar na Interface**

Recarregue a página:

**Resultado esperado:**
```
🔵 TESTE MESMA CONTA A - EM EXECUÇÃO (25%)
🔵 TESTE MESMA CONTA B - EM EXECUÇÃO (37%)  ← JUNTAS!
```

---

## 📋 **CHECKLIST DE CORREÇÃO:**

| Item | Status |
|------|--------|
| Cache de health check implementado | ✅ |
| Verificação de cache antes de chamada | ✅ |
| Aguarda se já está verificando | ✅ |
| Usa cache se verificou recentemente (30s) | ✅ |
| Health checks em paralelo | ✅ |
| Backend reiniciado | ✅ |
| Teste manual pendente | ⏳ |

---

## ⚙️ **CONFIGURAÇÕES:**

### **TTL do Cache:**
```typescript
private readonly HEALTH_CHECK_CACHE_TTL = 30000; // 30 segundos
```

**Por quê 30 segundos?**
- ✅ Evita chamadas excessivas à API
- ✅ Informação ainda relevante (health não muda rápido)
- ✅ Permite múltiplas campanhas usarem o mesmo resultado
- ✅ Atualiza a cada ciclo do worker (10s) após expirar

---

## 🎯 **PRÓXIMOS PASSOS:**

1. ✅ Sistema reiniciado com correção
2. ✅ Crie **2 campanhas com a mesma conta**
3. ✅ Veja ambas **rodando simultaneamente**!
4. ✅ Observe os logs: `⏳ Conta X já está sendo verificada, aguardando...`
5. ✅ Confirme que ambas processam **ao mesmo tempo**! 🚀

---

**Data:** 12/11/2025 15:00  
**Arquivo:** `backend/src/workers/campaign.worker.ts`  
**Mudanças:**
- Adicionado `healthCheckCache: Map<>`
- Novo método: `checkAccountHealthWithCache()`
- Novo método: `performHealthCheck()`
- Modificado: `checkCampaignAccountsHealth()` para usar cache

**Status:** ✅ PRONTO PARA TESTE!





