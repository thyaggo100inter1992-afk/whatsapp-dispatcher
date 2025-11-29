# 🔄 Sistema de Pausa de Instância com Redistribuição Automática

## 📋 Como Funciona

Quando você **pausa uma instância** durante uma campanha ativa, o sistema trata ela **exatamente como se tivesse desconectado**. As outras instâncias automaticamente **assumem os envios** que seriam feitos pela instância pausada.

---

## 🎯 Comportamento do Sistema

### **1️⃣ Campanha com 5 Instâncias Rodando**

```
📊 Campanha QR: 100 mensagens para enviar
🔄 5 instâncias ativas (A, B, C, D, E)
📤 Distribuição: 20 mensagens cada

Mensagem 1 → Instância A
Mensagem 2 → Instância B
Mensagem 3 → Instância C
Mensagem 4 → Instância D
Mensagem 5 → Instância E
Mensagem 6 → Instância A (volta para o início)
...
```

---

### **2️⃣ Você Pausa a Instância B no Meio da Campanha**

```bash
⏸️ Instância 556298669726 (ID: 13) pausada
   ⚠️  10 template(s) desativado(s) nas campanhas ativas
```

**O que acontece:**
- ❌ Instância B **sai da rotação** imediatamente
- ✅ Mensagens que seriam dela são **redistribuídas** automaticamente
- 🔄 Campanhas continuam com as **4 instâncias restantes** (A, C, D, E)

```
📊 Campanha continua automaticamente:
🔄 4 instâncias ativas agora (A, C, D, E)
📤 Nova distribuição: ~25 mensagens cada

Mensagem 13 → Instância A
Mensagem 14 → Instância C (pulou a B)
Mensagem 15 → Instância D
Mensagem 16 → Instância E
Mensagem 17 → Instância A
Mensagem 18 → Instância C (B ainda pausada)
...
```

---

### **3️⃣ Você Despausa a Instância B**

```bash
▶️ Instância 556298669726 (ID: 13) ativada
   ✅ Templates serão reativados automaticamente nas campanhas ativas

✅ ═══════════════════════════════════════════
✅  INSTÂNCIAS RECONECTADAS/DESPAUSADAS DETECTADAS
✅  Campanha ID: 15
✅  Quantidade: 10
✅ ═══════════════════════════════════════════

✅ [QR Worker] Instância "556298669726" (ID: 13) DESPAUSADA e REATIVADA na campanha 15
```

**O que acontece:**
- ✅ Instância B **volta para a rotação** automaticamente
- 🔄 Sistema volta a ter **5 instâncias ativas** (A, B, C, D, E)
- 📤 Mensagens são redistribuídas entre as 5 novamente

```
📊 Campanha continua com 5 instâncias:
🔄 5 instâncias ativas (A, B, C, D, E)
📤 Distribuição volta ao normal: 20 mensagens cada

Mensagem 50 → Instância A
Mensagem 51 → Instância B (voltou!)
Mensagem 52 → Instância C
Mensagem 53 → Instância D
Mensagem 54 → Instância E
Mensagem 55 → Instância A
...
```

---

## 🎮 Exemplos Práticos

### **Exemplo 1: Pausa Durante Envio**

```
Situação: Campanha enviando 100 mensagens
Já enviadas: 30 mensagens
Instâncias: A, B, C, D, E (5 ativas)

[Você pausa instância C]

Resultado:
- Mensagens 31-100 são enviadas apenas pelas instâncias A, B, D, E
- Cada uma envia ~17-18 mensagens (ao invés de 14)
- Campanha continua normalmente, apenas mais lenta
```

---

### **Exemplo 2: Pausa Múltiplas Instâncias**

```
Situação: Campanha rodando com 5 instâncias

[Você pausa instâncias B e D]

Resultado:
- Apenas 3 instâncias ficam ativas: A, C, E
- Mensagens são redistribuídas entre as 3
- Campanha fica ~40% mais lenta (perdeu 2 de 5 instâncias)

[Você despausa B e D]

Resultado:
- Voltam as 5 instâncias
- Velocidade volta ao normal
```

---

### **Exemplo 3: Pausa TODAS as Instâncias**

```
[Você clica em "Pausar Todas"]

⏸️ 5 instância(s) pausada(s)
   ⚠️  50 template(s) desativado(s) nas campanhas ativas

Resultado:
- ⏸️ TODAS as campanhas QR pausam AUTOMATICAMENTE
- ⚠️ Nenhuma mensagem é enviada
- 📊 Progresso é SALVO (continua de onde parou)

[Você clica em "Ativar Todas"]

▶️ 5 instância(s) ativada(s)
   ✅ Templates serão reativados automaticamente nas campanhas ativas

Resultado:
- ▶️ Campanhas RETOMAM automaticamente
- 📤 Envios continuam de onde pararam
- 🔄 Distribuição volta ao normal
```

---

## 🔍 Como o Sistema Funciona Internamente

### **Query de Templates (Round-Robin)**

```sql
SELECT ct.*, i.*, t.*
FROM qr_campaign_templates ct
LEFT JOIN uaz_instances i ON ct.instance_id = i.id
LEFT JOIN qr_templates t ON ct.qr_template_id = t.id
WHERE ct.campaign_id = $1 
  AND ct.is_active = true          -- ✅ Template ativo
  AND i.is_connected = true        -- ✅ Instância conectada
  AND i.is_active = true           -- ✅ Instância NÃO pausada
```

