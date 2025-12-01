@echo off
chcp 65001 >nul
cls
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║          🧪 TESTE COMPLETO DE WEBHOOK - WHATSAPP          ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo Este script vai executar um teste completo do webhook.
echo.
echo ════════════════════════════════════════════════════════════
echo.

:: Verificar se está na pasta correta
if not exist "backend" (
    echo ❌ ERRO: Execute este script na pasta raiz do projeto!
    goto :fim
)

:: ═══════════════════════════════════════════════════════════
:: ETAPA 1: VERIFICAR VARIÁVEIS NO .ENV
:: ═══════════════════════════════════════════════════════════

echo 1️⃣  VERIFICANDO VARIÁVEIS NO .ENV
echo ────────────────────────────────────────────────────────────
echo.

cd backend

if not exist .env (
    echo ❌ Arquivo .env não encontrado!
    echo.
    echo 💡 Execute: ADICIONAR-WEBHOOK-ENV.bat
    cd ..
    goto :fim
)

set WEBHOOK_TOKEN=
set WEBHOOK_BASE_URL=
set WEBHOOK_URL=

:: Extrair valores das variáveis
for /f "tokens=1,2 delims==" %%a in ('findstr /C:"WEBHOOK_VERIFY_TOKEN" .env') do set WEBHOOK_TOKEN=%%b
for /f "tokens=1,2 delims==" %%a in ('findstr /C:"WEBHOOK_BASE_URL" .env') do set WEBHOOK_BASE_URL=%%b
for /f "tokens=1,2 delims==" %%a in ('findstr /C:"WEBHOOK_URL" .env') do set WEBHOOK_URL=%%b

if "%WEBHOOK_TOKEN%"=="" (
    echo ❌ WEBHOOK_VERIFY_TOKEN não encontrado
    echo.
    echo 💡 Execute: ADICIONAR-WEBHOOK-ENV.bat
    cd ..
    goto :fim
) else (
    echo ✅ WEBHOOK_VERIFY_TOKEN: %WEBHOOK_TOKEN%
)

if "%WEBHOOK_BASE_URL%"=="" (
    echo ❌ WEBHOOK_BASE_URL não encontrado
    cd ..
    goto :fim
) else (
    echo ✅ WEBHOOK_BASE_URL: %WEBHOOK_BASE_URL%
)

if "%WEBHOOK_URL%"=="" (
    echo ❌ WEBHOOK_URL não encontrado
    cd ..
    goto :fim
) else (
    echo ✅ WEBHOOK_URL: %WEBHOOK_URL%
)

cd ..

echo.
echo ════════════════════════════════════════════════════════════
echo.

:: ═══════════════════════════════════════════════════════════
:: ETAPA 2: VERIFICAR SE O BACKEND ESTÁ RODANDO
:: ═══════════════════════════════════════════════════════════

echo 2️⃣  VERIFICANDO SE O BACKEND ESTÁ RODANDO
echo ────────────────────────────────────────────────────────────
echo.

where pm2 >nul 2>&1
if errorlevel 1 (
    echo ⚠️  PM2 não encontrado
    echo.
    echo 💡 Verifique se o backend está rodando manualmente
    echo.
) else (
    pm2 list | findstr "backend" >nul
    if errorlevel 1 (
        echo ❌ Backend não está rodando no PM2
        echo.
        echo 💡 Inicie o backend: pm2 start backend
        echo.
    ) else (
        echo ✅ Backend está rodando no PM2
        echo.
    )
)

echo ════════════════════════════════════════════════════════════
echo.

:: ═══════════════════════════════════════════════════════════
:: ETAPA 3: TESTAR CONECTIVIDADE COM O SERVIDOR
:: ═══════════════════════════════════════════════════════════

echo 3️⃣  TESTANDO CONECTIVIDADE COM O SERVIDOR
echo ────────────────────────────────────────────────────────────
echo.

