# 🚀 DEPLOY VIA GITHUB - GUIA COMPLETO

**Servidor:** 72.60.141.244  
**Método:** GitHub → Servidor  
**Status:** ✅ Recomendado

---

## 📋 PRÉ-REQUISITOS

✅ Conta no GitHub (você já tem)  
✅ Git instalado no Windows  
✅ SSH configurado no servidor  

---

## 🎯 PASSO 1: PREPARAR PROJETO LOCALMENTE

### 1.1. Limpar arquivos grandes

```powershell
# No Windows PowerShell
cd "C:\Users\thyag\Videos\NOVO DISPARADOR DE API OFICIAL - 29-11-2025 - 09h33"

# Remover node_modules
Remove-Item -Recurse -Force backend\node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force frontend\node_modules -ErrorAction SilentlyContinue

# Remover compilados
Remove-Item -Recurse -Force backend\dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force frontend\.next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force frontend\out -ErrorAction SilentlyContinue

# Remover backups
Remove-Item -Recurse -Force backup-catalogo -ErrorAction SilentlyContinue
```

### 1.2. Verificar .gitignore

O arquivo `.gitignore` já está criado e configurado! ✅

---

## 🐙 PASSO 2: CRIAR REPOSITÓRIO NO GITHUB

### Opção A: Via Interface Web (Mais Fácil) ⭐

1. Acesse: https://github.com/new
2. Nome do repositório: `whatsapp-dispatcher`
3. Descrição: "Sistema de Disparo WhatsApp - NettSistemas"
4. **Privado** (Recomendado) ✅
5. NÃO inicializar com README
6. Clique em "Create repository"

### Opção B: Via GitHub CLI

```bash
gh repo create whatsapp-dispatcher --private
```

---

## 💻 PASSO 3: ENVIAR CÓDIGO PARA GITHUB

### 3.1. Abrir Git Bash no projeto

```bash
# Clicar com botão direito na pasta do projeto
# Selecionar "Git Bash Here"

# OU no PowerShell:
cd "C:\Users\thyag\Videos\NOVO DISPARADOR DE API OFICIAL - 29-11-2025 - 09h33"
```

### 3.2. Inicializar Git

```bash
# Inicializar repositório
git init

# Adicionar todos os arquivos
git add .

# Verificar o que será enviado
git status
```

### 3.3. Criar primeiro commit

```bash
git commit -m "Initial commit - Sistema pronto para produção"
```

### 3.4. Conectar com GitHub

```bash
# Trocar SEU_USUARIO pelo seu usuário do GitHub
git remote add origin https://github.com/SEU_USUARIO/whatsapp-dispatcher.git

# Criar branch main
git branch -M main

# Enviar código
git push -u origin main
```

**Vai pedir usuário e senha do GitHub!**

---

## 🖥️ PASSO 4: CLONAR NO SERVIDOR

### 4.1. Conectar ao servidor

```bash
ssh root@72.60.141.244
# Senha: Tg74108520963,
```

### 4.2. Instalar Git (se não tiver)

```bash
apt update
apt install -y git
```

### 4.3. Clonar repositório

```bash
cd /root

# Se repositório PRIVADO:
git clone https://github.com/SEU_USUARIO/whatsapp-dispatcher.git
# Vai pedir usuário e senha

# Se repositório PÚBLICO:
git clone https://github.com/SEU_USUARIO/whatsapp-dispatcher.git
```

### 4.4. Entrar na pasta

```bash
cd whatsapp-dispatcher
```

---

## ⚙️ PASSO 5: INSTALAR NO SERVIDOR

### 5.1. Executar script automático

```bash
# Dar permissão de execução
chmod +x instalar-servidor.sh

# Executar instalação
./instalar-servidor.sh
```

**O script vai:**
- ✅ Instalar Node.js, PostgreSQL, NGINX, PM2
- ✅ Criar banco de dados
- ✅ Criar arquivos .env
- ✅ Instalar dependências
- ✅ Compilar backend e frontend
- ✅ Configurar NGINX
- ✅ Iniciar serviços com PM2

### 5.2. Configurar SSL

```bash
certbot --nginx -d api.sistemasnettsistemas.com.br
certbot --nginx -d sistemasnettsistemas.com.br
certbot --nginx -d www.sistemasnettsistemas.com.br
```

---

## 🔄 ATUALIZAÇÕES FUTURAS (SUPER FÁCIL!)

