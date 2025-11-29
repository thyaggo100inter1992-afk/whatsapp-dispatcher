# 🔄 Como o Sistema Funciona

Um guia visual e explicativo de como todo o sistema opera.

---

## 📊 Arquitetura Geral

```
┌─────────────────┐
│   NAVEGADOR     │
│  (Frontend)     │
│  React/Next.js  │
└────────┬────────┘
         │ HTTP + WebSocket
         ▼
┌─────────────────┐
│   BACKEND       │
│  Node.js/Express│
│  + Socket.IO    │
└────┬────┬───┬───┘
     │    │   │
     │    │   └──────────┐
     │    │              │
     ▼    ▼              ▼
┌────────┐  ┌─────────┐  ┌──────────┐
│Postgres│  │  Redis  │  │WhatsApp  │
│  (DB)  │  │ (Queue) │  │   API    │
└────────┘  └─────────┘  └──────────┘
```

---

## 🔄 Fluxo 1: Configurar Conta WhatsApp

```
1. Usuário acessa /configuracoes
   │
   ▼
2. Clica em "Adicionar Conta"
   │
   ▼
3. Preenche formulário:
   - Nome
   - Telefone
   - Access Token
   - Phone Number ID
   │
   ▼
4. Clica em "Testar Conexão"
   │
   ▼
5. Backend chama WhatsApp API
   │
   ├─ Sucesso → Salva no PostgreSQL
   │              │
   │              ▼
   │          Conta ativa ✅
   │
   └─ Erro → Mostra mensagem de erro ❌
```

---

## 🔄 Fluxo 2: Criar Campanha

```
1. Usuário acessa /campanha/criar
   │
   ▼
2. Preenche dados da campanha:
   │
   ├─ Nome da campanha
   │
   ├─ Adiciona Templates (pode adicionar vários):
   │  │
   │  ├─ Seleciona Número de Origem
   │  ├─ Seleciona Template
   │  └─ (Opcional) Upload de Mídia
   │
   ├─ Cola lista de contatos:
   │  │  5562999998888, João Silva
   │  │  5511888887777, Maria Santos
   │  │  ...
   │  │
   │  └─ Sistema parseia e valida
   │
   ├─ Configura Agendamento (opcional):
   │  ├─ Data/Hora
   │  └─ Horário de funcionamento
   │
   └─ Configura Controles:
      ├─ Delay entre mensagens (2-5s)
      ├─ Pausar a cada X mensagens
      └─ Duração da pausa
   │
   ▼
3. Clica em "Iniciar Campanha" ou "Agendar"
   │
   ▼
4. Backend processa:
   │
   ├─ Salva campanha no PostgreSQL
   ├─ Cria/atualiza contatos
   ├─ Associa templates
   └─ Adiciona na fila (Bull Queue)
   │
   ▼
5. Sistema de Filas processa:
   │
   ├─ Para cada contato:
   │  │
   │  ├─ Rotaciona template
   │  ├─ Aplica delay
   │  ├─ Cria job na fila
   │  └─ Aplica pausas (se configurado)
   │
   └─ Jobs são processados em background
   │
   ▼
6. Para cada job:
   │
   ├─ Busca conta WhatsApp
   ├─ Formata número
   ├─ Monta componentes do template
   ├─ Envia via WhatsApp API
   │  │
   │  ├─ Sucesso ✅
   │  │  ├─ Atualiza status: "sent"
   │  │  ├─ Incrementa contador
   │  │  └─ Emite evento via Socket.IO
   │  │
   │  └─ Erro ❌
   │     ├─ Tenta novamente (3x)
   │     ├─ Se falhar: status "failed"
   │     ├─ Salva erro no banco
   │     └─ Emite evento via Socket.IO
   │
   ▼
7. Frontend recebe atualizações em tempo real
   │
   └─ Atualiza progresso, contadores, etc
```

---

## 🔄 Fluxo 3: Enviar Mensagem Imediata

```
1. Usuário acessa /mensagem/enviar
   │
   ▼
2. Preenche dados:
   │
   ├─ Seleciona Número de Origem
   ├─ Digite Número do Destinatário
   ├─ Busca e seleciona Template
   └─ (Opcional) Upload de Mídia
   │
   ▼
3. Clica em "Enviar Mensagem Agora"
   │
   ▼
4. Backend processa:
   │
   ├─ Cria/atualiza contato
   ├─ Cria registro de mensagem
   └─ Adiciona na fila (prioridade alta)
   │
   ▼
5. Job é processado imediatamente:
   │
   ├─ Busca conta WhatsApp
   ├─ Formata número
   ├─ Monta template
   ├─ Envia via WhatsApp API
   │  │
   │  ├─ Sucesso ✅ → Status "sent"
   │  └─ Erro ❌ → Retry 3x
   │
   ▼
6. Frontend recebe confirmação
   │
   └─ Mostra mensagem de sucesso/erro
```

