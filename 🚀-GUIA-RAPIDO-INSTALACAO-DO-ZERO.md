# 🚀 GUIA RÁPIDO - INSTALAÇÃO DO ZERO NO SERVIDOR

**Data:** 29/11/2025  
**Objetivo:** Instalação completa do sistema WhatsApp Dispatcher do zero  
**Tempo Estimado:** 2-3 horas

---

## 📋 PRÉ-REQUISITOS

Antes de começar, tenha em mãos:
- ✅ Servidor Linux (Ubuntu 22.04 ou superior)
- ✅ Acesso SSH root
- ✅ Domínios configurados (DNS apontando para o servidor)
  - `sistemasnettsistemas.com.br` → IP do servidor
  - `api.sistemasnettsistemas.com.br` → IP do servidor
- ✅ Código-fonte do projeto
- ✅ Senha para o banco de dados PostgreSQL

---

## ⚡ INSTALAÇÃO RÁPIDA (COPY-PASTE)

### PASSO 1: Instalar Dependências do Sistema

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar versão
node -v  # Deve ser >= 18.x
npm -v

# Instalar PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Iniciar PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
sudo systemctl status postgresql

# Instalar NGINX
sudo apt install -y nginx

# Iniciar NGINX
sudo systemctl start nginx
sudo systemctl enable nginx

# Instalar PM2 globalmente
npm install -g pm2

# Instalar Certbot (SSL)
sudo apt install -y certbot python3-certbot-nginx

# Verificar instalações
echo "Node.js: $(node -v)"
echo "npm: $(npm -v)"
echo "PostgreSQL: $(psql --version)"
echo "NGINX: $(nginx -v)"
echo "PM2: $(pm2 -v)"
```

---

### PASSO 2: Configurar Banco de Dados

```bash
# Conectar ao PostgreSQL como postgres
sudo -u postgres psql

# ⚠️ EXECUTAR NO PSQL (dentro do PostgreSQL):
```

```sql
-- Criar banco de dados
CREATE DATABASE whatsapp_dispatcher;

-- Criar usuário (TROCAR A SENHA!)
CREATE USER whatsapp_user WITH PASSWORD 'SuaSenhaSeguraAqui123!@#';

-- Dar permissões
GRANT ALL PRIVILEGES ON DATABASE whatsapp_dispatcher TO whatsapp_user;

-- Sair
\q
```

```bash
# Testar conexão
psql -U whatsapp_user -d whatsapp_dispatcher -h localhost
# Digitar senha quando solicitado
# Se conectar com sucesso, digitar \q para sair
```

---

### PASSO 3: Upload e Configuração do Código

```bash
# Criar diretório do projeto
mkdir -p /root/apps
cd /root/apps

# Fazer upload do código (via SCP, SFTP, Git, etc)
# Exemplo com Git:
# git clone https://seu-repositorio.git whatsapp-dispatcher

# OU se já tiver o código local, usar SCP:
# scp -r ./whatsapp-dispatcher root@SEU_IP:/root/apps/

# Entrar no diretório
cd whatsapp-dispatcher
```

---

### PASSO 4: Configurar Backend

```bash
cd backend

# Criar arquivo .env
cat > .env << 'EOF'
# Servidor
PORT=3001
NODE_ENV=production

# Banco de Dados PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=whatsapp_dispatcher
DB_USER=whatsapp_user
DB_PASSWORD=SuaSenhaSeguraAqui123!@#

# JWT (TROCAR POR UMA CHAVE ALEATÓRIA!)
JWT_SECRET=mude_isso_para_uma_chave_super_secreta_e_aleatoria_de_pelo_menos_32_caracteres

# Frontend URL
FRONTEND_URL=https://sistemasnettsistemas.com.br

# Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
EOF

# ⚠️ IMPORTANTE: Editar o arquivo e trocar as senhas!
nano .env
# Trocar:
# - DB_PASSWORD
# - JWT_SECRET

# Instalar dependências
npm install

# Compilar TypeScript
npm run build

# Verificar se compilou
ls -la dist/
# Deve ter arquivos .js dentro
```

---

### PASSO 5: Executar Migrations (Criar Tabelas)

```bash
# Ainda dentro de /root/apps/whatsapp-dispatcher/backend

