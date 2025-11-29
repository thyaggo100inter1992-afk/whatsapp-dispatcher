#!/bin/bash

# Script para Configurar DATABASE_URL automaticamente

echo ""
echo "============================================================"
echo "CONFIGURAÇÃO AUTOMÁTICA DO DATABASE_URL"
echo "============================================================"
echo ""

cd "$(dirname "$0")/.."

echo "Verificando arquivo .env..."
echo ""

# Verificar se .env existe
if [ ! -f ".env" ]; then
    echo "Criando arquivo .env..."
    cat > .env << 'EOF'
# ============================================
# BANCO DE DADOS
# ============================================
DATABASE_URL=postgresql://postgres:Tg130992*@localhost:5432/whatsapp_dispatcher

# ============================================
# AUTENTICAÇÃO
# ============================================
JWT_SECRET=seu_jwt_secret_aqui_minimo_32_caracteres_para_seguranca_maxima
JWT_REFRESH_SECRET=seu_refresh_secret_aqui_minimo_32_caracteres

# ============================================
# CRIPTOGRAFIA
# ============================================
ENCRYPTION_KEY=sua_chave_de_32_caracteres_aqui_para_criptografia

# ============================================
# SERVIDOR
# ============================================
PORT=3000
NODE_ENV=development
EOF
    echo "[OK] Arquivo .env criado!"
else
    echo "[OK] Arquivo .env já existe"
    echo ""
    echo "Verificando DATABASE_URL..."
    
    # Verificar se DATABASE_URL já existe
    if ! grep -q "^DATABASE_URL=" .env; then
        echo ""
        echo "DATABASE_URL não encontrada, adicionando..."
        echo "DATABASE_URL=postgresql://postgres:Tg130992*@localhost:5432/whatsapp_dispatcher" >> .env
        echo "[OK] DATABASE_URL adicionada!"
    else
        echo "[OK] DATABASE_URL já configurada!"
        echo ""
        read -p "Deseja substituir? (s/n) " resposta
        if [ "$resposta" = "s" ] || [ "$resposta" = "S" ]; then
            echo ""
            echo "Atualizando DATABASE_URL..."
            sed -i.bak 's|^DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:Tg130992*@localhost:5432/whatsapp_dispatcher|' .env
            echo "[OK] DATABASE_URL atualizada!"
        else
            echo "[OK] Mantendo configuração existente"
        fi
    fi
fi

echo ""
echo "============================================================"
echo "CONFIGURAÇÃO CONCLUÍDA!"
echo "============================================================"
echo ""
echo "DATABASE_URL configurada para:"
echo "postgresql://postgres:Tg130992*@localhost:5432/whatsapp_dispatcher"
echo ""
echo "Próximo passo:"
echo "1. Verificar se PostgreSQL está rodando"
echo "2. Executar: node src/scripts/apply-multi-tenant-migration.js"
echo "3. Executar: node scripts/verificacao-completa.js"
echo ""
echo "============================================================"
echo ""





