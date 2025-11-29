@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   CRIANDO BANCO DE DADOS
echo ========================================
echo.

echo Conectando ao PostgreSQL...
echo Digite a senha do usuário postgres quando solicitado.
echo.

psql -U postgres -c "CREATE DATABASE whatsapp_dispatcher;"

if errorlevel 1 (
    echo.
    echo AVISO: Erro ao criar banco (pode ser que já exista)
    echo.
)

echo.
echo Executando migrations...
cd backend
call npm run migrate

if errorlevel 1 (
    echo.
    echo ERRO ao executar migrations!
    echo Verifique se o PostgreSQL está rodando.
    pause
    exit /b 1
)

cd ..

echo.
echo ========================================
echo   BANCO CRIADO COM SUCESSO!
echo ========================================
echo.
pause


