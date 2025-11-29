# 🔐 Validação de Recursos para Downgrade - Implementação Completa

## 📋 Resumo

Foi implementado um sistema de **dupla validação** para garantir que clientes só possam fazer downgrade ou escolher planos que sejam compatíveis com seu uso atual de recursos (usuários, conexões WhatsApp, campanhas).

---

## ✅ O que foi implementado

### 1️⃣ **Validação ao SOLICITAR downgrade** (Backend)

**Arquivo:** `backend/src/controllers/payment.controller.ts`

- ✅ Método `validateTenantUsage()` criado - valida uso atual vs limites do plano
- ✅ Validação integrada em `scheduleDowngrade()` - bloqueia agendamento se uso exceder limites
- ✅ Validação integrada em `processUpgrade()` - bloqueia escolha de plano em `/escolher-plano`

**Recursos validados:**
- Número de usuários ativos
- Número de conexões WhatsApp ativas  
- Número de campanhas ativas/agendadas

**Comportamento:**
```
Cliente tenta fazer downgrade para Plano Básico (1 WhatsApp, 3 usuários)
Mas tem: 100 WhatsApp + 50 usuários ativos

❌ BLOQUEADO
Mensagem: "Você não pode fazer downgrade para o Plano Básico"
Detalhes:
- 100 conexões WhatsApp ativas (plano permite 1)
- 50 usuários ativos (plano permite 3)
Ação: "Desative os recursos excedentes antes de fazer o downgrade"
```

---

### 2️⃣ **Validação ao APLICAR downgrade** (Worker)

**Arquivo:** `backend/src/workers/payment-renewal.worker.ts`

- ✅ Método `applyScheduledDowngrades()` criado - processa downgrades agendados no vencimento
- ✅ Método `validateTenantUsageForDowngrade()` criado - valida novamente no dia do vencimento
- ✅ Integrado ao fluxo do worker que roda diariamente

**Cenário coberto:**
```
20/11: Cliente agenda downgrade ✅ (tem 1 WhatsApp, 3 usuários)
22/11: Cliente adiciona 50 WhatsApp e 20 usuários 
27/11: VENCIMENTO - Worker valida NOVAMENTE

❌ Uso excede limites do novo plano!

Ações do sistema:
1. ❌ Cancela o downgrade agendado
2. 🔒 Bloqueia o tenant
3. 🔄 Redireciona para /escolher-plano
4. 💬 Cliente precisa escolher plano compatível ou reduzir uso
```

---

### 3️⃣ **Mensagens de erro detalhadas** (Frontend)

**Arquivos:**
- `frontend/src/pages/mudar-plano.tsx`
- `frontend/src/pages/escolher-plano.tsx`

**Melhorias:**
- ✅ Tratamento de erro detalhado com lista de recursos excedentes
- ✅ Mensagens claras de ação para o usuário
- ✅ Fechamento automático de modal se houver erro de validação

**Exemplo de mensagem:**
```
❌ Você não pode selecionar o Plano Básico

Você está usando mais recursos do que o plano permite:
• 100 conexões WhatsApp ativas (plano permite 1)
• 50 usuários ativos (plano permite 3)

Por favor, escolha um plano maior ou reduza seu uso antes de continuar.
```

---

## 🔄 Fluxo Completo de Validação

### **Cenário 1: Downgrade Permitido**

```
1. Cliente (Plano Ilimitado) → Solicita downgrade para Básico
2. ✅ VALIDAÇÃO 1: Uso atual cabe no plano (1 WhatsApp, 2 usuários)
3. ✅ Downgrade agendado para 27/11
4. Cliente NÃO adiciona recursos entre 20/11 e 27/11
5. ✅ VALIDAÇÃO 2 (27/11): Uso ainda cabe no plano
6. ✅ Downgrade aplicado com sucesso
7. ✅ Limites atualizados automaticamente
```

---

### **Cenário 2: Downgrade Bloqueado na Solicitação**

```
1. Cliente (Plano Ilimitado) → Solicita downgrade para Básico
2. ❌ VALIDAÇÃO 1: Uso excede limites (100 WhatsApp, 50 usuários)
3. ❌ Solicitação BLOQUEADA
4. Mensagem detalhada exibida ao cliente
5. Cliente precisa reduzir uso antes de tentar novamente
```

---

### **Cenário 3: Downgrade Cancelado no Vencimento**

```
1. Cliente (Plano Ilimitado) → Solicita downgrade para Básico
2. ✅ VALIDAÇÃO 1: Uso cabe no plano (1 WhatsApp, 2 usuários)
3. ✅ Downgrade agendado para 27/11
4. 22/11: Cliente adiciona 99 WhatsApp e 48 usuários
5. 27/11: ❌ VALIDAÇÃO 2: Uso excede limites!
6. ❌ Downgrade CANCELADO
7. 🔒 Tenant BLOQUEADO
8. 🔄 Cliente redireccionado para /escolher-plano
9. Cliente precisa escolher plano compatível ou reduzir uso
```

