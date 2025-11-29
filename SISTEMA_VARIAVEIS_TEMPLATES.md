# 🔧 SISTEMA DE VARIÁVEIS EM TEMPLATES

## ✅ STATUS: IMPLEMENTADO COMPLETAMENTE

---

## 📋 O QUE FOI IMPLEMENTADO

### 1. **Sistema de Variáveis Dinâmicas**
   - ✅ Formato: `{{variavel}}`
   - ✅ Suporte para variáveis personalizadas (`{{nome}}`, `{{valor}}`, etc)
   - ✅ Variáveis automáticas do sistema (preenchidas automaticamente)

### 2. **Variáveis Automáticas Disponíveis**
   
   | Variável | Descrição | Exemplo |
   |----------|-----------|---------|
   | `{{data}}` | Data atual | `16/11/2025` |
   | `{{hora}}` | Hora atual | `14:30` |
   | `{{protocolo}}` | Código aleatório de 6 caracteres | `A8F2K9` |
   | `{{saudacao}}` | Saudação baseada na hora | `Bom dia`, `Boa tarde`, `Boa noite` |

### 3. **Detecção Automática ao Criar Template**
   - ✅ Variáveis são detectadas em tempo real enquanto você digita
   - ✅ Indicadores visuais:
     - 🟢 **Verde com ✨**: Variáveis automáticas (sistema preenche)
     - 🔵 **Azul**: Variáveis personalizadas (você preenche)
   - ✅ Ajuda contextual mostrando variáveis disponíveis

### 4. **Modal de Preenchimento ao Carregar Template**
   - ✅ Abre automaticamente se o template tem variáveis
   - ✅ Campos para preencher variáveis personalizadas
   - ✅ Preview em tempo real do texto com variáveis substituídas
   - ✅ Validação: não permite enviar sem preencher variáveis obrigatórias

### 5. **Dois Modos de Envio**
   
   **📤 Enviar Direto**
   - Substitui variáveis
   - Envia imediatamente
   - Usa instância e número já selecionados
   
   **✏️ Editar Antes**
   - Substitui variáveis
   - Abre formulário de envio
   - Permite ajustes finais antes de enviar

---

## 🎯 COMO USAR

### **Passo 1: Criar Template com Variáveis**

1. Acesse: **Dashboard → Templates QR Connect → Criar Template**
2. Digite o texto com variáveis no formato `{{nome_da_variavel}}`

**Exemplo:**
```
{{saudacao}}, {{nome}}! 👋

Seu pedido #{{protocolo}} foi confirmado!

Valor: R$ {{valor}}
Data: {{data}}
Horário: {{hora}}

Obrigado pela preferência! 🎉
```

3. As variáveis serão detectadas automaticamente e mostradas abaixo do campo de texto
4. Salve o template normalmente

---

### **Passo 2: Usar Template no Envio Único**

1. Acesse: **Dashboard → Envio Único**
2. Selecione **Instância** e digite o **Número**
3. Clique em **"📥 Carregar Template"**
4. Escolha o template desejado

---

### **Passo 3: Preencher Variáveis**

Se o template tiver variáveis, o **Modal de Variáveis** abrirá automaticamente:

**🟢 Variáveis Automáticas (já preenchidas):**
- `{{data}}` → **16/11/2025**
- `{{hora}}` → **14:30**
- `{{protocolo}}` → **A8F2K9**
- `{{saudacao}}` → **Boa tarde**

**🔵 Variáveis Personalizadas (você preenche):**
- `{{nome}}` → Digite o nome do cliente
- `{{valor}}` → Digite o valor
- etc.

**👁️ Preview em Tempo Real:**
- Veja exatamente como a mensagem ficará
- Atualiza automaticamente conforme você digita

---

### **Passo 4: Escolher Modo de Envio**

**Opção A: 📤 Enviar Direto**
- Clique em **"📤 Enviar Direto"**
- A mensagem é enviada imediatamente
- Não permite edições

**Opção B: ✏️ Editar Antes**
- Clique em **"✏️ Editar Antes"**
- O formulário de envio é preenchido com o texto já substituído
- Você pode fazer ajustes finais
- Envie quando estiver pronto

---

## 📚 EXEMPLOS PRÁTICOS

### **Exemplo 1: Confirmação de Pedido**
```
{{saudacao}}, {{nome}}! 🎉

Seu pedido foi confirmado com sucesso!

🔖 Protocolo: {{protocolo}}
📅 Data: {{data}} às {{hora}}
💰 Valor Total: R$ {{valor}}

Em breve você receberá atualizações sobre a entrega!

Obrigado pela confiança! 😊
```

