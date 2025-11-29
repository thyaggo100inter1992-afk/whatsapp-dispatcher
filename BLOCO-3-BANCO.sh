#!/bin/bash
# ============================================
# BLOCO 3: CONFIGURAR BANCO DE DADOS
# Execute DEPOIS do Bloco 2
# ============================================

echo "==================================="
echo "🗄️ CONFIGURANDO BANCO DE DADOS..."
echo "==================================="

sudo -u postgres psql << 'EOF'
CREATE DATABASE whatsapp_dispatcher;
CREATE USER whatsapp_user WITH PASSWORD 'Senhaforte123!@#';
GRANT ALL PRIVILEGES ON DATABASE whatsapp_dispatcher TO whatsapp_user;
\q
EOF

# Testar conexão
echo ""
echo "Testando conexão com banco..."
PGPASSWORD='Senhaforte123!@#' psql -U whatsapp_user -d whatsapp_dispatcher -h localhost -c "SELECT 1;" && echo "✅ Banco configurado com sucesso!"

echo "==================================="
echo "✅ BLOCO 3 CONCLUÍDO!"
echo "==================================="

