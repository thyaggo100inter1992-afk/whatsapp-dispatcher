@echo off
chcp 65001 >nul
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║   🔍 EXECUTAR VERIFICAÇÃO COMPLETA DE WEBHOOK             ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

echo 📋 Este script vai executar uma verificação completa:
echo.
echo 1. ✅ Verificar variáveis no .env
echo 2. 🗄️  Verificar webhooks no banco de dados
echo 3. 🌐 Testar conectividade com o servidor
echo.
echo ════════════════════════════════════════════════════════════
echo.

:: Passo 1: Verificar .env
echo 1️⃣  VERIFICANDO ARQUIVO .ENV...
echo.

cd backend

if not exist .env (
    echo ❌ ERRO: Arquivo .env não encontrado!
    echo.
    goto :fim
)

set ENV_OK=1

findstr /C:"WEBHOOK_VERIFY_TOKEN" .env >nul
if errorlevel 1 (
    echo ❌ FALTANDO: WEBHOOK_VERIFY_TOKEN
    set ENV_OK=0
) else (
    echo ✅ WEBHOOK_VERIFY_TOKEN configurado
)

findstr /C:"WEBHOOK_BASE_URL" .env >nul
if errorlevel 1 (
    echo ❌ FALTANDO: WEBHOOK_BASE_URL
    set ENV_OK=0
) else (
    echo ✅ WEBHOOK_BASE_URL configurado
)

findstr /C:"WEBHOOK_URL" .env >nul
if errorlevel 1 (
    echo ❌ FALTANDO: WEBHOOK_URL
    set ENV_OK=0
) else (
    echo ✅ WEBHOOK_URL configurado
)

echo.
echo ════════════════════════════════════════════════════════════
echo.

if %ENV_OK%==0 (
    echo ⚠️  ATENÇÃO: Variáveis de webhook NÃO estão configuradas!
    echo.
    echo 💡 Execute: ADICIONAR-WEBHOOK-ENV.bat
    echo.
    goto :fim
)

:: Passo 2: Verificar banco de dados
echo 2️⃣  VERIFICANDO BANCO DE DADOS...
echo.

cd ..

:: Verificar se psql está disponível
where psql >nul 2>&1
if errorlevel 1 (
    echo ⚠️  PostgreSQL (psql) não encontrado no PATH
    echo.
    echo 💡 Você pode executar manualmente:
    echo    psql -U whatsapp_user -d whatsapp_dispatcher -f VERIFICAR-WEBHOOKS-BANCO.sql
    echo.
) else (
    echo 🗄️  Executando queries no banco de dados...
    echo.
    psql -U whatsapp_user -d whatsapp_dispatcher -f VERIFICAR-WEBHOOKS-BANCO.sql
    echo.
)

echo ════════════════════════════════════════════════════════════
echo.

:: Passo 3: Testar conectividade
echo 3️⃣  TESTANDO CONECTIVIDADE COM SERVIDOR...
echo.

curl --version >nul 2>&1
if errorlevel 1 (
    echo ⚠️  curl não encontrado
    echo.
    echo 💡 Instale o curl ou teste manualmente:
    echo    https://sistemasnettsistemas.com.br/api/webhook
    echo.
) else (
    echo 🌐 Testando endpoint do webhook...
    echo.
    curl -I https://sistemasnettsistemas.com.br/api/webhook
    echo.
)

echo ════════════════════════════════════════════════════════════
echo.

echo ✅ VERIFICAÇÃO COMPLETA!
echo.
echo 📋 Próximos passos:
echo.
echo 1. Se as variáveis estão OK: Configure no Facebook Developers
echo 2. Se há erros no banco: Verifique os logs do backend
echo 3. Leia o guia: 🔧-CONFIGURAR-WEBHOOK-WHATSAPP.md
echo.

:fim
echo.
echo Pressione qualquer tecla para sair...
pause >nul



