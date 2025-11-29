@echo off
chcp 65001 >nul
color 0B
cls
echo.
echo ╔═══════════════════════════════════════════════════════════════════╗
echo ║                                                                   ║
echo ║     🔧 RESOLVER: Consultas não salvam na Base de Dados           ║
echo ║                                                                   ║
echo ╚═══════════════════════════════════════════════════════════════════╝
echo.
echo 📋 PROBLEMA IDENTIFICADO:
echo    As consultas estão funcionando, mas os dados não aparecem
echo    automaticamente na aba "Base de Dados".
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo 🔍 CAUSA:
echo    A tabela "base_dados_completa" pode não existir ou estar incorreta.
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo ✅ SOLUÇÃO AUTOMÁTICA EM 3 PASSOS:
echo.
echo    [1/3] Criar/Verificar tabela no banco de dados
echo    [2/3] Reiniciar backend com logs melhorados
echo    [3/3] Testar funcionamento
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
pause

cls
echo.
echo ╔═══════════════════════════════════════════════════════════════════╗
echo ║                   [1/3] CRIANDO TABELA                            ║
echo ╚═══════════════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0backend"
echo 📋 Verificando banco de dados...
echo.
node aplicar-base-dados-completa.js

if %errorlevel% neq 0 (
  echo.
  echo ❌ ERRO ao criar tabela!
  echo.
  echo 💡 POSSÍVEIS CAUSAS:
  echo    • PostgreSQL não está rodando
  echo    • Credenciais incorretas no arquivo .env
  echo    • Banco de dados não existe
  echo.
  pause
  exit /b 1
)

echo.
echo ✅ Tabela criada/verificada com sucesso!
echo.
timeout /t 3 /nobreak >nul

cls
echo.
echo ╔═══════════════════════════════════════════════════════════════════╗
echo ║                [2/3] REINICIANDO BACKEND                          ║
echo ╚═══════════════════════════════════════════════════════════════════╝
echo.
echo ⚠️  ATENÇÃO: Feche o terminal do backend se estiver aberto (Ctrl+C)
echo.
pause

echo.
echo 🔄 Limpando cache e recompilando...
cd /d "%~dp0backend"
if exist dist rmdir /s /q dist
call npm run build

if %errorlevel% neq 0 (
  echo.
  echo ❌ Erro ao compilar!
  pause
  exit /b 1
)

echo.
echo ✅ Compilação concluída!
echo.
echo 🚀 Agora vou iniciar o backend...
echo    (Deixe este terminal aberto e observe os logs)
echo.
timeout /t 3 /nobreak >nul

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo 👀 OBSERVE OS LOGS ABAIXO:
echo.
echo    ✅ FUNCIONANDO: "💾 ✅ Salvo na base de dados: [documento]"
echo    ❌ COM ERRO: "❌ ERRO ao salvar na base de dados"
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

start cmd /k "cd /d "%~dp0backend" && npm start"

timeout /t 5 /nobreak >nul

cls
echo.
echo ╔═══════════════════════════════════════════════════════════════════╗
echo ║                   [3/3] TESTAR FUNCIONAMENTO                      ║
echo ╚═══════════════════════════════════════════════════════════════════╝
echo.
echo 🧪 PASSOS PARA TESTAR:
echo.
echo    1. Aguarde o backend iniciar completamente
echo       (mensagem: "🚀 Server running on port 3001")
echo.
echo    2. Abra o frontend: http://localhost:3000
echo.
echo    3. Vá em: "Consultar Dados Nova Vida"
echo.
echo    4. Faça uma consulta de teste (qualquer CPF/CNPJ)
echo.
echo    5. Clique na aba "Base de Dados"
echo.
echo    6. O registro deve aparecer automaticamente! ✅
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo 👀 NO CONSOLE DO BACKEND, VOCÊ DEVE VER:
echo.
echo    📋 Nova consulta: [documento]
echo    💾 Salvando na base de dados completa...
echo    💾 ✅ Salvo na base de dados: [documento]
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo 📖 PARA MAIS DETALHES:
echo    Leia: CORRIGIR-BASE-DADOS-AUTOMATICA.md
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo ✅ Correção aplicada com sucesso!
echo.
pause






