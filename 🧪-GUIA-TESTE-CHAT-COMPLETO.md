# 🧪 GUIA DE TESTE - Sistema de Chat

**Como testar todas as funcionalidades do chat**

---

## 📋 PASSO A PASSO COMPLETO

### 1️⃣ Preparar o Ambiente

#### Backend:

```bash
# Terminal 1 - Backend
cd backend

# Aplicar migration (se ainda não fez)
node aplicar-chat-system.js

# Aguardar confirmação:
# ✅ Tabelas criadas com sucesso!

# Iniciar backend
npm run dev

# Aguardar: 
# ✅ Rotas de conversas (chat) registradas
# 🚀 Server running on port 3001
```

#### Frontend:

```bash
# Terminal 2 - Frontend
cd frontend
npm run dev

# Aguardar:
# Ready on http://localhost:3000
```

---

### 2️⃣ Acessar o Chat

1. **Abra o navegador:** `http://localhost:3000`
2. **Faça login** com suas credenciais
3. **Você verá 3 cards na tela inicial:**
   - 🟢 API Oficial WhatsApp
   - 🔵 WhatsApp QR Connect
   - 🟣 **Chat Atendimento** ← NOVO!

4. **Clique no card roxo** "Chat Atendimento"
5. **Você será redirecionado para** `/chat`

---

### 3️⃣ Interface do Chat

Ao abrir, você verá:

```
┌──────────────────────────┬─────────────────────────┐
│ Lista de Conversas       │  Selecione uma conversa │
│ (vazia inicialmente)     │  (placeholder)          │
└──────────────────────────┴─────────────────────────┘
```

**Se ainda não há conversas:**
- Aparecerá mensagem: "Nenhuma conversa encontrada"
- "Aguardando mensagens de clientes"

---

### 4️⃣ Criar Primeira Conversa

**Opção A - Via Webhook (Recomendado):**

#### Se usar QR Connect:
1. Vá em **WhatsApp QR Connect**
2. Crie/conecte uma instância
3. **Peça para alguém enviar mensagem** para esse número
4. **A conversa aparecerá automaticamente!**

#### Se usar API Oficial:
1. Configure conta WhatsApp Business
2. Configure webhook no Meta
3. Cliente envia mensagem
4. **Conversa aparece!**

**Opção B - Via API Manual (Para testes):**

```bash
# Criar conversa teste via API
curl -X POST http://localhost:3001/api/conversations/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{
    "phone_number": "5562999999999",
    "contact_name": "Cliente Teste",
    "initial_message": "Olá! Esta é uma mensagem de teste."
  }'
```

---

### 5️⃣ Testar Funcionalidades

#### ✅ Ver Conversa:
1. **Lista aparece** com a conversa
2. **Avatar** com inicial do nome
3. **Nome/número** do contato
4. **Última mensagem** truncada
5. **Horário** formatado
6. **Badge verde** com contador (se não lida)

#### ✅ Abrir Conversa:
1. **Clique na conversa**
2. **Mensagens carregam** na direita
3. **Bolhas cinzas** (cliente) e **verdes** (você)
4. **Horários** em cada mensagem
5. **Status** de entrega (✓ ✓✓)

#### ✅ Enviar Mensagem:
1. **Digite** no campo inferior
2. **Pressione Enter** ou clique em 📤
3. **Mensagem aparece** instantaneamente (verde)
4. **Status muda**: 🔵 → ✓ → ✓✓ → ✓✓ azul
5. **Mensagem é enviada** via WhatsApp!

#### ✅ Marcar como Lida:
1. **Ao abrir conversa**, conta como lida
2. **Badge verde desaparece**
3. **Contador zera**
4. **unread_count = 0** no banco

#### ✅ Buscar Conversa:
1. **Digite** no campo de busca
2. **Lista filtra** em tempo real
3. **Busca por:**
   - Nome do contato
   - Número de telefone

#### ✅ Filtros:
1. **Todas**: Mostra todas as conversas
2. **Não lidas (X)**: Apenas com mensagens não lidas
3. **Arquivadas**: Conversas arquivadas

#### ✅ Auto-refresh:
1. **Deixe chat aberto**
2. **A cada 10 segundos:**
   - Lista atualiza
   - Mensagens atualizam
   - Contador atualiza

---

### 6️⃣ Testar Recebimento

#### Enviar Mensagem como Cliente:

**Se QR Connect:**
1. Abra WhatsApp no celular
2. Envie mensagem para o número conectado
3. **Aguarde 1-2 segundos**
4. **Mensagem aparece no chat automaticamente!**
5. **Badge "1" aparece** (não lida)

**Se API Oficial:**
1. Cliente envia via WhatsApp
2. Webhook processa
3. **Mensagem salva no chat**
4. **Aparece na lista**

---

