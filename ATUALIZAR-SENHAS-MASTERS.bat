@echo off
chcp 65001 > nul
color 0E
cls

echo.
echo ═══════════════════════════════════════════════════════════════
echo   🔐 ATUALIZAR SENHAS DOS USUÁRIOS MASTER EXISTENTES
echo ═══════════════════════════════════════════════════════════════
echo.
echo   Este script atualiza a senha de TODOS os usuários master
echo   existentes para a nova senha padrão.
echo.
echo   Nova senha: master123@nettsistemas
echo.
echo ═══════════════════════════════════════════════════════════════
echo.

cd backend

echo 📋 Verificando usuários master que serão atualizados...
echo.
node atualizar-senha-masters.js

echo.
echo ═══════════════════════════════════════════════════════════════
echo.
echo Para confirmar e executar a atualização, pressione qualquer tecla.
echo Para cancelar, feche esta janela.
echo.
pause

echo.
echo 🔄 Executando atualização...
echo.
node atualizar-senha-masters.js --confirmar

echo.
echo ═══════════════════════════════════════════════════════════════
echo   ✅ PROCESSO CONCLUÍDO
echo ═══════════════════════════════════════════════════════════════
echo.
echo   Agora você pode fazer login com:
echo   - Email: {ID}@NETTSISTEMAS.COM.BR
echo   - Senha: master123@nettsistemas
echo.
echo ═══════════════════════════════════════════════════════════════
echo.

cd ..

pause


