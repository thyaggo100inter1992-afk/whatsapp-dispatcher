# 📧 Sistema de Comunicação - Documentação Completa

## 🎯 Visão Geral

Sistema completo para o Super Admin enviar **emails em massa** e **notificações pop-up** para os tenants do sistema.

---

## 📊 Arquitetura do Sistema

### 🗄️ **Banco de Dados (4 Tabelas)**

#### 1. `admin_email_campaigns`
Armazena campanhas de email criadas pelo Super Admin.

```sql
- id: Identificador único
- admin_id: Quem criou a campanha
- name: Nome da campanha (ex: "Promoção Black Friday")
- subject: Assunto do email
- html_content: Conteúdo HTML do email
- status: 'draft', 'sending', 'completed', 'failed'
- recipient_type: 'all', 'active', 'blocked', 'trial', 'specific', 'manual', 'upload'
- specific_tenants: Array de IDs (se recipient_type = 'specific')
- manual_recipients: Emails separados por vírgula/linha (se recipient_type = 'manual')
- email_account_ids: Array de IDs das contas de email para rotação
- delay_seconds: Delay entre envios (1-60 segundos)
- total_recipients: Total de destinatários
- sent_count: Emails enviados com sucesso
- failed_count: Emails que falharam
- started_at, finished_at: Timestamps de início e fim
```

#### 2. `admin_email_campaign_recipients`
Destinatários individuais de cada campanha.

```sql
- id: Identificador único
- campaign_id: Referência à campanha
- tenant_id: ID do tenant (se aplicável)
- email: Email do destinatário
- status: 'pending', 'sent', 'failed'
- error_message: Mensagem de erro (se falhou)
- sent_at: Timestamp do envio
```

#### 3. `admin_notifications`
Notificações pop-up criadas pelo Super Admin.

```sql
- id: Identificador único
- admin_id: Quem criou a notificação
- title: Título da notificação
- message: Mensagem (suporta HTML)
- type: 'info', 'warning', 'urgent', 'success'
- recipient_type: 'all', 'active', 'blocked', 'trial', 'specific', 'plan'
- specific_tenants: Array de IDs (se recipient_type = 'specific')
- specific_plans: Array de nomes de planos (se recipient_type = 'plan')
- link_url: URL do link/botão (opcional)
- link_text: Texto do link/botão (opcional)
- icon_name: Nome do ícone (opcional)
- display_mode: 'modal' (centralizado)
- is_active: Se a notificação está ativa
- expires_at: Data de expiração (opcional)
```

#### 4. `admin_notification_reads`
Rastreamento de leitura e cliques nas notificações.

```sql
- id: Identificador único
- notification_id: Referência à notificação
- tenant_id: ID do tenant que leu
- read_at: Timestamp da leitura
- clicked_at: Timestamp do clique no link (se aplicável)
- UNIQUE(notification_id, tenant_id): Um tenant só pode ler uma notificação uma vez
```

---

## 🔌 APIs Backend

### 📧 **Campanhas de Email**

#### `GET /api/admin/communications/campaigns`
Lista todas as campanhas de email.

**Query Params:**
- `status` (opcional): Filtrar por status ('draft', 'sending', 'completed', 'failed')
- `limit` (opcional): Limite de resultados (padrão: 50)
- `offset` (opcional): Offset para paginação (padrão: 0)

**Response:**
```json
{
  "success": true,
  "campaigns": [
    {
      "id": 1,
      "name": "Promoção Black Friday",
      "subject": "🔥 Oferta Especial!",
      "recipient_type": "all",
      "total_recipients": 150,
      "sent_count": 145,
      "failed_count": 5,
      "status": "completed",
      "created_at": "2024-01-15T10:00:00Z",
      "started_at": "2024-01-15T10:05:00Z",
      "completed_at": "2024-01-15T10:20:00Z"
    }
  ]
}
```

---

#### `GET /api/admin/communications/campaigns/:id`
Detalhes de uma campanha específica.

**Response:**
```json
{
  "success": true,
  "campaign": {
    "id": 1,
    "name": "Promoção Black Friday",
    "subject": "🔥 Oferta Especial!",
    "html_content": "<h1>Olá!</h1><p>Conteúdo...</p>",
    "recipient_type": "all",
    "email_account_ids": [1, 2],
    "delay_seconds": 5,
    "total_recipients": 150,
    "sent_count": 145,
    "failed_count": 5,
    "status": "completed"
  }
}
```

---

#### `POST /api/admin/communications/campaigns`
Cria uma nova campanha de email.

