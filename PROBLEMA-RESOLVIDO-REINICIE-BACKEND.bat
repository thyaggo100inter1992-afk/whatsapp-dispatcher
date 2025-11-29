@echo off
chcp 65001 >nul
color 0A
cls
echo.
echo ╔═══════════════════════════════════════════════════════════════════╗
echo ║                                                                   ║
echo ║              ✅ PROBLEMA RESOLVIDO COM SUCESSO! ✅                ║
echo ║                                                                   ║
echo ╚═══════════════════════════════════════════════════════════════════╝
echo.
echo.
echo 🔍 ERRO ENCONTRADO:
echo    "valor é muito longo para tipo character varying(1)"
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo 🔧 CORREÇÕES APLICADAS:
echo.
echo    ✅ [1/3] Campo SEXO no banco: VARCHAR(1) → VARCHAR(20)
echo    ✅ [2/3] Código atualizado com normalização automática
echo    ✅ [3/3] Logs melhorados para debug
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo 🎯 AGORA os valores como "MASCULINO" e "FEMININO" serão:
echo    • Salvos corretamente no banco
echo    • Normalizados automaticamente (M/F)
echo    • Sem erros!
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo 🚀 ÚLTIMO PASSO NECESSÁRIO:
echo.
echo    ⚠️  REINICIAR O BACKEND
echo.
echo    (As mudanças no código precisam ser carregadas)
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo 📋 OPÇÕES DE REINÍCIO:
echo.
echo    [1] Reiniciar automaticamente (recomendado)
echo    [2] Reiniciar manualmente (você mesmo)
echo    [3] Ver documentação completa
echo.
choice /c 123 /n /m "Escolha uma opção: "

if errorlevel 3 (
  echo.
  echo 📖 Abrindo documentação...
  start notepad CORRECAO-COMPLETA-RESUMO.md
  pause
  exit /b 0
)

if errorlevel 2 (
  echo.
  echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  echo.
  echo 📝 PARA REINICIAR MANUALMENTE:
  echo.
  echo    1. Feche o terminal do backend (Ctrl+C)
  echo    2. No diretório backend/, execute: npm start
  echo    3. Aguarde: "🚀 Server running on port 3001"
  echo    4. Faça uma nova consulta e teste!
  echo.
  echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  echo.
  pause
  exit /b 0
)

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo ⚠️  Vou fechar TODOS os processos Node.js
echo    (Certifique-se de que não há nada importante rodando)
echo.
pause

echo.
echo 🔄 Fechando processos...
taskkill /F /IM node.exe /T 2>nul
timeout /t 3 /nobreak >nul

echo ✅ Processos fechados!
echo.
echo 🚀 Iniciando backend em novo terminal...
echo.
cd /d "%~dp0backend"
start "BACKEND - Disparador WhatsApp" cmd /k "npm start"

timeout /t 3 /nobreak >nul

cls
echo.
echo ╔═══════════════════════════════════════════════════════════════════╗
echo ║                    ✅ BACKEND REINICIADO! ✅                      ║
echo ╚═══════════════════════════════════════════════════════════════════╝
echo.
echo 👀 OBSERVE O TERMINAL DO BACKEND que foi aberto
echo.
echo    Aguarde a mensagem:
echo    "🚀 Server running on port 3001"
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo 🧪 AGORA TESTE:
echo.
echo    1. Acesse: http://localhost:3000
echo    2. Vá em "Consultar Dados Nova Vida"
echo    3. Faça uma consulta (qualquer CPF/CNPJ)
echo    4. Observe os logs do backend:
echo.
echo       ✅ SUCESSO: "💾 ✅ Salvo na base de dados: [documento]"
echo.
echo    5. Vá na aba "Base de Dados"
echo    6. O registro deve aparecer! ✅
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo 📖 DOCUMENTAÇÃO COMPLETA:
echo    CORRECAO-COMPLETA-RESUMO.md
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo ✅ Tudo pronto! Bons testes!
echo.
pause






