@echo off
chcp 65001 >nul
cls

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║     🔧 CORREÇÃO FRONTEND - REINICIANDO 🔧                ║
echo ║                                                          ║
echo ║  ✅ URL duplicada corrigida (/api/api → /api)            ║
echo ║  ✅ Token JWT sendo enviado automaticamente              ║
echo ║  ✅ Porta 3000 (backend) configurada corretamente        ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

echo ⏳ Aguardando 3 segundos...
timeout /t 3 /nobreak >nul

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 1️⃣  BACKEND (Porta 3000)
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

cd /d "%~dp0backend"
start "✅ BACKEND - Porta 3000" cmd /k "npm run dev"

echo ✅ Backend iniciando...
timeout /t 5 /nobreak >nul

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 2️⃣  FRONTEND (Porta 3001) - CORRIGIDO
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

cd /d "%~dp0frontend"
start "✅ FRONTEND - Token JWT habilitado" cmd /k "npm run dev"

echo ✅ Frontend iniciando...
echo.

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║        ✅ CORREÇÕES APLICADAS! ✅                        ║
echo ║                                                          ║
echo ║  🔧 CORREÇÕES:                                           ║
echo ║     1. URL /api/api → /api (corrigida!)                  ║
echo ║     2. Token JWT enviado automaticamente                 ║
echo ║     3. Interceptor 401 (redireciona para login)          ║
echo ║     4. Porta 3000 configurada                            ║
echo ║                                                          ║
echo ║  ⏳ Aguarde 30 segundos e:                               ║
echo ║                                                          ║
echo ║  1. Faça logout e login novamente                        ║
echo ║  2. Ou limpe o cache: Ctrl + Shift + R                   ║
echo ║  3. Navegue pelas páginas (Configurações, etc)           ║
echo ║                                                          ║
echo ║  ✅ Agora as configurações devem carregar!               ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
pause