**Body:**
```json
{
  "name": "Promoção Black Friday",
  "subject": "🔥 Oferta Especial!",
  "content": "<h1>Olá!</h1><p>Conteúdo...</p>",
  "recipient_type": "all",
  "recipient_list": {
    "tenant_ids": [1, 2, 3],
    "emails": ["email1@example.com", "email2@example.com"]
  },
  "email_accounts": [1, 2],
  "delay_seconds": 5
}
```

**Response:**
```json
{
  "success": true,
  "campaign": {
    "id": 1,
    "name": "Promoção Black Friday",
    "status": "draft"
  }
}
```

---

#### `POST /api/admin/communications/campaigns/preview-recipients`
Gera preview dos destinatários antes de criar a campanha.

**Body:**
```json
{
  "recipient_type": "active",
  "recipient_list": {}
}
```

**Response:**
```json
{
  "success": true,
  "emails": [
    "tenant1@example.com",
    "admin1@example.com",
    "tenant2@example.com",
    "admin2@example.com"
  ],
  "total": 4
}
```

---

#### `POST /api/admin/communications/campaigns/:id/start`
Inicia o envio de uma campanha.

**Response:**
```json
{
  "success": true,
  "message": "Campanha iniciada! O envio está sendo processado em segundo plano."
}
```

---

#### `DELETE /api/admin/communications/campaigns/:id`
Deleta uma campanha.

**Response:**
```json
{
  "success": true,
  "message": "Campanha deletada com sucesso"
}
```

---

### 💬 **Notificações Pop-up**

#### `GET /api/admin/communications/notifications`
Lista todas as notificações.

**Query Params:**
- `is_active` (opcional): Filtrar por ativas/inativas

**Response:**
```json
{
  "success": true,
  "notifications": [
    {
      "id": 1,
      "title": "Manutenção Programada",
      "message": "Sistema ficará offline das 02h às 04h",
      "type": "warning",
      "link_url": "https://status.example.com",
      "link_text": "Ver Status",
      "recipient_type": "all",
      "is_active": true,
      "stats": {
        "total_views": 45,
        "total_clicks": 12
      }
    }
  ]
}
```

---

#### `GET /api/admin/communications/notifications/:id`
Detalhes de uma notificação específica.

**Response:**
```json
{
  "success": true,
  "notification": {
    "id": 1,
    "title": "Manutenção Programada",
    "message": "Sistema ficará offline das 02h às 04h",
    "type": "warning",
    "link_url": "https://status.example.com",
    "link_text": "Ver Status",
    "recipient_type": "all",
    "is_active": true,
    "created_at": "2024-01-15T10:00:00Z"
  }
}
```

---

#### `POST /api/admin/communications/notifications`
Cria uma nova notificação.

**Body:**
```json
{
  "title": "Manutenção Programada",
  "message": "Sistema ficará offline das 02h às 04h",
  "type": "warning",
  "link_url": "https://status.example.com",
  "link_text": "Ver Status",
  "recipient_type": "all",
  "recipient_list": {}
}
```

**Response:**
```json
{
  "success": true,
  "notification": {
    "id": 1,
    "title": "Manutenção Programada",
    "is_active": true
  }
}
```

---

#### `PUT /api/admin/communications/notifications/:id`
Atualiza uma notificação existente.

**Body:**
```json
{
  "title": "Manutenção Adiada",
  "message": "Nova data: 20/01/2024",
  "type": "info"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notificação atualizada com sucesso"
}
```

---

#### `PATCH /api/admin/communications/notifications/:id/toggle`
Ativa/Desativa uma notificação.

**Response:**
```json
{
  "success": true,
  "message": "Status alterado com sucesso",
  "is_active": false
}
```

---

#### `DELETE /api/admin/communications/notifications/:id`
Deleta uma notificação.

**Response:**
```json
{
  "success": true,
  "message": "Notificação deletada com sucesso"
}
```

---

### 🔔 **APIs para Tenants (Notificações)**

#### `GET /api/notifications/active`
Retorna notificações ativas não lidas para o tenant atual.

**Headers:**
- `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "notifications": [
    {
      "id": 1,
      "title": "Manutenção Programada",
      "message": "Sistema ficará offline das 02h às 04h",
      "type": "warning",
      "link_url": "https://status.example.com",
      "link_text": "Ver Status"
    }
  ]
}
```

---

#### `POST /api/notifications/:id/read`
Marca uma notificação como lida.

**Response:**
```json
{
  "success": true,
  "message": "Notificação marcada como lida"
}
```

---

#### `POST /api/notifications/:id/click`
Registra que o tenant clicou no link da notificação.

**Response:**
```json
{
  "success": true,
  "message": "Clique registrado"
}
```

---

## 🎨 Frontend

### 📄 **Página de Comunicação** (`/admin/comunicacao`)

Página exclusiva do Super Admin com duas abas:

