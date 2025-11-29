# ✅ Sistema de Validações - Criar Campanha QR Connect

## 🎯 Visão Geral

Sistema completo de validações com notificações visuais para garantir que todas as configurações estejam corretas antes de criar uma campanha QR Connect.

---

## 🔍 Validações Implementadas

### **1️⃣ VALIDAÇÃO DE NOME DA CAMPANHA**

**Regras:**
- ❌ Campo não pode estar vazio
- ❌ Deve ter pelo menos 3 caracteres

**Notificações:**
```
❌ Digite o nome da campanha!
❌ O nome da campanha deve ter pelo menos 3 caracteres!
```

**Exemplo:**
- ✅ "Promoção Black Friday 2024"
- ❌ "ab" (muito curto)
- ❌ "" (vazio)

---

### **2️⃣ VALIDAÇÃO DE INSTÂNCIAS**

**Regras:**
- ❌ Deve selecionar pelo menos UMA instância
- ⚠️ Apenas instâncias CONECTADAS e ATIVAS aparecem
- ⚠️ Instâncias pausadas não aparecem

**Notificações:**
```
❌ Selecione pelo menos uma instância QR Connect!
💡 Você precisa selecionar uma instância para enviar as mensagens.
```

**Casos especiais:**
- Se houver instâncias pausadas: aviso sobre reativação
- Se não houver instâncias conectadas: aviso para conectar

---

### **3️⃣ VALIDAÇÃO DE TEMPLATES**

**Regras:**
- ❌ Deve selecionar pelo menos UM template
- ✅ Pode selecionar múltiplos templates

**Notificações:**
```
❌ Selecione pelo menos um template!
💡 Adicione templates para definir o conteúdo das mensagens.
```

**Dica:**
- Use filtros para encontrar templates específicos
- Selecione vários templates para rotatividade

---

### **4️⃣ VALIDAÇÃO DE CONTATOS**

**Regras:**
- ❌ Deve adicionar pelo menos UM contato
- ❌ Números devem ter entre 10 e 15 dígitos
- ✅ Aceita upload de planilha ou cola manual

**Notificações:**
```
❌ Adicione pelo menos um contato!
💡 Faça upload de uma planilha ou cole os números manualmente.

❌ Há 5 número(s) de telefone inválido(s)!
💡 Os números devem ter entre 10 e 15 dígitos.
```

**Formatos aceitos:**
- ✅ `5511999887766`
- ✅ `55 11 99988-7766`
- ✅ `(11) 99988-7766`
- ❌ `99988` (muito curto)
- ❌ `123456789012345678` (muito longo)

---

### **5️⃣ VALIDAÇÃO DE HORÁRIO DE TRABALHO**

**Regras:**
- ❌ Horário de início deve ser ANTES do fim
- ❌ Período deve ter pelo menos 1 hora
- ✅ Formato: HH:MM

**Notificações:**
```
❌ O horário de início deve ser ANTES do horário de término!
💡 Atual: 18:00 até 16:00

❌ O período de trabalho deve ter pelo menos 1 hora!
```

**Exemplos:**
- ✅ Início: 08:00 | Fim: 20:00 (12 horas)
- ✅ Início: 09:00 | Fim: 10:00 (1 hora)
- ❌ Início: 18:00 | Fim: 17:00 (invertido)
- ❌ Início: 10:00 | Fim: 10:30 (menos de 1 hora)

---

### **6️⃣ VALIDAÇÃO DE INTERVALO ENTRE MENSAGENS**

**Regras:**
- ❌ Deve ser pelo menos 1 segundo
- ⚠️ Recomendado: 5+ segundos
- ⚠️ Se < 3 segundos: aviso de risco

**Notificações:**
```
❌ O intervalo entre mensagens deve ser pelo menos 1 segundo!
💡 Recomendamos pelo menos 3-5 segundos para evitar bloqueios.

⚠️ Intervalo muito curto pode causar bloqueios no WhatsApp!
💡 Recomendamos usar pelo menos 5 segundos.
```

