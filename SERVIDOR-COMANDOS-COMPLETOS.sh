# ============================================
# COMANDOS PARA O SERVIDOR - COPIE E COLE
# SSH: root@72.60.141.244
# Senha: Tg74108520963,
# ============================================

# ============================================
# BLOCO 1: CONECTAR AO SERVIDOR
# ============================================
ssh root@72.60.141.244
# Senha: Tg74108520963,


# ============================================
# BLOCO 2: INSTALAR DEPENDÊNCIAS DO SISTEMA
# ============================================
apt update
apt upgrade -y

# Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# PostgreSQL
apt install -y postgresql postgresql-contrib

# NGINX
apt install -y nginx

# PM2
npm install -g pm2

# Certbot (SSL)
apt install -y certbot python3-certbot-nginx

# Git
apt install -y git

# Verificar instalações
echo "==================================="
echo "VERIFICANDO INSTALAÇÕES:"
echo "==================================="
node -v
npm -v
psql --version | head -1
nginx -v
pm2 -v
git --version
echo "==================================="


# ============================================
# BLOCO 3: CONFIGURAR BANCO DE DADOS
# ============================================
echo "==================================="
echo "CONFIGURANDO BANCO DE DADOS..."
echo "==================================="

sudo -u postgres psql << 'EOF'
CREATE DATABASE whatsapp_dispatcher;
CREATE USER whatsapp_user WITH PASSWORD 'Senhaforte123!@#';
GRANT ALL PRIVILEGES ON DATABASE whatsapp_dispatcher TO whatsapp_user;
\q
EOF

# Testar conexão
PGPASSWORD='Senhaforte123!@#' psql -U whatsapp_user -d whatsapp_dispatcher -h localhost -c "SELECT 1;" && echo "✅ Banco configurado!"


# ============================================
# BLOCO 4: CLONAR REPOSITÓRIO DO GITHUB
# ============================================
echo "==================================="
echo "CLONANDO REPOSITÓRIO..."
echo "==================================="

cd /root
git clone https://github.com/thyaggo100inter1992-afk/whatsapp-dispatcher.git
cd whatsapp-dispatcher
echo "✅ Repositório clonado!"


# ============================================
# BLOCO 5: CONFIGURAR BACKEND
# ============================================
echo "==================================="
echo "CONFIGURANDO BACKEND..."
echo "==================================="

cd /root/whatsapp-dispatcher/backend

# Criar arquivo .env
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
echo "Instalando dependências do backend..."
npm install

# Compilar TypeScript
echo "Compilando backend..."
npm run build

echo "✅ Backend configurado!"


# ============================================
# BLOCO 6: CONFIGURAR FRONTEND
# ============================================
echo "==================================="
echo "CONFIGURANDO FRONTEND..."
echo "==================================="

cd /root/whatsapp-dispatcher/frontend

# Criar arquivo .env.local
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
echo "Instalando dependências do frontend..."
npm install

# Compilar Next.js
echo "Compilando frontend..."
npm run build

echo "✅ Frontend configurado!"


# ============================================
# BLOCO 7: CONFIGURAR NGINX
# ============================================
echo "==================================="
echo "CONFIGURANDO NGINX..."
echo "==================================="

# Configuração da API (Backend)
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

# Configuração do Frontend
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

# Remover site padrão
rm -f /etc/nginx/sites-enabled/default

# Testar configuração
nginx -t

# Recarregar NGINX
systemctl reload nginx

echo "✅ NGINX configurado!"


# ============================================
# BLOCO 8: INICIAR SERVIÇOS COM PM2
# ============================================
echo "==================================="
echo "INICIANDO SERVIÇOS..."
echo "==================================="

# Iniciar Backend
cd /root/whatsapp-dispatcher/backend
pm2 delete whatsapp-backend 2>/dev/null || true
pm2 start npm --name "whatsapp-backend" -- start

# Iniciar Frontend
cd /root/whatsapp-dispatcher/frontend
pm2 delete whatsapp-frontend 2>/dev/null || true
pm2 start npm --name "whatsapp-frontend" -- start

# Salvar configuração do PM2
pm2 save

# Configurar auto-start
pm2 startup

# ⚠️ ATENÇÃO: O comando acima vai mostrar um comando para você executar!
# COPIE esse comando e EXECUTE ele também!

echo "✅ Serviços iniciados!"


# ============================================
# BLOCO 9: CONFIGURAR SSL (HTTPS)
# ============================================
echo "==================================="
echo "CONFIGURANDO SSL..."
echo "==================================="

# Certificado para API
certbot --nginx -d api.sistemasnettsistemas.com.br --non-interactive --agree-tos --email seu@email.com

# Certificado para Frontend
certbot --nginx -d sistemasnettsistemas.com.br -d www.sistemasnettsistemas.com.br --non-interactive --agree-tos --email seu@email.com

echo "✅ SSL configurado!"


# ============================================
# BLOCO 10: VERIFICAÇÕES FINAIS
# ============================================
echo "==================================="
echo "VERIFICAÇÕES FINAIS"
echo "==================================="

# Ver status dos serviços
pm2 list

# Testar API local
curl http://localhost:3001/api/health || echo "⚠️ API local não respondeu"

# Testar Frontend local
curl http://localhost:3000 -I | head -1 || echo "⚠️ Frontend local não respondeu"

echo ""
echo "==================================="
echo "✅ INSTALAÇÃO CONCLUÍDA!"
echo "==================================="
echo ""
echo "Acesse:"
echo "Frontend: https://sistemasnettsistemas.com.br"
echo "API: https://api.sistemasnettsistemas.com.br/api/health"
echo ""
echo "Comandos úteis:"
echo "  pm2 logs          - Ver logs em tempo real"
echo "  pm2 restart all   - Reiniciar serviços"
echo "  pm2 monit         - Monitorar recursos"
echo "==================================="

