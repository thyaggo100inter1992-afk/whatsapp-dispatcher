@echo off
chcp 65001 >nul
cls
echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║       🔍 VERIFICAR FUNCIONALIDADES DOS PLANOS                 ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

cd backend
node verificar-funcionalidades-planos.js

echo.
pause

