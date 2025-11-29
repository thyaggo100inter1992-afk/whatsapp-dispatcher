@echo off
chcp 65001 >nul
echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║        🚀 INICIANDO SISTEMA MULTI-TENANT 🚀              ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 1️⃣  INICIANDO BACKEND (Porta 3000)
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

start "WhatsApp Backend" cmd /k "cd /d backend && npm start"

echo ✅ Backend iniciado em nova janela
echo.
timeout /t 3 /nobreak >nul

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 2️⃣  INICIANDO FRONTEND (Porta 3001)
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

start "WhatsApp Frontend" cmd /k "cd /d frontend && npm run dev"

echo ✅ Frontend iniciado em nova janela
echo.

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║        ✅ SISTEMA INICIADO COM SUCESSO! ✅               ║
echo ║                                                          ║
echo ║  Aguarde 10-15 segundos para compilação...               ║
echo ║                                                          ║
echo ║  🌐 Frontend: http://localhost:3001                      ║
echo ║  🔧 Backend: http://localhost:3000                       ║
echo ║                                                          ║
echo ║  📄 Login: http://localhost:3001/login                   ║
echo ║  📧 Email: admin@minhaempresa.com                        ║
echo ║  🔑 Senha: admin123                                      ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
echo Pressione qualquer tecla para fechar esta janela...
pause >nul





