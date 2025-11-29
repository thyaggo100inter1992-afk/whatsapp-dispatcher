# 🔍 BUSCA AVANÇADA DE TEMPLATES

## 🎯 Nova Funcionalidade: Busca com Exclusão

Agora você pode **INCLUIR** e **EXCLUIR** palavras na busca de templates!

---

## 📋 Como Funciona

### **Dois Campos de Busca:**

1. **🔍 Buscar (incluir)**
   - Mostra templates que **CONTÊM** as palavras digitadas

2. **🚫 Excluir (não mostrar)**
   - Remove templates que **CONTÊM** as palavras digitadas

---

## 💡 EXEMPLO PRÁTICO

### **Cenário:**
Você tem estes templates:
- `saque_complementar`
- `saque_fgts`
- `saque_aniversario`
- `saque_emergencial`

---

### **Busca Simples:**

**Digite no campo "Buscar":** `saque`

**Resultado:** Mostra **TODOS** os templates com "saque"
```
✅ saque_complementar
✅ saque_fgts
✅ saque_aniversario
✅ saque_emergencial
```

---

### **Busca com Exclusão:**

**Digite no campo "Buscar":** `saque`  
**Digite no campo "Excluir":** `fgts`

**Resultado:** Mostra templates com "saque", **MAS SEM** "fgts"
```
✅ saque_complementar
❌ saque_fgts (EXCLUÍDO)
✅ saque_aniversario
✅ saque_emergencial
```

---

### **Múltiplas Exclusões:**

**Digite no campo "Buscar":** `saque`  
**Digite no campo "Excluir":** `fgts, aniversario`

**Resultado:** Mostra templates com "saque", **MAS SEM** "fgts" **OU** "aniversario"
```
✅ saque_complementar
❌ saque_fgts (EXCLUÍDO)
❌ saque_aniversario (EXCLUÍDO)
✅ saque_emergencial
```

💡 **Dica:** Separe as palavras de exclusão por **vírgula**

---

## 🎨 Interface Visual

### **Campos de Busca:**

```
┌──────────────────────────────────────────────────────────┐
│ 🔍 Buscar (incluir)          🚫 Excluir (não mostrar)   │
│ [saque            ]          [fgts                  ]    │
│ Digite palavras para INCLUIR │ Digite palavras para EXCLUIR │
└──────────────────────────────────────────────────────────┘
```

### **Feedback Visual:**

Quando você digita nos campos, aparece:

```
┌──────────────────────────────────────────────────────┐
│ 📋 Filtro Ativo:                                     │
│                                                      │
│ ✅ Incluindo: templates que contêm "saque"          │
│ ❌ Excluindo: templates que contêm "fgts"           │
│                                                      │
│ 📊 Resultados: 3 template(s)                        │
└──────────────────────────────────────────────────────┘
```

---

## 📚 Casos de Uso

### **Caso 1: Filtrar Templates de Produção**

**Objetivo:** Ver apenas templates de produção, sem os de teste

- **Buscar:** _(deixe vazio)_
- **Excluir:** `teste, demo, exemplo`

**Resultado:** Todos os templates, **EXCETO** os que contêm "teste", "demo" ou "exemplo"

---

### **Caso 2: Buscar Templates de Promoção (sem Black Friday)**

**Objetivo:** Ver promoções gerais, mas não de Black Friday

- **Buscar:** `promocao`
- **Excluir:** `black, friday`

**Resultado:** Templates com "promocao", mas sem "black" ou "friday"

---

### **Caso 3: Templates de Saque Específicos**

**Objetivo:** Ver apenas saques complementares

- **Buscar:** `saque`
- **Excluir:** `fgts, aniversario, emergencial`

**Resultado:** Apenas templates com "saque" E SEM as outras palavras

---

### **Caso 4: Limpar Templates Antigos**

**Objetivo:** Encontrar templates antigos para deletar

- **Buscar:** `2023`
- **Excluir:** _(deixe vazio)_
- Selecione todos
- Delete em massa

**Resultado:** Todos os templates de 2023 deletados

---

## ⚙️ Como Funciona Tecnicamente

### **Lógica de Filtro:**

```javascript
1. Busca (INCLUIR):
   - SE digitou algo → filtra templates que CONTÊM a palavra
   - SE não digitou → mostra TODOS

2. Exclusão (EXCLUIR):
   - SE digitou algo → remove templates que CONTÊM qualquer palavra
   - Suporta MÚLTIPLAS palavras (separadas por vírgula)
   - Cada palavra é verificada individualmente

3. Resultado Final:
   - Templates que passaram pelos dois filtros
```