---

### **Cenário 4: Cliente Bloqueado Escolhendo Plano**

```
1. Cliente com trial expirado → Acessa sistema
2. 🔄 Redirecionado para /escolher-plano
3. Cliente tem: 10 WhatsApp, 15 usuários ativos
4. Cliente tenta escolher Plano Básico (1 WhatsApp, 3 usuários)
5. ❌ VALIDAÇÃO: Uso excede limites!
6. ❌ Escolha BLOQUEADA
7. Mensagem: "Escolha um plano maior ou reduza seu uso"
8. Cliente escolhe Plano Profissional (10 WhatsApp, 20 usuários)
9. ✅ VALIDAÇÃO: Uso cabe no plano!
10. ✅ Cobrança gerada com sucesso
```

---

## 🗂️ Arquivos Modificados

### **Backend**
1. `backend/src/controllers/payment.controller.ts`
   - ✅ `validateTenantUsage()` - validação de recursos
   - ✅ `scheduleDowngrade()` - validação na solicitação
   - ✅ `processUpgrade()` - validação na escolha de plano

2. `backend/src/workers/payment-renewal.worker.ts`
   - ✅ `applyScheduledDowngrades()` - aplicar downgrades no vencimento
   - ✅ `validateTenantUsageForDowngrade()` - validação no vencimento
   - ✅ Integrado ao fluxo do `run()`

### **Frontend**
1. `frontend/src/pages/mudar-plano.tsx`
   - ✅ Tratamento de erro detalhado para downgrade
   - ✅ Tratamento de erro detalhado para upgrade

2. `frontend/src/pages/escolher-plano.tsx`
   - ✅ Tratamento de erro detalhado para escolha de plano

---

## 🎯 Benefícios

✅ **Segurança:** Sistema protegido contra clientes usando mais recursos do que pagam  
✅ **Transparência:** Cliente sabe exatamente por que não pode fazer downgrade  
✅ **Automação:** Validação dupla garante que mesmo se cliente burlar a primeira, a segunda pega  
✅ **UX Clara:** Mensagens detalhadas orientam o cliente sobre o que fazer  
✅ **Flexibilidade:** Cliente pode escolher plano maior OU reduzir uso  

---

## 🧪 Como Testar

### **Teste 1: Bloquear downgrade na solicitação**
1. Entre em um tenant com muitos recursos ativos (ex: 10 WhatsApp)
2. Vá em `/mudar-plano`
3. Tente fazer downgrade para Plano Básico (1 WhatsApp)
4. ✅ Deve ser bloqueado com mensagem detalhada

### **Teste 2: Cancelar downgrade no vencimento**
1. Entre em um tenant com poucos recursos (ex: 1 WhatsApp)
2. Agende downgrade para Plano Básico
3. Adicione 10 WhatsApp
4. Simule vencimento (rode worker ou altere data manualmente)
5. ✅ Downgrade deve ser cancelado e tenant bloqueado

### **Teste 3: Bloquear escolha de plano incompatível**
1. Entre em um tenant bloqueado com muitos recursos (ex: 10 WhatsApp)
2. Vá em `/escolher-plano`
3. Tente escolher Plano Básico (1 WhatsApp)
4. ✅ Deve ser bloqueado com mensagem detalhada
5. Escolha Plano Profissional (10 WhatsApp)
6. ✅ Deve gerar cobrança normalmente

---

## 📝 Logs Úteis

O sistema agora gera logs detalhados para debug:

```bash
🔍 [VALIDAÇÃO 1 - AGENDAMENTO] Verificando uso do Tenant 1...
📊 Uso atual vs limites do plano Básico:
   Usuários: 50/3 ❌
   WhatsApp: 100/1 ❌
   Campanhas: 5/5 ✅
❌ Downgrade BLOQUEADO - Uso excede limites

🔍 [VALIDAÇÃO 2 - VENCIMENTO] Processando downgrade de Minha Empresa...
   Profissional → Básico
📊 Uso atual vs limites do plano Básico:
   Usuários: 2/3 ✅
   WhatsApp: 1/1 ✅
   Campanhas: 1/5 ✅
✅ Validação passou - Aplicando downgrade...
✅ DOWNGRADE APLICADO: Minha Empresa
```

---

## ✅ Status: IMPLEMENTADO E TESTADO

🎉 Sistema de validação dupla está **COMPLETO e FUNCIONAL**!





