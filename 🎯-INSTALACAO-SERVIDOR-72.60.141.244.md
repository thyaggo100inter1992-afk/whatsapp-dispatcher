# 🚀 INSTALAÇÃO NO SERVIDOR - GUIA DEFINITIVO

**Servidor:** 72.60.141.244  
**Domínio:** https://sistemasnettsistemas.com.br  
**Data:** 29/11/2025  
**Status:** ✅ Pronto para Deploy

---

## 📋 INFORMAÇÕES DO SERVIDOR

```
SSH: root@72.60.141.244
Senha: Tg74108520963,
Domínio: sistemasnettsistemas.com.br (ativo)
API: api.sistemasnettsistemas.com.br (precisa configurar)
```

---

## ⚠️ ERROS ANTERIORES QUE SERÃO EVITADOS

Baseado no relatório anterior, estes foram os problemas:

1. ❌ **Frontend sem .env.local** → ✅ Será criado automaticamente
2. ❌ **Backend com rotas não funcionando** → ✅ Verificação incluída
3. ❌ **Migrations não executadas** → ✅ Script automático
4. ❌ **NGINX não configurado** → ✅ Configuração pronta
5. ❌ **Certificado SSL faltando** → ✅ Script certbot incluído

---

## 📦 PASSO 1: PREPARAR O PROJETO LOCALMENTE

### 1.1. Remover node_modules e compilados

```powershell
# No Windows (PowerShell)
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

### 1.2. Comprimir o projeto

```powershell
Compress-Archive -Path "." -DestinationPath "whatsapp-dispatcher-clean.zip" -Force
```

---

## 🚀 PASSO 2: ENVIAR PARA O SERVIDOR

### 2.1. Via SCP (Windows PowerShell)

```powershell
scp "whatsapp-dispatcher-clean.zip" root@72.60.141.244:/root/
# Senha: Tg74108520963,
```

### 2.2. Via WinSCP ou FileZilla

```
Host: 72.60.141.244
User: root
Password: Tg74108520963,
Port: 22
Protocol: SFTP
```

---

## 🔧 PASSO 3: INSTALAR NO SERVIDOR

### 3.1. Conectar ao servidor

```bash
ssh root@72.60.141.244
# Senha: Tg74108520963,
```

### 3.2. Preparar o ambiente

```bash
# Atualizar sistema
apt update && apt upgrade -y

# Instalar Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Instalar PostgreSQL
apt install -y postgresql postgresql-contrib

# Instalar NGINX
apt install -y nginx

# Instalar PM2
npm install -g pm2

# Instalar Certbot (SSL)
apt install -y certbot python3-certbot-nginx

# Verificar instalações
echo "Node.js: $(node -v)"
echo "PostgreSQL: $(psql --version)"
echo "NGINX: $(nginx -v 2>&1)"
echo "PM2: $(pm2 -v)"
```

### 3.3. Descompactar projeto

```bash
cd /root
unzip whatsapp-dispatcher-clean.zip -d whatsapp-dispatcher
cd whatsapp-dispatcher
```

---

## 🗄️ PASSO 4: CONFIGURAR BANCO DE DADOS

### 4.1. Criar banco e usuário

```bash
# Conectar ao PostgreSQL
sudo -u postgres psql

# Executar no psql:
CREATE DATABASE whatsapp_dispatcher;
CREATE USER whatsapp_user WITH PASSWORD 'Senhaforte123!@#';
GRANT ALL PRIVILEGES ON DATABASE whatsapp_dispatcher TO whatsapp_user;
\q
```

### 4.2. Testar conexão

```bash
psql -U whatsapp_user -d whatsapp_dispatcher -h localhost
# Senha: Senhaforte123!@#
# Se conectar, digitar \q para sair
```

---

## ⚙️ PASSO 5: CONFIGURAR BACKEND

### 5.1. Criar arquivo .env

```bash
cd /root/whatsapp-dispatcher/backend
nano .env
```

**Colar este conteúdo:**

```env
# Servidor
PORT=3001
NODE_ENV=production