#### 📧 **Aba Email:**
- **Formulário de Criação:**
  - Nome da campanha
  - Assunto do email
  - Conteúdo HTML (textarea)
  - Seleção de destinatários (dropdown)
  - Emails manuais (textarea, se aplicável)
  - Seleção de contas de email (checkboxes)
  - Delay entre envios (input number + botões rápidos)
- **Preview de Destinatários:**
  - Botão "Preview Destinatários"
  - Mostra lista de emails que receberão
- **Lista de Campanhas:**
  - Cards com nome, assunto, status, estatísticas
  - Badges coloridos por status (draft, sending, completed, failed)
  - Progresso visual (enviados/total)

#### 💬 **Aba Notificação:**
- **Formulário de Criação:**
  - Título
  - Mensagem (textarea)
  - Tipo (dropdown: Info, Aviso, Urgente, Sucesso)
  - Link opcional (URL + texto)
  - Seleção de destinatários
- **Lista de Notificações:**
  - Cards com título, mensagem, tipo, status
  - Badges coloridos por tipo
  - Estatísticas (visualizações, cliques)
  - Botões: Ativar/Desativar, Deletar

---

### 🔔 **Modal de Notificações** (`AdminNotificationModal`)

Componente integrado no `Layout.tsx` que aparece automaticamente para os tenants:

**Características:**
- ✅ Modal centralizado com overlay
- ✅ Aparece ao entrar no sistema
- ✅ Permanece até ser fechado manualmente
- ✅ Suporta múltiplas notificações em sequência
- ✅ Estilos por tipo (cores, ícones)
- ✅ Link/botão opcional
- ✅ Animações suaves (fadeIn, slideUp)
- ✅ Registra visualização e clique automaticamente

---

## ⚙️ Worker de Envio de Emails

### 📧 **`EmailCampaignWorker`**

Arquivo: `backend/src/workers/email-campaign.worker.js`

**Responsabilidades:**
1. Buscar destinatários com base no `recipient_type`
2. Incluir emails dos admins automaticamente
3. Inserir destinatários na tabela `admin_email_campaign_recipients`
4. Enviar emails com rotação de contas
5. Aplicar delay entre envios
6. Atualizar progresso em tempo real
7. Registrar falhas com mensagem de erro
8. Finalizar campanha com status `completed` ou `failed`

**Fluxo de Execução:**
```
1. Admin cria campanha → status = 'draft'
2. Admin clica "Criar e Enviar"
3. Backend chama emailCampaignWorker.startCampaign(id)
4. Worker:
   a. Busca destinatários
   b. Insere na tabela de recipients
   c. Atualiza status para 'sending'
   d. Loop de envio:
      - Seleciona conta de email (rotação)
      - Envia email
      - Atualiza status do recipient (sent/failed)
      - Aguarda delay
      - Atualiza progresso da campanha
   e. Finaliza com status 'completed' ou 'failed'
```

**Rotação de Contas:**
```javascript
accountIndex = 0;
for (recipient in recipients) {
  accountId = emailAccounts[accountIndex % emailAccounts.length].id;
  sendEmail(recipient, accountId);
  accountIndex++;
}
```

**Logs:**
```
🚀 ========================================
📧 Iniciando Campanha de Email #1
========================================

📋 Total de destinatários: 150
📨 Usando 2 conta(s) de email para rotação

📧 [1/150] Enviando para: tenant1@example.com (1%)
   🔄 Usando conta: CONTATO@NETTSISTEMAS.COM
   ✅ Enviado com sucesso!
   ⏱️  Aguardando 5s...

📧 [2/150] Enviando para: admin1@example.com (1%)
   🔄 Usando conta: CONTATO@NETTCRED.COM.BR
   ✅ Enviado com sucesso!
   ⏱️  Aguardando 5s...

...

✅ ========================================
📧 Campanha #1 Concluída!
   ✅ Enviados: 145
   ❌ Falhas: 5
========================================
```

---

## 🎯 Tipos de Destinatários

### 📧 **Campanhas de Email:**
- `all`: Todos os tenants
- `active`: Apenas tenants com status 'active'
- `blocked`: Apenas tenants com status 'blocked'
- `trial`: Apenas tenants com status 'trial'
- `specific`: IDs específicos (array de tenant_ids)
- `manual`: Emails digitados manualmente (separados por vírgula/linha)
- `upload`: Arquivo CSV/TXT (placeholder - não implementado)

### 💬 **Notificações:**
- `all`: Todos os tenants
- `active`: Apenas tenants com status 'active'
- `blocked`: Apenas tenants com status 'blocked'
- `trial`: Apenas tenants com status 'trial'
- `specific`: IDs específicos (array de tenant_ids)
- `plan`: Por plano (array de nomes de planos)

---

## 🔐 Segurança e Permissões

