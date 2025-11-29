# 🔄 SISTEMA DE GERENCIAMENTO DE CONTAS EM CAMPANHAS

## 🎯 PROBLEMA RESOLVIDO

**ANTES:**
- Se uma conta apresentasse problemas durante uma campanha, não havia como removê-la
- A conta problemática continuava gerando erros
- Era necessário pausar toda a campanha manualmente
- Perda de tempo e eficiência

**AGORA:**
- ✅ **Remoção manual** de contas com problemas
- ✅ **Remoção automática** após X falhas consecutivas
- ✅ **Redistribuição automática** dos contatos
- ✅ **Re-adicionar contas** quando o problema for corrigido
- ✅ **Visualização em tempo real** do status de cada conta
- ✅ **Todos os contatos recebem mensagem** (sem perda)

---

## 🚀 FUNCIONALIDADES

### **1. Visualização de Status das Contas**
- Ver todas as contas da campanha
- Quantidade de mensagens enviadas por conta
- Quantidade de falhas por conta
- Falhas consecutivas de cada conta
- Último erro registrado
- Status (ativa/removida)

### **2. Remoção Manual de Contas**
- Botão para remover conta temporariamente
- Confirmação antes de remover
- Redistribuição automática dos contatos restantes
- Toast notification confirmando a remoção

### **3. Remoção Automática**
- Configurável (padrão: 5 falhas consecutivas)
- Sistema monitora falhas de cada conta
- Remove automaticamente quando atinge o limite
- Log detalhado no console do backend
- Toast notification alertando sobre remoção

### **4. Re-adicionar Contas**
- Botão para reativar conta removida
- Zera contador de falhas
- Conta volta à rotação imediatamente
- Redistribuição automática

### **5. Redistribuição Inteligente**
- **Automática e instantânea**
- Apenas contatos FUTUROS são redistribuídos
- Balanceamento igual entre contas ativas
- Sem perda de contatos

### **6. Configuração Personalizável**
- Definir limite de falhas consecutivas (0-50)
- 0 = Desabilita remoção automática
- Configuração salva no banco de dados
- Aplicável por campanha

---

## 📋 COMO USAR

### **Passo 1: Acessar Gerenciador de Contas**

1. Vá em: **Campanhas**
2. Encontre uma campanha **Em Execução** ou **Pausada**
3. Clique no botão **👥** (Gerenciar Contas)

### **Passo 2: Visualizar Status**

Você verá:

```
┌─────────────────────────────────────────────────────────────┐
│ 📊 GERENCIAR CONTAS DA CAMPANHA                             │
├─────────────────────────────────────────────────────────────┤
│ Contas Ativas: 3                                            │
│ Contas Removidas: 0                                         │
│ Total de Contas: 3                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ⚙️ CONFIGURAÇÃO DE REMOÇÃO AUTOMÁTICA                       │
├─────────────────────────────────────────────────────────────┤
│ Remover conta após: [5] falhas consecutivas                │
│ [Salvar]                                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ✅ CONTAS ATIVAS (3)                                        │
├─────────────────────────────────────────────────────────────┤
│ ✅ Conta A (+5562999999999)                                 │
│    📊 Enviadas: 45 | ❌ Falhas: 0                           │
│    ⚠️ Falhas consecutivas: 0                                │
│    [Remover]                                                │
├─────────────────────────────────────────────────────────────┤
│ ✅ Conta B (+5562888888888)                                 │
│    📊 Enviadas: 43 | ❌ Falhas: 1                           │
│    ⚠️ Falhas consecutivas: 0                                │
│    [Remover]                                                │
├─────────────────────────────────────────────────────────────┤
│ ✅ Conta C (+5562777777777)                                 │
│    📊 Enviadas: 2 | ❌ Falhas: 3                            │
│    ⚠️ Falhas consecutivas: 3                                │
│    Último erro: Token expirado                              │
│    [Remover]                                                │
└─────────────────────────────────────────────────────────────┘
```

### **Passo 3: Remover Conta Manualmente**

1. Clique em **[Remover]** na conta problemática
2. Confirme a remoção
3. Toast aparece: "✅ Conta removida! 2 conta(s) ativa(s) restante(s)"
4. Sistema continua enviando com as contas restantes

### **Passo 4: Re-adicionar Conta**

1. Corrija o problema (ex: renove o token)
2. A conta aparecerá em "CONTAS REMOVIDAS"
3. Clique em **[Re-adicionar]**
4. Conta volta à rotação imediatamente

---

## 🔄 REDISTRIBUIÇÃO AUTOMÁTICA

### **Como Funciona:**