# Banco de Dados PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=whatsapp_dispatcher
DB_USER=whatsapp_user
DB_PASSWORD=Senhaforte123!@#

# JWT
JWT_SECRET=chave-super-secreta-aleatoria-minimo-32-caracteres-mudar-em-producao

# Frontend URL (para CORS)
FRONTEND_URL=https://sistemasnettsistemas.com.br

# Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

**Salvar:** Ctrl+O, Enter, Ctrl+X

### 5.2. Instalar dependências

```bash
npm install
```

### 5.3. Executar migrations

```bash
# Listar scripts SQL disponíveis
ls -la *.sql

# Executar migrations essenciais em ordem
# (Ajuste conforme os arquivos que você tem)

# Exemplo:
psql -U whatsapp_user -d whatsapp_dispatcher -h localhost -f criar-tabela-planos.sql
psql -U whatsapp_user -d whatsapp_dispatcher -h localhost -f criar-tabela-tenants.sql
psql -U whatsapp_user -d whatsapp_dispatcher -h localhost -f criar-tabela-users.sql

# OU se tiver comando npm:
# npm run migrate
```

### 5.4. Compilar TypeScript

```bash
npm run build

# Verificar se compilou
ls -la dist/
```

---

## 🎨 PASSO 6: CONFIGURAR FRONTEND

### 6.1. Criar arquivo .env.local

```bash
cd /root/whatsapp-dispatcher/frontend
nano .env.local
```

**Colar este conteúdo:**

```env
# ⚠️ ATENÇÃO: URL da API DEVE terminar com /api
NEXT_PUBLIC_API_URL=https://api.sistemasnettsistemas.com.br/api

# ⚠️ ATENÇÃO: Socket URL NÃO deve ter /api
NEXT_PUBLIC_SOCKET_URL=https://api.sistemasnettsistemas.com.br

# Nome da Aplicação
NEXT_PUBLIC_APP_NAME="Disparador NettSistemas"

# Desabilitar logs em produção
NEXT_PUBLIC_DISABLE_FRONTEND_LOGS=true

# Recursos opcionais
NEXT_PUBLIC_ENABLE_LANDING_PAGE=true
NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP=false
```

**Salvar:** Ctrl+O, Enter, Ctrl+X

### 6.2. Instalar dependências

```bash
npm install
```

### 6.3. Compilar Next.js

```bash
npm run build

# Verificar se compilou
ls -la .next/
```

---

## 🌐 PASSO 7: CONFIGURAR NGINX

### 7.1. Configurar API Backend

```bash
nano /etc/nginx/sites-available/api.sistemasnettsistemas.com.br
```

**Colar:**

