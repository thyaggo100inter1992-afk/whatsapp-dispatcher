@echo off
chcp 65001 >nul
cls
echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║       🔧 ADICIONAR FUNCIONALIDADES AOS PLANOS                 ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
echo ⚠️  Este script irá ADICIONAR funcionalidades a TODOS os planos!
echo.
echo Pressione qualquer tecla para continuar ou Ctrl+C para cancelar...
pause >nul

cd backend
node adicionar-funcionalidades-planos.js

echo.
pause