```
CENÁRIO: 90 contatos, 3 contas (A, B, C)

═══════════════════════════════════════════════════════════
FASE 1: Todas as contas ativas (enviados: 0-30)
═══════════════════════════════════════════════════════════

Rotação: A → B → C → A → B → C...

Contato 1  → Conta A ✅
Contato 2  → Conta B ✅
Contato 3  → Conta C ✅
Contato 4  → Conta A ✅
...
Contato 30 → Conta C ✅

Distribuição: A=10, B=10, C=10

═══════════════════════════════════════════════════════════
🚨 CONTA C REMOVIDA (falhas ou manual)
═══════════════════════════════════════════════════════════

Sistema recalcula:
✅ Enviados: 30
📊 Faltam: 60
📱 Contas ativas: A, B
🔄 Nova rotação: A → B → A → B...

═══════════════════════════════════════════════════════════
FASE 2: Só A e B ativas (enviados: 30-70)
═══════════════════════════════════════════════════════════

Contato 31 → Conta A ✅ (redistribuição começa)
Contato 32 → Conta B ✅
Contato 33 → Conta A ✅
Contato 34 → Conta B ✅
...
Contato 70 → Conta B ✅

Distribuição ADICIONAL: A=20, B=20

═══════════════════════════════════════════════════════════
✅ CONTA C RE-ADICIONADA
═══════════════════════════════════════════════════════════

Sistema recalcula:
✅ Enviados: 70
📊 Faltam: 20
📱 Contas ativas: A, B, C
🔄 Nova rotação: A → B → C → A → B → C...

═══════════════════════════════════════════════════════════
FASE 3: A, B, C ativas novamente (enviados: 70-90)
═══════════════════════════════════════════════════════════

Contato 71 → Conta A ✅
Contato 72 → Conta B ✅
Contato 73 → Conta C ✅ (conta C volta!)
Contato 74 → Conta A ✅
...
Contato 90 → Conta C ✅

Distribuição ADICIONAL: A≈7, B≈7, C≈6

═══════════════════════════════════════════════════════════
📊 RESULTADO FINAL
═══════════════════════════════════════════════════════════

Conta A: 37 mensagens (10+20+7)
Conta B: 37 mensagens (10+20+7)
Conta C: 16 mensagens (10+0+6) - Ficou fora na Fase 2

TOTAL: 90 mensagens ✅
TODOS os contatos receberam!
```

### **Regras da Redistribuição:**

1. ✅ Apenas contatos **FUTUROS** são afetados
2. ✅ Contatos já enviados **NÃO mudam**
3. ✅ Redistribuição é **instantânea e automática**
4. ✅ Balanceamento **sempre igualitário** entre contas ativas
5. ✅ **Nenhum contato fica sem receber** mensagem

---

## 🤖 REMOÇÃO AUTOMÁTICA

### **Funcionamento:**

1. Sistema monitora **falhas consecutivas** de cada conta
2. Quando uma mensagem **falha**:
   - Incrementa `consecutive_failures`
   - Salva `last_error`
3. Quando uma mensagem tem **sucesso**:
   - Zera `consecutive_failures`
4. Se `consecutive_failures` >= limite configurado:
   - Remove conta automaticamente
   - Log detalhado no console
   - Toast notification
   - Redistribuição automática

### **Log do Backend:**

```
❌ Erro ao enviar para 5511999998888: Token expirado
⚠️ Falhas consecutivas da conta 5: 1

❌ Erro ao enviar para 5511888887777: Token expirado
⚠️ Falhas consecutivas da conta 5: 2

❌ Erro ao enviar para 5511777776666: Token expirado
⚠️ Falhas consecutivas da conta 5: 3

❌ Erro ao enviar para 5511666665555: Token expirado
⚠️ Falhas consecutivas da conta 5: 4

❌ Erro ao enviar para 5511555554444: Token expirado
⚠️ Falhas consecutivas da conta 5: 5

🚨 ═══════════════════════════════════════════════════
🚨 REMOÇÃO AUTOMÁTICA DE CONTA
🚨 Conta 5 atingiu 5 falhas consecutivas
🚨 Limite configurado: 5 falhas
🚨 ═══════════════════════════════════════════════════

✅ Conta 5 REMOVIDA automaticamente da campanha
📊 Contas ativas restantes: 2
🔄 Redistribuição automática ativada para próximo envio
```

### **Configuração:**

- Padrão: **5 falhas consecutivas**
- Mínimo: **0** (desabilita remoção automática)
- Máximo: **50**
- Recomendado: **5-10** falhas

---

## ⚙️ ARQUITETURA TÉCNICA

### **Backend:**

#### **Banco de Dados:**
```sql
-- Novas colunas em campaign_templates
ALTER TABLE campaign_templates ADD COLUMN is_active BOOLEAN DEFAULT true;
ALTER TABLE campaign_templates ADD COLUMN consecutive_failures INTEGER DEFAULT 0;
ALTER TABLE campaign_templates ADD COLUMN last_error TEXT;
ALTER TABLE campaign_templates ADD COLUMN removed_at TIMESTAMP;

-- Nova coluna em campaigns
ALTER TABLE campaigns ADD COLUMN auto_remove_account_failures INTEGER DEFAULT 5;
```

#### **Endpoints:**
```
GET  /api/campaigns/:id/accounts-status       - Obter status das contas
POST /api/campaigns/:id/remove-account        - Remover conta manualmente
POST /api/campaigns/:id/add-account           - Re-adicionar conta
PUT  /api/campaigns/:id/auto-remove-config    - Atualizar config de remoção
```

