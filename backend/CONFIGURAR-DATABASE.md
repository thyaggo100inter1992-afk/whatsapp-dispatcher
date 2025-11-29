# ⚠️ CONFIGURAÇÃO NECESSÁRIA: DATABASE_URL

**Status:** DATABASE_URL não configurada no arquivo `.env`

---

## 🔧 COMO CONFIGURAR

### **1. Abrir o arquivo `.env`:**
```bash
cd backend
# Abrir com editor de texto
notepad .env
# Ou VSCode
code .env
```

### **2. Adicionar/Verificar DATABASE_URL:**

Adicione esta linha ao arquivo `.env`:

```bash
DATABASE_URL=postgresql://postgres:Tg130992*@localhost:5432/whatsapp_dispatcher
```

**Ou ajuste com suas credenciais:**

```bash
DATABASE_URL=postgresql://USUARIO:SENHA@HOST:PORTA/NOME_DO_BANCO
```

### **3. Exemplo completo do `.env`:**

```bash
# ============================================
# BANCO DE DADOS
# ============================================
DATABASE_URL=postgresql://postgres:Tg130992*@localhost:5432/whatsapp_dispatcher

# ============================================
# AUTENTICAÇÃO
# ============================================
JWT_SECRET=seu_jwt_secret_aqui_minimo_32_caracteres
JWT_REFRESH_SECRET=seu_refresh_secret_aqui

# ============================================
# CRIPTOGRAFIA
# ============================================
ENCRYPTION_KEY=sua_chave_de_32_caracteres_aqui

# ============================================
# SERVIDOR
# ============================================
PORT=3000
NODE_ENV=development
```

---

## 📝 FORMATO DA CONNECTION STRING

```
postgresql://[usuario]:[senha]@[host]:[porta]/[database]
```

**Exemplo real (baseado na senha que você forneceu):**
```
postgresql://postgres:Tg130992*@localhost:5432/whatsapp_dispatcher
```

**Componentes:**
- `postgres` - usuário do PostgreSQL
- `Tg130992*` - senha que você forneceu
- `localhost` - servidor (local)
- `5432` - porta padrão do PostgreSQL
- `whatsapp_dispatcher` - nome do banco de dados

---

## ✅ DEPOIS DE CONFIGURAR

Execute novamente a verificação:

```bash
cd backend
node scripts/verificacao-completa.js
```

**Ou:**

```bash
cd backend\scripts
verificacao-completa.bat
```

---

## 🧪 TESTAR CONEXÃO

```bash
cd backend
node -e "const {Pool} = require('pg'); require('dotenv').config(); const pool = new Pool({connectionString: process.env.DATABASE_URL}); pool.query('SELECT NOW()', (err, res) => { if(err) console.error('ERRO:', err.message); else console.log('✅ Conexão OK:', res.rows[0].now); pool.end(); });"
```

---

## ⚠️ IMPORTANTE

- O arquivo `.env` **NÃO** deve ser commitado no git
- Está no `.gitignore` por segurança
- Cada desenvolvedor precisa configurar seu próprio `.env`
- Em produção, use variáveis de ambiente do servidor

---

**Próximo passo:** Configurar o DATABASE_URL e executar verificação novamente! 🚀





