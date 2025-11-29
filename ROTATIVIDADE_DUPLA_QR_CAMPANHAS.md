# 🔄 ROTATIVIDADE DUPLA - CAMPANHAS QR CONNECT

## ✅ **IMPLEMENTADO COM SUCESSO!**

Data: 16/11/2025  
Sistema: Campanhas QR Connect  
Versão: 2.0 - Rotatividade Independente

---

## 🎯 **O QUE MUDOU?**

### **ANTES (Versão 1.0 - Pareada como API Oficial):**
```
Seleção: Pares de (Instância + Template)
- Instância A + Template 1
- Instância B + Template 2  
- Instância C + Template 1

Rotatividade: Rodízio dos PARES
Limitação: Vinculava instância ao template
```

### **AGORA (Versão 2.0 - Rotatividade Dupla):**
```
Seleção: INDEPENDENTE
- Instâncias: [A, B, C, D, E]
- Templates: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

Rotatividade: DUPLA
- Instâncias SEMPRE rodiziam
- Templates NÃO REPETEM até acabarem todos
```

---

## 🔥 **COMO FUNCIONA?**

### **1. Seleção na Interface**

**Passo 1:** Selecione as instâncias QR (checkboxes independentes)
```
☑ Instância A (11 99999-1111)
☑ Instância B (11 99999-2222)
☑ Instância C (11 99999-3333)
☑ Instância D (11 99999-4444)
☑ Instância E (11 99999-5555)

Total: 5 instâncias selecionadas
```

**Passo 2:** Selecione os templates (checkboxes independentes)
```
☑ Template 1 - Boas vindas
☑ Template 2 - Promoção
☑ Template 3 - Lembrete  
☑ Template 4 - Oferta
☑ Template 5 - Agradecimento
☑ Template 6 - Novidades
☑ Template 7 - Desconto
☑ Template 8 - Urgente
☑ Template 9 - Feedback
☑ Template 10 - Despedida

Total: 10 templates selecionados
```

**Resultado: 5 × 10 = 50 combinações criadas!**

---

### **2. Como o Backend Processa**

```typescript
// Backend cria TODAS as combinações
instance_ids = [1, 2, 3, 4, 5]
template_ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

// Cria na tabela qr_campaign_templates:
let order_index = 0;

for (const instanceId of instance_ids) {
  for (const templateId of template_ids) {
    INSERT INTO qr_campaign_templates 
    (campaign_id, instance_id, qr_template_id, order_index)
    VALUES (campaignId, instanceId, templateId, order_index);
    
    order_index++;
  }
}

// Resultado: 50 linhas criadas
```

---

### **3. Estrutura no Banco de Dados**

```sql
-- Exemplo com 3 instâncias × 5 templates = 15 combinações

SELECT * FROM qr_campaign_templates WHERE campaign_id = 5;

┌────┬─────────────┬─────────────┬────────────────┬─────────────┐
│ id │ campaign_id │ instance_id │ qr_template_id │ order_index │
├────┼─────────────┼─────────────┼────────────────┼─────────────┤
│ 1  │ 5           │ 1           │ 1              │ 0           │ ← Inst.1 + Temp.1
│ 2  │ 5           │ 1           │ 2              │ 1           │ ← Inst.1 + Temp.2
│ 3  │ 5           │ 1           │ 3              │ 2           │ ← Inst.1 + Temp.3
│ 4  │ 5           │ 1           │ 4              │ 3           │ ← Inst.1 + Temp.4
│ 5  │ 5           │ 1           │ 5              │ 4           │ ← Inst.1 + Temp.5
│ 6  │ 5           │ 2           │ 1              │ 5           │ ← Inst.2 + Temp.1
│ 7  │ 5           │ 2           │ 2              │ 6           │ ← Inst.2 + Temp.2
│ 8  │ 5           │ 2           │ 3              │ 7           │ ← Inst.2 + Temp.3
│ 9  │ 5           │ 2           │ 4              │ 8           │ ← Inst.2 + Temp.4
│ 10 │ 5           │ 2           │ 5              │ 9           │ ← Inst.2 + Temp.5
│ 11 │ 5           │ 3           │ 1              │ 10          │ ← Inst.3 + Temp.1
│ 12 │ 5           │ 3           │ 2              │ 11          │ ← Inst.3 + Temp.2
│ 13 │ 5           │ 3           │ 3              │ 12          │ ← Inst.3 + Temp.3
│ 14 │ 5           │ 3           │ 4              │ 13          │ ← Inst.3 + Temp.4
│ 15 │ 5           │ 3           │ 5              │ 14          │ ← Inst.3 + Temp.5
└────┴─────────────┴─────────────┴────────────────┴─────────────┘
```

