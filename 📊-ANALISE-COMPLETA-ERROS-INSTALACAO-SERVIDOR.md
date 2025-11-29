# 📊 ANÁLISE COMPLETA - POSSÍVEIS ERROS NA INSTALAÇÃO DO SERVIDOR

**Data de Análise:** 29/11/2025  
**Objetivo:** Documentar todos os erros possíveis para instalação do zero no servidor  
**Status:** 🔍 Análise Concluída - Pronto para Deploy

---

## 📋 ÍNDICE

1. [Resumo Executivo](#resumo-executivo)
2. [Erros Identificados Anteriormente](#erros-identificados-anteriormente)
3. [Análise de Possíveis Erros](#análise-de-possíveis-erros)
4. [Dependências Críticas](#dependências-críticas)
5. [Checklist de Instalação](#checklist-de-instalação)
6. [Configurações Obrigatórias](#configurações-obrigatórias)
7. [Ordem de Instalação Recomendada](#ordem-de-instalação-recomendada)
8. [Troubleshooting Avançado](#troubleshooting-avançado)

---

## 🎯 RESUMO EXECUTIVO

### Problema Original
O sistema funcionava **perfeitamente no servidor local**, mas ao subir para o **servidor online** apresentava múltiplos erros 404 e falhas de roteamento.

### Causa Raiz Anterior
1. **Falta do arquivo `.env.local`** no frontend (servidor online)
2. **Backend com rotas não funcionando** (problema estrutural)
3. **Erros de banco de dados** (tabelas não existentes)
4. **Falta de configuração de variáveis de ambiente**

### Solução Anterior (Parcial)
- ✅ Arquivo `.env.local` criado no frontend
- ✅ Frontend reconstruído com `npm run build`
- ✅ Backend recompilado
- ⚠️ Backend ainda com problemas de rotas (não resolvido)
- ⚠️ Banco de dados com tabelas faltantes

---

## ❌ ERROS IDENTIFICADOS ANTERIORMENTE (RELATÓRIO 29/11/2025)

### 1. Erros 404 no Frontend

**Sintomas:**
```
❌ Failed to load resource: the server responded with a status of 404
   - api.sistemanettisist...br/public/logo.js1
   - api.sistemanettisist...br/logs/activity.js1
```

**Causa:**
- Frontend sem arquivo `.env.local` = tentando acessar `http://localhost:3001/api` no navegador
- URLs inválidas sendo geradas (`.js1` é estranho - possível erro no build)

**Impacto:** Alto - Sistema não funciona

---

### 2. Backend Não Responde Rotas

**Sintomas:**
```bash
curl http://localhost:3001/api/health
# Resultado: Cannot GET /api/health

curl http://localhost:3001/api/public/logo
# Resultado: Cannot GET /api/public/logo
```

**Causa Possível:**
- Rotas não registradas corretamente
- Middleware bloqueando requisições
- Arquivo `dist/` desatualizado ou corrompido
- Express não configurado para servir `/api`

**Impacto:** Crítico - Sistema completamente inoperante

---

### 3. Erros de Banco de Dados

**Sintomas:**
```
❌ Erro: relation "tenants" does not exist
```

**Causa:**
- Migrations não executadas
- Banco de dados não criado
- Conexão incorreta com banco

**Impacto:** Crítico - Sistema não inicia

---

### 4. Erros de Logs

**Sintomas:**
```
❌ POST /api/logs/activity - 501 (Not Implemented)
```

**Causa:**
- Rota não implementada ou middleware com problema
- Possível loop infinito de logs (tentando logar o próprio log)

**Impacto:** Médio - Sistema funciona mas sem logs

---

## 🔍 ANÁLISE DE POSSÍVEIS ERROS (INSTALAÇÃO DO ZERO)

### CATEGORIA 1: ERROS DE AMBIENTE E DEPENDÊNCIAS

#### ❌ Erro 1.1: Node.js Versão Incompatível
**Descrição:** Node.js < 18.x pode causar problemas com Next.js 14

**Sintomas:**
```
Error: The engine "node" is incompatible with this module
```

**Solução:**
```bash
# Verificar versão
node -v  # Deve ser >= 18.x

# Instalar Node.js 20 (recomendado)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Prioridade:** 🔴 CRÍTICA

---

#### ❌ Erro 1.2: PostgreSQL Não Instalado ou Não Rodando

**Descrição:** Banco de dados não está ativo

**Sintomas:**
```
❌ Failed to connect to database
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solução:**
```bash
# Verificar se PostgreSQL está instalado
psql --version

# Instalar PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Iniciar serviço
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verificar status
sudo systemctl status postgresql
```

**Prioridade:** 🔴 CRÍTICA

---

#### ❌ Erro 1.3: PM2 Não Instalado

**Descrição:** Gerenciador de processos não disponível

**Sintomas:**
```
pm2: command not found
```

**Solução:**
```bash
# Instalar PM2 globalmente
npm install -g pm2

# Verificar instalação
pm2 --version
```

**Prioridade:** 🔴 CRÍTICA

---

### CATEGORIA 2: ERROS DE CONFIGURAÇÃO

#### ❌ Erro 2.1: Arquivo .env Ausente no Backend

**Descrição:** Variáveis de ambiente não configuradas

**Sintomas:**
```
❌ Database connection failed
TypeError: Cannot read property 'DB_HOST' of undefined
```

**Solução:**
```bash
# Criar arquivo .env no backend
cd backend
nano .env

# Adicionar configurações obrigatórias:
```

**Conteúdo Mínimo do .env:**
```env
# Servidor
PORT=3001
NODE_ENV=production

# Banco de Dados PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=whatsapp_dispatcher
DB_USER=postgres
DB_PASSWORD=SUA_SENHA_AQUI

# JWT
JWT_SECRET=CHAVE_SUPER_SECRETA_E_ALEATORIA_MINIMO_32_CARACTERES

# Frontend URL (para CORS)
FRONTEND_URL=https://sistemasnettsistemas.com.br

# Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

**Prioridade:** 🔴 CRÍTICA

---

#### ❌ Erro 2.2: Arquivo .env.local Ausente no Frontend

**Descrição:** Frontend não sabe onde está a API

**Sintomas:**
```
❌ Failed to load resource: the server responded with a status of 404
```

**Solução:**
```bash
# Criar arquivo .env.local no frontend
cd frontend
nano .env.local

# Adicionar configurações:
```

**Conteúdo Obrigatório do .env.local:**
```env
# URL da API Backend (DEVE INCLUIR /api NO FINAL!)
NEXT_PUBLIC_API_URL=https://api.sistemasnettsistemas.com.br/api

# URL do Socket.IO (SEM /api no final)
NEXT_PUBLIC_SOCKET_URL=https://api.sistemasnettsistemas.com.br

# Nome da Aplicação
NEXT_PUBLIC_APP_NAME="Disparador NettSistemas"

# Recursos opcionais
NEXT_PUBLIC_ENABLE_LANDING_PAGE=true
NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP=false
```

**⚠️ ATENÇÃO:** 
- A URL da API DEVE terminar com `/api`
- Socket URL NÃO deve ter `/api`
- Após criar/editar, fazer `npm run build`

**Prioridade:** 🔴 CRÍTICA

---

#### ❌ Erro 2.3: Banco de Dados Não Criado

**Descrição:** Database não existe no PostgreSQL

**Sintomas:**
```
error: database "whatsapp_dispatcher" does not exist
```

**Solução:**
```bash
# Conectar ao PostgreSQL
sudo -u postgres psql

# Criar banco de dados
CREATE DATABASE whatsapp_dispatcher;

# Criar usuário (se necessário)
CREATE USER seu_usuario WITH PASSWORD 'sua_senha';

# Dar permissões
GRANT ALL PRIVILEGES ON DATABASE whatsapp_dispatcher TO seu_usuario;

# Sair
\q
```

**Prioridade:** 🔴 CRÍTICA

---

#### ❌ Erro 2.4: Migrations Não Executadas

**Descrição:** Tabelas não existem no banco

**Sintomas:**
```
❌ error: relation "tenants" does not exist
❌ error: relation "users" does not exist
❌ error: relation "whatsapp_accounts" does not exist
```

**Solução:**
```bash
cd backend

# Verificar se há migrations na pasta
ls -la src/database/migrations/
ls -la migrations/

# Executar migrations (se houver comando)
npm run migrate

# OU executar scripts SQL manualmente
psql -U postgres -d whatsapp_dispatcher -f criar-tabela-*.sql
```

**⚠️ ATENÇÃO:** Este projeto tem muitos scripts SQL. Precisam ser executados em ordem!

**Prioridade:** 🔴 CRÍTICA

---

### CATEGORIA 3: ERROS DE BUILD E COMPILAÇÃO

#### ❌ Erro 3.1: Frontend Build Falha

**Descrição:** Next.js não consegue compilar

**Sintomas:**
```
Error: Build failed
Type error: Cannot find module...
```

**Solução:**
```bash
cd frontend

# Limpar cache e node_modules
rm -rf .next node_modules package-lock.json

# Reinstalar dependências
npm install

# Tentar build novamente
npm run build
```

**Prioridade:** 🟠 ALTA

---

#### ❌ Erro 3.2: Backend Build Falha (TypeScript)

**Descrição:** TypeScript não compila

**Sintomas:**
```
Error: Compilation failed
src/server.ts(10,5): error TS2322...
```

**Solução:**
```bash
cd backend

# Limpar dist anterior
rm -rf dist

# Verificar erros do TypeScript
npx tsc --noEmit

# Compilar
npm run build
```

**Prioridade:** 🟠 ALTA

---

#### ❌ Erro 3.3: Dependências Faltando

**Descrição:** Pacotes npm não instalados

**Sintomas:**
```
Error: Cannot find module 'express'
Error: Cannot find module 'pg'
```

**Solução:**
```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

**Prioridade:** 🔴 CRÍTICA

---

### CATEGORIA 4: ERROS DE NGINX E PROXY

#### ❌ Erro 4.1: NGINX Não Configurado

**Descrição:** Proxy reverso não está funcionando

**Sintomas:**
- `https://api.sistemasnettsistemas.com.br` não responde
- Erro 502 Bad Gateway
- Erro 504 Gateway Timeout

**Solução:**
```bash
# Criar configuração para API
sudo nano /etc/nginx/sites-available/api.sistemasnettsistemas.com.br
```

**Configuração Mínima do NGINX (API):**
```nginx
server {
    listen 80;
    server_name api.sistemasnettsistemas.com.br;

    # Redirecionar HTTP para HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.sistemasnettsistemas.com.br;

    # Certificados SSL (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/api.sistemasnettsistemas.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.sistemasnettsistemas.com.br/privkey.pem;

    # Configurações SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Tamanho máximo de upload
    client_max_body_size 100M;

    # Proxy para backend Node.js
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        
        # Headers importantes
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

**Ativar configuração:**
```bash
# Criar link simbólico
sudo ln -s /etc/nginx/sites-available/api.sistemasnettsistemas.com.br /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Recarregar NGINX
sudo systemctl reload nginx
```

**Prioridade:** 🔴 CRÍTICA

---

#### ❌ Erro 4.2: Certificado SSL Não Instalado

**Descrição:** HTTPS não funciona

**Sintomas:**
```
ERR_SSL_PROTOCOL_ERROR
Your connection is not private
```

**Solução:**
```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx

# Obter certificado SSL
sudo certbot --nginx -d api.sistemasnettsistemas.com.br
sudo certbot --nginx -d sistemasnettsistemas.com.br

# Verificar renovação automática
sudo certbot renew --dry-run
```

**Prioridade:** 🟠 ALTA

---

#### ❌ Erro 4.3: CORS Bloqueando Requisições

**Descrição:** Navegador bloqueia requisições entre domínios

**Sintomas:**
```
Access to fetch at 'https://api...' from origin 'https://...' has been blocked by CORS policy
```

**Solução:**

No arquivo `backend/src/server.ts`, verificar se o CORS está configurado corretamente:

```typescript
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001', 
    'https://sistemasnettsistemas.com.br',  // ✅ ADICIONAR DOMÍNIO PRODUÇÃO
    process.env.FRONTEND_URL || 'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

**E no `.env` do backend:**
```env
FRONTEND_URL=https://sistemasnettsistemas.com.br
```

**Prioridade:** 🟠 ALTA

---

### CATEGORIA 5: ERROS DE ROTAS E API

#### ❌ Erro 5.1: Rota /api/health Não Funciona

**Descrição:** Backend não responde nem ao health check

**Sintomas:**
```bash
curl http://localhost:3001/api/health
# Resultado: Cannot GET /api/health
```

**Causa Possível:**
1. Rotas não registradas em `server.ts`
2. Arquivo `routes/index.ts` com problema
3. Build desatualizado (pasta `dist/` antiga)

**Solução:**
```bash
# 1. Verificar se routes está sendo importado
cat backend/src/server.ts | grep "routes"
# Deve ter: import routes from './routes';
# Deve ter: app.use('/api', routes);

# 2. Recompilar backend
cd backend
rm -rf dist
npm run build

# 3. Reiniciar serviço
pm2 restart whatsapp-backend

# 4. Testar novamente
curl http://localhost:3001/api/health
```

**⚠️ VERIFICAÇÃO:** O arquivo `src/routes/index.ts` existe e exporta o router corretamente?

**Prioridade:** 🔴 CRÍTICA

---

#### ❌ Erro 5.2: Rotas Retornam 404

**Descrição:** Algumas rotas funcionam, outras não

**Sintomas:**
```
GET /api/whatsapp-accounts - 200 OK ✅
GET /api/public/logo - 404 Not Found ❌
```

**Causa:**
- Rota não registrada em `routes/index.ts`
- Controller não exportado corretamente
- Caminho do arquivo errado

**Solução:**
```bash
# Verificar se a rota está registrada
cat backend/src/routes/index.ts | grep "public/logo"

# Deve ter algo como:
# router.get('/public/logo', getLogoOnly);
```

**Prioridade:** 🟡 MÉDIA

---

### CATEGORIA 6: ERROS DE PERMISSÕES

#### ❌ Erro 6.1: Permissões de Arquivos

**Descrição:** Node.js não consegue acessar arquivos

**Sintomas:**
```
Error: EACCES: permission denied, open '/root/apps/whatsapp-dispatcherr/uploads/...'
```

**Solução:**
```bash
# Dar permissões corretas para pasta uploads
cd /root/apps/whatsapp-dispatcherr/backend
sudo chown -R $USER:$USER uploads
sudo chmod -R 755 uploads

# Dar permissões para node_modules (se necessário)
sudo chown -R $USER:$USER node_modules
```

**Prioridade:** 🟡 MÉDIA

---

#### ❌ Erro 6.2: Firewall Bloqueando Portas

**Descrição:** Portas 3000, 3001 bloqueadas

**Sintomas:**
- Backend roda mas não responde de fora
- Frontend não acessível

**Solução:**
```bash
# Verificar se firewall está ativo
sudo ufw status

# Abrir portas necessárias
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3001/tcp  # Apenas se necessário (geralmente usa NGINX)

# Recarregar firewall
sudo ufw reload
```

**Prioridade:** 🟠 ALTA

---

### CATEGORIA 7: ERROS DE PM2

#### ❌ Erro 7.1: PM2 Não Inicia Serviços

**Descrição:** Serviços não iniciam ou crasham imediatamente

**Sintomas:**
```bash
pm2 list
# Status: errored ou stopped
```

**Solução:**
```bash
# Ver logs de erro
pm2 logs whatsapp-backend --lines 50
pm2 logs whatsapp-frontend --lines 50

# Deletar processos antigos
pm2 delete all

# Recriar processos
cd /root/apps/whatsapp-dispatcherr/backend
pm2 start npm --name "whatsapp-backend" -- start

cd /root/apps/whatsapp-dispatcherr/frontend
pm2 start npm --name "whatsapp-frontend" -- start

# Salvar configuração
pm2 save
```

**Prioridade:** 🟠 ALTA

---

#### ❌ Erro 7.2: PM2 Não Persiste Após Reboot

**Descrição:** Serviços não iniciam automaticamente

**Sintomas:**
- Após reiniciar servidor, PM2 não inicia

**Solução:**
```bash
# Configurar PM2 para iniciar com o sistema
pm2 startup

# Copiar e executar o comando que aparecer (exemplo):
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root

# Salvar processos atuais
pm2 save
```

**Prioridade:** 🟡 MÉDIA

---

## 🔧 DEPENDÊNCIAS CRÍTICAS

### Backend
```json
{
  "dependencies": {
    "express": "^4.18.2",        // Framework web
    "pg": "^8.11.3",              // PostgreSQL client
    "dotenv": "^16.3.1",          // Variáveis de ambiente
    "cors": "^2.8.5",             // CORS
    "bcryptjs": "^3.0.3",         // Hash de senha
    "jsonwebtoken": "^9.0.2",     // JWT
    "axios": "^1.6.2",            // HTTP client
    "socket.io": "^4.6.2",        // WebSocket
    "multer": "^1.4.5-lts.1",     // Upload de arquivos
    "sharp": "^0.34.5"            // Processamento de imagens
  },
  "devDependencies": {
    "typescript": "^5.3.3",       // TypeScript
    "tsx": "^4.7.0"               // TS executor
  }
}
```

### Frontend
```json
{
  "dependencies": {
    "next": "^14.0.4",            // Framework React
    "react": "^18.2.0",           // React
    "react-dom": "^18.2.0",       // React DOM
    "axios": "^1.6.2",            // HTTP client
    "socket.io-client": "^4.6.2"  // WebSocket client
  },
  "devDependencies": {
    "typescript": "^5.3.3",       // TypeScript
    "tailwindcss": "^3.4.0"       // CSS framework
  }
}
```

---

## ✅ CHECKLIST DE INSTALAÇÃO (ORDEM RECOMENDADA)

### 1️⃣ PREPARAÇÃO DO SERVIDOR

```bash
☐ Verificar versão do Node.js (>= 18.x)
☐ Instalar PostgreSQL
☐ Instalar NGINX
☐ Instalar PM2 globalmente
☐ Configurar firewall (portas 80, 443)
```

**Comandos:**
```bash
# Node.js
node -v  # Verificar versão

# PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# NGINX
sudo apt install nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# PM2
npm install -g pm2
```

---

### 2️⃣ CONFIGURAÇÃO DO BANCO DE DADOS

```bash
☐ Criar banco de dados
☐ Criar usuário (se necessário)
☐ Testar conexão
```

**Comandos:**
```bash
sudo -u postgres psql
CREATE DATABASE whatsapp_dispatcher;
CREATE USER seu_usuario WITH PASSWORD 'sua_senha_segura';
GRANT ALL PRIVILEGES ON DATABASE whatsapp_dispatcher TO seu_usuario;
\q
```

---

### 3️⃣ UPLOAD E CONFIGURAÇÃO DO CÓDIGO

```bash
☐ Fazer upload do código para o servidor
☐ Criar arquivo .env no backend
☐ Criar arquivo .env.local no frontend
☐ Instalar dependências do backend
☐ Instalar dependências do frontend
```

**Comandos:**
```bash
# Navegar para o projeto
cd /root/apps/whatsapp-dispatcherr

# Backend
cd backend
nano .env  # Configurar variáveis
npm install

# Frontend
cd ../frontend
nano .env.local  # Configurar variáveis
npm install
```

---

### 4️⃣ EXECUTAR MIGRATIONS

```bash
☐ Verificar scripts SQL disponíveis
☐ Executar migrations em ordem
☐ Verificar se tabelas foram criadas
```

**Comandos:**
```bash
cd backend

# Listar scripts disponíveis
ls -la *.sql
ls -la migrations/

# Executar migrations (se houver comando npm)
npm run migrate

# OU executar manualmente (EXEMPLO)
psql -U postgres -d whatsapp_dispatcher -f criar-tabela-planos.sql
psql -U postgres -d whatsapp_dispatcher -f criar-tabela-tenants.sql
# ... etc
```

**⚠️ IMPORTANTE:** A ordem de execução importa! Tabelas com foreign keys precisam que suas referências existam primeiro.

---

### 5️⃣ BUILD DOS PROJETOS

```bash
☐ Compilar backend (TypeScript → JavaScript)
☐ Compilar frontend (Next.js build)
☐ Verificar erros de build
```

**Comandos:**
```bash
# Backend
cd backend
npm run build  # Gera pasta dist/

# Verificar se compilou
ls -la dist/

# Frontend
cd ../frontend
npm run build  # Gera pasta .next/

# Verificar se compilou
ls -la .next/
```

---

### 6️⃣ CONFIGURAR NGINX

```bash
☐ Criar configuração para API (api.sistemasnettsistemas.com.br)
☐ Criar configuração para Frontend (sistemasnettsistemas.com.br)
☐ Obter certificados SSL (Let's Encrypt)
☐ Testar configurações
☐ Recarregar NGINX
```

**Comandos:**
```bash
# Configurar API
sudo nano /etc/nginx/sites-available/api.sistemasnettsistemas.com.br
# (colar configuração do NGINX)

# Ativar
sudo ln -s /etc/nginx/sites-available/api.sistemasnettsistemas.com.br /etc/nginx/sites-enabled/

# SSL
sudo certbot --nginx -d api.sistemasnettsistemas.com.br
sudo certbot --nginx -d sistemasnettsistemas.com.br

# Testar
sudo nginx -t

# Recarregar
sudo systemctl reload nginx
```

---

### 7️⃣ INICIAR SERVIÇOS COM PM2

```bash
☐ Iniciar backend
☐ Iniciar frontend
☐ Verificar logs
☐ Salvar configuração PM2
☐ Configurar auto-start
```

**Comandos:**
```bash
# Backend
cd /root/apps/whatsapp-dispatcherr/backend
pm2 start npm --name "whatsapp-backend" -- start

# Frontend
cd /root/apps/whatsapp-dispatcherr/frontend
pm2 start npm --name "whatsapp-frontend" -- start

# Verificar
pm2 list
pm2 logs --lines 100

# Salvar
pm2 save

# Auto-start
pm2 startup
# (executar comando que aparecer)
```

---

### 8️⃣ TESTES FINAIS

```bash
☐ Testar backend localmente (curl)
☐ Testar API externa (browser)
☐ Testar frontend
☐ Testar login
☐ Verificar logs sem erros
```

**Comandos:**
```bash
# Testar backend local
curl http://localhost:3001/api/health

# Testar API externa
curl https://api.sistemasnettsistemas.com.br/api/health

# Testar frontend
curl https://sistemasnettsistemas.com.br

# Ver logs
pm2 logs --lines 50
```

---

## 🔐 CONFIGURAÇÕES OBRIGATÓRIAS

### Backend (.env)

```env
# ============================================
# SERVIDOR
# ============================================
PORT=3001
NODE_ENV=production

# ============================================
# BANCO DE DADOS POSTGRESQL
# ============================================
DB_HOST=localhost
DB_PORT=5432
DB_NAME=whatsapp_dispatcher
DB_USER=postgres
DB_PASSWORD=SENHA_SUPER_SEGURA_AQUI

# ============================================
# JWT (AUTENTICAÇÃO)
# ============================================
JWT_SECRET=CHAVE_ALEATORIA_MINIMO_32_CARACTERES_AQUI

# ============================================
# FRONTEND (CORS)
# ============================================
FRONTEND_URL=https://sistemasnettsistemas.com.br

# ============================================
# UPLOAD
# ============================================
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# ============================================
# CLOUDINARY (OPCIONAL)
# ============================================
# CLOUDINARY_CLOUD_NAME=seu_cloud_name
# CLOUDINARY_API_KEY=sua_api_key
# CLOUDINARY_API_SECRET=seu_api_secret

# ============================================
# REDIS (SE USAR FILAS)
# ============================================
# REDIS_HOST=localhost
# REDIS_PORT=6379
# REDIS_PASSWORD=
```

### Frontend (.env.local)

```env
# ============================================
# API BACKEND
# ============================================
# ⚠️ ATENÇÃO: DEVE TERMINAR COM /api
NEXT_PUBLIC_API_URL=https://api.sistemasnettsistemas.com.br/api

# ============================================
# SOCKET.IO
# ============================================
# ⚠️ ATENÇÃO: NÃO DEVE TER /api
NEXT_PUBLIC_SOCKET_URL=https://api.sistemasnettsistemas.com.br

# ============================================
# CONFIGURAÇÕES DA APLICAÇÃO
# ============================================
NEXT_PUBLIC_APP_NAME="Disparador NettSistemas"

# ============================================
# RECURSOS OPCIONAIS
# ============================================
NEXT_PUBLIC_ENABLE_LANDING_PAGE=true
NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP=false

# ============================================
# LOGS (DESABILITAR EM PRODUÇÃO)
# ============================================
NEXT_PUBLIC_DISABLE_FRONTEND_LOGS=true
```

---

## 📝 ORDEM DE INSTALAÇÃO RECOMENDADA (RESUMO)

```
1. Servidor Linux
   ├── Node.js >= 18.x
   ├── PostgreSQL
   ├── NGINX
   └── PM2

2. Banco de Dados
   ├── Criar database
   ├── Criar usuário
   └── Testar conexão

3. Código
   ├── Upload do projeto
   ├── .env (backend)
   ├── .env.local (frontend)
   ├── npm install (backend)
   └── npm install (frontend)

4. Migrations
   ├── Verificar scripts SQL
   ├── Executar em ordem
   └── Verificar tabelas criadas

5. Build
   ├── npm run build (backend)
   └── npm run build (frontend)

6. NGINX
   ├── Configurar API
   ├── Configurar Frontend
   ├── SSL (Certbot)
   └── Reload

7. PM2
   ├── Start backend
   ├── Start frontend
   ├── Verificar logs
   └── pm2 save + startup

8. Testes
   ├── Health check local
   ├── Health check externo
   ├── Frontend
   └── Login
```

---

## 🔧 TROUBLESHOOTING AVANÇADO

### Problema: Backend inicia mas não responde rotas

**Diagnóstico:**
```bash
# 1. Verificar se o servidor está rodando
pm2 list
# Status deve ser "online"

# 2. Verificar logs
pm2 logs whatsapp-backend --lines 50
# Deve mostrar: "Server running on port 3001"

# 3. Testar conexão local
curl http://localhost:3001/api/health

# 4. Se falhar, verificar se a porta está aberta
sudo netstat -tlnp | grep 3001
# Deve mostrar: LISTEN na porta 3001

# 5. Verificar arquivo server.js compilado
cat backend/dist/server.js | grep "app.use('/api'"
# Deve ter: app.use('/api', routes)
```

**Possíveis Causas:**
1. Build desatualizado (dist/ antigo)
2. Erro no arquivo routes/index.ts
3. Middleware bloqueando requisições
4. Express não configurado corretamente

**Solução:**
```bash
# Recompilar do zero
cd backend
rm -rf dist
npm run build

# Verificar se dist/ foi criado
ls -la dist/

# Reiniciar
pm2 restart whatsapp-backend
pm2 logs whatsapp-backend --lines 20
```

---

### Problema: Frontend não carrega ou fica em branco

**Diagnóstico:**
```bash
# 1. Verificar se está rodando
pm2 list
# Status: online

# 2. Verificar logs
pm2 logs whatsapp-frontend --lines 50

# 3. Abrir Developer Tools no navegador
# Console → Ver erros JavaScript
# Network → Ver requisições falhando

# 4. Verificar se .env.local existe
ls -la frontend/.env.local

# 5. Verificar se build foi feito
ls -la frontend/.next/
```

**Possíveis Causas:**
1. `.env.local` não existe ou está errado
2. Build não foi feito após criar `.env.local`
3. URL da API errada
4. CORS bloqueando requisições

**Solução:**
```bash
# 1. Criar/verificar .env.local
cd frontend
cat .env.local
# Deve ter: NEXT_PUBLIC_API_URL=https://api.sistemasnettsistemas.com.br/api

# 2. Rebuild
rm -rf .next
npm run build

# 3. Reiniciar
pm2 restart whatsapp-frontend
```

---

### Problema: Erro "Cannot GET /api/..."

**Diagnóstico:**
```bash
# 1. Verificar se routes está sendo carregado
cat backend/src/server.ts | grep -A 5 "app.use"

# Deve ter:
# app.use('/api', routes);

# 2. Verificar se routes/index.ts exporta corretamente
cat backend/src/routes/index.ts | grep "export default"

# Deve ter:
# export default router;

# 3. Verificar se dist/ está atualizado
ls -lt backend/dist/server.js
# Comparar data/hora com src/server.ts
```

**Solução:**
```bash
# Recompilar
cd backend
npm run build
pm2 restart whatsapp-backend

# Testar
curl http://localhost:3001/api/health
```

---

### Problema: Erro "relation does not exist"

**Diagnóstico:**
```bash
# 1. Conectar ao banco
psql -U postgres -d whatsapp_dispatcher

# 2. Listar tabelas
\dt

# 3. Se não houver tabelas, migrations não foram executadas
```

**Solução:**
```bash
# Executar migrations
cd backend

# Verificar se há scripts
ls -la *.sql migrations/*.sql

# Executar manualmente (exemplo)
psql -U postgres -d whatsapp_dispatcher -f criar-tabela-tenants.sql
psql -U postgres -d whatsapp_dispatcher -f criar-tabela-users.sql
# ... etc

# OU se houver comando npm
npm run migrate
```

---

## 🎯 RESUMO DOS ERROS MAIS COMUNS

| Erro | Causa | Solução | Prioridade |
|------|-------|---------|------------|
| Erros 404 no frontend | `.env.local` ausente | Criar arquivo + rebuild | 🔴 CRÍTICA |
| Backend não responde | Build desatualizado | `npm run build` + restart | 🔴 CRÍTICA |
| Tabelas não existem | Migrations não executadas | Executar scripts SQL | 🔴 CRÍTICA |
| CORS bloqueando | FRONTEND_URL errado | Corrigir `.env` backend | 🟠 ALTA |
| SSL não funciona | Certificado não instalado | `certbot --nginx` | 🟠 ALTA |
| PM2 não persiste | Startup não configurado | `pm2 startup + save` | 🟡 MÉDIA |

---

## 📞 INFORMAÇÕES FINAIS

### Servidor Anterior
- **IP:** 72.60.141.244
- **Domínio API:** api.sistemasnettsistemas.com.br
- **Domínio Frontend:** sistemasnettsistemas.com.br
- **Path:** /root/apps/whatsapp-dispatcherr/

### Comandos Úteis

```bash
# Ver logs em tempo real
pm2 logs

# Reiniciar tudo
pm2 restart all

# Verificar status
pm2 list

# Ver uso de recursos
pm2 monit

# Testar API
curl https://api.sistemasnettsistemas.com.br/api/health

# Ver logs do NGINX
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## ✅ CONCLUSÃO

Este documento contém:
- ✅ Todos os erros identificados anteriormente
- ✅ Análise de possíveis novos erros
- ✅ Soluções detalhadas para cada erro
- ✅ Ordem recomendada de instalação
- ✅ Configurações obrigatórias
- ✅ Troubleshooting avançado

**Próximos Passos:**
1. Seguir o checklist na ordem
2. Documentar cada etapa executada
3. Anotar erros que aparecerem
4. Consultar troubleshooting se necessário

**Boa sorte com a instalação!** 🚀

---

**Documento criado em:** 29/11/2025  
**Versão:** 1.0  
**Status:** ✅ Completo e Pronto para Uso