**Recomendações:**
- ✅ **5-10 segundos**: Seguro e rápido
- ⚠️ **3-4 segundos**: Aceitável, mas com risco
- ❌ **1-2 segundos**: MUITO arriscado (pode ser bloqueado)

---

### **7️⃣ VALIDAÇÃO DE PAUSA AUTOMÁTICA**

**Regras:**
- ❌ Se configurar pausa, tempo mínimo: 1 minuto
- ⚠️ Pausar a cada < 10 mensagens: aviso de lentidão
- ✅ Valor 0 = sem pausa

**Notificações:**
```
❌ Se configurar pausa automática, defina o tempo de pausa (mínimo 1 minuto)!

⚠️ Pausar a cada poucas mensagens pode deixar a campanha muito lenta.
```

**Exemplos:**
- ✅ Pausar a cada 100 mensagens por 30 minutos
- ⚠️ Pausar a cada 5 mensagens (muito lento)
- ✅ 0 mensagens = sem pausa automática

---

### **8️⃣ VALIDAÇÃO DE AGENDAMENTO**

**Regras:**
- ❌ Data/hora deve ser no FUTURO
- ⚠️ Se > 90 dias: aviso de agendamento distante
- ✅ Agendamento é opcional

**Notificações:**
```
❌ A data/hora agendada deve ser no FUTURO!
💡 Escolha uma data e hora posterior ao momento atual.

⚠️ Você está agendando para mais de 90 dias no futuro.
```

**Exemplos:**
- ✅ Agendar para amanhã às 10:00
- ❌ Agendar para ontem (impossível)
- ⚠️ Agendar para daqui 120 dias (aviso)

---

## 🎨 Tipos de Notificações

### **❌ Erro (Vermelho)**
Bloqueia a criação da campanha. Deve ser corrigido.

```javascript
toast.error('❌ Mensagem de erro');
```

### **⚠️ Aviso (Amarelo)**
Não bloqueia, mas alerta sobre possíveis problemas.

```javascript
toast.warning('⚠️ Mensagem de aviso');
```

### **💡 Dica (Azul)**
Sugestões para o usuário sobre como corrigir.

```javascript
toast.warning('💡 Dica útil');
```

### **✅ Sucesso (Verde)**
Confirma que a ação foi realizada com sucesso.

```javascript
toast.success('✅ Mensagem de sucesso');
```

---

## 🚀 Fluxo de Validação

```
Usuário clica em "Criar Campanha"
        ↓
1. Validar Nome
        ↓ (OK)
2. Validar Instâncias
        ↓ (OK)
3. Validar Templates
        ↓ (OK)
4. Validar Contatos
        ↓ (OK)
5. Validar Horários
        ↓ (OK)
6. Validar Intervalo
        ↓ (OK)
7. Validar Pausas
        ↓ (OK)
8. Validar Agendamento
        ↓ (OK)
9. Validar Números
        ↓ (OK)
✅ TODAS VALIDAÇÕES OK
        ↓
🚀 Criar Campanha
```

**Se qualquer validação falhar:**
- ❌ Exibe notificação de erro
- 🛑 Interrompe o processo
- 💡 Mostra dica de como corrigir

---

## 📋 Checklist de Criação de Campanha

Antes de clicar em "Criar Campanha", verifique:

- [ ] Nome da campanha preenchido (mínimo 3 caracteres)
- [ ] Pelo menos 1 instância selecionada
- [ ] Pelo menos 1 template selecionado
- [ ] Pelo menos 1 contato adicionado
- [ ] Números de telefone válidos (10-15 dígitos)
- [ ] Horário de início ANTES do horário de fim
- [ ] Período de trabalho de pelo menos 1 hora
- [ ] Intervalo entre mensagens ≥ 1 segundo (recomendado ≥ 5s)
- [ ] Se configurar pausa, tempo ≥ 1 minuto
- [ ] Se agendar, data/hora no futuro

---

## 🎯 Exemplos Práticos

### **✅ EXEMPLO VÁLIDO**