# Verificar scripts SQL disponíveis
ls -la *.sql migrations/*.sql 2>/dev/null | head -20

# Executar migrations em ordem
# ⚠️ AJUSTAR conforme os scripts disponíveis no seu projeto

# Exemplo (ajuste os nomes dos arquivos):
psql -U whatsapp_user -d whatsapp_dispatcher -h localhost -f criar-tabela-planos.sql
psql -U whatsapp_user -d whatsapp_dispatcher -h localhost -f criar-tabela-tenants.sql
psql -U whatsapp_user -d whatsapp_dispatcher -h localhost -f criar-tabela-users.sql
# ... continuar com outros scripts

# OU se houver comando npm:
npm run migrate

# Verificar se tabelas foram criadas
psql -U whatsapp_user -d whatsapp_dispatcher -h localhost -c "\dt"
```

**⚠️ IMPORTANTE:** 
- A ordem de execução dos scripts SQL importa!
- Tabelas com foreign keys precisam que suas referências existam primeiro
- Se der erro de "relation does not exist", execute as migrations na ordem correta

---

### PASSO 6: Configurar Frontend

```bash
cd /root/apps/whatsapp-dispatcher/frontend

# Criar arquivo .env.local
cat > .env.local << 'EOF'
# URL da API Backend (DEVE INCLUIR /api NO FINAL!)
NEXT_PUBLIC_API_URL=https://api.sistemasnettsistemas.com.br/api

# URL do Socket.IO (SEM /api no final)
NEXT_PUBLIC_SOCKET_URL=https://api.sistemasnettsistemas.com.br

# Nome da Aplicação
NEXT_PUBLIC_APP_NAME="Disparador NettSistemas"

# Desabilitar logs em produção
NEXT_PUBLIC_DISABLE_FRONTEND_LOGS=true

# Recursos opcionais
NEXT_PUBLIC_ENABLE_LANDING_PAGE=true
NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP=false
EOF

# Verificar arquivo
cat .env.local

# Instalar dependências
npm install

# Compilar Next.js (pode demorar 5-10 minutos)
npm run build

# Verificar se compilou
ls -la .next/
# Deve ter arquivos dentro
```

---

### PASSO 7: Configurar NGINX (Proxy Reverso)

#### 7.1. Configurar API Backend

```bash
# Criar configuração para API
sudo nano /etc/nginx/sites-available/api.sistemasnettsistemas.com.br
```

**Colar este conteúdo:**

```nginx
server {
    listen 80;
    server_name api.sistemasnettsistemas.com.br;

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
        
        # Cache
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Salvar:** Ctrl+O, Enter, Ctrl+X

#### 7.2. Configurar Frontend

```bash
# Criar configuração para Frontend
sudo nano /etc/nginx/sites-available/sistemasnettsistemas.com.br
```

**Colar este conteúdo:**

```nginx
server {
    listen 80;
    server_name sistemasnettsistemas.com.br www.sistemasnettsistemas.com.br;

    # Tamanho máximo de upload
    client_max_body_size 100M;

    # Proxy para frontend Next.js
    location / {
        proxy_pass http://localhost:3000;
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
        
        # Cache
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Salvar:** Ctrl+O, Enter, Ctrl+X

#### 7.3. Ativar Configurações

```bash
# Criar links simbólicos
sudo ln -s /etc/nginx/sites-available/api.sistemasnettsistemas.com.br /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/sistemasnettsistemas.com.br /etc/nginx/sites-enabled/

# Remover configuração padrão (opcional)
sudo rm /etc/nginx/sites-enabled/default

# Testar configuração
sudo nginx -t

# Se aparecer "syntax is ok" e "test is successful":
sudo systemctl reload nginx
```

---

### PASSO 8: Obter Certificados SSL (HTTPS)

```bash
# Obter certificados SSL com Let's Encrypt
sudo certbot --nginx -d api.sistemasnettsistemas.com.br
sudo certbot --nginx -d sistemasnettsistemas.com.br
sudo certbot --nginx -d www.sistemasnettsistemas.com.br

# Seguir as instruções:
# 1. Digitar email
# 2. Aceitar termos (Y)
# 3. Compartilhar email (N ou Y)
# 4. Escolher opção 2 (redirecionar HTTP para HTTPS)

# Verificar renovação automática
sudo certbot renew --dry-run

# Se tudo OK, os certificados serão renovados automaticamente
```

---

### PASSO 9: Iniciar Serviços com PM2

```bash
# Iniciar Backend
cd /root/apps/whatsapp-dispatcher/backend
pm2 start npm --name "whatsapp-backend" -- start

# Iniciar Frontend
cd /root/apps/whatsapp-dispatcher/frontend
pm2 start npm --name "whatsapp-frontend" -- start

# Verificar status
pm2 list

# Deve mostrar:
# ┌────┬────────────────────┬──────────┬──────┬───────────┐
# │ id │ name               │ mode     │ ↺    │ status    │
# ├────┼────────────────────┼──────────┼──────┼───────────┤
# │ 0  │ whatsapp-backend   │ fork     │ 0    │ online    │
# │ 1  │ whatsapp-frontend  │ fork     │ 0    │ online    │
# └────┴────────────────────┴──────────┴──────┴───────────┘

# Ver logs
pm2 logs --lines 50

# Salvar configuração do PM2
pm2 save

# Configurar PM2 para iniciar com o sistema
pm2 startup
# IMPORTANTE: Copiar e executar o comando que aparecer!
# Exemplo: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root
```

---

### PASSO 10: Testes Finais

```bash
# 1. Testar backend localmente
curl http://localhost:3001/api/health
# Deve retornar algo como: {"success":true,"message":"API is running"}

# 2. Testar API externamente
curl https://api.sistemasnettsistemas.com.br/api/health
# Deve retornar o mesmo

# 3. Testar frontend
curl https://sistemasnettsistemas.com.br
# Deve retornar HTML do Next.js

# 4. Abrir no navegador
# https://sistemasnettsistemas.com.br
# Deve carregar a página de login

# 5. Ver logs em tempo real
pm2 logs

# 6. Verificar se não há erros
pm2 logs whatsapp-backend --lines 50 --nostream
pm2 logs whatsapp-frontend --lines 50 --nostream
```

---

## ✅ CHECKLIST FINAL

Após a instalação, verificar se tudo está funcionando:

```bash
☐ Node.js instalado (>= 18.x)
☐ PostgreSQL rodando
☐ NGINX rodando
☐ PM2 instalado
☐ Banco de dados criado
☐ Tabelas criadas (migrations executadas)
☐ Backend compilado (pasta dist/ existe)
☐ Frontend compilado (pasta .next/ existe)
☐ Certificados SSL instalados
☐ Backend online no PM2
☐ Frontend online no PM2
☐ curl http://localhost:3001/api/health funciona
☐ curl https://api.sistemasnettsistemas.com.br/api/health funciona
☐ https://sistemasnettsistemas.com.br carrega
☐ Login funciona
☐ Sem erros nos logs do PM2
```

---

## 🔥 RESOLUÇÃO RÁPIDA DE PROBLEMAS

### Backend não inicia
```bash
pm2 logs whatsapp-backend --lines 50
# Ver erro específico

# Recompilar
cd /root/apps/whatsapp-dispatcher/backend
rm -rf dist
npm run build
pm2 restart whatsapp-backend
```

### Frontend não carrega
```bash
# Verificar se .env.local está correto
cat /root/apps/whatsapp-dispatcher/frontend/.env.local

# Recompilar
cd /root/apps/whatsapp-dispatcher/frontend
rm -rf .next
npm run build
pm2 restart whatsapp-frontend
```

### Erro "relation does not exist"
```bash
# Migrations não foram executadas
cd /root/apps/whatsapp-dispatcher/backend

# Executar migrations manualmente
psql -U whatsapp_user -d whatsapp_dispatcher -h localhost -f nome-do-script.sql
```

### Erro 502 Bad Gateway
```bash
# Backend não está rodando
pm2 restart whatsapp-backend
pm2 logs whatsapp-backend
```

### Erro de CORS
```bash
# Verificar se FRONTEND_URL está correto no .env do backend
cat /root/apps/whatsapp-dispatcher/backend/.env | grep FRONTEND_URL
# Deve ter: FRONTEND_URL=https://sistemasnettsistemas.com.br

# Se estiver errado, corrigir e reiniciar
nano /root/apps/whatsapp-dispatcher/backend/.env
pm2 restart whatsapp-backend
```

---

## 📞 COMANDOS ÚTEIS

```bash
# Ver logs em tempo real
pm2 logs

# Ver logs de um serviço específico
pm2 logs whatsapp-backend
pm2 logs whatsapp-frontend

# Reiniciar serviços
pm2 restart all
pm2 restart whatsapp-backend
pm2 restart whatsapp-frontend

# Ver status
pm2 list
pm2 monit

# Parar serviços
pm2 stop all

# Ver logs do NGINX
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Recarregar NGINX
sudo nginx -t
sudo systemctl reload nginx

# Ver conexões com banco
psql -U whatsapp_user -d whatsapp_dispatcher -h localhost
\dt  # Listar tabelas
\q   # Sair
```

---

## 🎯 RESUMO DOS ARQUIVOS CRIADOS

```
/root/apps/whatsapp-dispatcher/
├── backend/
│   ├── .env                          ✅ Criado
│   ├── dist/                         ✅ Compilado
│   └── uploads/                      ✅ Criado automaticamente
├── frontend/
│   ├── .env.local                    ✅ Criado
│   └── .next/                        ✅ Compilado
└── ...

/etc/nginx/sites-available/
├── api.sistemasnettsistemas.com.br   ✅ Criado
└── sistemasnettsistemas.com.br       ✅ Criado

/etc/nginx/sites-enabled/
├── api.sistemasnettsistemas.com.br   ✅ Link simbólico
└── sistemasnettsistemas.com.br       ✅ Link simbólico
```

---

## 🚀 INSTALAÇÃO CONCLUÍDA!

Se todos os passos foram executados corretamente:

✅ Sistema rodando em **produção**  
✅ HTTPS configurado (SSL)  
✅ Backend e Frontend online  
✅ PM2 gerenciando processos  
✅ Auto-restart configurado  

**Acesse:** https://sistemasnettsistemas.com.br

---

## 📚 DOCUMENTAÇÃO ADICIONAL

Para mais detalhes sobre erros específicos e troubleshooting avançado, consulte:

- **📊-ANALISE-COMPLETA-ERROS-INSTALACAO-SERVIDOR.md** - Análise detalhada de todos os erros possíveis
- **📋-RELATORIO-SESSAO-ERROS-404-29-11-2025.md** - Relatório da sessão anterior

---

**Documento criado em:** 29/11/2025  
**Versão:** 1.0  
**Status:** ✅ Pronto para Uso

**Boa sorte com a instalação! 🚀**