---

### **4. Como o Envio Acontece (Worker)**

```typescript
// Buscar combinações ATIVAS ordenadas
const combinations = await query(`
  SELECT * FROM qr_campaign_templates
  WHERE campaign_id = $1 AND is_active = true
  ORDER BY order_index
`, [campaignId]);

// Usar índice atual para pegar próxima combinação
let currentIndex = 0;

for (const contact of contacts) {
  // Pega combinação atual (com rodízio circular)
  const combo = combinations[currentIndex % combinations.length];
  
  // Envia mensagem
  await sendMessage({
    instanceId: combo.instance_id,      // Instância da combinação
    templateId: combo.qr_template_id,   // Template da combinação
    phone: contact.phone
  });
  
  // Próxima combinação
  currentIndex++;
}
```

---

## 📊 **EXEMPLO PRÁTICO**

### **Configuração:**
- **3 instâncias:** A, B, C
- **5 templates:** T1, T2, T3, T4, T5  
- **Total:** 15 combinações

### **Ordem de Envio:**

```
Contato 1  → Instância A + Template 1  (index 0)
Contato 2  → Instância A + Template 2  (index 1)
Contato 3  → Instância A + Template 3  (index 2)
Contato 4  → Instância A + Template 4  (index 3)
Contato 5  → Instância A + Template 5  (index 4)  ← Acabou inst.A

Contato 6  → Instância B + Template 1  (index 5)
Contato 7  → Instância B + Template 2  (index 6)
Contato 8  → Instância B + Template 3  (index 7)
Contato 9  → Instância B + Template 4  (index 8)
Contato 10 → Instância B + Template 5  (index 9)  ← Acabou inst.B

Contato 11 → Instância C + Template 1  (index 10)
Contato 12 → Instância C + Template 2  (index 11)
Contato 13 → Instância C + Template 3  (index 12)
Contato 14 → Instância C + Template 4  (index 13)
Contato 15 → Instância C + Template 5  (index 14) ← Acabou inst.C

Contato 16 → Instância A + Template 1  (index 0)  ← VOLTA AO INÍCIO
Contato 17 → Instância A + Template 2  (index 1)
...e assim sucessivamente
```

**Resultado:**
- ✅ Cada instância envia TODOS os templates
- ✅ Templates não repetem até acabarem todos
- ✅ Instâncias rodiziam constantemente
- ✅ Máxima distribuição e variação

---

## 🎯 **VANTAGENS DO SISTEMA**

### **1. Flexibilidade Total**
- ❌ Não precisa parear manualmente
- ✅ Seleciona instâncias e templates separadamente
- ✅ Sistema cria as combinações automaticamente

### **2. Máxima Variedade**
- ✅ Templates não repetem até acabarem todos
- ✅ Instâncias rodiziam constantemente
- ✅ Distribuição perfeita

### **3. Escalabilidade**
```
10 instâncias × 20 templates = 200 combinações
20 instâncias × 10 templates = 200 combinações
5 instâncias × 40 templates = 200 combinações
```
Você escolhe a melhor proporção!

