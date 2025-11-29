#!/bin/bash
# ============================================
# BLOCO 7: CONFIGURAR NGINX
# Execute DEPOIS do Bloco 6
# ============================================

echo "==================================="
echo "🌐 CONFIGURANDO NGINX..."
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

echo "✅ Configuração da API criada"

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

echo "✅ Configuração do Frontend criada"

# Ativar sites
ln -sf /etc/nginx/sites-available/api.sistemasnettsistemas.com.br /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/sistemasnettsistemas.com.br /etc/nginx/sites-enabled/

# Remover site padrão
rm -f /etc/nginx/sites-enabled/default

echo ""
echo "Testando configuração do NGINX..."
nginx -t

echo ""
echo "Recarregando NGINX..."
systemctl reload nginx

echo ""
echo "==================================="
echo "✅ BLOCO 7 CONCLUÍDO!"
echo "==================================="