**Resultado:**
- ✅ Retorna apenas instâncias **conectadas E não pausadas**
- 🔄 Templates de instâncias pausadas **não aparecem**
- 📤 Mensagens são distribuídas entre as instâncias **retornadas**

---

### **Algoritmo de Distribuição**

```typescript
// 1. Agrupar templates por instância
const templatesByInstance = groupByInstance(allTemplates);
const instanceIds = Array.from(templatesByInstance.keys());
const numInstances = instanceIds.length; // 5 → 4 quando pausar uma

// 2. Calcular qual instância usar (round-robin)
const currentSentCount = campaign.sent_count + index;
const instanceIndex = currentSentCount % numInstances; // 0, 1, 2, 3, 4 → 0, 1, 2, 3
const selectedInstanceId = instanceIds[instanceIndex];

// 3. Selecionar template dentro da instância
const instanceTemplates = templatesByInstance.get(selectedInstanceId);
const templateIndex = Math.floor(currentSentCount / numInstances) % instanceTemplates.length;
const template = instanceTemplates[templateIndex];
```

**Quando pausa 1 instância:**
- `numInstances` muda de `5` para `4`
- Distribuição automática: `sent_count % 4` ao invés de `% 5`
- Templates "pulam" a instância pausada naturalmente

---

## ⚡ Vantagens do Sistema

✅ **Redistribuição Automática**: Sem intervenção manual  
✅ **Sem Perda de Progresso**: Campanha continua de onde parou  
✅ **Flexibilidade Total**: Pause/ative instâncias a qualquer momento  
✅ **Balanceamento Dinâmico**: Carga distribuída entre instâncias ativas  
✅ **Logs Claros**: Sempre sabe o que está acontecendo  
✅ **Reativação Automática**: Basta despausar para voltar à rotação  

---

## 📊 Comparação: Antes vs Depois

### **❌ ANTES (Problema)**
```
5 instâncias configuradas
Enviando sempre da mesma (bug)
Pausa não afetava campanhas ativas
```

### **✅ DEPOIS (Solução)**
```
5 instâncias ativas
Distribuição round-robin real
Pausa = remove da rotação
Despausa = volta para a rotação
```

---

## 🧪 Como Testar

### **Teste 1: Pausa Durante Envio**
1. Inicie campanha QR com 5 instâncias
2. Aguarde enviar ~10 mensagens
3. Pause UMA instância
4. Observe logs: apenas 4 instâncias enviando
5. Despausa a instância
6. Observe: volta a usar 5 instâncias

### **Teste 2: Pausa Todas**
1. Campanha QR rodando
2. Clique em "Pausar Todas"
3. Observe: campanha para completamente
4. Clique em "Ativar Todas"
5. Observe: campanha retoma automaticamente

### **Teste 3: Pausa/Despausa Rápida**
1. Campanha rodando
2. Pausa instância A
3. Aguarda 10 segundos
4. Despausa instância A
5. Observe: volta para a rotação normal

---

## 🎯 Casos de Uso

### **Manutenção de Instância**
```
Problema: Precisa reiniciar o WhatsApp de uma instância
Solução: Pausa a instância, faz manutenção, despausa
Resultado: Campanhas continuam com outras instâncias
```

### **Controle de Carga**
```
Problema: Instância A recebendo muitas mensagens
Solução: Pause temporariamente para distribuir melhor
Resultado: Carga redistribuída entre as outras
```

### **Fim do Expediente**
```
Problema: Quer parar envios durante a noite
Solução: "Pausar Todas" no fim do dia
Resultado: Nenhuma mensagem enviada
Manhã: "Ativar Todas" para retomar
```

### **Teste de Estabilidade**
```
Problema: Quer testar campanha com menos instâncias
Solução: Pause algumas instâncias
Resultado: Teste com carga real distribuída
```

---

## 🔧 Logs do Sistema

### **Quando Pausar**
```bash
⏸️ Instância 556298669726 (ID: 13) pausada
   ⚠️  10 template(s) desativado(s) nas campanhas ativas

🔄 [QR Worker] 4 instância(s) ativa(s) para envio
📊 [DEBUG] Total de templates: 40 (10 templates por instância)

🔍 [DEBUG] Distribuição de templates por instância:
   Instância 556298669727 (ID: 14): 10 template(s)
   Instância 556298669728 (ID: 15): 10 template(s)
   Instância 556298669729 (ID: 16): 10 template(s)
   Instância 556298669730 (ID: 17): 10 template(s)
```

### **Quando Despausar**
```bash
▶️ Instância 556298669726 (ID: 13) ativada
   ✅ Templates serão reativados automaticamente nas campanhas ativas

✅ ═══════════════════════════════════════════
✅  INSTÂNCIAS RECONECTADAS/DESPAUSADAS DETECTADAS
✅  Campanha ID: 15
✅  Quantidade: 10
✅ ═══════════════════════════════════════════

✅ [QR Worker] Instância "556298669726" (ID: 13) DESPAUSADA e REATIVADA na campanha 15

🔄 [QR Worker] 5 instância(s) ativa(s) para envio
📊 [DEBUG] Total de templates: 50 (10 templates por instância)
```

---

## ✅ Implementação Completa

O sistema agora:
- ✅ Filtra instâncias pausadas da rotação
- ✅ Redistribui mensagens automaticamente
- ✅ Reativa instâncias despausadas
- ✅ Mantém progresso das campanhas
- ✅ Logs detalhados de todas operações
- ✅ Funciona com pausa individual e em massa

**Tudo automático. Tudo transparente. Tudo funcionando!** 🚀







