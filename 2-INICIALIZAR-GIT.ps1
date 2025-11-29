# ============================================
# SCRIPT 2: INICIALIZAR GIT
# Execute este script no PowerShell
# ============================================

$ErrorActionPreference = "Stop"

Write-Host "======================================"
Write-Host "🐙 INICIALIZANDO GIT"
Write-Host "======================================"
Write-Host ""

$projectPath = "C:\Users\thyag\Videos\NOVO DISPARADOR DE API OFICIAL - 29-11-2025 - 09h33"

Write-Host "📁 Navegando para o projeto..."
Set-Location $projectPath

Write-Host ""
Write-Host "🔍 Verificando se Git está instalado..."

try {
    $gitVersion = git --version
    Write-Host "✅ Git instalado: $gitVersion"
} catch {
    Write-Host "❌ Git NÃO está instalado!"
    Write-Host ""
    Write-Host "Por favor, instale o Git:"
    Write-Host "https://git-scm.com/download/win"
    Write-Host ""
    Pause
    exit
}

Write-Host ""
Write-Host "🎯 Inicializando repositório Git..."

# Verificar se já existe um repositório Git
if (Test-Path ".git") {
    Write-Host "⚠️ Repositório Git já existe!"
    $resposta = Read-Host "Deseja reinicializar? (s/n)"
    if ($resposta -eq "s") {
        Remove-Item -Recurse -Force ".git"
        git init
        Write-Host "✅ Repositório reinicializado"
    }
} else {
    git init
    Write-Host "✅ Repositório Git inicializado"
}

Write-Host ""
Write-Host "📝 Verificando .gitignore..."

if (Test-Path ".gitignore") {
    Write-Host "✅ .gitignore já existe"
} else {
    Write-Host "❌ .gitignore NÃO encontrado"
    Write-Host "⚠️ ATENÇÃO: Certifique-se que o .gitignore existe!"
}

Write-Host ""
Write-Host "➕ Adicionando arquivos ao Git..."
git add .

Write-Host ""
Write-Host "📊 Arquivos que serão enviados:"
git status --short | Select-Object -First 20
Write-Host "..."
Write-Host ""

$totalFiles = (git status --short | Measure-Object).Count
Write-Host "Total de arquivos: $totalFiles"

Write-Host ""
Write-Host "💾 Criando commit inicial..."
git commit -m "Initial commit - Sistema pronto para produção"

Write-Host ""
Write-Host "✅ GIT CONFIGURADO COM SUCESSO!"
Write-Host ""
Write-Host "======================================"
Write-Host "📋 INFORMAÇÕES DO COMMIT"
Write-Host "======================================"
git log --oneline -1
Write-Host ""
Write-Host "======================================"
Write-Host "⏭️ PRÓXIMO PASSO:"
Write-Host "======================================"
Write-Host ""
Write-Host "AGORA VOCÊ PRECISA:"
Write-Host ""
Write-Host "1. Criar repositório no GitHub:"
Write-Host "   https://github.com/new"
Write-Host ""
Write-Host "2. Nome: whatsapp-dispatcher"
Write-Host "3. Privado: SIM"
Write-Host "4. NÃO inicializar com README"
Write-Host ""
Write-Host "5. Depois, execute o script:"
Write-Host "   3-ENVIAR-PARA-GITHUB.ps1"
Write-Host ""

Pause