### 7️⃣ Verificar no Banco de Dados

```sql
-- Ver conversas
SELECT 
  id,
  phone_number,
  contact_name,
  unread_count,
  last_message_text,
  last_message_at
FROM conversations
ORDER BY last_message_at DESC;

-- Ver mensagens
SELECT 
  id,
  conversation_id,
  message_direction,
  message_content,
  status,
  sent_at
FROM conversation_messages
ORDER BY sent_at DESC
LIMIT 20;

-- Ver não lidas
SELECT 
  phone_number,
  contact_name,
  unread_count,
  last_message_text
FROM conversations
WHERE unread_count > 0;
```

---

## 🎯 CENÁRIOS DE TESTE

### Cenário 1: Nova Conversa
1. ✅ Cliente envia primeira mensagem
2. ✅ Conversa é criada
3. ✅ Aparece na lista com badge "1"
4. ✅ Atendente abre
5. ✅ Badge desaparece
6. ✅ unread_count = 0

### Cenário 2: Responder Cliente
1. ✅ Atendente digita resposta
2. ✅ Pressiona Enter
3. ✅ Mensagem enviada
4. ✅ Aparece em verde
5. ✅ Status: 🔵 → ✓ → ✓✓
6. ✅ Cliente recebe no WhatsApp

### Cenário 3: Múltiplas Conversas
1. ✅ 3 clientes enviam mensagens
2. ✅ 3 conversas criadas
3. ✅ Ordenadas por mais recente
4. ✅ Contador total: 3
5. ✅ Atendente abre uma
6. ✅ Contador: 2 (uma lida)

### Cenário 4: Busca
1. ✅ 10 conversas ativas
2. ✅ Buscar por "João"
3. ✅ Mostra apenas "João Silva"
4. ✅ Limpar busca
5. ✅ Mostra todas novamente

### Cenário 5: Auto-refresh
1. ✅ Chat aberto
2. ✅ Cliente envia mensagem
3. ✅ Aguardar até 10s
4. ✅ Mensagem aparece automaticamente
5. ✅ Sem precisar recarregar página

---

## 🐛 TROUBLESHOOTING

### Erro: "Conversa não encontrada"
- Verifique se o tenant está correto
- Verifique RLS no banco
- Veja logs do backend

### Erro ao enviar mensagem:
- Verifique conta WhatsApp conectada
- Veja se instância está ativa
- Cheque logs do backend

### Conversas não aparecem:
- Verifique migration aplicada
- Veja tabela `conversations`
- Cheque filtro ativo (Todas/Não lidas)

### Mensagens não chegam:
- Verifique webhooks configurados
- Veja logs do webhook controller
- Teste enviar manualmente

---

## 📊 LOGS ESPERADOS

### Backend - Quando mensagem chega:

```
💬 Processando MENSAGEM RECEBIDA...
   📱 De: 5562999999999
   📋 Tipo: text
   🆔 Message ID: wamid.ABC123

💾 Salvando mensagem no chat...
   📝 Conteúdo: Olá! Tudo bem?...
   ✅ Conversa existente: 5
   ✅ Mensagem salva com sucesso!
```

### Backend - Quando atendente envia:

```
📨 Recebendo requisição de envio...
   Conversa: 5
   Conteúdo: Oi! Como posso ajudar?

📱 Enviando via WhatsApp API...
✅ Mensagem enviada com sucesso!
🆔 WhatsApp Message ID: wamid.XYZ789
```

---

## ✅ CHECKLIST DE TESTE

Use este checklist para validar:

### Recebimento:
- [ ] Mensagem de texto recebida salva no chat
- [ ] Conversa criada automaticamente
- [ ] Badge de não lida aparece
- [ ] Contador incrementa
- [ ] Ordenação correta (mais recente primeiro)

### Envio:
- [ ] Digitar mensagem funciona
- [ ] Enter envia mensagem
- [ ] Mensagem aparece no chat
- [ ] Mensagem enviada via WhatsApp
- [ ] Status atualiza corretamente

### Interface:
- [ ] Lista de conversas carrega
- [ ] Janela de chat abre ao clicar
- [ ] Mensagens exibidas corretamente
- [ ] Bolhas de cores certas
- [ ] Horários formatados
- [ ] Status icons corretos

### Funcionalidades:
- [ ] Busca funciona
- [ ] Filtros funcionam
- [ ] Marcar como lida funciona
- [ ] Auto-refresh ativo
- [ ] Contador de não lidas correto

### Responsividade:
- [ ] Desktop: 2 colunas
- [ ] Tablet: Adaptável
- [ ] Mobile: Empilhado

---

## 🎉 SUCESSO!

Se todos os testes passaram, **o chat está 100% funcional!**

Parabéns! 🚀

---

*Guia de Teste - Sistema de Chat v1.0*  
*07/12/2025*


