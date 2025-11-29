# ⚠️ O que ainda falta instalar

## ✅ Já Instalado:
- ✅ **Node.js** v25.1.0
- ✅ **Backend** - 247 pacotes npm
- ✅ **Frontend** - 410 pacotes npm

---

## ❌ Faltando Instalar:

### 1️⃣ PostgreSQL (Banco de Dados)

**Por que precisa:** Armazena todos os dados (contas, campanhas, mensagens, etc)

**Como instalar:**

1. **Baixe o instalador:**
   - Link: https://www.postgresql.org/download/windows/
   - Escolha a versão 14 ou superior

2. **Execute o instalador:**
   - Clique Next, Next...
   - **IMPORTANTE:** Defina uma senha para o usuário `postgres` (anote essa senha!)
   - Porta: deixe 5432 (padrão)
   - Instale o pgAdmin 4 (ferramenta visual)

3. **Teste a instalação:**
   ```powershell
   psql --version
   ```

**Tempo de instalação:** ~10 minutos

---

### 2️⃣ Redis (Sistema de Filas)

**Por que precisa:** Gerencia a fila de mensagens para envio

**Você tem 3 opções:**

#### 🌟 OPÇÃO 1: Redis Cloud (RECOMENDADO - Gratuito e Fácil)

1. **Crie conta grátis:**
   - Link: https://redis.com/try-free/
   - Use Google ou Email

2. **Crie banco Redis:**
   - Clique em "Create Database"
   - Nome: whatsapp_dispatcher
   - Região: US-East-1 (ou mais próxima)
   - Plano: FREE (30MB)

3. **Copie as credenciais:**
   - Endpoint: `redis-xxxxx.cloud.redislabs.com:12345`
   - Password: `sua_senha_aqui`

4. **Configure no `backend\.env`:**
   ```env
   REDIS_HOST=redis-xxxxx.cloud.redislabs.com
   REDIS_PORT=12345
   REDIS_PASSWORD=sua_senha_aqui
   ```

**Tempo:** ~5 minutos  
**✅ Vantagem:** Não precisa instalar nada no PC

---

#### 📦 OPÇÃO 2: Redis para Windows (Não oficial)

1. **Baixe:**
   - Link: https://github.com/tporadowski/redis/releases
   - Arquivo: `Redis-x64-5.0.14.1.zip`

2. **Extraia o ZIP:**
   - Extraia para: `C:\Redis\`

3. **Execute:**
   - Navegue até a pasta
   - Duplo clique em `redis-server.exe`
   - Deixe a janela aberta

4. **Configure no `backend\.env`:**
   ```env
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   ```

**Tempo:** ~3 minutos  
**⚠️ Desvantagem:** Precisa manter o redis-server rodando

---

#### 🐧 OPÇÃO 3: WSL (Windows Subsystem for Linux)

Se você já tem WSL instalado:

```bash
wsl
sudo apt update
sudo apt install redis-server -y
sudo service redis-server start
redis-cli ping  # Deve retornar PONG
```

**Configure no `backend\.env`:**
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

---

## 📝 Próximos Passos (Ordem Correta):

### ✅ PASSO 1: Instalar PostgreSQL
Execute o instalador e anote a senha.

### ✅ PASSO 2: Escolher e Configurar Redis
Escolha uma das 3 opções acima.

### ✅ PASSO 3: Configurar o arquivo `.env`
Abra `backend\.env` e edite:

```env
# Banco de Dados PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=whatsapp_dispatcher
DB_USER=postgres
DB_PASSWORD=SUA_SENHA_AQUI     ← Cole a senha do PostgreSQL

# Redis (use as credenciais da opção que escolheu)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### ✅ PASSO 4: Criar o Banco de Dados
Execute o script:
```
2-criar-banco.bat
```

Ou manualmente:
```powershell
psql -U postgres -c "CREATE DATABASE whatsapp_dispatcher;"
cd backend
npm run migrate
```

### ✅ PASSO 5: Iniciar os Servidores
Execute:
```
5-iniciar-tudo.bat
```

### ✅ PASSO 6: Acessar o Sistema
Abra no navegador:
```
http://localhost:3000
```

---

## 🎯 Estimativa de Tempo Total:

- PostgreSQL: 10 minutos
- Redis Cloud: 5 minutos
- Configurar .env: 2 minutos
- Criar banco: 1 minuto
- **Total: ~20 minutos**

---

## 🆘 Precisa de Ajuda?

Execute o script de verificação:
```
0-verificar-requisitos.bat
```

Ele mostra exatamente o que está instalado e o que falta!

---

## 💡 Recomendação Final:

**Para começar RÁPIDO:**
1. Instale PostgreSQL (link acima)
2. Use Redis Cloud (não precisa instalar nada)
3. Configure o .env
4. Execute 2-criar-banco.bat
5. Execute 5-iniciar-tudo.bat
6. Pronto! 🚀

**Total: ~15 minutos e você está testando!**


