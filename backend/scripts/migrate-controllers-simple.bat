@echo off
setlocal enabledelayedexpansion

echo ============================================================
echo MIGRACAO AUTOMATICA DE CONTROLLERS PARA MULTI-TENANT
echo ============================================================
echo.

set BACKUP_DIR=controller-backups-%date:~-4%%date:~3,2%%date:~0,2%-%time:~0,2%%time:~3,2%%time:~6,2%
set BACKUP_DIR=%BACKUP_DIR: =0%

echo Criando backup em: %BACKUP_DIR%
mkdir "%BACKUP_DIR%" 2>nul
echo.

set count=0

echo [1/12] Migrando: bulk-profile.controller.ts
set /a count+=1
if exist "..\src\controllers\bulk-profile.controller.ts" (
    copy "..\src\controllers\bulk-profile.controller.ts" "%BACKUP_DIR%\" >nul 2>&1
    powershell -Command "(Get-Content '..\src\controllers\bulk-profile.controller.ts') -replace \"import { query } from '../database/connection';\", \"import { tenantQuery } from '../database/tenant-query';\" -replace 'await query\(', 'await tenantQuery(req, ' | Set-Content '..\src\controllers\bulk-profile.controller.ts'"
    echo    [OK] Migrado
) else (
    echo    [SKIP] Arquivo nao encontrado
)
echo.

echo [2/12] Migrando: template.controller.ts
set /a count+=1
if exist "..\src\controllers\template.controller.ts" (
    copy "..\src\controllers\template.controller.ts" "%BACKUP_DIR%\" >nul 2>&1
    powershell -Command "(Get-Content '..\src\controllers\template.controller.ts') -replace \"import { query } from '../database/connection';\", \"import { tenantQuery } from '../database/tenant-query';\" -replace 'await query\(', 'await tenantQuery(req, ' | Set-Content '..\src\controllers\template.controller.ts'"
    echo    [OK] Migrado
) else (
    echo    [SKIP] Arquivo nao encontrado
)
echo.

echo [3/12] Migrando: analytics.controller.ts
set /a count+=1
if exist "..\src\controllers\analytics.controller.ts" (
    copy "..\src\controllers\analytics.controller.ts" "%BACKUP_DIR%\" >nul 2>&1
    powershell -Command "(Get-Content '..\src\controllers\analytics.controller.ts') -replace \"import { query } from '../database/connection';\", \"import { tenantQuery } from '../database/tenant-query';\" -replace 'await query\(', 'await tenantQuery(req, ' | Set-Content '..\src\controllers\analytics.controller.ts'"
    echo    [OK] Migrado
) else (
    echo    [SKIP] Arquivo nao encontrado
)
echo.

echo ============================================================
echo MIGRACAO CONCLUIDA!
echo ============================================================
echo.
echo [OK] Backups salvos em: %BACKUP_DIR%
echo [!!] REVISE os arquivos manualmente
echo [+]  Adicione tenant_id nos INSERTs
echo.
echo Consulte: INSTRUCOES-MIGRACAO-POR-CONTROLLER.md
echo.
pause





