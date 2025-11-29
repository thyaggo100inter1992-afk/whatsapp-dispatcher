@echo off
chcp 65001 >nul
cls

echo ╔═══════════════════════════════════════════════════════════════╗
echo ║                                                                 ║
echo ║    🔍 DIAGNÓSTICO: Sistema de Credenciais WhatsApp            ║
echo ║                                                                 ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.
echo Este script vai executar um diagnóstico completo do sistema
echo de credenciais para identificar problemas.
echo.
echo ═══════════════════════════════════════════════════════════════
echo CONFIGURAÇÃO DO BANCO DE DADOS
echo ═══════════════════════════════════════════════════════════════
echo.

set /p PGHOST="Host do PostgreSQL [localhost]: " || set PGHOST=localhost
set /p PGPORT="Porta [5432]: " || set PGPORT=5432
set /p PGDATABASE="Nome do Banco de Dados: "
set /p PGUSER="Usuário [postgres]: " || set PGUSER=postgres
set /p PGPASSWORD="Senha: "

echo.
echo ═══════════════════════════════════════════════════════════════
echo EXECUTANDO DIAGNÓSTICO...
echo ═══════════════════════════════════════════════════════════════
echo.

psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f DIAGNOSTICO-EXECUTAR-AGORA.sql

echo.
echo ═══════════════════════════════════════════════════════════════
echo ✅ DIAGNÓSTICO CONCLUÍDO!
echo ═══════════════════════════════════════════════════════════════
echo.
echo Analise os resultados acima.
echo.
echo Se houver problemas identificados, execute os scripts de correção:
echo   1. CORRIGIR-TENANTS-SEM-CREDENCIAL.sql
echo   2. CORRIGIR-INSTANCIAS-SEM-CREDENCIAL.sql
echo.
echo Você também pode acessar a página de diagnóstico visual:
echo   http://localhost:3000/diagnostic/credentials
echo.
pause