where curl >nul 2>&1
if errorlevel 1 (
    echo ⚠️  curl não encontrado
    echo.
    echo 💡 Instale o curl para testar a conectividade
    echo.
) else (
    echo 🌐 Testando: https://sistemasnettsistemas.com.br/api/webhook
    echo.
    
    curl -s -o nul -w "Status HTTP: %%{http_code}\n" https://sistemasnettsistemas.com.br/api/webhook
    echo.
    
    if errorlevel 1 (
        echo ❌ Erro ao conectar com o servidor
        echo.
    ) else (
        echo ✅ Servidor está respondendo
        echo.
    )
)

echo ════════════════════════════════════════════════════════════
echo.

:: ═══════════════════════════════════════════════════════════
:: ETAPA 4: TESTAR VERIFICAÇÃO DO WEBHOOK
:: ═══════════════════════════════════════════════════════════

echo 4️⃣  TESTANDO VERIFICAÇÃO DO WEBHOOK
echo ────────────────────────────────────────────────────────────
echo.

where curl >nul 2>&1
if errorlevel 1 (
    echo ⚠️  curl não encontrado - pulando teste
    echo.
) else (
    echo 🧪 Simulando verificação do Facebook...
    echo.
    echo URL: https://sistemasnettsistemas.com.br/api/webhook
    echo Token: %WEBHOOK_TOKEN%
    echo.
    
    curl -X GET "https://sistemasnettsistemas.com.br/api/webhook?hub.mode=subscribe&hub.verify_token=%WEBHOOK_TOKEN%&hub.challenge=teste_123"
    
    echo.
    echo.
    echo 📋 Resultado esperado: "teste_123"
    echo.
    echo ✅ Se retornou "teste_123": Webhook está funcionando!
    echo ❌ Se retornou erro 403: Token está errado
    echo ❌ Se retornou erro 500: Problema no backend
    echo.
)

echo ════════════════════════════════════════════════════════════
echo.

:: ═══════════════════════════════════════════════════════════
:: ETAPA 5: VERIFICAR LOGS NO BANCO DE DADOS
:: ═══════════════════════════════════════════════════════════

echo 5️⃣  VERIFICANDO LOGS NO BANCO DE DADOS
echo ────────────────────────────────────────────────────────────
echo.

where psql >nul 2>&1
if errorlevel 1 (
    echo ⚠️  PostgreSQL (psql) não encontrado no PATH
    echo.
    echo 💡 Você pode verificar manualmente:
    echo    psql -U whatsapp_user -d whatsapp_dispatcher
    echo    SELECT * FROM webhook_logs ORDER BY id DESC LIMIT 5;
    echo.
) else (
    echo 🗄️  Buscando últimos webhooks no banco...
    echo.
    
    psql -U whatsapp_user -d whatsapp_dispatcher -c "SELECT id, request_type, verification_success, received_at FROM webhook_logs ORDER BY id DESC LIMIT 5;"
    
    echo.
)

echo ════════════════════════════════════════════════════════════
echo.

:: ═══════════════════════════════════════════════════════════
:: ETAPA 6: RESUMO E PRÓXIMOS PASSOS
:: ═══════════════════════════════════════════════════════════

echo 6️⃣  RESUMO E PRÓXIMOS PASSOS
echo ────────────────────────────────────────────────────────────
echo.

echo ✅ TESTE COMPLETO EXECUTADO!
echo.
echo 📋 Próximos passos:
echo.
echo 1. Se o teste de verificação funcionou (retornou "teste_123"):
echo    → Configure no Facebook Developers
echo    → Use a URL: https://sistemasnettsistemas.com.br/api/webhook
echo    → Use o token: %WEBHOOK_TOKEN%
echo.
echo 2. Se o teste falhou:
echo    → Verifique os logs: pm2 logs backend
echo    → Verifique se o backend está rodando
echo    → Verifique se as variáveis estão corretas no .env
echo.
echo 3. Após configurar no Facebook:
echo    → Envie uma mensagem de teste
echo    → Verifique os logs: pm2 logs backend
echo    → Deve aparecer: "🔔 ===== WEBHOOK RECEBIDO ====="
echo.
echo 📖 Leia o guia completo: 🔧-CONFIGURAR-WEBHOOK-WHATSAPP.md
echo.

:fim
echo ════════════════════════════════════════════════════════════
echo.
echo Pressione qualquer tecla para sair...
pause >nul