---

## 🔄 Fluxo 4: Upload de Mídia

```
1. Usuário arrasta arquivo ou clica para selecionar
   │
   ▼
2. Componente MediaUpload valida:
   │
   ├─ Tipo de arquivo permitido? (image/video/audio/pdf)
   ├─ Tamanho OK? (< 10MB)
   │  │
   │  ├─ Sim → Continua
   │  └─ Não → Mostra erro
   │
   ▼
3. Upload para backend via FormData
   │
   ▼
4. Middleware Multer processa:
   │
   ├─ Gera nome único (UUID)
   ├─ Salva em /uploads/media/
   └─ Retorna dados do arquivo
   │
   ▼
5. Frontend recebe resposta:
   │
   ├─ URL do arquivo
   ├─ Nome original
   ├─ Tipo MIME
   └─ Tamanho
   │
   ▼
6. Mostra preview (se for imagem)
   │
   └─ URL é usada no envio da mensagem
```

---

## 🔄 Fluxo 5: Sistema de Filas (Bull Queue)

```
┌──────────────────────┐
│  CAMPAIGN QUEUE      │
│  (Fila de Campanhas) │
└──────────┬───────────┘
           │
           ▼
      Processa Campanha
           │
           ├─ Para cada contato
           │  │
           │  ├─ Calcula delay
           │  ├─ Rotaciona template
           │  └─ Cria job em MESSAGE QUEUE
           │
           ▼
┌──────────────────────┐
│  MESSAGE QUEUE       │
│  (Fila de Mensagens) │
└──────────┬───────────┘
           │
           ▼
      Processa Mensagem
           │
           ├─ Busca conta
           ├─ Envia WhatsApp API
           ├─ Atualiza status
           └─ Emite evento Socket.IO
           │
           ▼
       ┌─────────┐
       │ SUCESSO │
       └─────────┘
           │
           ├─ Atualiza contadores
           ├─ Notifica frontend
           └─ Remove job da fila
```

---

## 🔄 Fluxo 6: Rotação de Templates

```
Campanha com 3 templates:
├─ Template A → Conta 1 → Mídia 1
├─ Template B → Conta 2 → Mídia 2
└─ Template C → Conta 3 → Mídia 3

Lista de 10 contatos:

Contato 1  →  Template A (índice 0 % 3 = 0)
Contato 2  →  Template B (índice 1 % 3 = 1)
Contato 3  →  Template C (índice 2 % 3 = 2)
Contato 4  →  Template A (índice 3 % 3 = 0) ← Volta
Contato 5  →  Template B (índice 4 % 3 = 1)
Contato 6  →  Template C (índice 5 % 3 = 2)
Contato 7  →  Template A (índice 6 % 3 = 0)
Contato 8  →  Template B (índice 7 % 3 = 1)
Contato 9  →  Template C (índice 8 % 3 = 2)
Contato 10 →  Template A (índice 9 % 3 = 0)

Resultado:
- Template A: 4 mensagens (contas 1,4,7,10)
- Template B: 3 mensagens (contas 2,5,8)
- Template C: 3 mensagens (contas 3,6,9)
```

---

## 🔄 Fluxo 7: Sistema de Pausas

```
Configuração:
- Pausar a cada: 10 mensagens
- Duração: 60 segundos

Execução:

Msg 1  → Envia (delay 2-5s)
Msg 2  → Envia (delay 2-5s)
Msg 3  → Envia (delay 2-5s)
...
Msg 9  → Envia (delay 2-5s)
Msg 10 → Envia (delay 2-5s)
         │
         ▼
      ⏸️ PAUSA 60 segundos
         │
         ▼
Msg 11 → Envia (delay 2-5s)
Msg 12 → Envia (delay 2-5s)
...
Msg 20 → Envia (delay 2-5s)
         │
         ▼
      ⏸️ PAUSA 60 segundos
         │
         ▼
Msg 21 → Continua...
```

---

## 🔄 Fluxo 8: Status de Mensagens

```
┌─────────┐
│ pending │ ← Criada no banco, aguardando fila
└────┬────┘
     │
     ▼
┌─────────┐
│  sent   │ ← Enviada para WhatsApp
└────┬────┘
     │
     ▼
┌─────────┐
│delivered│ ← Entregue no celular do destinatário
└────┬────┘
     │
     ▼
┌─────────┐
│  read   │ ← Lida pelo destinatário
└─────────┘

Se falhar em qualquer etapa:
     │
     ▼
┌─────────┐
│ failed  │ ← Após 3 tentativas
└─────────┘
```

---

## 🔄 Fluxo 9: Atualizações em Tempo Real (WebSocket)

