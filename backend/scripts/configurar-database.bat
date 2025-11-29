@echo off
REM Script para Configurar DATABASE_URL automaticamente

echo.
echo ============================================================
echo CONFIGURACAO AUTOMATICA DO DATABASE_URL
echo ============================================================
echo.

cd /d "%~dp0\.."

echo Verificando arquivo .env...
echo.

REM Verificar se .env existe
if not exist ".env" (
    echo Criando arquivo .env...
    (
        echo # ============================================
        echo # BANCO DE DADOS
        echo # ============================================
        echo DATABASE_URL=postgresql://postgres:Tg130992*@localhost:5432/whatsapp_dispatcher
        echo.
        echo # ============================================
        echo # AUTENTICACAO
        echo # ============================================
        echo JWT_SECRET=seu_jwt_secret_aqui_minimo_32_caracteres_para_seguranca_maxima
        echo JWT_REFRESH_SECRET=seu_refresh_secret_aqui_minimo_32_caracteres
        echo.
        echo # ============================================
        echo # CRIPTOGRAFIA
        echo # ============================================
        echo ENCRYPTION_KEY=sua_chave_de_32_caracteres_aqui_para_criptografia
        echo.
        echo # ============================================
        echo # SERVIDOR
        echo # ============================================
        echo PORT=3000
        echo NODE_ENV=development
    ) > .env
    echo [OK] Arquivo .env criado!
) else (
    echo [OK] Arquivo .env ja existe
    echo.
    echo Verificando DATABASE_URL...
    
    REM Verificar se DATABASE_URL já existe
    findstr /C:"DATABASE_URL=" .env >nul 2>&1
    if errorlevel 1 (
        echo.
        echo DATABASE_URL nao encontrada, adicionando...
        echo DATABASE_URL=postgresql://postgres:Tg130992*@localhost:5432/whatsapp_dispatcher >> .env
        echo [OK] DATABASE_URL adicionada!
    ) else (
        echo [OK] DATABASE_URL ja configurada!
        echo.
        echo Deseja substituir? (S/N)
        set /p resposta=
        if /i "%resposta%"=="S" (
            echo.
            echo Atualizando DATABASE_URL...
            powershell -Command "(Get-Content .env) -replace '^DATABASE_URL=.*', 'DATABASE_URL=postgresql://postgres:Tg130992*@localhost:5432/whatsapp_dispatcher' | Set-Content .env"
            echo [OK] DATABASE_URL atualizada!
        ) else (
            echo [OK] Mantendo configuracao existente
        )
    )
)

echo.
echo ============================================================
echo CONFIGURACAO CONCLUIDA!
echo ============================================================
echo.
echo DATABASE_URL configurada para:
echo postgresql://postgres:Tg130992*@localhost:5432/whatsapp_dispatcher
echo.
echo Proximo passo:
echo 1. Verificar se PostgreSQL esta rodando
echo 2. Executar: node src\scripts\apply-multi-tenant-migration.js
echo 3. Executar: node scripts\verificacao-completa.js
echo.
echo ============================================================
echo.

pause





