@echo off
chcp 65001 >nul
echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║        🚀 INICIANDO SISTEMA - PORTAS CORRETAS 🚀         ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 1️⃣  INICIANDO BACKEND (Porta 3000)
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

cd backend
start "Backend - Porta 3000" cmd /k "npm start"
cd ..

echo ✅ Backend iniciando na porta 3000...
timeout /t 2 >nul

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 2️⃣  INICIANDO FRONTEND (Porta 3001)
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

cd frontend
start "Frontend - Porta 3001" cmd /k "npm run dev"
cd ..

echo ✅ Frontend iniciando na porta 3001...
echo.

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║        ✅ SISTEMA INICIADO! ✅                           ║
echo ║                                                          ║
echo ║  🔧 Backend:  http://localhost:3000                      ║
echo ║  🌐 Frontend: http://localhost:3001                      ║
echo ║                                                          ║
echo ║  Aguarde 15-20 segundos para compilação do Next.js...    ║
echo ║                                                          ║
echo ║  📄 DEPOIS acesse: http://localhost:3001/login           ║
echo ║  📧 Email: admin@minhaempresa.com                        ║
echo ║  🔑 Senha: admin123                                      ║
echo ║                                                          ║
echo ║  ⚠️  IMPORTANTE: Aguarde compilação terminar!            ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
echo Pressione qualquer tecla para fechar...
pause >nul





