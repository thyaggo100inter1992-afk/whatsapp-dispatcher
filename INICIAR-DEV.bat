@echo off
chcp 65001 >nul
echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║        🚀 INICIANDO SISTEMA (MODO DEV) 🚀                ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 1️⃣  INICIANDO BACKEND DEV (Porta 3000)
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

cd backend
start "Backend DEV - Porta 3000" cmd /k "npm run dev"
cd ..

echo ✅ Backend DEV iniciando na porta 3000...
echo.

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
echo ║        ✅ SISTEMA DEV INICIADO! ✅                       ║
echo ║                                                          ║
echo ║  🔧 Backend DEV:  http://localhost:3000                  ║
echo ║  🌐 Frontend:     http://localhost:3001                  ║
echo ║                                                          ║
echo ║  ⚠️  Aguarde 15-20 segundos para compilação...            ║
echo ║                                                          ║
echo ║  📄 Acesse: http://localhost:3001/login                  ║
echo ║  📧 Email: admin@minhaempresa.com                        ║
echo ║  🔑 Senha: admin123                                      ║
echo ║                                                          ║
echo ║  💡 Modo DEV: Hotreload ativo!                           ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
echo Aguardando 5 segundos...
timeout /t 5 >nul
echo.
echo 🔍 Verificando se os serviços iniciaram...
cd backend
node scripts/verificar-e-esperar.js
cd ..
echo.
echo Pressione qualquer tecla para fechar...
pause >nul





