@echo off
chcp 65001 > nul
echo.
echo ============================================
echo 📋 ATUALIZAR TABELAS QR CAMPANHAS (100%%)
echo ============================================
echo.
echo Este script vai adicionar as colunas:
echo   - no_whatsapp_count
echo   - button_clicks_count
echo   - auto_remove_account_failures
echo   - removal_count, permanent_removal, removal_history
echo.
echo ⚠️  Certifique-se de que o PostgreSQL está rodando!
echo.
pause

echo.
echo 📦 Executando script SQL de atualização...
echo.

psql -U postgres -d whatsapp_dispatcher -f backend\src\database\migrations\update_qr_campaigns.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo ✅ TABELAS ATUALIZADAS COM SUCESSO!
    echo ============================================
    echo.
    echo Próximos passos:
    echo   1. Reiniciar o backend
    echo   2. As campanhas QR agora têm 100%% paridade
    echo.
) else (
    echo.
    echo ============================================
    echo ❌ ERRO AO ATUALIZAR TABELAS
    echo ============================================
    echo.
    echo Verifique:
    echo   - PostgreSQL está rodando?
    echo   - Banco 'whatsapp_dispatcher' existe?
    echo   - Usuário 'postgres' tem permissão?
    echo.
)

pause








