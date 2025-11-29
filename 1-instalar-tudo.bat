@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   INSTALANDO DEPENDÊNCIAS
echo ========================================
echo.

echo [1/4] Instalando Backend...
cd backend
call npm install
if errorlevel 1 (
    echo ERRO ao instalar backend!
    pause
    exit /b 1
)

echo.
echo [2/4] Copiando arquivo .env...
if not exist .env (
    copy env.example.txt .env
    echo IMPORTANTE: Edite o arquivo backend\.env com suas configurações!
) else (
    echo Arquivo .env já existe, pulando...
)

echo.
echo [3/4] Instalando Frontend...
cd ..\frontend
call npm install
if errorlevel 1 (
    echo ERRO ao instalar frontend!
    pause
    exit /b 1
)

echo.
echo [4/4] Criando arquivo .env.local...
if not exist .env.local (
    echo NEXT_PUBLIC_API_URL=http://localhost:3001 > .env.local
)

cd ..

echo.
echo ========================================
echo   INSTALAÇÃO CONCLUÍDA!
echo ========================================
echo.
echo PRÓXIMOS PASSOS:
echo 1. Edite o arquivo backend\.env com suas configurações
echo 2. Crie o banco de dados: whatsapp_dispatcher
echo 3. Execute 2-criar-banco.bat
echo 4. Execute 3-iniciar-backend.bat
echo 5. Execute 4-iniciar-frontend.bat
echo.
pause


