@echo off
chcp 65001 > nul
color 0C
echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║         🔬 TESTE DIRETO - QUERY SQL NO BANCO DE DADOS        ║
echo ╔═══════════════════════════════════════════════════════════════╗
echo.
echo 🎯 Este teste vai executar a query SQL DIRETAMENTE no banco
echo    para verificar se a lógica está correta!
echo.
echo ⏳ Reiniciando backend...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul
echo.
echo 🚀 Iniciando backend...
cd backend
start "Backend - TESTE SQL" cmd /k "npm start"
timeout /t 5 /nobreak >nul
echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║                    ✅ BACKEND INICIADO                        ║
echo ╔═══════════════════════════════════════════════════════════════╗
echo.
echo 🔬 EXECUTANDO TESTE DIRETO...
echo.
timeout /t 2 /nobreak >nul
echo.
echo 📞 Testando telefone: 62994396869
curl -s http://localhost:3001/api/base-dados/teste-busca-telefone/62994396869
echo.
echo.
echo ════════════════════════════════════════════════════════════════
echo.
echo 📞 Testando telefone: 62993204885
curl -s http://localhost:3001/api/base-dados/teste-busca-telefone/62993204885
echo.
echo.
echo ════════════════════════════════════════════════════════════════
echo.
echo 📞 Testando telefone: 62998562593
curl -s http://localhost:3001/api/base-dados/teste-busca-telefone/62998562593
echo.
echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║              👀 VEJA O TERMINAL DO BACKEND                    ║
echo ║         Vai mostrar TODOS os testes SQL executados!           ║
echo ╔═══════════════════════════════════════════════════════════════╗
echo.
echo Você verá no backend:
echo   🧪 ===== TESTE DE BUSCA POR TELEFONE =====
echo   📱 Telefone digitado: 62994396869
echo   📱 Telefone (só números): 62994396869
echo   📱 Tamanho: 11
echo   
echo   🔍 SEPARAÇÃO:
echo      DDD: 62
echo      Número: 994396869
echo   
echo   ✅ RESULTADO 1 (DDD E Tel separados): X encontrados
echo   ✅ RESULTADO 2 (Número junto): X encontrados
echo   ✅ RESULTADO 3 (Query completa): X encontrados
echo.
echo ════════════════════════════════════════════════════════════════
pause






