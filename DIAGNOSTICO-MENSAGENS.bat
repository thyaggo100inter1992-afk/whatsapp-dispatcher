@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   🔍 DIAGNÓSTICO DE MENSAGENS
echo ========================================
echo.
echo Verificando mensagens no banco...
echo.

cd backend
node verificar-mensagens.js

echo.
pause