Quando você fizer mudanças no código:

### No Windows:

```bash
git add .
git commit -m "Descrição da mudança"
git push
```

### No Servidor:

```bash
cd /root/whatsapp-dispatcher

# Baixar atualizações
git pull

# Recompilar se necessário
cd backend && npm run build && cd ..
cd frontend && npm run build && cd ..

# Reiniciar serviços
pm2 restart all
```

**Pronto! Sistema atualizado em segundos! ⚡**

---

## 🔐 AUTENTICAÇÃO GITHUB

### Opção 1: Personal Access Token (Recomendado)

1. Acesse: https://github.com/settings/tokens
2. "Generate new token" → "Classic"
3. Nome: "Deploy WhatsApp Dispatcher"
4. Marcar: `repo` (todos)
5. Gerar token
6. **COPIAR O TOKEN!** (não vai aparecer de novo)
7. Ao fazer `git push` ou `git clone`:
   - Username: seu_usuario
   - Password: **cole o token** (não a senha)

### Opção 2: SSH Key (Mais Seguro)

```bash
# No servidor
ssh-keygen -t ed25519 -C "seu@email.com"
# Pressionar Enter 3 vezes

# Copiar chave pública
cat ~/.ssh/id_ed25519.pub

# Adicionar em: https://github.com/settings/keys
```

Depois usar:
```bash
git clone git@github.com:SEU_USUARIO/whatsapp-dispatcher.git
```

---

## ✅ VANTAGENS DO GITHUB

| Aspecto | GitHub | Upload Direto |
|---------|--------|---------------|
| **Atualizações** | `git pull` (segundos) | Subir tudo de novo (minutos) |
| **Tamanho** | ~50 MB | ~100 MB |
| **Histórico** | ✅ Total | ❌ Nenhum |
| **Rollback** | ✅ Fácil | ❌ Impossível |
| **Backup** | ✅ Automático | ❌ Manual |
| **Colaboração** | ✅ Fácil | ❌ Difícil |

---

## 🎯 RESUMO DO FLUXO

```
Windows (Desenvolvimento)
    ↓
git add . && git commit && git push
    ↓
GitHub (Repositório)
    ↓
git clone / git pull
    ↓
Servidor (Produção)
    ↓
npm install && npm run build
    ↓
pm2 restart
    ↓
✅ Sistema Atualizado!
```

---

## 🐛 RESOLUÇÃO DE PROBLEMAS

### Erro: "Permission denied (publickey)"

```bash
# Usar HTTPS em vez de SSH
git remote set-url origin https://github.com/SEU_USUARIO/whatsapp-dispatcher.git
```

### Erro: "Authentication failed"

- Use Personal Access Token em vez de senha
- Ou configure SSH key

### Erro: "fatal: not a git repository"

```bash
cd /root/whatsapp-dispatcher
git init
git remote add origin https://github.com/SEU_USUARIO/whatsapp-dispatcher.git
```

---

## 📝 ARQUIVOS QUE NÃO VÃO PRO GITHUB

Graças ao `.gitignore`, estes arquivos NÃO serão enviados:

- ❌ `node_modules/` (~1 GB)
- ❌ `dist/` e `.next/` (~200 MB)
- ❌ `.env` e `.env.local` (segurança)
- ❌ Backups e temporários
- ❌ Logs

**Serão criados no servidor automaticamente!**

---

## ✅ CHECKLIST COMPLETO

### No Windows:
```
☐ node_modules removido
☐ Git instalado
☐ Repositório criado no GitHub
☐ Código commitado
☐ Código enviado (git push)
```

### No Servidor:
```
☐ Git instalado
☐ Repositório clonado
☐ Script executado
☐ SSL configurado
☐ Serviços rodando
☐ Sistema funcionando
```

---

## 🎉 PRONTO!

Com GitHub você terá:
- ✅ Deploy profissional
- ✅ Atualizações em segundos
- ✅ Backup automático
- ✅ Histórico completo
- ✅ Facilidade para colaborar

**Total de comandos:**
- Windows: 3 comandos
- Servidor: 3 comandos

**Tempo total:** ~30 minutos (primeira vez)  
**Atualizações futuras:** ~2 minutos! ⚡

---

**Documento criado em:** 29/11/2025  
**Método:** ✅ GitHub (Recomendado)  
**Status:** Pronto para usar!

