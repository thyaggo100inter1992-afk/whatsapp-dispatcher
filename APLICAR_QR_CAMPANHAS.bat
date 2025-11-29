@echo off
chcp 65001 > nul
echo.
echo ============================================
echo 📋 CRIAR TABELAS DE CAMPANHAS QR CONNECT
echo ============================================
echo.
echo Este script vai criar as tabelas:
echo   - qr_campaigns
echo   - qr_campaign_templates
echo   - qr_campaign_contacts
echo   - qr_campaign_messages
echo.
echo ⚠️  Certifique-se de que o PostgreSQL está rodando!
echo.
pause

echo.
echo 📦 Executando script SQL...
echo.

psql -U postgres -d whatsapp_dispatcher -f backend\src\database\migrations\create_qr_campaigns.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo ✅ TABELAS CRIADAS COM SUCESSO!
    echo ============================================
    echo.
    echo Próximos passos:
    echo   1. Reiniciar o backend
    echo   2. Acessar Dashboard UAZ
    echo   3. Criar sua primeira campanha QR!
    echo.
) else (
    echo.
    echo ============================================
    echo ❌ ERRO AO CRIAR TABELAS
    echo ============================================
    echo.
    echo Verifique:
    echo   - PostgreSQL está rodando?
    echo   - Banco 'whatsapp_dispatcher' existe?
    echo   - Usuário 'postgres' tem permissão?
    echo.
)

pause








