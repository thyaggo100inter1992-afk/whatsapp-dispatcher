# ============================================
# SCRIPT 1: PREPARAR PROJETO PARA GITHUB
# Execute este script no PowerShell
# ============================================

$ErrorActionPreference = "SilentlyContinue"

Write-Host "======================================"
Write-Host "🚀 PREPARANDO PROJETO PARA GITHUB"
Write-Host "======================================"
Write-Host ""

$projectPath = "C:\Users\thyag\Videos\NOVO DISPARADOR DE API OFICIAL - 29-11-2025 - 09h33"

Write-Host "📁 Navegando para o projeto..."
Set-Location $projectPath

Write-Host ""
Write-Host "🗑️ REMOVENDO ARQUIVOS GRANDES..."
Write-Host ""

# Remover node_modules
Write-Host "⏳ Removendo backend/node_modules..."
Remove-Item -Recurse -Force "backend\node_modules" -ErrorAction SilentlyContinue
Write-Host "✅ backend/node_modules removido"

Write-Host "⏳ Removendo frontend/node_modules..."
Remove-Item -Recurse -Force "frontend\node_modules" -ErrorAction SilentlyContinue
Write-Host "✅ frontend/node_modules removido"

# Remover compilados
Write-Host "⏳ Removendo backend/dist..."
Remove-Item -Recurse -Force "backend\dist" -ErrorAction SilentlyContinue
Write-Host "✅ backend/dist removido"

Write-Host "⏳ Removendo frontend/.next..."
Remove-Item -Recurse -Force "frontend\.next" -ErrorAction SilentlyContinue
Write-Host "✅ frontend/.next removido"

Write-Host "⏳ Removendo frontend/out..."
Remove-Item -Recurse -Force "frontend\out" -ErrorAction SilentlyContinue
Write-Host "✅ frontend/out removido"

# Remover backups
Write-Host "⏳ Removendo backup-catalogo..."
Remove-Item -Recurse -Force "backup-catalogo" -ErrorAction SilentlyContinue
Write-Host "✅ backup-catalogo removido"

Write-Host ""
Write-Host "✅ LIMPEZA CONCLUÍDA!"
Write-Host ""
Write-Host "📊 Tamanho estimado agora: ~50-70 MB"
Write-Host ""
Write-Host "======================================"
Write-Host "✅ PROJETO PRONTO PARA O GIT!"
Write-Host "======================================"
Write-Host ""
Write-Host "⏭️ PRÓXIMO PASSO:"
Write-Host "Execute o script: 2-INICIALIZAR-GIT.ps1"
Write-Host ""

Pause

