@echo off
chcp 65001 >nul
cls

echo ============================================
echo 🔒 BACKUP ANTES DA MIGRAÇÃO MULTI-TENANT
echo ============================================
echo.

REM Ler variáveis do .env
for /f "tokens=1,2 delims==" %%a in ('type .env 2^>nul ^| findstr /v "^#"') do (
    if "%%a"=="DB_HOST" set DB_HOST=%%b
    if "%%a"=="DB_PORT" set DB_PORT=%%b
    if "%%a"=="DB_NAME" set DB_NAME=%%b
    if "%%a"=="DB_USER" set DB_USER=%%b
    if "%%a"=="DB_PASSWORD" set DB_PASSWORD=%%b
)

REM Valores padrão se não encontrar no .env
if not defined DB_HOST set DB_HOST=localhost
if not defined DB_PORT set DB_PORT=5432
if not defined DB_NAME set DB_NAME=whatsapp_dispatcher
if not defined DB_USER set DB_USER=postgres

echo 📋 Configurações:
echo    Host: %DB_HOST%
echo    Porta: %DB_PORT%
echo    Banco: %DB_NAME%
echo    Usuário: %DB_USER%
echo.

REM Criar pasta de backups se não existir
if not exist "backups" mkdir backups

REM Nome do arquivo com timestamp
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,8%_%datetime:~8,6%
set BACKUP_FILE=backups\backup_before_multi_tenant_%TIMESTAMP%.sql

echo 📦 Criando backup...
echo    Arquivo: %BACKUP_FILE%
echo.

REM Definir senha como variável de ambiente para pg_dump
set PGPASSWORD=%DB_PASSWORD%

REM Executar pg_dump
pg_dump -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -F p -f %BACKUP_FILE%

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ BACKUP CRIADO COM SUCESSO!
    echo.
    echo 📂 Localização: %BACKUP_FILE%
    
    REM Mostrar tamanho do arquivo
    for %%A in (%BACKUP_FILE%) do (
        set size=%%~zA
        set /a sizeMB=!size! / 1048576
        echo 📊 Tamanho: !sizeMB! MB
    )
    
    echo.
    echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    echo 🔒 BACKUP SEGURO CRIADO!
    echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    echo.
    echo 💡 Para restaurar este backup (se necessário):
    echo    psql -h %DB_HOST% -U %DB_USER% -d %DB_NAME% ^< %BACKUP_FILE%
    echo.
    echo 🚀 Agora você pode prosseguir com a migração!
    echo.
) else (
    echo.
    echo ❌ ERRO AO CRIAR BACKUP!
    echo.
    echo Verifique:
    echo  1. PostgreSQL está instalado e acessível
    echo  2. Credenciais no arquivo .env estão corretas
    echo  3. Banco de dados existe
    echo.
    echo ⚠️ NÃO PROSSIGA COM A MIGRAÇÃO SEM BACKUP!
    echo.
)

REM Limpar variável de senha
set PGPASSWORD=

echo.
pause





