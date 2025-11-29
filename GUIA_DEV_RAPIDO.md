# 📚 GUIA RÁPIDO DO DESENVOLVEDOR

## 🎯 O QUE É O SISTEMA
Sistema de disparo em massa de mensagens WhatsApp com **2 tipos de campanha**:
- **API Oficial** (WhatsApp Business API)
- **QR Connect** (instâncias Evolution API com QR Code)

---

## 🏗️ ARQUITETURA

### **Stack Técnico**
```
Frontend: Next.js 14 + React 18 + TailwindCSS + Socket.IO
Backend:  Node.js + Express + TypeScript + Bull (filas)
Banco:    PostgreSQL
Cache:    Redis (para filas Bull)
```

### **Estrutura de Pastas**
```
backend/src/
  ├── routes/          # Rotas da API
  ├── workers/         # Workers das filas (campaign.worker.ts)
  ├── services/        # Lógica de negócio
  ├── database/        # Schema SQL + conexão
  └── server.ts        # Servidor principal

frontend/src/
  ├── pages/           # Páginas Next.js
  ├── components/      # Componentes React
  └── services/        # Chamadas API
```

---

## 📊 BANCO DE DADOS (8 Tabelas Principais)

| Tabela | Função |
|--------|--------|
| `whatsapp_accounts` | Contas WhatsApp Business API |
| `templates` | Templates aprovados pela Meta |
| `campaigns` | Campanhas de disparo |
| `campaign_templates` | Templates de cada campanha (1:N) |
| `contacts` | Contatos para envio |
| `campaign_contacts` | Relação campanha-contato |
| `messages` | Log de envios (status, timestamps) |
| `media` | Arquivos de mídia |

**Relacionamento:** 1 campanha → N templates → N contatos → N mensagens

---

## 🔄 COMO FUNCIONA O DISPARO

### **1. API Oficial (WhatsApp Business API)**
```typescript
// Rotação: Round-Robin (Conta → Template)
const accountIndex = sentCount % totalAccounts;
const templateIndex = sentCount % totalTemplates;

// Controle de ritmo
- Delay entre mensagens: 3-5 segundos
- Pausas programadas (horários)
- Worker: campaign.worker.ts (linha 448+)
```

### **2. QR Connect (Evolution API)**
```typescript
// Rotação: Dupla (Instância + Template)
- Distribui contatos entre instâncias
- Alterna templates dentro de cada instância
- Worker: qr-campaign.worker.ts
```

**Fluxo Geral:**
```
1. Criar campanha (frontend)
2. Selecionar templates + contatos
3. Campanha vai p/ fila Bull (Redis)
4. Worker processa (loop controlado)
5. Envia via WhatsApp API
6. Atualiza status via webhook
7. Socket.IO atualiza frontend em tempo real
```

---

## 🛠️ PRINCIPAIS ENDPOINTS

### **API Oficial**
```
POST   /api/whatsapp-accounts     # Criar conta
GET    /api/templates              # Listar templates
POST   /api/campaigns              # Criar campanha
GET    /api/campaigns/:id          # Detalhes campanha
POST   /api/campaigns/:id/pause    # Pausar
POST   /api/campaigns/:id/resume   # Retomar
POST   /api/webhook                # Webhook WhatsApp
```

### **QR Connect**
```
POST   /api/qr-templates           # Criar template QR
GET    /api/qr-templates           # Listar templates QR
POST   /api/qr-campaigns           # Criar campanha QR
POST   /api/qr-webhook             # Webhook Evolution API
```

---

## ⚙️ CONFIGURAÇÃO

### **Backend (.env)**
```bash
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/whatsapp_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=seu-secret
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
```

### **Frontend (.env.local)**
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### **Rodar Projeto**
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

---

## 🔑 CONCEITOS-CHAVE

### **1. Templates (API Oficial)**
- Devem ser **aprovados pela Meta** primeiro
- Estrutura: Header + Body + Footer + Buttons
- Suportam variáveis: `{{1}}`, `{{2}}`, etc.
- Armazenados em `templates` (vinculados a conta)

### **2. Rotação de Templates**
- **API Oficial:** Round-robin simples (módulo %)
- **QR Connect:** Dupla rotação (instância + template)
- Evita repetição, distribui carga

### **3. Controle de Ritmo**
```javascript
// Delays padrão
const delay = Math.floor(Math.random() * 2000) + 3000; // 3-5s
await sleep(delay);
```

### **4. Status de Mensagens**
```
pending → sent → delivered → read
           ↓
        failed
```

### **5. Webhooks**
- WhatsApp envia status de mensagens
- Atualiza `messages.status` + timestamps
- Incrementa contadores da campanha

### **6. Socket.IO**
- Atualiza dashboard em tempo real
- Eventos: `campaignUpdate`, `messageStatus`

---

## 🚨 PONTOS DE ATENÇÃO

1. **Templates:** Sempre verificar se estão aprovados (`status: 'APPROVED'`)
2. **Rate Limits:** WhatsApp tem limites de envio (começar com 1000/dia)
3. **Formato Telefone:** Sempre `55DDD9XXXXXXXX` (sem +, espaços ou parênteses)
4. **Filas Bull:** Redis deve estar rodando
5. **Webhook:** Configurar na Meta Developer Console
6. **Rotação:** Verificar `currentSentCount` para garantir distribuição

---

## 📝 ARQUIVOS IMPORTANTES

| Arquivo | O que faz |
|---------|-----------|
| `backend/src/workers/campaign.worker.ts` | Processamento de campanhas API Oficial |
| `backend/src/workers/qr-campaign.worker.ts` | Processamento campanhas QR |
| `backend/src/routes/index.ts` | Definição de todas as rotas |
| `backend/src/database/schema.sql` | Estrutura do banco |
| `frontend/src/pages/index.tsx` | Dashboard principal |

---

## 🎓 PARA COMEÇAR

1. **Entender o fluxo:** Campanha → Fila → Worker → WhatsApp → Webhook → Atualização
2. **Explorar o Worker:** `campaign.worker.ts` (linha 448-650)
3. **Ver rotas:** `backend/src/routes/index.ts`
4. **Testar:** Criar uma campanha pequena (10 contatos) para ver funcionando

---

**🚀 Dica:** Comece debugando o worker. É o coração do sistema!

