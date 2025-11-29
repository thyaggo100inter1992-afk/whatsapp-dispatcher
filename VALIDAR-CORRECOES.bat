@echo off
chcp 65001 >nul
echo.
echo ═══════════════════════════════════════════════════════════
echo    🧪 VALIDAÇÃO DAS CORREÇÕES - QR CODE UAZ
echo ═══════════════════════════════════════════════════════════
echo.

echo 📋 Verificando status do backend...
echo.
curl -s http://localhost:5000/health >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Backend não está rodando!
    echo.
    echo 💡 Execute: .\3-iniciar-backend.bat
    echo.
    pause
    exit /b 1
)
echo ✅ Backend está rodando!
echo.

echo ═══════════════════════════════════════════════════════════
echo    📊 VERIFICANDO INSTÂNCIAS NO BANCO DE DADOS
echo ═══════════════════════════════════════════════════════════
echo.
cd backend
call npx ts-node -e "const { Pool } = require('pg'); require('dotenv').config(); const pool = new Pool({ connectionString: process.env.DATABASE_URL }); pool.query('SELECT id, name, is_connected, status, phone_number FROM uaz_instances ORDER BY id DESC LIMIT 5').then(r => { console.log('\n📊 Instâncias UAZ:\n'); if (r.rows.length === 0) { console.log('❌ Nenhuma instância encontrada. Crie uma em: http://localhost:3000/configuracoes-uaz\n'); } else { r.rows.forEach(inst => { const statusIcon = inst.is_connected ? '✅' : '⏸️'; console.log(`${statusIcon} ID: ${inst.id} | Nome: ${inst.name}`); console.log(`   Status: ${inst.status} | Conectado: ${inst.is_connected}`); console.log(`   Telefone: ${inst.phone_number || 'N/A'}`); console.log(''); }); } process.exit(0); }).catch(e => { console.error('❌ Erro:', e.message); process.exit(1); });"
cd ..
echo.

echo ═══════════════════════════════════════════════════════════
echo    🔍 VERIFICANDO ARQUIVOS MODIFICADOS
echo ═══════════════════════════════════════════════════════════
echo.

echo Checando frontend/src/pages/uaz/qr-code.tsx...
findstr /C:"qr.length > 0" frontend\src\pages\uaz\qr-code.tsx >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Validação de QR code não-vazio implementada
) else (
    echo ❌ Validação de QR code não encontrada
)

findstr /C:"response.data.connected || response.data.loggedIn" frontend\src\pages\uaz\qr-code.tsx >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Detecção de instância conectada implementada
) else (
    echo ❌ Detecção de conexão não encontrada
)

findstr /C:"error.response?.status === 409" frontend\src\pages\uaz\qr-code.tsx >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Tratamento de erro 409 implementado
) else (
    echo ❌ Tratamento de erro 409 não encontrado
)

echo.
echo Checando backend/src/routes/uaz.js...
findstr /C:"is_connected = $3" backend\src\routes\uaz.js >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Atualização de is_connected no banco implementada
) else (
    echo ❌ Atualização de is_connected não encontrada
)

findstr /C:"last_connected_at = CASE" backend\src\routes\uaz.js >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Atualização de last_connected_at implementada
) else (
    echo ❌ Atualização de last_connected_at não encontrada
)

echo.
echo ═══════════════════════════════════════════════════════════
echo    🚀 PRÓXIMOS PASSOS
echo ═══════════════════════════════════════════════════════════
echo.
echo 1. Acesse: http://localhost:3000
echo 2. Clique em "WhatsApp QR Code (UAZ)"
echo 3. Crie uma nova instância (se ainda não tiver)
echo 4. Clique em "🔗 Gerar QR Code"
echo 5. Pressione F12 e vá na aba Console
echo 6. Verifique os logs:
echo.
echo    ✅ Esperado quando NÃO conectado:
echo       📋 Response completa da API: {success: true, qrcode: "data:image/...", connected: false}
echo       🔍 QR Code recebido: data:image/png;base64,...
echo       ✅ QR Code válido, definindo no estado
echo.
echo    ✅ Esperado quando JÁ conectado:
echo       📋 Response completa da API: {success: true, connected: true, loggedIn: true}
echo       ✅ Instância já conectada! Atualizando estado...
echo.
echo    ❌ NÃO deve aparecer mais:
echo       ❌ QR Code inválido: undefined
echo.
echo 📖 Para mais detalhes, veja:
echo    - RESUMO-CORRECOES-QRCODE.md
echo    - TESTE-QRCODE-CORRIGIDO.md
echo.
pause

