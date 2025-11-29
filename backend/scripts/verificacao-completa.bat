@echo off
REM Script de Verificação Completa (Windows)

echo.
echo ============================================================
echo VERIFICACAO COMPLETA DO SISTEMA MULTI-TENANT
echo ============================================================
echo.

cd /d "%~dp0\.."

echo Executando verificacao...
echo.

node scripts/verificacao-completa.js

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================
    echo VERIFICACAO CONCLUIDA COM SUCESSO!
    echo ============================================================
) else (
    echo.
    echo ============================================================
    echo VERIFICACAO ENCONTROU PROBLEMAS
    echo ============================================================
)

pause





