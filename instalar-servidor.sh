#!/bin/bash
# ============================================
# SCRIPT DE INSTALAÇÃO AUTOMÁTICA
# Servidor: 72.60.141.244
# Domínio: sistemasnettsistemas.com.br
# ============================================

set -e  # Parar se houver erro

echo "======================================"
echo "🚀 INSTALAÇÃO WHATSAPP DISPATCHER"
echo "======================================"
echo ""
echo "Servidor: 72.60.141.244"
echo "Domínio: sistemasnettsistemas.com.br"
echo ""

# ============================================
# PASSO 1: INSTALAR DEPENDÊNCIAS
# ============================================
echo "📦 Instalando dependências do sistema..."

apt update
apt upgrade -y

# Node.js 20.x
echo "📦 Instalando Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# PostgreSQL
echo "📦 Instalando PostgreSQL..."
apt install -y postgresql postgresql-contrib

# NGINX
echo "📦 Instalando NGINX..."
apt install -y nginx

# PM2
echo "📦 Instalando PM2..."
npm install -g pm2

# Certbot
echo "📦 Instalando Certbot..."
apt install -y certbot python3-certbot-nginx

echo "✅ Dependências instaladas!"
echo ""

# ============================================
# PASSO 2: CONFIGURAR BANCO DE DADOS
# ============================================
echo "🗄️ Configurando banco de dados..."

sudo -u postgres psql -c "CREATE DATABASE whatsapp_dispatcher;" || echo "Banco já existe"
sudo -u postgres psql -c "CREATE USER whatsapp_user WITH PASSWORD 'Senhaforte123!@#';" || echo "Usuário já existe"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE whatsapp_dispatcher TO whatsapp_user;"

echo "✅ Banco de dados configurado!"
echo ""

# ============================================
# PASSO 3: CONFIGURAR BACKEND
# ============================================
echo "⚙️ Configurando backend..."

cd /root/whatsapp-dispatcher/backend

# Criar .env
cat > .env << 'EOF'
PORT=3001
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5432
DB_NAME=whatsapp_dispatcher
DB_USER=whatsapp_user
DB_PASSWORD=Senhaforte123!@#
JWT_SECRET=chave-super-secreta-aleatoria-minimo-32-caracteres-mudar-em-producao
FRONTEND_URL=https://sistemasnettsistemas.com.br
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
EOF

echo "✅ Arquivo .env criado"

# Instalar dependências
echo "📦 Instalando dependências do backend..."
npm install

# Executar migrations (se existirem)
echo "🗄️ Executando migrations..."
if [ -f "migrations/init.sql" ]; then
    psql -U whatsapp_user -d whatsapp_dispatcher -h localhost -f migrations/init.sql
fi

# Compilar
echo "🔨 Compilando backend..."
npm run build

echo "✅ Backend configurado!"
echo ""

# ============================================
# PASSO 4: CONFIGURAR FRONTEND
# ============================================
echo "🎨 Configurando frontend..."

cd /root/whatsapp-dispatcher/frontend

# Criar .env.local
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://api.sistemasnettsistemas.com.br/api
NEXT_PUBLIC_SOCKET_URL=https://api.sistemasnettsistemas.com.br
NEXT_PUBLIC_APP_NAME="Disparador NettSistemas"
NEXT_PUBLIC_DISABLE_FRONTEND_LOGS=true
NEXT_PUBLIC_ENABLE_LANDING_PAGE=true
NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP=false
EOF

echo "✅ Arquivo .env.local criado"

# Instalar dependências
echo "📦 Instalando dependências do frontend..."
npm install

# Compilar
echo "🔨 Compilando frontend..."
npm run build

echo "✅ Frontend configurado!"
echo ""

# ============================================
# PASSO 5: CONFIGURAR NGINX
# ============================================
echo "🌐 Configurando NGINX..."

# API Backend
cat > /etc/nginx/sites-available/api.sistemasnettsistemas.com.br << 'EOF'
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
EOF

# Frontend
cat > /etc/nginx/sites-available/sistemasnettsistemas.com.br << 'EOF'
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
EOF

# Ativar sites
ln -sf /etc/nginx/sites-available/api.sistemasnettsistemas.com.br /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/sistemasnettsistemas.com.br /etc/nginx/sites-enabled/

# Remover default
rm -f /etc/nginx/sites-enabled/default

# Testar configuração
nginx -t

# Recarregar NGINX
systemctl reload nginx

echo "✅ NGINX configurado!"
echo ""

# ============================================
# PASSO 6: INICIAR SERVIÇOS
# ============================================
echo "🚀 Iniciando serviços..."

# Backend
cd /root/whatsapp-dispatcher/backend
pm2 delete whatsapp-backend 2>/dev/null || true
pm2 start npm --name "whatsapp-backend" -- start

# Frontend
cd /root/whatsapp-dispatcher/frontend
pm2 delete whatsapp-frontend 2>/dev/null || true
pm2 start npm --name "whatsapp-frontend" -- start

# Salvar configuração PM2
pm2 save

# Configurar auto-start
pm2 startup systemd -u root --hp /root

echo "✅ Serviços iniciados!"
echo ""

# ============================================
# PASSO 7: CONFIGURAR SSL
# ============================================
echo "🔒 Configurando SSL..."
echo ""
echo "Execute manualmente:"
echo "certbot --nginx -d api.sistemasnettsistemas.com.br"
echo "certbot --nginx -d sistemasnettsistemas.com.br"
echo "certbot --nginx -d www.sistemasnettsistemas.com.br"
echo ""

# ============================================
# VERIFICAÇÕES FINAIS
# ============================================
echo "======================================"
echo "✅ INSTALAÇÃO CONCLUÍDA!"
echo "======================================"
echo ""
echo "Verificações:"
echo ""
echo "1. Status dos serviços:"
pm2 list
echo ""
echo "2. Testar backend:"
echo "   curl http://localhost:3001/api/health"
echo ""
echo "3. Configurar SSL:"
echo "   certbot --nginx -d api.sistemasnettsistemas.com.br"
echo "   certbot --nginx -d sistemasnettsistemas.com.br"
echo ""
echo "4. Acessar:"
echo "   https://sistemasnettsistemas.com.br"
echo ""
echo "======================================"