**Variáveis automáticas:**
- `{{saudacao}}` → "Bom dia" (baseado na hora atual)
- `{{protocolo}}` → "K9L2M5" (gerado automaticamente)
- `{{data}}` → "16/11/2025"
- `{{hora}}` → "14:30"

**Variáveis que você preenche:**
- `{{nome}}` → "João Silva"
- `{{valor}}` → "149,90"

**Resultado:**
```
Boa tarde, João Silva! 🎉

Seu pedido foi confirmado com sucesso!

🔖 Protocolo: K9L2M5
📅 Data: 16/11/2025 às 14:30
💰 Valor Total: R$ 149,90

Em breve você receberá atualizações sobre a entrega!

Obrigado pela confiança! 😊
```

---

### **Exemplo 2: Lembrete de Consulta**
```
{{saudacao}}, Dr(a). {{nome_medico}}! 🩺

Lembrete: Consulta agendada para {{data_consulta}} às {{hora_consulta}}

👤 Paciente: {{nome_paciente}}
📋 Tipo: {{tipo_consulta}}
📍 Local: {{local}}

Protocolo: {{protocolo}}

Qualquer dúvida, entre em contato! 📞
```

---

### **Exemplo 3: Cobrança Personalizada**
```
Olá {{nome}}, {{saudacao}}! 💳

Este é um lembrete sobre sua fatura:

📄 Vencimento: {{data_vencimento}}
💰 Valor: R$ {{valor}}
🔖 Código: {{protocolo}}

Para pagar, acesse: {{link_pagamento}}

Data atual: {{data}}

Obrigado! 🙏
```

---

## 🎨 RECURSOS VISUAIS

### **Na Criação do Template:**
- 🟢 Tags verdes com ✨: Variáveis automáticas
- 🔵 Tags azuis: Variáveis personalizadas
- 💡 Dica mostrando variáveis disponíveis

### **No Modal de Variáveis:**
- 🤖 Seção verde: Variáveis automáticas (readonly)
- 👤 Seção azul: Campos para preencher
- 👁️ Preview em tempo real
- ✅ Validação antes de enviar

---

## 🛠️ ARQUIVOS CRIADOS

1. **`frontend/src/utils/templateVariables.ts`**
   - Funções para detectar variáveis
   - Gerar valores automáticos
   - Substituir variáveis no texto

2. **`frontend/src/components/TemplateVariablesModal.tsx`**
   - Modal para preencher variáveis
   - Preview em tempo real
   - Botões "Enviar Direto" e "Editar Antes"

3. **Integrações:**
   - `frontend/src/pages/qr-templates/criar.tsx` → Detecção ao criar
   - `frontend/src/pages/uaz/enviar-mensagem-unificado.tsx` → Modal ao carregar

---

## ✅ VALIDAÇÕES IMPLEMENTADAS

- ✅ Não permite enviar sem preencher variáveis personalizadas obrigatórias
- ✅ Mensagens de erro claras indicando quais variáveis estão faltando
- ✅ Preview atualiza em tempo real conforme você digita
- ✅ Variáveis do sistema são sempre preenchidas automaticamente

---

## 🎯 DICAS PARA USAR

1. **Use nomes descritivos para variáveis:**
   - ✅ `{{nome_cliente}}`, `{{data_entrega}}`
   - ❌ `{{n}}`, `{{d1}}`

2. **Aproveite as variáveis automáticas:**
   - `{{saudacao}}` adapta-se automaticamente ao horário
   - `{{protocolo}}` gera códigos únicos para cada envio
   - `{{data}}` e `{{hora}}` sempre atuais

3. **Use preview para verificar:**
   - Sempre confira o preview antes de enviar
   - Garante que o texto está correto

4. **Organize templates por contexto:**
   - "Confirmação de Pedido"
   - "Lembrete de Consulta"
   - "Cobrança Mensal"
   - etc.

---

## 🚀 PRONTO PARA USAR!

O sistema está **100% funcional** e pronto para uso imediato!

**Teste agora:**
1. Crie um template com variáveis
2. Carregue no Envio Único
3. Preencha as variáveis no modal
4. Escolha enviar direto ou editar antes

---

## 📞 SUPORTE

Qualquer dúvida ou problema, avise! 😊










