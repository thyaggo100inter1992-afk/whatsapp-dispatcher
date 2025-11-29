@echo off
REM Script de Migração Automática de Controllers (Windows)
REM ATENÇÃO: Este script faz mudanças automáticas. Sempre revise manualmente!

echo ============================================================
echo MIGRACAO AUTOMATICA DE CONTROLLERS PARA MULTI-TENANT
echo ============================================================
echo.

SET CONTROLLERS_DIR=..\src\controllers
SET BACKUP_DIR=controller-backups-%DATE:~-4%-%DATE:~3,2%-%DATE:~0,2%-%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%

REM Criar diretório de backup
mkdir "%BACKUP_DIR%" 2>nul
echo Backups serao salvos em: %BACKUP_DIR%
echo.

REM Lista de controllers para migrar
SET "CONTROLLERS=bulk-profile.controller.ts template.controller.ts whatsapp-catalog.controller.ts analytics.controller.ts proxy.controller.ts qr-webhook.controller.ts whatsapp-settings.controller.ts proxy-manager.controller.ts qr-campaign.controller.ts webhook.controller.ts campaign.controller.ts restriction-list.controller.ts"

SET count=0
FOR %%c IN (%CONTROLLERS%) DO (
  SET /A count+=1
  SET filepath=%CONTROLLERS_DIR%\%%c
  
  IF EXIST "!filepath!" (
    echo [!count!/12] Migrando: %%c
    
    REM Backup
    copy "!filepath!" "%BACKUP_DIR%\%%c" >nul
    
    REM Criar arquivo temporário com substituições
    powershell -Command "(Get-Content '!filepath!') -replace \"import { query } from '../database/connection';\", \"import { tenantQuery } from '../database/tenant-query';\" -replace \"import { query } from \`"../database/connection\`";\", \"import { tenantQuery } from '../database/tenant-query';\" -replace 'await query\(', 'await tenantQuery(req, ' | Set-Content '!filepath!.tmp'"
    
    REM Substituir arquivo original
    move /Y "!filepath!.tmp" "!filepath!" >nul
    
    echo    [OK] Import atualizado
    echo    [OK] Queries atualizadas (REVISE MANUALMENTE!)
    echo.
  ) ELSE (
    echo [!count!/12] %%c - NAO ENCONTRADO
  )
)

echo ============================================================
echo MIGRACAO AUTOMATICA CONCLUIDA
echo ============================================================
echo.
echo IMPORTANTE - PROXIMOS PASSOS:
echo.
echo 1. [OK] Backups salvos em: %BACKUP_DIR%
echo 2. [!!] REVISE MANUALMENTE cada controller
echo 3. [+]  Adicione tenant_id nos INSERTs
echo 4. [~]  Converta transacoes para tenantTransaction
echo 5. [?]  Teste com 2 tenants diferentes
echo.
echo Consulte: INSTRUCOES-MIGRACAO-POR-CONTROLLER.md
echo.
echo ============================================================
pause





