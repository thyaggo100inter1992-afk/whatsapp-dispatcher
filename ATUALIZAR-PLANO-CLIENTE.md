# 🔄 COMO ATUALIZAR O PLANO DO CLIENTE

## ⚠️ PROBLEMA:
Você alterou o plano na tela de Admin, mas ele não aparece atualizado no painel do cliente.

---

## ✅ SOLUÇÃO PASSO A PASSO:

### 1️⃣ SALVAR A ALTERAÇÃO
Na tela de **Admin → Tenants → Editar Cadastro**:
1. Selecione o plano desejado no dropdown
2. **Clique em SALVAR** (botão no final da página)
3. Aguarde a confirmação "Tenant atualizado com sucesso"

### 2️⃣ ATUALIZAR O PAINEL DO CLIENTE

Existem **3 formas** de atualizar:

#### **OPÇÃO A: Clicar em "Atualizar"** (Mais Rápido)
1. Vá em **Gestão → Financeiro**
2. Clique no botão **"🔄 Atualizar"** no card de status
3. ✅ O plano deve atualizar

#### **OPÇÃO B: Recarregar a página** (Rápido)
1. Pressione **Ctrl + Shift + R** (força reload)
2. ✅ Ou pressione **F5**

#### **OPÇÃO C: Logout e Login** (Garante 100%)
1. Clique em **"Sair"** no canto superior direito
2. Faça **login** novamente
3. Vá em **Gestão → Financeiro**
4. ✅ Plano atualizado!

---

## 🔍 VERIFICAR SE SALVOU NO BANCO

Para confirmar que a mudança foi salva:

```bash
cd backend
node -e "require('dotenv').config(); const {Pool} = require('pg'); const pool = new Pool({user: process.env.DB_USER, host: process.env.DB_HOST, database: process.env.DB_NAME, password: process.env.DB_PASSWORD, port: process.env.DB_PORT}); pool.query('SELECT id, nome, plano FROM tenants WHERE id = 1').then(r => {console.log('Plano atual:', r.rows[0].plano); pool.end();});"
```

Deve retornar o plano que você selecionou.

---

## 📊 POR QUE ISSO ACONTECE?

O sistema usa **AuthContext** que cacheia os dados do usuário quando faz login:
- ✅ É mais rápido (não precisa buscar do banco toda hora)
- ❌ Mas não atualiza automaticamente quando admin muda algo

### Quando o cache é atualizado:
- ✅ Quando faz **logout/login**
- ✅ Quando **recarrega a página** (F5)
- ✅ Quando clica em **"Atualizar"**

---

## 🎯 RECOMENDAÇÃO:

### Para mudanças no Admin:
1. Altere o plano
2. **Salve**
3. Avise o cliente para **fazer logout e login** novamente

### Ou:
Oriente o cliente a clicar em **"🔄 Atualizar"** na aba Financeiro após você mudar o plano dele.

---

## ✅ CHECKLIST:

- [ ] Mudança feita na tela de Admin
- [ ] Clicou em **SALVAR**
- [ ] Viu mensagem "Tenant atualizado com sucesso"
- [ ] Cliente fez **logout/login** OU clicou em **"Atualizar"**
- [ ] Verificou na aba **Gestão → Financeiro**
- [ ] ✅ Plano correto exibido!

---

**Faça o teste agora!** 🚀