### **Rotas Protegidas:**
- ✅ Todas as rotas `/admin/communications/*` requerem autenticação
- ✅ Apenas Super Admins podem acessar
- ✅ Middleware `requireSuperAdmin` aplicado

### **RLS (Row Level Security):**
- ✅ Tabelas de comunicação têm políticas RLS
- ✅ Super Admins podem ver/gerenciar tudo
- ✅ Tenants só podem ver suas próprias notificações

---

## 📊 Estatísticas e Tracking

### **Campanhas de Email:**
- `total_recipients`: Total de destinatários
- `sent_count`: Emails enviados com sucesso
- `failed_count`: Emails que falharam
- `started_at`: Timestamp de início
- `finished_at`: Timestamp de conclusão

### **Notificações:**
- `total_views`: Total de visualizações (leituras)
- `total_clicks`: Total de cliques no link
- Rastreamento individual por tenant

---

## 🚀 Como Usar

### **1. Enviar Email em Massa:**
1. Acesse `/admin/comunicacao`
2. Clique em "Nova Campanha"
3. Preencha o formulário:
   - Nome: "Promoção Black Friday"
   - Assunto: "🔥 Oferta Especial!"
   - Conteúdo: HTML customizado
   - Destinatários: "Todos os Tenants"
   - Contas de Email: Selecione 2+ contas para rotação
   - Delay: 5 segundos
4. Clique em "Preview Destinatários" (opcional)
5. Clique em "Criar e Enviar"
6. Aguarde o envio (acompanhe na lista de campanhas)

### **2. Criar Notificação Pop-up:**
1. Acesse `/admin/comunicacao`
2. Clique na aba "Notificações Pop-up"
3. Clique em "Nova Notificação"
4. Preencha o formulário:
   - Título: "Manutenção Programada"
   - Mensagem: "Sistema ficará offline das 02h às 04h"
   - Tipo: "Aviso"
   - Link: "https://status.example.com" (opcional)
   - Texto do Link: "Ver Status" (opcional)
   - Destinatários: "Todos os Tenants"
5. Clique em "Criar Notificação"
6. A notificação aparecerá automaticamente para os tenants ao entrarem no sistema

### **3. Gerenciar Notificações:**
- **Desativar:** Clique em "Desativar" (notificação para de aparecer)
- **Ativar:** Clique em "Ativar" (notificação volta a aparecer)
- **Deletar:** Clique em "Deletar" (remove permanentemente)
- **Ver Estatísticas:** Visualizações e cliques aparecem nos cards

---

## 🎨 Estilos e UX

### **Cores por Tipo de Notificação:**
- **Info:** Azul (`from-blue-500 to-blue-600`)
- **Aviso:** Amarelo (`from-yellow-500 to-yellow-600`)
- **Urgente:** Vermelho (`from-red-500 to-red-600`)
- **Sucesso:** Verde (`from-green-500 to-green-600`)

### **Status de Campanha:**
- **Draft:** Cinza (`bg-gray-500`)
- **Sending:** Azul pulsante (`bg-blue-500 animate-pulse`)
- **Completed:** Verde (`bg-green-500`)
- **Failed:** Vermelho (`bg-red-500`)

---

## 🔧 Manutenção e Troubleshooting

### **Logs:**
- Backend: `pm2 logs whatsapp-backend`
- Frontend: Console do navegador

### **Verificar Campanhas:**
```sql
SELECT id, name, status, sent_count, failed_count, total_recipients 
FROM admin_email_campaigns 
ORDER BY created_at DESC;
```

### **Verificar Destinatários:**
```sql
SELECT email, status, error_message 
FROM admin_email_campaign_recipients 
WHERE campaign_id = 1 AND status = 'failed';
```

### **Verificar Notificações:**
```sql
SELECT n.id, n.title, n.is_active, 
       COUNT(r.id) as total_reads,
       COUNT(r.clicked_at) as total_clicks
FROM admin_notifications n
LEFT JOIN admin_notification_reads r ON r.notification_id = n.id
GROUP BY n.id;
```

---

## ✅ Checklist de Implementação

- [x] Banco de Dados (4 tabelas)
- [x] Migrations SQL
- [x] APIs Backend (emails)
- [x] APIs Backend (notificações)
- [x] Worker de envio de emails
- [x] Rotação de contas de email
- [x] Delay entre envios
- [x] Página de gerenciamento (Super Admin)
- [x] Modal de notificações (Tenants)
- [x] Tracking de leitura/clique
- [x] Estatísticas em tempo real
- [x] Logs detalhados
- [x] Documentação completa

---

## 🎉 Sistema Completo e Pronto para Uso!

O sistema de comunicação está **100% funcional** e pronto para ser usado pelo Super Admin para se comunicar com os tenants através de emails em massa e notificações pop-up.

