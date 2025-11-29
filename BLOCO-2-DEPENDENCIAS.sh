#!/bin/bash
# ============================================
# BLOCO 2: INSTALAR DEPENDÊNCIAS
# Copie TUDO abaixo e cole no servidor
# ============================================

echo "==================================="
echo "📦 INSTALANDO DEPENDÊNCIAS..."
echo "==================================="

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
echo ""
echo "==================================="
echo "✅ VERIFICANDO INSTALAÇÕES:"
echo "==================================="
echo "Node.js: $(node -v)"
echo "NPM: $(npm -v)"
echo "PostgreSQL: $(psql --version | head -1)"
echo "NGINX: $(nginx -v 2>&1)"
echo "PM2: $(pm2 -v)"
echo "Git: $(git --version)"
echo "==================================="
echo "✅ BLOCO 2 CONCLUÍDO!"
echo "==================================="

