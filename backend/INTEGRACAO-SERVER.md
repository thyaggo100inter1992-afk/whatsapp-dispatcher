# 🔧 Integração: Como Atualizar seu server.js

Este guia mostra como integrar o sistema de autenticação multi-tenant no seu servidor Express existente.

---

## 📝 Exemplo de Integração

### Opção 1: Servidor Novo (Recomendado para testes)

Crie `backend/src/server-multitenant.js`:

```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// ============================================
// MIDDLEWARES GLOBAIS
// ============================================

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  credentials: true
}));

// Body Parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logs de requisição (desenvolvimento)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ============================================
// ROTAS
// ============================================

// Health check
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API Multi-Tenant - WhatsApp Dispatcher',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// Rotas da API
const apiRoutes = require('./routes/index');
app.use('/api', apiRoutes);

// ============================================
// TRATAMENTO DE ERROS
// ============================================

// 404 - Rota não encontrada
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada',
    path: req.path
  });
});

// Erro global
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Erro interno do servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 SERVIDOR MULTI-TENANT INICIADO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🔐 Autenticação: POST /api/auth/login`);
  console.log(`📝 Registro: POST /api/auth/register`);
  console.log(`❤️  Health: GET /api/health`);
  console.log('');
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Banco: ${process.env.DB_NAME}@${process.env.DB_HOST}`);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});

// Tratamento de shutdown gracioso
process.on('SIGTERM', () => {
  console.log('SIGTERM recebido, encerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT recebido, encerrando servidor...');
  process.exit(0);
});

module.exports = app;
```

---

### Opção 2: Atualizar Servidor Existente

Se você já tem um `server.js` funcionando, adicione:

```javascript
// ... seu código existente ...

// ADICIONAR: Rotas de autenticação
const authRoutes = require('./routes/auth.routes');
app.use('/api/auth', authRoutes);

// ADICIONAR: Middlewares nas rotas protegidas
const { authenticate } = require('./middleware/auth.middleware');
const { setTenantContext } = require('./middleware/tenant.middleware');

// Aplicar para todas as rotas que precisam de autenticação
app.use('/api/campaigns', authenticate, setTenantContext, campaignsRouter);
app.use('/api/templates', authenticate, setTenantContext, templatesRouter);
app.use('/api/contacts', authenticate, setTenantContext, contactsRouter);
// ... suas outras rotas ...

// ... resto do código ...
```

---

## 🧪 Testando a Integração

### 1. Iniciar o Servidor

```bash
cd backend
node src/server-multitenant.js
```

### 2. Testar Health Check

```bash
curl http://localhost:3000/api/health
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "API Multi-Tenant funcionando!",
  "timestamp": "2024-11-20T02:30:00.000Z"
}
```

### 3. Testar Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@minhaempresa.com",
    "password": "admin123"
  }'
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Login realizado com sucesso",
  "data": {
    "user": {
      "id": 1,
      "nome": "Administrador",
      "email": "admin@minhaempresa.com",
      "role": "super_admin"
    },
    "tenant": {
      "id": 1,
      "nome": "Minha Empresa",
      "slug": "minha-empresa",
      "plano": "enterprise"
    },
    "tokens": {
      "accessToken": "eyJhbGc...",
      "refreshToken": "eyJhbGc...",
      "expiresIn": 604800
    }
  }
}
```

### 4. Testar Rota Protegida

```bash
# Copie o accessToken da resposta anterior
TOKEN="seu-token-aqui"

curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**Resposta esperada:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "nome": "Administrador",
      "email": "admin@minhaempresa.com",
      "role": "super_admin"
    },
    "tenant": {
      "id": 1,
      "nome": "Minha Empresa",
      "slug": "minha-empresa",
      "plano": "enterprise"
    }
  }
}
```

### 5. Testar Registro de Novo Tenant

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "tenantNome": "Empresa Teste",
    "tenantEmail": "contato@empresateste.com",
    "adminNome": "Admin Teste",
    "adminEmail": "admin@empresateste.com",
    "adminPassword": "senha123",
    "plano": "basico"
  }'
```

---

## 📋 Package.json - Scripts Úteis

Adicione ao seu `package.json`:

```json
{
  "scripts": {
    "start": "node src/server.js",
    "start:multitenant": "node src/server-multitenant.js",
    "dev": "nodemon src/server-multitenant.js",
    "dev:old": "nodemon src/server.js"
  }
}
```

---

## 🔐 Variáveis de Ambiente Obrigatórias

Certifique-se de ter no `.env`:

```bash
# ESSENCIAL para JWT funcionar
JWT_SECRET=uma-chave-muito-segura-e-aleatoria-aqui

# Dados do banco (você já tem)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=whatsapp_dispatcher
DB_USER=postgres
DB_PASSWORD=Tg130992*
```

**⚠️ IMPORTANTE:** Troque `JWT_SECRET` por algo seguro em produção!

---

## 🎯 Próximos Passos

1. ✅ Criar `server-multitenant.js`
2. ✅ Testar login com credenciais do Tenant 1
3. ✅ Testar registro de novo tenant
4. ✅ Migrar seus controllers existentes (ver `GUIA-MIGRACAO-CONTROLLERS.md`)

---

## 🐛 Troubleshooting

### Erro: "JWT_SECRET não definido"
➜ Adicione `JWT_SECRET` no arquivo `.env`

### Erro: "Token inválido"
➜ Verifique se o token está no formato: `Bearer TOKEN`

### Erro: "Usuário não encontrado"
➜ Verifique se rodou as migrations da Fase 1

### Erro: "Tenant inativo"
➜ Verifique se o tenant está com `status = 'active'` no banco

---

Precisa de ajuda? Só avisar! 🚀





