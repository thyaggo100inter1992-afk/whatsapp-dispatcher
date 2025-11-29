# 🔄 SISTEMA DE ROTAÇÃO: INSTÂNCIAS E TEMPLATES (QR CONNECT)

## 📋 **VISÃO GERAL**

O sistema de rotação de instâncias e templates nas campanhas QR Connect utiliza o **método Round-Robin (circular)**, garantindo distribuição uniforme e equitativa.

---

## 🎯 **MÉTODO UTILIZADO: ROUND-ROBIN CIRCULAR**

### **Operador Matemático: MÓDULO (`%`)**

O operador módulo retorna o **resto da divisão**.

**Exemplos:**
- `0 % 3 = 0` (0 ÷ 3 = 0, resto 0)
- `1 % 3 = 1` (1 ÷ 3 = 0, resto 1)
- `2 % 3 = 2` (2 ÷ 3 = 0, resto 2)
- `3 % 3 = 0` (3 ÷ 3 = 1, resto 0) ← **Volta ao início**
- `4 % 3 = 1` (4 ÷ 3 = 1, resto 1)

---

## 📱 **ROTAÇÃO DE INSTÂNCIAS (Números de WhatsApp)**

### **Como funciona:**

```javascript
// A cada mensagem, calcula qual instância usar
const instanceIndex = messageIndex % campaignInstances.length;
const currentInstance = campaignInstances[instanceIndex];
```

### **Exemplo Prático:**

**Configuração:**
- 3 instâncias: `A`, `B`, `C`
- 10 mensagens para enviar

**Distribuição:**

| Mensagem # | Cálculo | Instância Usada |
|------------|---------|-----------------|
| 0 | `0 % 3 = 0` | **A** |
| 1 | `1 % 3 = 1` | **B** |
| 2 | `2 % 3 = 2` | **C** |
| 3 | `3 % 3 = 0` | **A** ← volta |
| 4 | `4 % 3 = 1` | **B** |
| 5 | `5 % 3 = 2` | **C** |
| 6 | `6 % 3 = 0` | **A** |
| 7 | `7 % 3 = 1` | **B** |
| 8 | `8 % 3 = 2` | **C** |
| 9 | `9 % 3 = 0` | **A** |

**Resultado:**
- Instância A: 4 mensagens (40%)
- Instância B: 3 mensagens (30%)
- Instância C: 3 mensagens (30%)

✅ **Distribuição uniforme e balanceada!**

---

## 📄 **ROTAÇÃO DE TEMPLATES**

### **Como funciona:**

```javascript
// A cada mensagem, calcula qual template usar
const templateIndex = messageIndex % campaignTemplates.length;
const currentTemplate = campaignTemplates[templateIndex];
```

### **Exemplo Prático:**

**Configuração:**
- 2 templates: `Template A`, `Template B`
- 10 mensagens para enviar

**Distribuição:**

| Mensagem # | Cálculo | Template Usado |
|------------|---------|----------------|
| 0 | `0 % 2 = 0` | **Template A** |
| 1 | `1 % 2 = 1` | **Template B** |
| 2 | `2 % 2 = 0` | **Template A** ← volta |
| 3 | `3 % 2 = 1` | **Template B** |
| 4 | `4 % 2 = 0` | **Template A** |
| 5 | `5 % 2 = 1` | **Template B** |
| 6 | `6 % 2 = 0` | **Template A** |
| 7 | `7 % 2 = 1` | **Template B** |
| 8 | `8 % 2 = 0` | **Template A** |
| 9 | `9 % 2 = 1` | **Template B** |

**Resultado:**
- Template A: 5 mensagens (50%)
- Template B: 5 mensagens (50%)

✅ **Distribuição perfeitamente balanceada!**

---

## 🎯 **EXEMPLO COMPLETO: INSTÂNCIAS + TEMPLATES**

### **Configuração:**
- **3 instâncias:** A, B, C
- **2 templates:** T1, T2
- **12 contatos:** Contato1, Contato2, ..., Contato12

### **Resultado:**

