@echo off
chcp 65001 >nul
cls

echo ═══════════════════════════════════════════════════════════
echo 🚀 EXECUTAR FASE 1 - MULTI-TENANT
echo ═══════════════════════════════════════════════════════════
echo.
echo ⚠️  ATENÇÃO: Esta operação irá modificar o banco de dados!
echo.
echo Certifique-se de que:
echo   ✅ Você leu a documentação
echo   ✅ O backend está PARADO
echo   ✅ Ninguém está usando o sistema
echo.
echo ═══════════════════════════════════════════════════════════
echo.

pause

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo PASSO 1: BACKUP DO BANCO DE DADOS
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

cd backend
call scripts\backup-before-migration.bat

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ ERRO ao criar backup!
    echo ⚠️  NÃO PROSSIGA SEM BACKUP!
    echo.
    pause
    exit /b 1
)

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo PASSO 2: APLICAR MIGRATIONS
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

node src\scripts\apply-multi-tenant-migration.js

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ═══════════════════════════════════════════════════════════
    echo ✅ FASE 1 APLICADA COM SUCESSO!
    echo ═══════════════════════════════════════════════════════════
    echo.
    echo 🎉 Parabéns! O banco de dados está pronto!
    echo.
    echo 📊 Resumo:
    echo   ✅ Tabelas de controle criadas
    echo   ✅ tenant_id adicionado em todas as tabelas
    echo   ✅ Seus dados preservados no Tenant 1
    echo   ✅ Índices criados
    echo   ✅ Row Level Security habilitado
    echo.
    echo 🔐 Credenciais de acesso:
    echo   Email: admin@minhaempresa.com
    echo   Senha: admin123
    echo   ⚠️  ALTERE A SENHA APÓS O PRIMEIRO LOGIN!
    echo.
    echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    echo ➡️  PRÓXIMA FASE:
    echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    echo.
    echo A Fase 2 (Autenticação e Middleware) será implementada agora.
    echo.
    echo ⚠️  NÃO REINICIE O BACKEND AINDA!
    echo    Aguarde a conclusão da Fase 2.
    echo.
) else (
    echo.
    echo ═══════════════════════════════════════════════════════════
    echo ❌ ERRO AO APLICAR FASE 1
    echo ═══════════════════════════════════════════════════════════
    echo.
    echo ⚠️  O banco pode estar em estado inconsistente!
    echo.
    echo Para restaurar o backup:
    echo   1. Encontre o arquivo de backup em backend\backups\
    echo   2. Execute:
    echo      psql -h localhost -U postgres -d whatsapp_dispatcher ^< backups\backup_before_multi_tenant_XXXXX.sql
    echo.
    echo Substitua XXXXX pelo timestamp do seu backup.
    echo.
)

echo.
pause





