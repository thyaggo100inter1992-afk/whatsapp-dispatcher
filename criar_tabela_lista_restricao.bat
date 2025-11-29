@echo off
echo.
echo ========================================
echo CRIANDO TABELA LISTA_RESTRICAO
echo ========================================
echo.

REM Verificar se PostgreSQL está instalado
where psql >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERRO: PostgreSQL nao encontrado!
    echo Instale o PostgreSQL ou adicione ao PATH
    echo.
    pause
    exit /b 1
)

echo Digite as informacoes do banco de dados:
echo.

set /p DB_HOST="Host (default: localhost): "
if "%DB_HOST%"=="" set DB_HOST=localhost

set /p DB_PORT="Porta (default: 5432): "
if "%DB_PORT%"=="" set DB_PORT=5432

set /p DB_NAME="Nome do banco: "
if "%DB_NAME%"=="" (
    echo ERRO: Nome do banco e obrigatorio!
    pause
    exit /b 1
)

set /p DB_USER="Usuario: "
if "%DB_USER%"=="" (
    echo ERRO: Usuario e obrigatorio!
    pause
    exit /b 1
)

echo.
echo Conectando ao banco: %DB_NAME% em %DB_HOST%:%DB_PORT%
echo Usuario: %DB_USER%
echo.

REM Executar SQL
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f backend\src\database\migrations\criar_tabela_lista_restricao.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo TABELA CRIADA COM SUCESSO!
    echo ========================================
    echo.
    echo Agora voce pode:
    echo   1. Recarregar o navegador (F5)
    echo   2. Adicionar CPFs na Lista de Restricao
    echo.
) else (
    echo.
    echo ========================================
    echo ERRO AO CRIAR TABELA!
    echo ========================================
    echo Verifique:
    echo   - Credenciais do banco
    echo   - Permissoes do usuario
    echo   - Conexao com o banco
    echo.
)

pause





