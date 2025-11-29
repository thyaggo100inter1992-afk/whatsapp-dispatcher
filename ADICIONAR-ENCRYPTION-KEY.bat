@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   🔐 ADICIONAR ENCRYPTION KEY
echo ========================================
echo.
echo Este script vai adicionar a chave de
echo criptografia necessária no arquivo .env
echo.
pause

cd backend

echo.
echo 🔐 Adicionando ENCRYPTION_KEY...
echo.

node adicionar-encryption-key.js

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   ✅ SUCESSO!
    echo ========================================
    echo.
    echo Agora:
    echo   1. Vá no terminal do backend
    echo   2. Pressione Ctrl+C
    echo   3. Execute: 3-iniciar-backend.bat
    echo   4. Tente salvar a integração novamente
    echo.
) else (
    echo.
    echo ========================================
    echo   ⚠️  ATENÇÃO
    echo ========================================
    echo.
    echo Siga a solução manual acima.
    echo.
)

pause