#### **Worker (campaign.worker.ts):**
- Busca apenas templates com `is_active = true`
- Incrementa `consecutive_failures` em caso de falha
- Zera `consecutive_failures` em caso de sucesso
- Remove automaticamente se atingir limite
- Redistribuição automática (busca sempre contas ativas)

### **Frontend:**

#### **Componente:**
```
CampaignAccountsManager.tsx
- Visualização em tempo real (atualiza a cada 3s)
- Gerenciamento de contas
- Configuração de limite
- Toast notifications
```

#### **Integração:**
```
campanhas.tsx
- Botão "Gerenciar Contas" (ícone 👥)
- Apenas para campanhas running/paused
- Modal com CampaignAccountsManager
- Toast notifications integradas
```

---

## 💡 CASOS DE USO

### **Caso 1: Token Expirado**

```
Problema: Token da Conta C expirou

1. Sistema detecta 5 falhas consecutivas
2. Remove Conta C automaticamente
3. Toast: "⚠️ Conta C removida (5 falhas)"
4. Campanha continua com A e B
5. Você renova o token da Conta C
6. Re-adiciona Conta C
7. Toast: "✅ Conta C re-adicionada!"
8. Campanha continua com A, B e C
```

### **Caso 2: Conta Problemática**

```
Problema: Conta B está com problemas intermitentes

1. Você abre "Gerenciar Contas"
2. Vê: "Conta B - Falhas consecutivas: 3"
3. Clica em [Remover] na Conta B
4. Toast: "✅ Conta B removida!"
5. Campanha continua com A e C
6. Você corrige o problema da Conta B
7. Re-adiciona Conta B
8. Campanha volta ao normal
```

### **Caso 3: Balanceamento**

```
Situação: Quer retirar uma conta para balancear melhor

1. Campanha com 3 contas (A, B, C)
2. Conta C está mais lenta
3. Remove Conta C manualmente
4. Contatos restantes são divididos entre A e B
5. Campanha termina mais rápido
```

---

## 🛡️ PROTEÇÕES

### **1. Nenhuma conta ativa:**
```
Se TODAS as contas forem removidas:
→ Campanha é PAUSADA automaticamente
→ Toast: "⚠️ Campanha pausada! Nenhuma conta ativa."
→ Você deve re-adicionar pelo menos uma conta
```

### **2. Contador de falhas:**
```
Falhas CONSECUTIVAS são contadas
Se houver 1 SUCESSO, o contador zera
Isso evita remoção desnecessária
```

### **3. Confirmação:**
```
Todas as ações (remover/adicionar) exigem confirmação
Evita ações acidentais
```

---

## 📊 ESTATÍSTICAS

### **Sem Gerenciamento:**
- Conta problemática = Campanha pausada
- Necessário intervenção manual
- Perda de tempo
- Contatos podem ficar sem receber

### **Com Gerenciamento:**
- ✅ Remoção automática em segundos
- ✅ Zero intervenção (se configurado)
- ✅ 100% dos contatos recebem
- ✅ Campanha nunca para

---

## 🎯 RESUMO

| Funcionalidade | Descrição |
|----------------|-----------|
| **Visualização** | Status de cada conta em tempo real |
| **Remoção Manual** | Botão para remover conta |
| **Remoção Automática** | Remove após X falhas (padrão: 5) |
| **Re-adicionar** | Botão para reativar conta |
| **Redistribuição** | Automática e instantânea |
| **Configuração** | Limite de falhas personalizável |
| **Toast** | Notificações não intrusivas |
| **Logs** | Detalhados no console backend |
| **Proteção** | Pausa se nenhuma conta ativa |

---

## 🚀 BENEFÍCIOS

✅ **Resiliência**: Campanha continua mesmo com contas problemáticas  
✅ **Automação**: Sistema cuida da remoção automaticamente  
✅ **Controle**: Você tem opção manual quando necessário  
✅ **Transparência**: Visualização completa do status  
✅ **Eficiência**: Sem perda de contatos ou tempo  
✅ **Flexibilidade**: Re-adicionar contas a qualquer momento  
✅ **UX**: Toast notifications elegantes  

---

## 📝 OBSERVAÇÕES

### **Importante:**
- A redistribuição **NÃO afeta** contatos já enviados
- Apenas contatos **futuros** são redistribuídos
- O sistema sempre busca **balanceamento igual**
- **Todos os contatos** sempre recebem mensagem

### **Recomendações:**
- Mantenha limite em **5 falhas** (padrão)
- Monitore a tela "Gerenciar Contas" regularmente
- Corrija problemas de token antes de re-adicionar
- Use remoção manual para teste e ajustes

---

**🎉 SISTEMA DE GERENCIAMENTO DE CONTAS IMPLEMENTADO COM SUCESSO!**

**Agora suas campanhas são resilientes e inteligentes!** 🚀

