# 📊 Monitoramento de Health das Contas WhatsApp

## 🎯 Objetivo

Sistema automático que monitora a saúde de cada conta WhatsApp em tempo real e gerencia automaticamente sua participação em campanhas ativas.

---

## 📋 Informações Monitoradas

### 1️⃣ Quality Rating (Qualidade da Conta)
- 🟢 **GREEN** - Conta saudável, sem restrições
- 🟡 **YELLOW** - Conta com avisos, pode ter restrições em breve
- 🔴 **RED** - Conta com problemas sérios, limite reduzido

### 2️⃣ Phone Number Status
- ✅ **CONNECTED** - Número conectado e funcionando
- ❌ **DISCONNECTED** - Número desconectado
- 🚫 **FLAGGED** - Número sinalizado
- 🔴 **RESTRICTED** - Número com restrições
- ⛔ **BANNED** - Número banido/bloqueado

### 3️⃣ Messaging Limit (Limite de Envio)
- **TIER_0** - 50 mensagens/dia
- **TIER_1** - 1.000 mensagens/dia
- **TIER_2** - 10.000 mensagens/dia
- **TIER_3** - 100.000 mensagens/dia
- **TIER_4** - Ilimitado

---

## ⚙️ Funcionamento Automático

### 🔄 Verificação Periódica
- Executa **a cada ciclo do worker** (aproximadamente a cada 10 segundos)
- Busca informações direto da **WhatsApp Business API**
- Atualiza status de todas as contas da campanha

### ❌ Remoção Automática
Uma conta é **removida automaticamente** quando:
- Quality Rating = **YELLOW** ou **RED**
- Status = **DISCONNECTED**, **FLAGGED**, **RESTRICTED** ou **BANNED**

**Ação:** `is_active` = `false` no banco de dados

### ✅ Re-adição Automática
Uma conta é **readicionada automaticamente** quando:
- Quality Rating volta para **GREEN**
- Status volta para **CONNECTED**
- Campanha ainda está **RUNNING** (não finalizada/cancelada)

**Ação:** `is_active` = `true` no banco de dados

---

## ⏸️ Pausa/Retomada de Campanha

### Pausa Automática
**Quando:** Todas as contas são removidas (0 contas ativas)
**Ação:**
1. Campanha muda para status **PAUSED**
2. Sistema aguarda contas voltarem
3. Não perde o progresso

### Retomada Automática
**Quando:** Pelo menos 1 conta volta ao normal
**Ação:**
1. Campanha volta para status **RUNNING**
2. Continua de onde parou
3. Usa as contas disponíveis

---

## 📡 Exibição no Frontend

### Log de Atividades em Tempo Real

```
👥 Contas (3) - 2 ativas

┌─────────────────────────────────────────────────┐
│ 🟢 681742951                                    │
│ 📊 Qualidade: 🟢 ALTA                           │
│ 📱 Status: ✅ CONECTADO                         │
│ 📈 Limite: 10.000/dia (TIER 2)                  │
│ 🎬 Campanha: ✅ ATIVA E ENVIANDO                │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 🟡 8143-7760                          ⚠️        │
│ 📊 Qualidade: 🟡 MÉDIA ⚠️                       │
│ 📱 Status: ✅ CONECTADO                         │
│ 📈 Limite: 1.000/dia (TIER 1)                   │
│ 🎬 Campanha: ⏸️ PAUSADA - Qualidade YELLOW     │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 🟢 8141-2569                                    │
│ 📊 Qualidade: 🟢 ALTA                           │
│ 📱 Status: ✅ CONECTADO                         │
│ 📈 Limite: 10.000/dia (TIER 2)                  │
│ 🎬 Campanha: ✅ ATIVA E ENVIANDO                │
└─────────────────────────────────────────────────┘
```

### Atualização
- ⏱️ **Tempo Real** - Atualiza a cada 3 segundos
- 🔄 Automático - Sem necessidade de recarregar a página

---

## 🔔 Notificações (Futuro)

### Toast Notifications
Quando implementados, os toasts mostrarão:

**Remoção:**
```
⚠️ Conta 8143-7760 removida automaticamente
   Motivo: Qualidade YELLOW
   Campanha continua com 2 contas
```

**Re-adição:**
```
✅ Conta 8143-7760 readicionada automaticamente
   Qualidade melhorou para GREEN
   Campanha agora com 3 contas
```

**Pausa:**
```
⏸️ Campanha pausada automaticamente
   Motivo: 0 contas disponíveis
   Aguardando contas voltarem...
```

**Retomada:**
```
▶️ Campanha retomada automaticamente
   Conta 681742951 disponível
   Continuando envios...
```

---

## 🏗️ Arquitetura

### Backend

#### `whatsapp-health.service.ts`
- Busca informações da API WhatsApp
- Valida se conta está saudável
- Formata informações para exibição

#### `campaign.worker.ts`
- Método `checkCampaignAccountsHealth()`
- Executa a cada ciclo do worker
- Atualiza `is_active` conforme health
- Pausa/retoma campanha conforme necessário

#### `campaign.controller.ts`
- Endpoint `/campaigns/:id/activity-log`
- Retorna health de todas as contas
- Inclui status na campanha

### Frontend

#### `pages/campanha/[id].tsx`
- Componente de Log de Atividades
- Exibe health das contas em tempo real
- Atualização automática a cada 3 segundos

---

## 🎯 Benefícios

✅ **Proteção Automática** - Sistema protege a campanha de contas problemáticas  
✅ **Continuidade** - Campanha continua com contas saudáveis  
✅ **Recuperação Automática** - Contas voltam quando melhoram  
✅ **Visibilidade Total** - Você vê tudo em tempo real  
✅ **Sem Intervenção Manual** - Tudo automático  
✅ **Sem Perda de Progresso** - Pausa preserva o estado  

---

## 📌 Notas Importantes

1. **Messaging Limit** é apenas informativo (não remove conta)
2. **Pausas manuais** são respeitadas (não retomam automaticamente)
3. **Campanhas finalizadas** não recebem contas de volta
4. **Health check** consulta API real do WhatsApp
5. **Latência da API** pode atrasar detecção em alguns segundos

---

## 🔧 Configuração

Nenhuma configuração necessária! O sistema funciona automaticamente para todas as campanhas ativas.

---

**Implementado em: 12/11/2025**  
**Versão: 1.0.0**

