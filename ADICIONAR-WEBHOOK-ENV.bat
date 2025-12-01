@echo off
chcp 65001 >nul
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║   ➕ ADICIONAR CONFIGURAÇÕES DE WEBHOOK NO .ENV           ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

cd backend

if not exist .env (
    echo ❌ ERRO: Arquivo .env não encontrado em backend\
    echo.
    echo 💡 Crie o arquivo primeiro ou copie de um exemplo
    goto :fim
)

echo 📝 Gerando token aleatório...
echo.

:: Gerar um token aleatório simples
set TOKEN=webhook_token_%RANDOM%%RANDOM%_2024

echo ✅ Token gerado: %TOKEN%
echo.
echo 📋 Adicionando configurações ao .env...
echo.

:: Adicionar as linhas ao final do arquivo .env
echo. >> .env
echo # Webhook do WhatsApp >> .env
echo WEBHOOK_VERIFY_TOKEN=%TOKEN% >> .env
echo WEBHOOK_BASE_URL=https://sistemasnettsistemas.com.br >> .env
echo WEBHOOK_URL=https://sistemasnettsistemas.com.br/api/webhook >> .env

echo ✅ Configurações adicionadas com sucesso!
echo.
echo ════════════════════════════════════════════════════════════
echo.
echo 📋 Configurações adicionadas:
echo.
echo WEBHOOK_VERIFY_TOKEN=%TOKEN%
echo WEBHOOK_BASE_URL=https://sistemasnettsistemas.com.br
echo WEBHOOK_URL=https://sistemasnettsistemas.com.br/api/webhook
echo.
echo ⚠️  IMPORTANTE: GUARDE ESTE TOKEN!
echo.
echo 📝 Você vai precisar dele no Facebook Developers:
echo    1. Acesse: https://developers.facebook.com/apps
echo    2. Selecione seu App do WhatsApp
echo    3. Vá em WhatsApp ^> Configuration ^> Webhooks
echo    4. Configure:
echo       - Callback URL: https://sistemasnettsistemas.com.br/api/webhook
echo       - Verify Token: %TOKEN%
echo.
echo 🔄 Próximo passo: Reinicie o backend
echo    Comando: pm2 restart backend
echo.

:fim
echo.
echo Pressione qualquer tecla para sair...
pause >nul



