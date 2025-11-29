# 🔧 Backend - WhatsApp API Dispatcher

Backend da aplicação construído com Node.js, TypeScript, Express, PostgreSQL e Redis.

---

## 📋 Estrutura

```
backend/
├── src/
│   ├── controllers/       # Controladores das rotas
│   ├── database/          # Conexão e migrations
│   ├── middlewares/       # Middlewares (upload, auth, etc)
│   ├── models/            # Models do banco de dados
│   ├── routes/            # Definição de rotas
│   ├── services/          # Lógica de negócio
│   │   ├── whatsapp.service.ts   # Integração WhatsApp API
│   │   └── queue.service.ts      # Sistema de filas
│   └── server.ts          # Servidor principal
├── uploads/               # Arquivos enviados
├── package.json
├── tsconfig.json
└── .env
```

---

## 🚀 Instalação

```bash
npm install
```

---

## ⚙️ Configuração

Crie o arquivo `.env`:

```env
PORT=3001
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=whatsapp_dispatcher
DB_USER=postgres
DB_PASSWORD=sua_senha

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

JWT_SECRET=sua_chave_secreta

UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

---

## 🗄️ Banco de Dados

### Criar o banco:
```bash
psql -U postgres
CREATE DATABASE whatsapp_dispatcher;
\q
```

### Executar migrations:
```bash
npm run migrate
```

---

## 🏃 Executar

### Desenvolvimento:
```bash
npm run dev
```

### Produção:
```bash
npm run build
npm start
```

---

## 📡 API Endpoints

### WhatsApp Accounts
- `POST /api/whatsapp-accounts` - Criar conta
- `GET /api/whatsapp-accounts` - Listar contas
- `GET /api/whatsapp-accounts/active` - Contas ativas
- `GET /api/whatsapp-accounts/:id` - Buscar por ID
- `PUT /api/whatsapp-accounts/:id` - Atualizar
- `DELETE /api/whatsapp-accounts/:id` - Deletar
- `PATCH /api/whatsapp-accounts/:id/toggle` - Ativar/Desativar
- `POST /api/whatsapp-accounts/test-connection` - Testar conexão
- `GET /api/whatsapp-accounts/:id/templates` - Buscar templates

### Campaigns
- `POST /api/campaigns` - Criar campanha
- `GET /api/campaigns` - Listar campanhas
- `GET /api/campaigns/:id` - Buscar por ID
- `GET /api/campaigns/:id/messages` - Mensagens da campanha
- `GET /api/campaigns/:id/stats` - Estatísticas
- `PATCH /api/campaigns/:id/status` - Atualizar status
- `DELETE /api/campaigns/:id` - Deletar

### Messages
- `POST /api/messages/send-immediate` - Enviar imediato
- `GET /api/messages` - Listar mensagens
- `GET /api/messages/:id` - Buscar por ID
- `GET /api/messages/queue/stats` - Estatísticas da fila

### Upload
- `POST /api/upload/media` - Upload de mídia

### Health
- `GET /api/health` - Status da API

---

## 🔄 Sistema de Filas

O sistema usa **Bull Queue** com Redis para gerenciar filas:

### Filas:
- **message-queue**: Envio individual de mensagens
- **campaign-queue**: Processamento de campanhas

### Eventos:
- `completed` - Job completado
- `failed` - Job falhou
- `progress` - Progresso atualizado

---

## 📦 Dependências Principais

- **express** - Framework web
- **pg** - PostgreSQL client
- **bull** - Gerenciamento de filas
- **ioredis** - Cliente Redis
- **axios** - Requisições HTTP
- **multer** - Upload de arquivos
- **socket.io** - WebSocket

---

## 🧪 Testes

```bash
# Testar conexão com banco
npm run migrate

# Testar API
curl http://localhost:3001/api/health
```

---

## 🐳 Docker

```bash
docker build -t whatsapp-backend .
docker run -p 3001:3001 whatsapp-backend
```

---

## 📝 Logs

Os logs são exibidos no console:
- ✅ Operações bem-sucedidas (verde)
- ❌ Erros (vermelho)
- ℹ️ Informações (azul)

---

## 🔒 Segurança

- Validação de entrada em todas as rotas
- Tokens armazenados de forma segura
- CORS configurado
- Rate limiting (a implementar)

---

## 📚 Documentação da API WhatsApp

- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- [Cloud API Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference)