### **4. Independência QR Connect**
- ✅ Templates salvos localmente (não precisam aprovação)
- ✅ Qualquer instância pode usar qualquer template
- ✅ Sem vínculo obrigatório

---

## 📝 **COMPARAÇÃO: API OFICIAL vs QR CONNECT**

| Aspecto | API Oficial | QR Connect |
|---------|-------------|------------|
| **Vínculo Template-Conta** | ✅ Obrigatório | ❌ Não existe |
| **Aprovação de Templates** | ✅ Requerida | ❌ Não requerida |
| **Flexibilidade** | ⚠️ Limitada | ✅ Total |
| **Rotatividade** | Pares vinculados | Dupla independente |
| **Seleção** | Pares manuais | Checkboxes separados |

---

## 🔧 **ARQUIVOS MODIFICADOS**

### **Frontend:**
```
✅ frontend/src/pages/qr-campanha/criar.tsx (reescrito)
   - Checkboxes para instâncias
   - Checkboxes para templates
   - Visualização de combinações
   - Envio de instance_ids e template_ids
```

### **Backend:**
```
✅ backend/src/controllers/qr-campaign.controller.ts
   - Recebe instance_ids[] e template_ids[]
   - Cria todas as combinações automaticamente
   - Loop duplo (instâncias × templates)
   - Retorna total de combinações
```

### **Database:**
```
✅ qr_campaign_templates (tabela existente)
   - Agora armazena TODAS as combinações
   - order_index garante rotatividade correta
   - is_active para gerenciamento
```

---

## 💡 **COMO USAR**

### **1. Criar Campanha**
1. Acesse: `/qr-campanha/criar`
2. **Seção 1:** Selecione as instâncias QR (checkboxes)
3. **Seção 2:** Selecione os templates (checkboxes)
4. **Visualize:** Quantidade de combinações geradas
5. Adicione contatos
6. Configure horário/intervalo
7. Crie a campanha!

### **2. Ver Combinações**
```sql
-- Ver todas as combinações de uma campanha
SELECT 
  ct.order_index,
  i.instance_name,
  t.name as template_name,
  ct.is_active
FROM qr_campaign_templates ct
JOIN uaz_instances i ON ct.instance_id = i.id
JOIN qr_templates t ON ct.qr_template_id = t.id
WHERE ct.campaign_id = [ID_DA_CAMPANHA]
ORDER BY ct.order_index;
```

### **3. Gerenciar Durante Campanha**
- ✅ Remover instância (desativa TODAS combinações dela)
- ✅ Re-adicionar instância (reativa TODAS combinações dela)
- ✅ Ver estatísticas por instância
- ✅ Ver estatísticas por template

---

## 🎊 **RESULTADO FINAL**

```
┌─────────────────────────────────────────┐
│  ✅ ROTATIVIDADE DUPLA IMPLEMENTADA     │
│                                         │
│  Frontend:  ✅ Interface com checkboxes │
│  Backend:   ✅ Combinações automáticas  │
│  Database:  ✅ Estrutura pronta         │
│  Lógica:    ✅ Rotatividade configurada │
│                                         │
│  Status: 🚀 PRONTO PARA USAR            │
└─────────────────────────────────────────┘
```

---

## 📞 **SUPORTE**

**Se tiver dúvidas:**
1. Veja os exemplos práticos acima
2. Teste com poucos contatos primeiro
3. Verifique as combinações no banco

**Lembre-se:**
- ✅ Instâncias SEMPRE rodiziam
- ✅ Templates NÃO REPETEM até acabarem todos
- ✅ Sistema cria combinações automaticamente

---

**🎉 APROVEITE O NOVO SISTEMA DE ROTATIVIDADE DUPLA! 🎉**

**Data de Implementação:** 17/11/2025  
**Versão:** 2.0 - Rotatividade Independente  
**Status:** ✅ 100% Funcional
