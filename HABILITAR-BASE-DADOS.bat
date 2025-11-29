@echo off
chcp 65001 >nul
echo.
echo ================================================
echo   HABILITAR FUNCIONALIDADE BASE DE DADOS
echo ================================================
echo.
echo Este script vai habilitar a funcionalidade
echo "base_dados" em todos os planos e tenants
echo.
echo Isso resolve o erro 403 ao acessar Base de Dados
echo.
pause

cd backend
node executar-habilitar-base-dados.js

echo.
echo ================================================
echo.
pause

