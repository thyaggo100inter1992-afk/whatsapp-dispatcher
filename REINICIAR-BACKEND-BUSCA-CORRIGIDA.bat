@echo off
chcp 65001 > nul
color 0A
echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║              🔄 REINICIANDO BACKEND - BUSCA CORRIGIDA        ║
echo ╔═══════════════════════════════════════════════════════════════╗
echo.
echo ⏳ Parando backend atual...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul
echo.
echo 🚀 Iniciando backend com correção de busca por telefone...
cd backend
start "Backend - BUSCA POR TELEFONE CORRIGIDA" cmd /k "npm start"
echo.
echo ✅ Backend reiniciado!
echo.
echo 📋 O QUE FOI CORRIGIDO:
echo    ▶ Agora a busca por telefone considera que DDD e número
echo      estão SEPARADOS no banco de dados
echo.
echo    ▶ Busca de 3 formas simultâneas:
echo       1. "ddd":"62" E "telefone":"994396869"
echo       2. "62994396869" (número junto)
echo       3. "5562994396869" (com código 55)
echo.
echo 🧪 TESTE AGORA:
echo    Digite na Busca Rápida: 62994396869
echo    Resultado esperado: ✅ MARIA JOANETA
echo.
echo ════════════════════════════════════════════════════════════════
pause






