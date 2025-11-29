# 🔧 Configuração de Variáveis de Ambiente

## 📋 Arquivo `.env` Necessário

Crie ou atualize seu arquivo `backend/.env` com estas variáveis:

```bash
# ============================================
# CONFIGURAÇÃO MULTI-TENANT
# ============================================

# Banco de Dados
DB_HOST=localhost
DB_PORT=5432
DB_NAME=whatsapp_dispatcher
DB_USER=postgres
DB_PASSWORD=Tg130992*

# JWT (Autenticação) - ESSENCIAL!
# ⚠️ TROQUE por algo seguro em produção!
JWT_SECRET=chave-secreta-super-forte-e-aleatoria-mude-em-producao-12345678

# Servidor
PORT=3000
NODE_ENV=development

# CORS (ajuste para seu frontend)
CORS_ORIGIN=http://localhost:3001

# ============================================
# SUAS CONFIGURAÇÕES EXISTENTES
# (Mantenha suas configs atuais aqui)
# ============================================
```

---

## ⚠️ IMPORTANTE: JWT_SECRET

O `JWT_SECRET` é **ESSENCIAL** para o sistema de autenticação funcionar!

### Em Desenvolvimento:
Qualquer string longa serve, exemplo:
```bash
JWT_SECRET=minha-chave-secreta-de-desenvolvimento-123456789
```

### Em Produção:
Use algo realmente aleatório e seguro:

```bash
# Linux/Mac: Gerar chave aleatória
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Ou use um gerador online:
# https://randomkeygen.com/
```

**Exemplo de chave segura:**
```bash
JWT_SECRET=8f7d6e5c4b3a2f1e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e
```

---

## ✅ Verificar se .env está configurado

Crie este script para testar:

**`backend/test-env.js`:**
```javascript
require('dotenv').config();

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔍 VERIFICAÇÃO DE VARIÁVEIS DE AMBIENTE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

const required = {
  'DB_HOST': process.env.DB_HOST,
  'DB_PORT': process.env.DB_PORT,
  'DB_NAME': process.env.DB_NAME,
  'DB_USER': process.env.DB_USER,
  'DB_PASSWORD': process.env.DB_PASSWORD ? '***' : undefined,
  'JWT_SECRET': process.env.JWT_SECRET ? '***' : undefined,
};

let allOk = true;

for (const [key, value] of Object.entries(required)) {
  const status = value ? '✅' : '❌';
  console.log(`${status} ${key}: ${value || 'NÃO DEFINIDO'}`);
  
  if (!value) allOk = false;
}

console.log('');
if (allOk) {
  console.log('✅ Todas as variáveis obrigatórias estão definidas!');
} else {
  console.log('❌ Algumas variáveis estão faltando!');
  console.log('');
  console.log('➜ Crie/atualize o arquivo backend/.env');
}
console.log('');
```

**Execute:**
```bash
node backend/test-env.js
```

---

## 🚨 Erros Comuns

### Erro: "JWT_SECRET não definido"
**Causa:** Variável `JWT_SECRET` não está no `.env`
**Solução:** Adicione `JWT_SECRET=sua-chave-aqui` no `.env`

### Erro: "Cannot connect to database"
**Causa:** Credenciais do banco incorretas
**Solução:** Verifique `DB_*` no `.env`

### Erro: ".env não carregado"
**Causa:** Falta `require('dotenv').config();` no início do arquivo
**Solução:** Adicione no topo do `server.js`

---

## 📝 Checklist

- [ ] Arquivo `.env` existe
- [ ] `JWT_SECRET` definido e longo (mínimo 32 caracteres)
- [ ] Credenciais do banco corretas
- [ ] `require('dotenv').config()` no início do server.js
- [ ] Testado com `node backend/test-env.js`

---

Tudo pronto? Execute seu servidor e teste! 🚀





