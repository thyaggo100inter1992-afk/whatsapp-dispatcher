# 🐛 BUG CRÍTICO: Botões de Campanhas Misturados

## ❌ Problema Identificado

### **Sintoma:**
Página de "Botões da Campanha" de **QR Connect** estava mostrando cliques de campanhas **WhatsApp Business API**.

**Screenshot do problema:**
- Usuário na área de QR Connect
- Estatísticas mostrando botões: "SIM, QUERO SABER", "NÃO TENHO INTERESSE", etc.
- **Esses botões são de campanhas da API Oficial, NÃO de QR Connect!**

---

## 🔍 Análise

### **Causa Raiz:**

A tabela `button_clicks` **não distinguia** o tipo de campanha:

```sql
-- ANTES (ERRADO):
CREATE TABLE button_clicks (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER,  -- ← Pode ser ID de QR OU API!
  button_text VARCHAR,
  -- ...
);
```

**Problema:**
- Campanha QR ID=1 
- Campanha API ID=1
- **SÃO DIFERENTES**, mas compartilham a mesma tabela!

---

## 📊 Evidências

### **Verificação da tabela:**

```sql
SELECT 
  bc.campaign_id,
  CASE 
    WHEN c.id IS NOT NULL THEN 'WhatsApp Business API'
    WHEN qc.id IS NOT NULL THEN 'QR Connect'
    ELSE 'Desconhecido'
  END as campaign_type,
  COUNT(*) as total_clicks
FROM button_clicks bc
LEFT JOIN campaigns c ON bc.campaign_id = c.id
LEFT JOIN qr_campaigns qc ON bc.campaign_id = qc.id
GROUP BY bc.campaign_id, c.id, qc.id;
```

**Resultado:**
```
ID | Tipo                    | Total Cliques
---|------------------------|---------------
1  | WhatsApp Business API  | 2
19 | WhatsApp Business API  | 14
37 | WhatsApp Business API  | 36
...
```

**TODOS os cliques eram de campanhas API!**

---

## ✅ Solução Implementada

### **1. Adicionada coluna `campaign_type`:**

```sql
ALTER TABLE button_clicks
ADD COLUMN campaign_type VARCHAR(20) DEFAULT 'whatsapp_api';
```

**Valores possíveis:**
- `'whatsapp_api'` - Campanha WhatsApp Business API
- `'qr_connect'` - Campanha QR Connect

---

### **2. Atualizado Controller QR:**

```typescript
// ANTES (ERRADO):
SELECT * FROM button_clicks 
WHERE campaign_id = $1

// DEPOIS (CORRETO):
SELECT * FROM button_clicks 
WHERE campaign_id = $1 AND campaign_type = 'qr_connect'
```

**Arquivos modificados:**
- `backend/src/controllers/qr-campaign.controller.ts`

---

### **3. Atualizado Webhooks:**

**QR Connect Webhook:**
```typescript
INSERT INTO button_clicks (..., campaign_type)
VALUES (..., 'qr_connect')  // ← Agora marca como QR
```

**WhatsApp API Webhook:**
```typescript
INSERT INTO button_clicks (..., campaign_type)
VALUES (..., 'whatsapp_api')  // ← Marca como API
```

**Arquivos modificados:**
- `backend/src/controllers/qr-webhook.controller.ts`
- `backend/src/controllers/webhook.controller.ts`

---

### **4. Criados Índices:**

```sql
CREATE INDEX idx_button_clicks_campaign_type 
ON button_clicks(campaign_type);

CREATE INDEX idx_button_clicks_campaign_id_type 
ON button_clicks(campaign_id, campaign_type);
```

**Benefício:** Consultas mais rápidas.

---

## 🎯 Antes vs Depois

### **ANTES (ERRADO):**

```
┌─────────────────────────┐
│  QR Connect Campanha 1  │
│  (mostrando botões)     │
└─────────────────────────┘
          ↓
    [button_clicks]
    WHERE campaign_id = 1
          ↓
    Retorna cliques da
    API Campanha 1
          ↓
❌ DADOS ERRADOS!
```

---

### **DEPOIS (CORRETO):**

```
┌─────────────────────────┐
│  QR Connect Campanha 1  │
│  (mostrando botões)     │
└─────────────────────────┘
          ↓
    [button_clicks]
    WHERE campaign_id = 1
    AND campaign_type = 'qr_connect'
          ↓
    Retorna cliques APENAS
    da QR Campanha 1
          ↓
✅ DADOS CORRETOS!
```

---

## 📋 Checklist de Correção

- [x] Identificado o problema
- [x] Criada migração do banco
- [x] Executada migração
- [x] Atualizado controller QR
- [x] Atualizado webhook QR
- [x] Atualizado webhook API
- [x] Criados índices
- [x] Backend reiniciado
- [ ] Testado em produção

