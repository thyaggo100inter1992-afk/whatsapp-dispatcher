# ============================================
# SCRIPT 3: ENVIAR PARA GITHUB
# Execute DEPOIS de criar o repositório no GitHub
# ============================================

$ErrorActionPreference = "Stop"

Write-Host "======================================"
Write-Host "🚀 ENVIANDO PARA GITHUB"
Write-Host "======================================"
Write-Host ""

$projectPath = "C:\Users\thyag\Videos\NOVO DISPARADOR DE API OFICIAL - 29-11-2025 - 09h33"

Write-Host "📁 Navegando para o projeto..."
Set-Location $projectPath

Write-Host ""
Write-Host "======================================"
Write-Host "⚠️ ANTES DE CONTINUAR"
Write-Host "======================================"
Write-Host ""
Write-Host "Você JÁ criou o repositório no GitHub?"
Write-Host "https://github.com/new"
Write-Host ""
$resposta = Read-Host "Digite 's' para continuar ou 'n' para cancelar"

if ($resposta -ne "s") {
    Write-Host ""
    Write-Host "❌ Cancelado!"
    Write-Host ""
    Write-Host "Crie o repositório primeiro em:"
    Write-Host "https://github.com/new"
    Write-Host ""
    Pause
    exit
}

Write-Host ""
Write-Host "======================================"
Write-Host "📝 CONFIGURAÇÃO DO GITHUB"
Write-Host "======================================"
Write-Host ""

$usuario = Read-Host "Digite seu USUÁRIO do GitHub"

Write-Host ""
Write-Host "======================================"
Write-Host "🔗 Conectando com GitHub..."
Write-Host "======================================"
Write-Host ""

# Configurar remote
$repoUrl = "https://github.com/$usuario/whatsapp-dispatcher.git"
Write-Host "URL do repositório: $repoUrl"
Write-Host ""

try {
    git remote add origin $repoUrl
    Write-Host "✅ Remote 'origin' adicionado"
} catch {
    Write-Host "⚠️ Remote 'origin' já existe, atualizando..."
    git remote set-url origin $repoUrl
    Write-Host "✅ Remote 'origin' atualizado"
}

Write-Host ""
Write-Host "======================================"
Write-Host "🌳 Criando branch 'main'..."
Write-Host "======================================"
Write-Host ""

git branch -M main
Write-Host "✅ Branch 'main' criada"

Write-Host ""
Write-Host "======================================"
Write-Host "📤 ENVIANDO CÓDIGO PARA GITHUB..."
Write-Host "======================================"
Write-Host ""
Write-Host "⚠️ ATENÇÃO:"
Write-Host "Vai pedir seu USUÁRIO e TOKEN do GitHub"
Write-Host ""
Write-Host "NÃO USE SUA SENHA! Use um Personal Access Token:"
Write-Host "https://github.com/settings/tokens"
Write-Host ""
Write-Host "Pressione Enter para continuar..."
Read-Host

git push -u origin main

Write-Host ""
Write-Host "======================================"
Write-Host "🎉 CÓDIGO ENVIADO COM SUCESSO!"
Write-Host "======================================"
Write-Host ""
Write-Host "Seu repositório está em:"
Write-Host "https://github.com/$usuario/whatsapp-dispatcher"
Write-Host ""
Write-Host "======================================"
Write-Host "⏭️ PRÓXIMO PASSO: SERVIDOR"
Write-Host "======================================"
Write-Host ""
Write-Host "Abra o arquivo: 4-COMANDOS-SERVIDOR.txt"
Write-Host "E execute os comandos no servidor"
Write-Host ""

Pause

