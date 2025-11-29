@echo off
chcp 65001 > nul
echo.
echo ========================================
echo   🧹 LIMPANDO IDs LOCAIS
echo ========================================
echo.
cd backend
node limpar-ids-locais.js
echo.
echo ========================================
echo.
echo ✅ PRONTO!
echo.
echo PRÓXIMOS PASSOS:
echo 1. Reinicie o backend (Ctrl+C e execute 3-iniciar-backend.bat)
echo 2. Pressione F5 no navegador
echo 3. Tente sincronizar novamente
echo.
echo ========================================
pause