---

## 🎯 Exemplos Avançados

### **Exemplo 1: Combinação Complexa**

**Templates:**
```
- promocao_natal_2024
- promocao_pascoa_2024
- promocao_black_friday_2024
- confirmacao_pedido_2024
- lembrete_pagamento_2024
```

**Busca:** `2024`  
**Excluir:** `promocao, lembrete`

**Resultado:**
```
❌ promocao_natal_2024 (EXCLUÍDO - tem "promocao")
❌ promocao_pascoa_2024 (EXCLUÍDO - tem "promocao")
❌ promocao_black_friday_2024 (EXCLUÍDO - tem "promocao")
✅ confirmacao_pedido_2024
❌ lembrete_pagamento_2024 (EXCLUÍDO - tem "lembrete")
```

---

### **Exemplo 2: Busca Exata**

**Templates:**
```
- saque
- saque_fgts
- consulta_saque
```

**Busca:** `saque`  
**Excluir:** `fgts, consulta`

**Resultado:**
```
✅ saque
❌ saque_fgts (EXCLUÍDO - tem "fgts")
❌ consulta_saque (EXCLUÍDO - tem "consulta")
```

---

### **Exemplo 3: Apenas Exclusão**

**Objetivo:** Ver todos os templates, menos os de teste

**Busca:** _(vazio)_  
**Excluir:** `teste, test, demo, exemplo`

**Resultado:** Todos os templates de produção

---

## 💡 Dicas e Truques

### **Dica 1: Use Exclusão para Limpar Resultados**
```
Busca: marketing
Excluir: 2023

Resultado: Todos os templates de marketing, exceto de 2023
```

### **Dica 2: Combine com Seleção Múltipla**
```
1. Busca: teste
2. Selecionar todos
3. Deletar em massa
4. Limpa todos os templates de teste
```

### **Dica 3: Palavras Parciais**
```
Excluir: fgt

Também remove:
- saque_fgts (contém "fgt")
- consulta_fgts (contém "fgt")
```

### **Dica 4: Vírgula para Múltiplas Exclusões**
```
Excluir: teste, demo, old

Remove templates que contêm:
- teste OU
- demo OU
- old
```

---

## ⚠️ Notas Importantes

### **Case Insensitive:**
- Busca **NÃO** diferencia maiúsculas de minúsculas
- `FGTS` = `fgts` = `FgTs`

### **Busca Parcial:**
- Busca por `saque` encontra:
  - `saque_fgts`
  - `consulta_saque`
  - `novo_saque`

### **Múltiplas Exclusões:**
- Use **vírgula** para separar
- Espaços são removidos automaticamente
- `fgts, teste` = `fgts,teste` = `fgts , teste`

### **Filtros Combinados:**
- **Buscar** = filtro positivo (incluir)
- **Excluir** = filtro negativo (remover)
- Ambos podem ser usados **simultaneamente**

---

## 📊 Exemplos Reais

### **Cenário Real 1:**
```
Empresa com 50 templates
- 10 de saque
- 15 de promoção
- 10 de confirmação
- 15 de teste

Busca: (vazio)
Excluir: teste

Resultado: 35 templates (remove os 15 de teste)
```

### **Cenário Real 2:**
```
Templates de saque:
- saque_fgts_aprovado
- saque_fgts_negado
- saque_complementar_aprovado
- saque_complementar_negado
- saque_aniversario

Busca: saque, aprovado
Excluir: fgts

Resultado:
✅ saque_complementar_aprovado
(Único que tem "saque" E "aprovado" E NÃO tem "fgts")
```

---

## 🎉 Resumo

| Funcionalidade | O que faz |
|---------------|-----------|
| **🔍 Buscar** | Inclui templates que contêm a palavra |
| **🚫 Excluir** | Remove templates que contêm a palavra |
| **Vírgula** | Separa múltiplas palavras de exclusão |
| **Feedback** | Mostra filtros ativos e quantidade de resultados |
| **Combine** | Use com seleção múltipla para ações em massa |

---

## 🚀 Onde Usar

Esta funcionalidade está disponível em:

1. ✅ **Gerenciar Templates** (`/template/gerenciar`)
2. ✅ **Criar Campanha** (ao selecionar templates)

---

## 🎯 Benefícios

✅ **Encontrar templates específicos rapidamente**  
✅ **Filtrar templates de teste/produção**  
✅ **Organizar templates antigos**  
✅ **Combinar com ações em massa**  
✅ **Busca inteligente e flexível**

---

**🔍 BUSCA AVANÇADA IMPLEMENTADA COM SUCESSO!**

