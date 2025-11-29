#!/bin/bash

clear

echo "═══════════════════════════════════════════════════════════"
echo "🚀 EXECUTAR FASE 1 - MULTI-TENANT"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "⚠️  ATENÇÃO: Esta operação irá modificar o banco de dados!"
echo ""
echo "Certifique-se de que:"
echo "  ✅ Você leu a documentação"
echo "  ✅ O backend está PARADO"
echo "  ✅ Ninguém está usando o sistema"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

read -p "Pressione Enter para continuar ou Ctrl+C para cancelar..."

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PASSO 1: BACKUP DO BANCO DE DADOS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd backend
chmod +x scripts/backup-before-migration.sh
./scripts/backup-before-migration.sh

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ ERRO ao criar backup!"
    echo "⚠️  NÃO PROSSIGA SEM BACKUP!"
    echo ""
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PASSO 2: APLICAR MIGRATIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

node src/scripts/apply-multi-tenant-migration.js

if [ $? -eq 0 ]; then
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "✅ FASE 1 APLICADA COM SUCESSO!"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "🎉 Parabéns! O banco de dados está pronto!"
    echo ""
    echo "📊 Resumo:"
    echo "  ✅ Tabelas de controle criadas"
    echo "  ✅ tenant_id adicionado em todas as tabelas"
    echo "  ✅ Seus dados preservados no Tenant 1"
    echo "  ✅ Índices criados"
    echo "  ✅ Row Level Security habilitado"
    echo ""
    echo "🔐 Credenciais de acesso:"
    echo "  Email: admin@minhaempresa.com"
    echo "  Senha: admin123"
    echo "  ⚠️  ALTERE A SENHA APÓS O PRIMEIRO LOGIN!"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "➡️  PRÓXIMA FASE:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "A Fase 2 (Autenticação e Middleware) será implementada agora."
    echo ""
    echo "⚠️  NÃO REINICIE O BACKEND AINDA!"
    echo "   Aguarde a conclusão da Fase 2."
    echo ""
else
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "❌ ERRO AO APLICAR FASE 1"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "⚠️  O banco pode estar em estado inconsistente!"
    echo ""
    echo "Para restaurar o backup:"
    echo "  1. Encontre o arquivo de backup em backend/backups/"
    echo "  2. Execute:"
    echo "     psql -h localhost -U postgres -d whatsapp_dispatcher < backups/backup_before_multi_tenant_XXXXX.sql"
    echo ""
    echo "Substitua XXXXX pelo timestamp do seu backup."
    echo ""
fi

echo ""