| Mensagem | Contato | Instância (msg % 3) | Template (msg % 2) |
|----------|---------|---------------------|---------------------|
| 0 | Contato1 | **A** (0 % 3 = 0) | **T1** (0 % 2 = 0) |
| 1 | Contato2 | **B** (1 % 3 = 1) | **T2** (1 % 2 = 1) |
| 2 | Contato3 | **C** (2 % 3 = 2) | **T1** (2 % 2 = 0) |
| 3 | Contato4 | **A** (3 % 3 = 0) | **T2** (3 % 2 = 1) |
| 4 | Contato5 | **B** (4 % 3 = 1) | **T1** (4 % 2 = 0) |
| 5 | Contato6 | **C** (5 % 3 = 2) | **T2** (5 % 2 = 1) |
| 6 | Contato7 | **A** (6 % 3 = 0) | **T1** (6 % 2 = 0) |
| 7 | Contato8 | **B** (7 % 3 = 1) | **T2** (7 % 2 = 1) |
| 8 | Contato9 | **C** (8 % 3 = 2) | **T1** (8 % 2 = 0) |
| 9 | Contato10 | **A** (9 % 3 = 0) | **T2** (9 % 2 = 1) |
| 10 | Contato11 | **B** (10 % 3 = 1) | **T1** (10 % 2 = 0) |
| 11 | Contato12 | **C** (11 % 3 = 2) | **T2** (11 % 2 = 1) |

### **Resumo:**
- **Instância A:** 4 mensagens (33,3%)
- **Instância B:** 4 mensagens (33,3%)
- **Instância C:** 4 mensagens (33,3%)
- **Template T1:** 6 mensagens (50%)
- **Template T2:** 6 mensagens (50%)

✅ **Distribuição perfeita e balanceada!**

---

## 🔍 **ONDE ESTÁ O CÓDIGO?**

### **Arquivo:** `backend/src/workers/qr-campaign.worker.ts`

### **Linha ~318-328:**
```typescript
// Determinar qual template cada contato vai usar (rotatividade)
const activeTemplatesCount = templates.length;
const startOffset = campaign.sent_count % activeTemplatesCount;

// ENVIAR MENSAGENS SEQUENCIALMENTE COM DELAY
for (let index = 0; index < contacts.length; index++) {
  const contact = contacts[index];
  
  // 🔄 ROTAÇÃO DE TEMPLATE
  const templateIndex = (startOffset + index) % activeTemplatesCount;
  const template = templates[templateIndex];
  
  // Cada template já tem sua instância associada
  console.log(`🎯 Contato ${contact.phone_number} → Instância ${template.instance_name} → Template ${template.template_name}`);
  
  await this.sendMessage(campaign, contact, template);
}
```

**Observação importante:**
- Cada **template está vinculado a uma instância específica**
- Portanto, ao rotacionar templates, automaticamente rotaciona as instâncias também

---

## ✅ **CARACTERÍSTICAS DO SISTEMA**

| Característica | Descrição |
|----------------|-----------|
| **Método** | Round-Robin (Circular) |
| **Distribuição** | Uniforme e balanceada |
| **Independência** | Rotação de templates inclui rotação de instâncias |
| **Automático** | Não requer configuração manual |
| **Persistente** | Continua do ponto onde parou após pausas |
| **Previsível** | Sempre segue a mesma ordem |

---

## 🎯 **VANTAGENS DO MÉTODO ROUND-ROBIN**

1. **✅ Distribuição Uniforme:** Todas as instâncias enviam aproximadamente a mesma quantidade
2. **✅ Balanceamento de Carga:** Nenhuma instância fica sobrecarregada
3. **✅ Simples e Eficiente:** Usa apenas uma operação matemática (%)
4. **✅ Previsível:** Ordem sempre consistente
5. **✅ Escalável:** Funciona com qualquer quantidade de instâncias/templates

---

## 📊 **SIMULAÇÃO: 100 MENSAGENS COM 5 INSTÂNCIAS**

```
Instância 0: 20 mensagens (20%)
Instância 1: 20 mensagens (20%)
Instância 2: 20 mensagens (20%)
Instância 3: 20 mensagens (20%)
Instância 4: 20 mensagens (20%)
```

✅ **Distribuição perfeita em todas as situações!**

---

## 🔄 **PERSISTÊNCIA APÓS PAUSA**

Quando uma campanha é pausada e retomada:

```javascript
const startOffset = campaign.sent_count % activeTemplatesCount;
```

**Exemplo:**
- 3 templates disponíveis
- 7 mensagens já foram enviadas
- `startOffset = 7 % 3 = 1` ← **Começa do Template 1** (não do 0)

✅ **Continua exatamente de onde parou!**

---

## 📝 **RESUMO EXECUTIVO**

- 🔄 **Rotação:** Circular (Round-Robin)
- 🎯 **Algoritmo:** Operador módulo (`%`)
- 📊 **Distribuição:** Uniforme e balanceada
- ⚙️ **Configuração:** Automática
- ✅ **Status:** Funcionando perfeitamente

---

**Documentação criada em:** 18/11/2025  
**Sistema:** Disparador WhatsApp QR Connect  
**Versão:** 1.0







