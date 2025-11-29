#!/bin/bash
# ============================================
# BLOCO 9: CONFIGURAR SSL (HTTPS)
# Execute DEPOIS do Bloco 8 e do comando pm2 startup
# ============================================

echo "==================================="
echo "🔒 CONFIGURANDO SSL..."
echo "==================================="

# Verificar DNS primeiro
echo "Verificando DNS..."
echo ""
echo "api.sistemasnettsistemas.com.br:"
nslookup api.sistemasnettsistemas.com.br || echo "⚠️ DNS não encontrado"
echo ""
echo "sistemasnettsistemas.com.br:"
nslookup sistemasnettsistemas.com.br || echo "⚠️ DNS não encontrado"
echo ""

read -p "Os DNS estão apontando corretamente? (s/n): " resposta

if [ "$resposta" != "s" ]; then
    echo ""
    echo "⚠️ Configure os DNS antes de continuar!"
    echo "No painel do domínio, adicione:"
    echo ""
    echo "Tipo: A"
    echo "Host: api"
    echo "Valor: 72.60.141.244"
    echo ""
    echo "Depois execute este bloco novamente."
    exit 1
fi

echo ""
echo "Configurando SSL para API..."
certbot --nginx -d api.sistemasnettsistemas.com.br --non-interactive --agree-tos --email seu@email.com --redirect

echo ""
echo "Configurando SSL para Frontend..."
certbot --nginx -d sistemasnettsistemas.com.br -d www.sistemasnettsistemas.com.br --non-interactive --agree-tos --email seu@email.com --redirect

echo ""
echo "==================================="
echo "✅ BLOCO 9 CONCLUÍDO!"
echo "==================================="