```
Backend                     Frontend
   │                           │
   │  ┌─────────────┐         │
   │  │ Job Started │         │
   │  └──────┬──────┘         │
   │         │                │
   ├─────────┴───────────────►│
   │  emit('campaign:progress')│
   │  { progress: 10% }        │
   │                           │ Atualiza barra de progresso
   │                           │
   │  ┌───────────────┐       │
   │  │ Message Sent  │       │
   │  └───────┬───────┘       │
   │          │               │
   ├──────────┴──────────────►│
   │  emit('message:completed')│
   │  { messageId: 123 }       │
   │                           │ Incrementa contador
   │                           │
   │  ┌───────────────┐       │
   │  │ Campaign Done │       │
   │  └───────┬───────┘       │
   │          │               │
   ├──────────┴──────────────►│
   │  emit('campaign:completed')│
   │  { campaignId: 1 }        │
   │                           │ Mostra notificação
   │                           │
```

---

## 🔄 Fluxo 10: Integração WhatsApp API

```
1. Backend prepara requisição:
   │
   ├─ URL: https://graph.facebook.com/v18.0/{phone_number_id}/messages
   ├─ Headers:
   │  └─ Authorization: Bearer {access_token}
   └─ Body:
      ├─ messaging_product: "whatsapp"
      ├─ to: "5562999998888"
      ├─ type: "template"
      └─ template:
         ├─ name: "nome_do_template"
         ├─ language: { code: "pt_BR" }
         └─ components: [
            └─ { type: "body", parameters: [...] }
         ]
   │
   ▼
2. Envia para WhatsApp API
   │
   ├─ Sucesso (200 OK)
   │  │
   │  └─ Retorna:
   │     ├─ messaging_product: "whatsapp"
   │     └─ messages: [{ id: "wamid.xxx" }]
   │
   └─ Erro (4xx/5xx)
      │
      └─ Retorna:
         └─ error: { message: "...", code: ... }
   │
   ▼
3. Backend processa resposta
   │
   ├─ Salva message_id
   ├─ Atualiza status
   └─ Notifica frontend
```

---

## 📊 Diagrama Completo do Banco de Dados

```
┌─────────────────────┐
│ whatsapp_accounts   │
│ ─────────────────── │
│ • id (PK)          │───┐
│ • name              │   │
│ • phone_number      │   │
│ • access_token      │   │
│ • is_active         │   │
└─────────────────────┘   │
                          │
                          │
┌─────────────────────┐   │    ┌─────────────────────┐
│ campaigns           │   │    │ campaign_templates  │
│ ─────────────────── │   │    │ ─────────────────── │
│ • id (PK)          │───┼───►│ • campaign_id (FK)  │
│ • name              │   │    │ • account_id (FK)   │◄──┘
│ • status            │   │    │ • template_id (FK)  │
│ • sent_count        │   │    │ • media_url         │
│ • delivered_count   │   │    │ • order_index       │
└─────────────────────┘   │    └─────────────────────┘
         │                │
         │                │
         ▼                │
┌─────────────────────┐   │
│ campaign_contacts   │   │
│ ─────────────────── │   │
│ • campaign_id (FK)  │───┤
│ • contact_id (FK)   │◄──┼──┐
└─────────────────────┘   │  │
                          │  │
                          │  │
┌─────────────────────┐   │  │
│ contacts            │   │  │
│ ─────────────────── │   │  │
│ • id (PK)          │───┼──┘
│ • phone_number      │   │
│ • name              │   │
│ • variables (JSON)  │   │
└─────────────────────┘   │
                          │
                          │
┌─────────────────────┐   │
│ messages            │   │
│ ─────────────────── │   │
│ • id (PK)          │   │
│ • campaign_id (FK)  │───┘
│ • contact_id (FK)   │
│ • account_id (FK)   │
│ • status            │
│ • sent_at           │
│ • delivered_at      │
│ • read_at           │
│ • error_message     │
└─────────────────────┘
```

---

## 🎯 Resumo dos Principais Conceitos

### 1. **Separação de Responsabilidades**
- Frontend: Interface e UX
- Backend: Lógica de negócio
- PostgreSQL: Armazenamento
- Redis: Filas e cache
- WhatsApp API: Envio

### 2. **Sistema de Filas**
- Jobs assíncronos
- Retry automático
- Processamento em background
- Controle de taxa

### 3. **Tempo Real**
- WebSocket (Socket.IO)
- Atualizações instantâneas
- Sem necessidade de polling

### 4. **Rotação Inteligente**
- Distribui mensagens entre templates
- Distribui carga entre contas
- Evita bloqueios

### 5. **Controle de Envio**
- Delays configuráveis
- Pausas automáticas
- Horário de funcionamento
- Respeita limites

---

**Agora você entende como TUDO funciona! 🚀**


