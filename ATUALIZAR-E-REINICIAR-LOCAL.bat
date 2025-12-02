@echo off
chcp 65001 > nul
echo.
echo 🔄 ATUALIZANDO E REINICIANDO SERVIDOR LOCAL
echo ========================================================
echo.

cd backend

echo 🗑️  Limpando pasta dist...
if exist dist rmdir /s /q dist

echo.
echo 🔨 Compilando código TypeScript...
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ ERRO na compilação!
    echo.
    pause
    exit /b 1
)

echo.
echo ✅ Compilação concluída!
echo.
echo 🔄 Reiniciando servidor com PM2...
pm2 restart whatsapp-backend

echo.
echo ✅ Servidor reiniciado!
echo.
echo 🎯 Agora:
echo    1. Recarregue a página de configurações no navegador
echo    2. O status deve mudar para ATIVO! 🟢
echo.
echo ========================================================
echo 🎯 Pressione qualquer tecla para fechar...
pause > nul






