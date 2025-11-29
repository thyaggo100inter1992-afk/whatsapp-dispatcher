@echo off
chcp 65001 >nul
echo ====================================
echo 🗑️ LIMPEZA DE ARQUIVOS DESNECESSÁRIOS
echo ====================================
echo.
echo Este script vai remover:
echo - Documentação temporária (.md de desenvolvimento)
echo - Scripts de teste (.bat temporários)
echo - Arquivos compilados (dist, .next, node_modules)
echo - Backups antigos
echo.
echo MANTENDO:
echo - Código-fonte (src/)
echo - 4 documentos de instalação
echo - Configurações essenciais
echo.
pause

echo.
echo 📋 Criando backup da lista de arquivos...
dir /b /s > BACKUP-LISTA-ANTES-LIMPEZA.txt
echo ✅ Backup criado: BACKUP-LISTA-ANTES-LIMPEZA.txt
echo.

echo 🗑️ Removendo documentação temporária...

REM Remover documentação temporária com ✅
for %%f in (✅-*.md) do (
    echo Removendo: %%f
    del /q "%%f"
)

REM Remover documentação temporária com 🚀 (EXCETO os 4 essenciais)
for %%f in (🚀-*.md) do (
    if not "%%f"=="🚀-GUIA-RAPIDO-INSTALACAO-DO-ZERO.md" (
        echo Removendo: %%f
        del /q "%%f"
    )
)

REM Remover outros emojis temporários
for %%f in (🎉-*.md 🚨-*.md 👉-*.md 🔍-*.md 📋-*.md ⚠️-*.md 🐛-*.md 🔄-*.md 🎨-*.md 🔧-*.md 🎯-*.md 📊-*.md 📢-*.md) do (
    if exist "%%f" (
        echo Removendo: %%f
        del /q "%%f" 2>nul
    )
)

REM Remover arquivos começando com FASE, CORRECAO, AUDITORIA, etc
for %%f in (FASE-*.md CORRECAO-*.md AUDITORIA-*.md RESUMO-*.md STATUS-*.md IMPLEMENTACAO-*.md SISTEMA-*.md) do (
    if exist "%%f" (
        echo Removendo: %%f
        del /q "%%f" 2>nul
    )
)

echo.
echo 🗑️ Removendo scripts de teste...

REM Remover scripts .bat de teste (MANTENDO apenas os 6 essenciais de inicialização)
for %%f in (TESTAR-*.bat DIAGNOSTICAR-*.bat VERIFICAR-*.bat CORRIGIR-*.bat APLICAR-*.bat DEBUG-*.bat EXECUTAR-*.bat REINICIAR-*.bat INICIAR-*.bat) do (
    if exist "%%f" (
        if not "%%f"=="INICIAR-BACKEND.bat" (
            if not "%%f"=="INICIAR-FRONTEND.bat" (
                if not "%%f"=="REINICIAR.bat" (
                    echo Removendo: %%f
                    del /q "%%f" 2>nul
                )
            )
        )
    )
)

REM Remover kill-port scripts (não necessários em produção)
del /q frontend\kill-port-*.bat 2>nul
del /q backend\kill-port-*.bat 2>nul

echo.
echo 🗑️ Removendo backups...
if exist backup-catalogo (
    echo Removendo pasta: backup-catalogo
    rmdir /s /q backup-catalogo
)

echo.
echo 🗑️ Removendo node_modules...
if exist backend\node_modules (
    echo Removendo: backend\node_modules
    rmdir /s /q backend\node_modules
)
if exist frontend\node_modules (
    echo Removendo: frontend\node_modules
    rmdir /s /q frontend\node_modules
)

echo.
echo 🗑️ Removendo arquivos compilados...
if exist backend\dist (
    echo Removendo: backend\dist
    rmdir /s /q backend\dist
)
if exist frontend\.next (
    echo Removendo: frontend\.next
    rmdir /s /q frontend\.next
)
if exist frontend\out (
    echo Removendo: frontend\out
    rmdir /s /q frontend\out
)

echo.
echo 🗑️ Removendo uploads de teste...
if exist frontend\backend\uploads (
    echo Removendo: frontend\backend\uploads (estrutura duplicada)
    rmdir /s /q frontend\backend
)

echo.
echo 🗑️ Removendo scripts de teste do backend...
cd backend
for %%f in (test-*.js test-*.ts check-*.js check-*.ts debug-*.js debug-*.ts fix-*.js monitor-*.js verify*.js testar-*.js diagnostico-*.js) do (
    if exist "%%f" (
        echo Removendo: backend\%%f
        del /q "%%f" 2>nul
    )
)
cd ..

echo.
echo 🗑️ Removendo arquivos de log e temporários...
del /q *.log 2>nul
del /q backend\*.log 2>nul
del /q frontend\*.log 2>nul
del /q backend\*.txt 2>nul

echo.
echo ✅ LIMPEZA CONCLUÍDA!
echo.
echo 📊 Criando lista final de arquivos...
dir /b /s > LISTA-ARQUIVOS-APOS-LIMPEZA.txt
echo ✅ Lista criada: LISTA-ARQUIVOS-APOS-LIMPEZA.txt
echo.
echo 📁 Estrutura final limpa e pronta para deploy!
echo.
pause

