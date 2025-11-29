@echo off
chcp 65001 > nul
cls
echo ================================================================
echo 🔧 RECOMPILAR CÓDIGO TYPESCRIPT
echo ================================================================
echo.
echo Este script irá recompilar todos os arquivos TypeScript
echo para aplicar as correções no backend.
echo.
echo ================================================================
echo.

cd backend

echo 📋 Recompilando TypeScript...
echo.

call npm run build

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================================
    echo ✅ COMPILAÇÃO CONCLUÍDA COM SUCESSO!
    echo ================================================================
    echo.
    echo ✅ Código TypeScript recompilado
    echo ✅ Correções aplicadas
    echo.
    echo 💡 PRÓXIMO PASSO: Reinicie o backend!
    echo    → Ctrl+C (parar)
    echo    → 3-iniciar-backend.bat (iniciar)
    echo.
) else (
    echo.
    echo ================================================================
    echo ❌ ERRO NA COMPILAÇÃO
    echo ================================================================
    echo.
    echo Verifique os erros acima.
    echo.
)

pause