```
Nome: "Promoção Black Friday 2024"
Instâncias: [556291785664] (1 selecionada)
Templates: [Template 1, Template 2] (2 selecionados)
Contatos: 150 números válidos
Horário: 08:00 até 20:00 (12 horas)
Intervalo: 5 segundos
Pausa: A cada 100 mensagens por 30 minutos
Agendamento: 25/11/2024 às 09:00

Resultado: ✅ Campanha criada com sucesso!
```

---

### **❌ EXEMPLO INVÁLIDO**

```
Nome: "ab"  ❌ Muito curto
Instâncias: [] ❌ Nenhuma selecionada
Templates: [Template 1]
Contatos: 50 números
Horário: 18:00 até 16:00 ❌ Invertido
Intervalo: 1 segundo ⚠️ Muito curto
Pausa: A cada 100 por 0 minutos ❌ Inválido

Resultado: ❌ Múltiplos erros, campanha não criada
```

**Notificações exibidas:**
```
❌ O nome da campanha deve ter pelo menos 3 caracteres!
❌ Selecione pelo menos uma instância QR Connect!
💡 Você precisa selecionar uma instância para enviar as mensagens.
❌ O horário de início deve ser ANTES do horário de término!
💡 Atual: 18:00 até 16:00
⚠️ Intervalo muito curto pode causar bloqueios no WhatsApp!
💡 Recomendamos usar pelo menos 5 segundos.
❌ Se configurar pausa automática, defina o tempo de pausa (mínimo 1 minuto)!
```

---

## 🔧 Arquivos Modificados

### **Frontend:**
- `frontend/src/pages/qr-campanha/criar.tsx`
- `frontend/src/pages/qr-campanha/criar-novo.tsx`

### **Validações em:**
Função `handleSubmit()` em ambos os arquivos.

---

## 🎓 Mensagens Educativas

Além de bloquear ações incorretas, o sistema **ensina** o usuário:

- 💡 Explica **por quê** algo está errado
- 💡 Sugere **como** corrigir
- 💡 Mostra valores **recomendados**

**Exemplo:**
```
❌ O intervalo entre mensagens deve ser pelo menos 1 segundo!
💡 Recomendamos pelo menos 3-5 segundos para evitar bloqueios.
```

---

## ✅ Benefícios

1. **Previne Erros:** Impossível criar campanha com configurações inválidas
2. **Educa Usuário:** Mensagens explicam o problema e a solução
3. **Experiência Melhor:** Feedback imediato ao invés de erro silencioso
4. **Proteção:** Evita bloqueios por configurações arriscadas
5. **Clareza:** Ícones e cores facilitam compreensão

---

## 🚀 Como Testar

### **Teste 1: Tentar criar sem nome**
1. Deixe o nome vazio
2. Clique em "Criar Campanha"
3. **Resultado:** ❌ Digite o nome da campanha!

### **Teste 2: Tentar criar sem instância**
1. Preencha o nome
2. NÃO selecione instância
3. Clique em "Criar Campanha"
4. **Resultado:** ❌ Selecione pelo menos uma instância!

### **Teste 3: Horário invertido**
1. Configure Início: 18:00, Fim: 16:00
2. Clique em "Criar Campanha"
3. **Resultado:** ❌ O horário de início deve ser ANTES do fim!

### **Teste 4: Intervalo curto**
1. Configure intervalo: 1 segundo
2. Clique em "Criar Campanha"
3. **Resultado:** ⚠️ Intervalo muito curto! Recomendamos 5s

### **Teste 5: Campanha válida**
1. Preencha tudo corretamente
2. Clique em "Criar Campanha"
3. **Resultado:** ✅ Validações concluídas! Criando campanha...

---

## 📞 Suporte

Se encontrar algum caso não coberto pelas validações, reporte para adicionar nova regra!

---

**Desenvolvido para:** Sistema de Disparador WhatsApp QR Connect  
**Data:** Novembro 2024  
**Status:** ✅ Implementado e Funcionando







