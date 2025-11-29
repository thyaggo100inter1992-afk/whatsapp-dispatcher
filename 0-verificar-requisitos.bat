@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   VERIFICANDO REQUISITOS DO SISTEMA
echo ========================================
echo.

set TODOS_OK=1

echo [1/4] Verificando Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js NÃO instalado
    set TODOS_OK=0
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo ✅ Node.js instalado: %NODE_VERSION%
)

echo.
echo [2/4] Verificando PostgreSQL...
psql --version >nul 2>&1
if errorlevel 1 (
    echo ❌ PostgreSQL NÃO instalado
    echo    Baixe em: https://www.postgresql.org/download/windows/
    set TODOS_OK=0
) else (
    for /f "tokens=*" %%i in ('psql --version') do set PG_VERSION=%%i
    echo ✅ PostgreSQL instalado: %PG_VERSION%
)

echo.
echo [3/4] Verificando Redis...
redis-cli --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Redis NÃO instalado localmente
    echo    Opção 1: Use Redis Cloud (gratuito) - https://redis.com/try-free/
    echo    Opção 2: Instale Redis para Windows
    set TODOS_OK=0
) else (
    for /f "tokens=*" %%i in ('redis-cli --version') do set REDIS_VERSION=%%i
    echo ✅ Redis instalado: %REDIS_VERSION%
)

echo.
echo [4/4] Verificando dependências npm...
if exist "backend\node_modules" (
    echo ✅ Backend: Dependências instaladas
) else (
    echo ❌ Backend: Dependências NÃO instaladas
    echo    Execute: cd backend ^&^& npm install
    set TODOS_OK=0
)

if exist "frontend\node_modules" (
    echo ✅ Frontend: Dependências instaladas
) else (
    echo ❌ Frontend: Dependências NÃO instaladas
    echo    Execute: cd frontend ^&^& npm install
    set TODOS_OK=0
)

echo.
echo ========================================
if %TODOS_OK%==1 (
    echo   ✅ TUDO PRONTO PARA INICIAR!
    echo ========================================
    echo.
    echo Próximos passos:
    echo 1. Configure backend\.env com suas credenciais
    echo 2. Execute: 2-criar-banco.bat
    echo 3. Execute: 5-iniciar-tudo.bat
) else (
    echo   ⚠️  ALGUNS REQUISITOS FALTANDO
    echo ========================================
    echo.
    echo Instale os itens marcados com ❌ acima
)
echo.
pause


