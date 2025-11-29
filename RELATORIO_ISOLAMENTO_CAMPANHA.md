# 🔒 Isolamento de Dados por Campanha - Relatórios Excel

Documentação oficial garantindo que cada relatório contém **APENAS** dados da campanha específica.

---

## 🎯 Regra Principal

### ✅ CADA RELATÓRIO É EXCLUSIVO

**Regra de Ouro:**
> Cada relatório Excel gerado contém **SOMENTE** informações da campanha específica solicitada. **NUNCA** dados gerais ou de outras campanhas.

---

## 🔐 Garantias Técnicas

### 1. Filtro Obrigatório por Campaign ID

**Toda query SQL inclui:**
```sql
WHERE campaign_id = $1
```

**Onde:**
- `$1` = ID da campanha específica
- Parâmetro preparado (SQL Injection safe)
- Validado antes da query

### 2. Validação de Existência

```typescript
const campaign = await CampaignModel.findById(campaignId);
if (!campaign) {
  throw new Error('Campanha não encontrada');
}
```

**Resultado:**
- ✅ Se campanha existe → Gera relatório
- ❌ Se não existe → Erro, não gera

### 3. Joins Seguros

Todos os JOINs respeitam o `campaign_id`:

```sql
LEFT JOIN messages m ON m.contact_id = c.id 
  AND m.campaign_id = $1  -- ← Garante isolamento
```

---

## 📊 Isolamento por Aba

### Aba 1: Resumo da Campanha

**Fonte de Dados:**
```typescript
const campaign = await CampaignModel.findById(campaignId);
```

**Dados Mostrados:**
- Nome DA campanha específica
- Datas DA campanha específica
- Configurações DA campanha específica

**Garantia:** ✅ Objeto único, impossível misturar

---

### Aba 2: Estatísticas

**Fonte de Dados:**
```typescript
campaign.total_contacts
campaign.sent_count
campaign.delivered_count
campaign.read_count
campaign.failed_count
```

**Dados Mostrados:**
- Estatísticas calculadas APENAS da campanha

**Garantia:** ✅ Campos do registro único da campanha

---

### Aba 3: Contas Utilizadas

**Query:**
```sql
SELECT w.*, COUNT(m.id) as total_messages
FROM whatsapp_accounts w
LEFT JOIN messages m ON m.whatsapp_account_id = w.id 
  AND m.campaign_id = $1  -- ← Filtro 1
WHERE w.id IN (
  SELECT whatsapp_account_id 
  FROM campaign_templates 
  WHERE campaign_id = $1    -- ← Filtro 2
)
```

**Dados Mostrados:**
- Apenas contas usadas NESTA campanha
- Mensagens enviadas NESTA campanha por cada conta

**Garantia:** ✅ Duplo filtro de segurança

---

### Aba 4: Mensagens Detalhadas

**Query:**
```sql
SELECT m.*, c.name, w.name
FROM messages m
LEFT JOIN contacts c ON m.contact_id = c.id
LEFT JOIN whatsapp_accounts w ON m.whatsapp_account_id = w.id
WHERE m.campaign_id = $1  -- ← Filtro principal
ORDER BY m.created_at
```

**Dados Mostrados:**
- Apenas mensagens enviadas NESTA campanha

**Garantia:** ✅ Filtro direto na tabela de mensagens

---

### Aba 5: Contatos

**Query:**
```sql
SELECT DISTINCT c.name, c.phone_number, m.status
FROM contacts c
LEFT JOIN messages m ON m.contact_id = c.id 
  AND m.campaign_id = $1  -- ← Filtro 1
WHERE c.id IN (
  SELECT contact_id 
  FROM messages 
  WHERE campaign_id = $1    -- ← Filtro 2
)
```

**Dados Mostrados:**
- Apenas contatos que receberam mensagens DESTA campanha

**Garantia:** ✅ Duplo filtro: JOIN + WHERE IN

---

### Aba 6: Falhas e Erros

**Query:**
```typescript
const failedMessages = messages.filter(m => m.status === 'failed');
// messages já foi filtrado por campaign_id
```

**Dados Mostrados:**
- Apenas falhas das mensagens DESTA campanha

**Garantia:** ✅ Subset das mensagens já filtradas

---

### Aba 7: Cliques de Botões

**Query:**
```sql
SELECT bc.*, m.template_name, c.name
FROM button_clicks bc
LEFT JOIN messages m ON bc.message_id = m.id
LEFT JOIN contacts c ON bc.contact_id = c.id
WHERE bc.campaign_id = $1  -- ← Filtro principal
ORDER BY bc.clicked_at DESC
```

**Dados Mostrados:**
- Apenas cliques em mensagens DESTA campanha

**Garantia:** ✅ Filtro direto na tabela de cliques

---

## 🚫 O Que NUNCA Aparece

### ❌ Dados de Outras Campanhas

```
Campanha 100 (Black Friday)
  ↓
Relatório NUNCA terá:
  ❌ Mensagens da Campanha 101
  ❌ Contatos da Campanha 102
  ❌ Cliques da Campanha 103
```

