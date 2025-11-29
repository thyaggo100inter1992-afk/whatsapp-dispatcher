# 🔧 FIX: Problema de Rotação de Instâncias

## 🐛 Problema Identificado

O sistema estava enviando todas as mensagens de apenas **UMA instância** porque a ordem de criação dos templates estava errada.

### Como estava (ERRADO):
```
order_index 0-9:   Instância 1 com todos os 10 templates
order_index 10-19: Instância 2 com todos os 10 templates  
order_index 20-29: Instância 3 com todos os 10 templates
...
```

Como o worker processa poucos contatos por vez, ele sempre pegava os primeiros índices (0-9), que eram **TODOS da mesma instância**!

### Como deve ser (CORRETO):
```
order_index 0-4:   Template 1 com todas as 5 instâncias (rotação)
order_index 5-9:   Template 2 com todas as 5 instâncias (rotação)
order_index 10-14: Template 3 com todas as 5 instâncias (rotação)
...
```

Agora as **instâncias alternam primeiro**, garantindo distribuição balanceada!

---

## ✅ Correções Aplicadas

### 1. ✅ **Código de Criação Corrigido** (`qr-campaign.controller.ts`)
   - **Antes:** `for (instanceId) { for (templateId) { ... } }`
   - **Depois:** `for (templateId) { for (instanceId) { ... } }`
   - Agora **novas campanhas** já serão criadas com a ordem correta!

### 2. ✅ **Endpoint de Correção Criado**
   - Rota: `POST /api/qr-campaigns/:id/reorder-templates`
   - Reordena templates de campanhas **já existentes**

### 3. ✅ **Script SQL Disponível** (`fix-campaign-15-order.sql`)
   - Para correção manual via banco de dados (se preferir)

---

## 🚀 Como Corrigir a Campanha 15

### Opção 1: Via API (Recomendado)

**1. Pausar a campanha:**
```bash
POST http://localhost:3001/api/qr-campaigns/15/pause
```

**2. Reordenar os templates:**
```bash
POST http://localhost:3001/api/qr-campaigns/15/reorder-templates
```

**3. Retomar a campanha:**
```bash
POST http://localhost:3001/api/qr-campaigns/15/resume
```

### Opção 2: Via SQL (Banco de Dados)

Execute o arquivo `fix-campaign-15-order.sql` no PostgreSQL:

```bash
psql -U seu_usuario -d seu_banco -f fix-campaign-15-order.sql
```

---

## 📊 Resultado Esperado

Após a correção, você verá nos logs:

```
🎯 Contato 1 → Instância 556298669726
🎯 Contato 2 → Instância 556200000000  ← DIFERENTE!
🎯 Contato 3 → Instância 556311111111  ← DIFERENTE!
🎯 Contato 4 → Instância 556422222222  ← DIFERENTE!
🎯 Contato 5 → Instância 556533333333  ← DIFERENTE!
🎯 Contato 6 → Instância 556298669726  ← Volta pra primeira (rodízio)
```

As **5 instâncias** vão alternar automaticamente! ✅

---

## 🔍 Verificação

Após reordenar, você pode verificar a nova ordem com:

```bash
GET http://localhost:3001/api/qr-campaigns/15/accounts-status
```

Ou verificar nos logs do sistema quando enviar as próximas mensagens.

---

## 📌 Importante

- ✅ **Novas campanhas:** Já serão criadas com a ordem correta
- ⚠️ **Campanhas antigas:** Precisam ser reordenadas usando o endpoint ou SQL
- 🔄 **Rotação automática:** O worker já faz o rodízio, só precisa da ordem correta

---

## 🎯 Status

- [x] Problema identificado
- [x] Código corrigido
- [x] Endpoint de correção criado
- [x] Script SQL disponível
- [ ] **Campanha 15 precisa ser corrigida** ← AÇÃO NECESSÁRIA

---

## 💡 Dúvidas?

Se tiver alguma dúvida sobre a correção, me avise!

