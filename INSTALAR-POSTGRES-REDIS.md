# 🚀 Como Instalar PostgreSQL e Redis - Passo a Passo Simples

## ⚡ OPÇÃO MAIS RÁPIDA (Recomendada)

### 1️⃣ PostgreSQL (10 minutos)

**Passo 1:** Clique no link para baixar:
```
https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
```

**Passo 2:** Escolha: **Windows x86-64** (última versão)

**Passo 3:** Execute o arquivo baixado (.exe)

**Passo 4:** Durante a instalação:
- ✅ Clique "Next" em tudo
- ⚠️ **IMPORTANTE:** Quando pedir senha, use: `postgres123` (ou escolha outra e anote!)
- ✅ Porta: deixe 5432
- ✅ Instale tudo (incluindo pgAdmin 4)

**Passo 5:** Anote sua senha aqui:
```
Senha do PostgreSQL: ________________
```

---

### 2️⃣ Redis Cloud (5 minutos - GRÁTIS)

**Não precisa instalar nada no seu PC!**

**Passo 1:** Acesse e crie conta:
```
https://redis.com/try-free/
```

**Passo 2:** Clique em "Get Started Free"

**Passo 3:** Preencha:
- Email: seu email
- Senha: escolha uma senha
- OU: Use "Sign in with Google"

**Passo 4:** Após login, clique em "Create database"

**Passo 5:** Configure:
- Subscription name: `whatsapp`
- Cloud Provider: AWS
- Region: `US-East-1`
- Plan: **FREE** (30MB)
- Clique "Create database"

**Passo 6:** Copie as credenciais:

Na página do banco, você verá:
```
Endpoint: redis-xxxxx.cloud.redislabs.com:12345
Password: abc123xyz...
```

**Anote aqui:**
```
Redis Host: ________________
Redis Port: ________________
Redis Password: ________________
```

---

## ✏️ CONFIGURAR O SISTEMA

Após instalar, abra o arquivo: `backend\.env`

Substitua as linhas:

```env
# PostgreSQL
DB_PASSWORD=postgres123    ← Cole a senha que você escolheu

# Redis Cloud
REDIS_HOST=redis-12345.c123.us-east-1-4.ec2.cloud.redislabs.com    ← Cole o host
REDIS_PORT=12345                                                     ← Cole a porta
REDIS_PASSWORD=abc123xyz                                             ← Cole a senha
```

---

## ▶️ INICIAR O SISTEMA

Depois de configurar, execute:

```
2-criar-banco.bat
```

Depois:

```
5-iniciar-tudo.bat
```

Pronto! Acesse: http://localhost:3000

---

## 🆘 PROBLEMAS?

**Erro ao criar banco:**
- Verifique se o PostgreSQL está rodando
- Confirme se a senha no .env está correta

**Erro ao conectar Redis:**
- Verifique se copiou as credenciais corretas
- Certifique-se que o banco Redis está "Active" no painel

---

## ⏱️ TEMPO TOTAL: ~15 minutos

1. PostgreSQL: 10 min
2. Redis Cloud: 5 min
3. Configurar .env: 2 min
4. Criar banco: 1 min
5. Iniciar: 1 min

**Total: ~20 minutos até estar testando!**