---

## 🧪 Como Testar

### **1. Limpar tabela de teste:**

```sql
-- Limpar cliques de teste
DELETE FROM button_clicks 
WHERE campaign_type IS NULL 
  OR campaign_id NOT IN (
    SELECT id FROM qr_campaigns
    UNION
    SELECT id FROM campaigns
  );
```

### **2. Criar campanha QR com botões:**

1. Vá em **Campanhas QR** → **Nova Campanha**
2. Selecione template com **botões** ou **lista**
3. Adicione contatos
4. Envie

### **3. Simular clique:**

```sql
-- Simular clique de botão em campanha QR
INSERT INTO button_clicks (
  campaign_id, phone_number, button_text, 
  button_payload, clicked_at, campaign_type
) VALUES (
  1, '5562993204885', 'SIM, QUERO SABER', 
  'yes', NOW(), 'qr_connect'
);
```

### **4. Verificar estatísticas:**

1. Vá em **Campanhas QR** → **Detalhes da Campanha**
2. Scroll até "Botões da Campanha"
3. **Deve mostrar apenas cliques QR Connect** ✅
4. **NÃO deve mostrar cliques da API** ✅

---

## 🔍 Debug

### **Ver distribuição de cliques:**

```sql
SELECT 
  campaign_type,
  COUNT(*) as total_clicks,
  COUNT(DISTINCT campaign_id) as unique_campaigns
FROM button_clicks
GROUP BY campaign_type;
```

**Resultado esperado:**
```
campaign_type    | total_clicks | unique_campaigns
-----------------|--------------|------------------
whatsapp_api     | 165          | 8
qr_connect       | 5            | 2
```

---

### **Ver cliques por campanha específica:**

```sql
-- Campanha QR
SELECT * FROM button_clicks 
WHERE campaign_id = 1 AND campaign_type = 'qr_connect';

-- Campanha API
SELECT * FROM button_clicks 
WHERE campaign_id = 1 AND campaign_type = 'whatsapp_api';
```

---

## 🚨 Impacto do Bug

### **Antes da correção:**

- ❌ Estatísticas **ERRADAS**
- ❌ Dados **MISTURADOS** entre QR e API
- ❌ Impossível saber quais botões são de qual tipo
- ❌ Relatórios **INCORRETOS**
- ❌ Tomada de decisão baseada em **DADOS FALSOS**

### **Depois da correção:**

- ✅ Estatísticas **CORRETAS**
- ✅ Dados **SEPARADOS** por tipo
- ✅ Rastreamento **PRECISO**
- ✅ Relatórios **CONFIÁVEIS**
- ✅ Decisões baseadas em **DADOS REAIS**

---

## 📝 Lições Aprendidas

### **1. Sempre distinguir tipos de entidade**

Quando há dois tipos de campanhas, **sempre** adicionar campo de tipo:
```sql
campaign_type VARCHAR(20) NOT NULL
```

### **2. Índices compostos**

Para consultas com múltiplos WHERE, criar índice composto:
```sql
INDEX(campaign_id, campaign_type)
```

### **3. Validar dados históricos**

Ao adicionar nova coluna, verificar e **corrigir dados antigos**:
```sql
UPDATE table SET new_column = 'default' WHERE new_column IS NULL;
```

### **4. Testar separação de dados**

Sempre verificar se queries estão retornando **apenas** dados do tipo correto.

---

## 🎓 Prevenção

### **Checklist para novos recursos:**

- [ ] Há múltiplos tipos da mesma entidade?
- [ ] Tabelas compartilhadas precisam de campo `type`?
- [ ] Queries filtram pelo tipo correto?
- [ ] Webhooks salvam o tipo correto?
- [ ] Controllers filtram pelo tipo correto?
- [ ] Há índices para melhor performance?
- [ ] Dados históricos foram atualizados?

---

## ✅ Status

**BUG:** 🐛 Crítico - Dados Misturados  
**SEVERIDADE:** Alta  
**IMPACTO:** Estatísticas incorretas  
**STATUS:** ✅ **CORRIGIDO**  
**DATA:** 18/11/2024  
**ARQUIVOS:** 6 modificados, 1 migração criada

---

## 📞 Contato

Se encontrar outros casos de dados misturados:
1. Verifique se há campo `campaign_type` ou similar
2. Execute query de verificação
3. Reporte imediatamente

---

**Desenvolvido para:** Sistema Disparador WhatsApp  
**Módulos afetados:** QR Connect, WhatsApp Business API  
**Prioridade:** 🔴 **CRÍTICA**  
**Resolvido por:** AI Assistant  
**Data:** 18/11/2024 23:35







