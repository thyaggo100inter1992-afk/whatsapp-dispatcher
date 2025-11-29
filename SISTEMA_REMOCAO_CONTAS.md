# 🚫 Sistema de Remoção e Reativação de Contas

## 📋 Visão Geral

Sistema completo que gerencia automaticamente a remoção e reativação de contas em campanhas, com regras diferenciadas para remoções por health (qualidade da API) e por falhas consecutivas.

---

## 🎯 Regras de Remoção

### **1️⃣ Remoção por HEALTH (Qualidade/Status da API)**

**Quando Remove:**
- Quality Rating = `YELLOW` ou `RED`
- Phone Status = `DISCONNECTED`, `FLAGGED`, `RESTRICTED`, `BANNED`

**Quando Reativa:**
- ✅ **Imediatamente** quando health melhorar
- Quality = `GREEN` + Status = `CONNECTED`
- ⏱️ **Sem tempo de espera**

**Contabilização:**
- ❌ **NÃO conta** para `removal_count`
- ❌ **NÃO leva** a remoção permanente
- ✅ Pode ser removida infinitas vezes

**Tipo no histórico:** `"health"`

---

### **2️⃣ PRIMEIRA Remoção por 5 Falhas Consecutivas**

**Quando Remove:**
- Conta atinge `5 falhas consecutivas` de envio

**Registra:**
```json
{
  "removal_count": 1,
  "permanent_removal": false,
  "removal_history": [{
    "timestamp": "2025-11-12T21:30:00Z",
    "reason": "5 falhas consecutivas",
    "type": "consecutive_failures",
    "removal_number": 1,
    "is_permanent": false
  }]
}
```

**Quando Reativa:**
**TODAS as 3 condições devem ser verdadeiras:**
1. ✅ Passou **10 minutos** desde `removed_at`
2. ✅ Quality Rating = `GREEN`
3. ✅ Phone Status = `CONNECTED`

**Exemplo:**
```
21:30 - Removida (5 falhas)
21:35 - Health: YELLOW (ainda não pode voltar)
21:40 - 10min passados, MAS health YELLOW (não volta)
21:50 - Health: GREEN + CONNECTED (VOLTA!)
```

---

### **3️⃣ SEGUNDA Remoção por 5 Falhas Consecutivas**

**Quando Remove:**
- Conta foi removida anteriormente (`removal_count` = 1)
- Atinge `5 falhas consecutivas` **NOVAMENTE**

**Registra:**
```json
{
  "removal_count": 2,
  "permanent_removal": true,
  "removal_history": [
    {
      "timestamp": "2025-11-12T21:30:00Z",
      "reason": "5 falhas consecutivas",
      "removal_number": 1,
      "reactivated_at": "2025-11-12T21:45:00Z"
    },
    {
      "timestamp": "2025-11-12T22:30:00Z",
      "reason": "5 falhas consecutivas - PERMANENTE",
      "removal_number": 2,
      "is_permanent": true
    }
  ]
}
```

**Quando Reativa:**
- ❌ **NUNCA** reativa automaticamente
- ✋ **SOMENTE reativação manual** pelo usuário
- 🔘 Botão "Reativar Manualmente" na interface

---

## 📊 Estrutura de Dados

### **Tabela: `campaign_templates`**

```sql
removal_count INTEGER DEFAULT 0
  -- Contador de remoções por falhas consecutivas
  -- NÃO conta remoções por health

permanent_removal BOOLEAN DEFAULT false
  -- true = removida permanentemente (2ª vez)
  -- Só reativa manualmente

removal_history JSONB DEFAULT '[]'
  -- Array com histórico completo
  -- Inclui remoções e reativações
```

### **Formato do Histórico:**

```json
[
  {
    "timestamp": "2025-11-12T21:30:00Z",
    "reason": "Qualidade YELLOW",
    "type": "health",
    "removal_number": null,
    "reactivated_at": "2025-11-12T21:35:00Z",
    "reactivation_reason": "Health melhorou (GREEN + CONNECTED)"
  },
  {
    "timestamp": "2025-11-12T22:00:00Z",
    "reason": "5 falhas consecutivas",
    "type": "consecutive_failures",
    "removal_number": 1,
    "is_permanent": false,
    "reactivated_at": "2025-11-12T22:15:00Z",
    "reactivation_reason": "10 minutos passados + health bom (15min)"
  },
  {
    "timestamp": "2025-11-12T23:00:00Z",
    "reason": "5 falhas consecutivas - PERMANENTE",
    "type": "consecutive_failures",
    "removal_number": 2,
    "is_permanent": true
  }
]
```

---

## 🔄 Fluxo Completo