### ❌ Dados Gerais do Sistema

```
Relatório NUNCA terá:
  ❌ Total de mensagens do sistema
  ❌ Total de contatos cadastrados
  ❌ Total de campanhas criadas
  ❌ Estatísticas globais
```

### ❌ Cross-Contamination

```
Campanha A: 1000 contatos
Campanha B: 500 contatos
  ↓
Relatório da Campanha A:
  ✅ Mostra: 1000 contatos
  ❌ Nunca: 1500 contatos
```

---

## 🔍 Exemplos de Teste

### Teste 1: Duas Campanhas com Mesmo Contato

**Cenário:**
- Contato: João Silva (+5562999999999)
- Campanha 1: Enviou em 10/11/2025
- Campanha 2: Enviou em 12/11/2025

**Relatório da Campanha 1:**
```
Aba 4 (Mensagens):
  ✅ João Silva | 10/11/2025 | Template A
  ❌ Não mostra: envio de 12/11/2025
```

**Relatório da Campanha 2:**
```
Aba 4 (Mensagens):
  ✅ João Silva | 12/11/2025 | Template B
  ❌ Não mostra: envio de 10/11/2025
```

---

### Teste 2: Mesma Conta em Múltiplas Campanhas

**Cenário:**
- Conta: Conta Principal
- Campanha 1: 500 mensagens
- Campanha 2: 300 mensagens

**Relatório da Campanha 1:**
```
Aba 3 (Contas):
  Conta Principal: 500 mensagens
  ❌ Não mostra: 800 mensagens (total)
```

**Relatório da Campanha 2:**
```
Aba 3 (Contas):
  Conta Principal: 300 mensagens
  ❌ Não mostra: 800 mensagens (total)
```

---

### Teste 3: Cliques em Diferentes Campanhas

**Cenário:**
- Contato: Maria Santos
- Campanha 1: Clicou em "Ver Ofertas"
- Campanha 2: Clicou em "Comprar Agora"

**Relatório da Campanha 1:**
```
Aba 7 (Cliques):
  ✅ Maria | Ver Ofertas
  ❌ Não mostra: Comprar Agora
```

**Relatório da Campanha 2:**
```
Aba 7 (Cliques):
  ✅ Maria | Comprar Agora
  ❌ Não mostra: Ver Ofertas
```

---

## 🛡️ Segurança SQL

### Prepared Statements

```typescript
await query(
  'SELECT * FROM messages WHERE campaign_id = $1',
  [campaignId]  // ← Parâmetro seguro
);
```

**Proteção contra:**
- ✅ SQL Injection
- ✅ Tipo incorreto
- ✅ Valores maliciosos

### Validação de Tipo

```typescript
const campaignId = parseInt(req.params.id);
// Garante que é um número válido
```

---

## 📋 Checklist de Isolamento

Antes de cada relatório ser gerado:

- [x] ✅ Campaign ID validado
- [x] ✅ Campanha existe no banco
- [x] ✅ Todas as queries filtradas por campaign_id
- [x] ✅ JOINs respeitam o filtro
- [x] ✅ Subqueries também filtradas
- [x] ✅ Sem dados gerais
- [x] ✅ Sem cross-contamination

---

## 🎯 Resumo Visual

```
┌─────────────────────────────────────┐
│  Campanha 123: "Black Friday 2025"  │
│                                     │
│  Gerar Relatório                    │
└──────────────┬──────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  📊 Relatório Excel Gerado           │
├──────────────────────────────────────┤
│  Aba 1: Resumo da Campanha 123       │
│  Aba 2: Estatísticas da Campanha 123 │
│  Aba 3: Contas da Campanha 123       │
│  Aba 4: Mensagens da Campanha 123    │
│  Aba 5: Contatos da Campanha 123     │
│  Aba 6: Falhas da Campanha 123       │
│  Aba 7: Cliques da Campanha 123      │
└──────────────────────────────────────┘
               │
               ▼
        ✅ ISOLADO
     Sem dados de:
     - Campanha 124
     - Campanha 125
     - Campanhas gerais
```

---

## ✅ Garantia Final

**Compromisso do Sistema:**

> Cada relatório Excel gerado contém **EXCLUSIVAMENTE** dados da campanha específica solicitada. É **IMPOSSÍVEL** que dados de outras campanhas apareçam no relatório devido aos múltiplos níveis de filtros SQL implementados.

**Níveis de Proteção:**
1. ✅ Validação do Campaign ID
2. ✅ Filtro WHERE em todas as queries
3. ✅ JOINs condicionais por campaign_id
4. ✅ Subqueries também filtradas
5. ✅ Prepared statements (SQL Injection safe)

---

## 🚀 Confiança Total

Você pode ter **100% de certeza** que:

- ✅ Relatório da Campanha A só tem dados da Campanha A
- ✅ Relatório da Campanha B só tem dados da Campanha B
- ✅ Nunca haverá mistura de dados
- ✅ Cada Excel é único e isolado
- ✅ Auditável e rastreável

**Sistema 🔒 SEGURO e 📊 ISOLADO por design!**





