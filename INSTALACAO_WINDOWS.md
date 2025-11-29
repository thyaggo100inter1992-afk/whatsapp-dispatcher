# 📦 Guia de Instalação - Windows

Este guia detalha como instalar e executar o sistema no **Windows 10/11**.

---

## 📋 Pré-requisitos

### 1️⃣ Node.js

**Baixar e Instalar:**
1. Acesse: https://nodejs.org/
2. Baixe a versão **LTS** (recomendada)
3. Execute o instalador e siga as instruções
4. Verifique a instalação:
```cmd
node --version
npm --version
```

### 2️⃣ PostgreSQL

**Baixar e Instalar:**
1. Acesse: https://www.postgresql.org/download/windows/
2. Baixe o instalador do **PostgreSQL 14** ou superior
3. Execute o instalador:
   - Defina uma **senha** para o usuário `postgres`
   - Porta padrão: `5432`
   - Instale o **pgAdmin 4** (incluído)
4. Verifique a instalação:
```cmd
psql --version
```

**Criar o Banco de Dados:**
1. Abra o **pgAdmin 4** ou **SQL Shell (psql)**
2. Conecte com o usuário `postgres`
3. Execute:
```sql
CREATE DATABASE whatsapp_dispatcher;
```

### 3️⃣ Redis

**Opção 1 - Usando WSL (Recomendado):**
```bash
# No WSL (Ubuntu)
sudo apt update
sudo apt install redis-server
sudo service redis-server start
redis-cli ping
```

**Opção 2 - Redis para Windows (Não oficial):**
1. Acesse: https://github.com/tporadowski/redis/releases
2. Baixe o arquivo `.zip`
3. Extraia e execute `redis-server.exe`

**Opção 3 - Docker Desktop:**
```cmd
docker run -d -p 6379:6379 redis:7-alpine
```

**Opção 4 - Redis Cloud (Gratuito):**
1. Acesse: https://redis.com/try-free/
2. Crie uma conta gratuita
3. Crie um banco Redis
4. Copie as credenciais para o `.env`

---

## 🚀 Instalação Passo a Passo

### 1️⃣ Clonar o Repositório

```cmd
git clone <url-do-repositorio>
cd "NOVO DISPARADOR DE API OFICIAL"
```

### 2️⃣ Configurar Backend

```cmd
cd backend
npm install
```

**Criar arquivo `.env`:**

Copie o conteúdo de `.env.example` e crie um arquivo `.env` com suas configurações:

```env
PORT=3001
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=whatsapp_dispatcher
DB_USER=postgres
DB_PASSWORD=sua_senha_do_postgres

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

JWT_SECRET=mude_isso_para_algo_super_seguro

UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

**Criar as tabelas do banco:**

```cmd
npm run migrate
```

**Iniciar o backend:**

```cmd
npm run dev
```

✅ Backend rodando em: http://localhost:3001

---

### 3️⃣ Configurar Frontend

**Abra outro terminal (PowerShell ou CMD):**

```cmd
cd frontend
npm install
```

**Criar arquivo `.env.local`:**

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**Iniciar o frontend:**

```cmd
npm run dev
```

✅ Frontend rodando em: http://localhost:3000

---

## 🎯 Testando o Sistema

1. Abra o navegador em: http://localhost:3000
2. Vá em **Configurações**
3. Adicione suas credenciais do WhatsApp
4. Teste a conexão
5. Crie sua primeira campanha!

---

## 🐛 Problemas Comuns no Windows

### Erro: "npm não é reconhecido como comando"

**Solução:**
1. Feche e abra o terminal novamente
2. Ou adicione o Node.js ao PATH manualmente:
   - Pesquise por "Variáveis de Ambiente"
   - Adicione: `C:\Program Files\nodejs\`

### Erro: "psql não é reconhecido como comando"

**Solução:**
Adicione o PostgreSQL ao PATH:
- Caminho típico: `C:\Program Files\PostgreSQL\14\bin`

### Erro: Porta 3001 ou 3000 já em uso

**Solução:**
```cmd
# Ver processos usando a porta
netstat -ano | findstr :3001

# Matar processo pelo PID
taskkill /PID <numero_do_pid> /F
```

### Erro: Não consegue conectar ao Redis

**Solução:**
- Verifique se o Redis está rodando
- Use Redis Cloud (gratuito) como alternativa
- Configure as credenciais no `.env`

### Erro: "Acesso negado" ao PostgreSQL

**Solução:**
1. Verifique se a senha no `.env` está correta
2. No pgAdmin, verifique se o usuário `postgres` tem permissões
3. Tente se conectar manualmente:
```cmd
psql -U postgres -d whatsapp_dispatcher
```

---

## 💡 Dicas para Windows

### Usar PowerShell ao invés de CMD
```powershell
# PowerShell tem melhor suporte para comandos modernos
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### Instalar Git Bash
- Melhor experiência de terminal
- Download: https://git-scm.com/download/win

### Usar Visual Studio Code
- Editor recomendado para desenvolvimento
- Download: https://code.visualstudio.com/
- Extensões úteis:
  - ESLint
  - Prettier
  - PostgreSQL
  - Docker (se usar)

---

## 🔧 Scripts Úteis

**Reiniciar tudo:**
```cmd
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev

# Terminal 3 - Redis (se local)
redis-server
```

**Limpar e reinstalar:**
```cmd
# Backend
cd backend
rmdir /s /q node_modules
del package-lock.json
npm install

# Frontend
cd frontend
rmdir /s /q node_modules
rmdir /s /q .next
del package-lock.json
npm install
```

---

## 📞 Precisa de Ajuda?

- Verifique se todos os pré-requisitos estão instalados
- Confira se as portas estão livres (3000, 3001, 5432, 6379)
- Verifique os logs de erro no terminal
- Consulte o README.md principal

---

**✅ Pronto! Seu sistema está rodando no Windows!**


