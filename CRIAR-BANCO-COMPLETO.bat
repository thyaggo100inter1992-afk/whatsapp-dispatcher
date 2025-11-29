@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   CRIANDO BANCO DE DADOS
echo ========================================
echo.

echo [1/2] Adicionando PostgreSQL ao PATH...
set PATH=%PATH%;C:\Program Files\PostgreSQL\17\bin;C:\Program Files\PostgreSQL\16\bin;C:\Program Files\PostgreSQL\15\bin

echo [2/2] Criando banco de dados...
echo Digite a senha do PostgreSQL quando solicitado: Tg130992*
echo.

psql -U postgres -c "CREATE DATABASE whatsapp_dispatcher;"

if errorlevel 1 (
    echo.
    echo ⚠️  Erro ao criar banco (pode ser que já exista)
    echo Continuando com as migrations...
)

echo.
echo [3/3] Executando migrations...
cd backend
call npm run migrate

if errorlevel 1 (
    echo.
    echo ❌ Erro ao executar migrations!
    cd ..
    pause
    exit /b 1
)

cd ..

echo.
echo ========================================
echo   ✅ BANCO CRIADO COM SUCESSO!
echo ========================================
echo.
echo Próximo passo: Iniciar os servidores
echo Execute: 5-iniciar-tudo.bat
echo.
pause


