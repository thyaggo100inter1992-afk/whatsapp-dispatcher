@echo off
chcp 65001 > nul
color 0A
cls

echo.
echo ═══════════════════════════════════════════════════════════════
echo   🔐 CRIAR USUÁRIOS MASTER FALTANTES
echo ═══════════════════════════════════════════════════════════════
echo.
echo   Este script verifica e cria usuários master para todos os
echo   tenants que ainda não possuem.
echo.
echo   Credenciais criadas:
echo   - Email: {TENANT_ID}@NETTSISTEMAS.COM.BR
echo   - Senha: Tg130992*
echo.
echo ═══════════════════════════════════════════════════════════════
echo.

pause

echo.
echo 📡 Enviando requisição para criar usuários master...
echo.

REM Fazer requisição POST para criar masters faltantes
curl -X POST http://localhost:3001/api/admin/master-users/create-missing ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer SEU_TOKEN_AQUI"

echo.
echo.
echo ═══════════════════════════════════════════════════════════════
echo   ✅ PROCESSO CONCLUÍDO
echo ═══════════════════════════════════════════════════════════════
echo.
echo   IMPORTANTE: 
echo   Para que este script funcione automaticamente, você precisa:
echo.
echo   1. Estar logado como super admin
echo   2. Copiar seu token JWT
echo   3. Editar este arquivo (CRIAR-MASTERS-FALTANTES.bat)
echo   4. Substituir "SEU_TOKEN_AQUI" pelo token real
echo.
echo   OU
echo.
echo   Acesse manualmente: /admin/master-users
echo   E clique no botão "Criar Faltantes"
echo.
echo ═══════════════════════════════════════════════════════════════
echo.

pause