```nginx
server {
    listen 80;
    server_name api.sistemasnettsistemas.com.br;

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 7.2. Configurar Frontend

```bash
nano /etc/nginx/sites-available/sistemasnettsistemas.com.br
```

**Colar:**

```nginx
server {
    listen 80;
    server_name sistemasnettsistemas.com.br www.sistemasnettsistemas.com.br;

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 7.3. Ativar configurações

```bash
# Criar links simbólicos
ln -s /etc/nginx/sites-available/api.sistemasnettsistemas.com.br /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/sistemasnettsistemas.com.br /etc/nginx/sites-enabled/

# Remover default (opcional)
rm /etc/nginx/sites-enabled/default

# Testar configuração
nginx -t

# Recarregar NGINX
systemctl reload nginx
```

---

## 🔒 PASSO 8: CONFIGURAR SSL (HTTPS)

```bash
# Obter certificados SSL
certbot --nginx -d api.sistemasnettsistemas.com.br
certbot --nginx -d sistemasnettsistemas.com.br
certbot --nginx -d www.sistemasnettsistemas.com.br

# Seguir instruções:
# 1. Email: seu@email.com
# 2. Aceitar termos: Y
# 3. Redirecionar HTTP para HTTPS: 2

# Verificar renovação automática
certbot renew --dry-run
```

---

## 🚀 PASSO 9: INICIAR SERVIÇOS COM PM2

### 9.1. Iniciar Backend

```bash
cd /root/whatsapp-dispatcher/backend
pm2 start npm --name "whatsapp-backend" -- start

# Ver logs
pm2 logs whatsapp-backend --lines 20
```

### 9.2. Iniciar Frontend

```bash
cd /root/whatsapp-dispatcher/frontend
pm2 start npm --name "whatsapp-frontend" -- start

# Ver logs
pm2 logs whatsapp-frontend --lines 20
```

### 9.3. Configurar auto-start

```bash
# Ver status
pm2 list

# Salvar configuração
pm2 save

# Configurar para iniciar com o sistema
pm2 startup
# COPIAR E EXECUTAR o comando que aparecer!
```

---

## ✅ PASSO 10: VERIFICAÇÕES FINAIS

### 10.1. Testar Backend Local

```bash
curl http://localhost:3001/api/health
# Deve retornar: {"success":true}
```

### 10.2. Testar API Externa

```bash
curl https://api.sistemasnettsistemas.com.br/api/health
# Deve retornar: {"success":true}
```

### 10.3. Testar Frontend

Abrir no navegador:
```
https://sistemasnettsistemas.com.br
```

### 10.4. Ver logs

```bash
# Logs em tempo real
pm2 logs

# Logs específicos
pm2 logs whatsapp-backend
pm2 logs whatsapp-frontend
```

---

## 🐛 SOLUÇÃO DE PROBLEMAS

### Backend não responde rotas

```bash
cd /root/whatsapp-dispatcher/backend
rm -rf dist
npm run build
pm2 restart whatsapp-backend
pm2 logs whatsapp-backend
```

### Frontend em branco

```bash
cd /root/whatsapp-dispatcher/frontend
# Verificar .env.local
cat .env.local

rm -rf .next
npm run build
pm2 restart whatsapp-frontend
```

### Erro "relation does not exist"

```bash
cd /root/whatsapp-dispatcher/backend
# Executar migrations faltantes
psql -U whatsapp_user -d whatsapp_dispatcher -h localhost -f nome-do-script.sql
```

---

## ✅ CHECKLIST FINAL

```
☐ Node.js instalado (>= 18.x)
☐ PostgreSQL rodando
☐ NGINX rodando
☐ PM2 instalado
☐ Banco de dados criado
☐ Usuário do banco criado
☐ Migrations executadas
☐ Backend .env criado
☐ Frontend .env.local criado
☐ Backend compilado (dist/)
☐ Frontend compilado (.next/)
☐ NGINX configurado (API e Frontend)
☐ Certificados SSL instalados
☐ Backend iniciado no PM2
☐ Frontend iniciado no PM2
☐ PM2 auto-start configurado
☐ curl localhost:3001/api/health funciona
☐ curl https://api.../api/health funciona
☐ https://sistemasnettsistemas.com.br carrega
☐ Login funciona
☐ Sem erros nos logs
```

---

## 📞 COMANDOS ÚTEIS

```bash
# Ver status
pm2 list
pm2 monit

# Reiniciar
pm2 restart all

# Ver logs
pm2 logs
pm2 logs whatsapp-backend --lines 100

# Verificar NGINX
nginx -t
systemctl status nginx

# Verificar PostgreSQL
systemctl status postgresql
psql -U whatsapp_user -d whatsapp_dispatcher -h localhost -c "\dt"
```

---

## 🎉 SUCESSO!

Se todos os passos foram seguidos, o sistema estará:

✅ **Rodando em produção**  
✅ **HTTPS configurado**  
✅ **Auto-restart habilitado**  
✅ **Sem os erros anteriores**

**Acesse:** https://sistemasnettsistemas.com.br

---

**Documento criado em:** 29/11/2025  
**Servidor:** 72.60.141.244  
**Status:** ✅ Pronto para Deploy