### **Cenário 1: Health ruim e volta**
```
21:00 - Conta: GREEN + CONNECTED ✅
21:05 - API: Quality muda para YELLOW 🟡
21:05 - Worker detecta → REMOVE
        Histórico: [{type: "health", reason: "Qualidade YELLOW"}]
        removal_count: 0 (não conta)
21:10 - API: Quality volta para GREEN 🟢
21:10 - Worker detecta → REATIVA (imediato)
        Histórico: reactivated_at adicionado
```

### **Cenário 2: Primeira remoção por falhas**
```
21:30 - Falha 5 ❌
21:30 - Worker → REMOVE
        removal_count: 1
        permanent_removal: false
        Histórico: [{type: "consecutive_failures", removal_number: 1}]
21:35 - Health: YELLOW 🟡 (não pode voltar)
21:40 - 10min passados + YELLOW (não pode voltar)
21:50 - Health: GREEN + CONNECTED 🟢 + 10min passados
21:50 - Worker → REATIVA
        Zera consecutive_failures
```

### **Cenário 3: Segunda remoção (permanente)**
```
22:30 - Falha 5 novamente ❌
22:30 - Worker → REMOVE PERMANENTEMENTE
        removal_count: 2
        permanent_removal: true
        Histórico: [{removal_number: 2, is_permanent: true}]
22:40 - Health: GREEN (mas não volta automaticamente)
∞     - Precisa reativação MANUAL
```

---

## 🖥️ Interface Frontend

### **Display de Conta Ativa:**
```
🟢 681742951
📊 Qualidade: 🟢 ALTA
📱 Status: ✅ CONECTADO
📈 Limite: 10.000/dia (TIER 2)
🎬 Campanha: ✅ ATIVA E ENVIANDO
```

### **Display de Conta com Remoção Permanente:**
```
🔴 8143-7760
📊 Qualidade: 🟢 ALTA
📱 Status: ✅ CONECTADO
📈 Limite: 1.000/dia (TIER 1)
🎬 Campanha: 🚫 REMOVIDA PERMANENTEMENTE (2x remoções)

📋 Histórico de Remoções (2x):
1️⃣ #1 11/11/2025 21:30
   5 falhas consecutivas
   ↳ Reativada em 11/11/2025 21:45 - 10 minutos passados + health bom

2️⃣ #2 🚫 PERMANENTE 11/11/2025 22:30
   5 falhas consecutivas - PERMANENTE

[🔄 Reativar Manualmente]
⚠️ Conta removida permanentemente
```

---

## 🛠️ Endpoints

### **GET `/campaigns/:id/activity-log`**
Retorna health e histórico de todas as contas:
```json
{
  "activeAccounts": [
    {
      "id": 1,
      "name": "Conta 1",
      "removalCount": 2,
      "permanentRemoval": true,
      "removalHistory": [...]
    }
  ]
}
```

### **POST `/campaigns/:id/add-account`**
Reativa conta manualmente:
```json
{
  "accountId": 1
}
```
- Remove `permanent_removal = false`
- Mantém `removal_count` (histórico)
- Adiciona entrada de reativação manual no histórico

---

## 📝 Logs do Console

### **Remoção por Health:**
```
⚠️ Desativando conta 1 da campanha 30: Qualidade YELLOW
```

### **Primeira Remoção por Falhas:**
```
🚨 ═══════════════════════════════════════════════════
🚨 REMOÇÃO AUTOMÁTICA DE CONTA
🚨 Conta 1 atingiu 5 falhas consecutivas
🚨 Limite configurado: 5 falhas
🚨 Remoção #1
🚨 Aguardará 10 minutos + health bom para reativar
🚨 ═══════════════════════════════════════════════════
```

### **Segunda Remoção (Permanente):**
```
🚨 ═══════════════════════════════════════════════════
🚨 REMOÇÃO AUTOMÁTICA DE CONTA
🚨 Conta 1 atingiu 5 falhas consecutivas
🚨 Limite configurado: 5 falhas
🚨 Remoção #2
🚨 ⚠️ REMOÇÃO PERMANENTE - Só reativa manualmente!
🚨 ═══════════════════════════════════════════════════
```

### **Reativação:**
```
✅ Reativando conta 1 na campanha 30: Health melhorou (GREEN + CONNECTED)
✅ Reativando conta 2 na campanha 30: 10 minutos passados + health bom (15min)
✅ Re-adicionando MANUALMENTE conta 3 à campanha 30
```

---

## 🎯 Benefícios

✅ **Proteção Inteligente** - Diferencia problemas temporários de permanentes  
✅ **Histórico Completo** - Rastreabilidade total  
✅ **Recuperação Automática** - Volta quando possível  
✅ **Controle Manual** - Reativação quando necessário  
✅ **Transparência** - Você vê tudo que aconteceu  
✅ **Sem Perda** - Mantém histórico mesmo após reativar  

---

**Implementado em: 12/11/2025**  
**Versão: 2.0.0**

