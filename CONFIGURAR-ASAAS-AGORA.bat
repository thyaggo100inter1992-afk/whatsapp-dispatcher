@echo off
chcp 65001 > nul
echo ============================================
echo   CONFIGURAR ASAAS - GATEWAY DE PAGAMENTO
echo ============================================
echo.
echo Este script vai te ajudar a configurar o Asaas
echo.
echo PASSO 1: CRIAR CONTA NO ASAAS
echo ════════════════════════════════════════════
echo.
echo Para TESTES (Sandbox):
echo   https://sandbox.asaas.com
echo.
echo Para PRODUÇÃO:
echo   https://www.asaas.com
echo.
pause
echo.
echo PASSO 2: OBTER API KEY
echo ════════════════════════════════════════════
echo.
echo 1. Faça login no Asaas
echo 2. Vá em: Configurações → Integrações → API
echo 3. Copie sua API Key
echo.
pause
echo.
echo PASSO 3: ADICIONAR NO .ENV
echo ════════════════════════════════════════════
echo.
set /p api_key="Cole sua API Key aqui: "
echo.
set /p environment="Ambiente (sandbox ou production): "
echo.
echo Adicionando configurações ao .env...
echo.
cd backend
echo. >> .env
echo # ============================================ >> .env
echo # ASAAS - GATEWAY DE PAGAMENTO >> .env
echo # ============================================ >> .env
echo ASAAS_API_KEY=%api_key% >> .env
echo ASAAS_ENVIRONMENT=%environment% >> .env
echo. >> .env
echo ✅ Configurações adicionadas ao backend/.env
echo.
cd ..
echo.
echo PASSO 4: CONFIGURAR WEBHOOK
echo ════════════════════════════════════════════
echo.
echo O webhook é ESSENCIAL para liberação automática!
echo.
echo OPÇÃO 1 - DESENVOLVIMENTO (com ngrok):
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 1. Execute: ngrok http 5000
echo 2. Copie a URL gerada (ex: https://abc123.ngrok.io)
echo 3. No Asaas:
echo    - Vá em: Configurações → Integrações → Webhooks
echo    - URL: https://abc123.ngrok.io/api/payments/webhook
echo    - Marque os eventos de pagamento
echo.
echo OPÇÃO 2 - PRODUÇÃO (com domínio):
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 1. URL: https://seudominio.com/api/payments/webhook
echo 2. Configure no Asaas igual ao desenvolvimento
echo.
pause
echo.
echo ============================================
echo   ✅ CONFIGURAÇÃO CONCLUÍDA!
echo ============================================
echo.
echo Próximos passos:
echo.
echo 1. Execute: APLICAR-SISTEMA-PAGAMENTOS.bat
echo    (Para aplicar as migrations no banco)
echo.
echo 2. Reinicie o backend:
echo    cd backend
echo    npm run dev
echo.
echo 3. Configure o webhook no Asaas
echo.
echo 4. Teste o sistema! 🚀
echo.
pause





