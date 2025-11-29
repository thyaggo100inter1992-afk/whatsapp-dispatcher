# Script para matar o processo na porta 3001 (Windows PowerShell)

Write-Host "🔍 Procurando processo na porta 3001..." -ForegroundColor Yellow

# Encontrar o PID do processo usando a porta 3001
$process = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue

if ($process) {
    $pid = $process.OwningProcess
    Write-Host "✅ Processo encontrado! PID: $pid" -ForegroundColor Green
    
    # Matar o processo
    Write-Host "🔫 Matando processo $pid..." -ForegroundColor Red
    Stop-Process -Id $pid -Force
    
    Write-Host "✅ Processo $pid foi finalizado!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Agora você pode iniciar o backend novamente com: npm run dev" -ForegroundColor Cyan
} else {
    Write-Host "❌ Nenhum processo encontrado na porta 3001" -ForegroundColor Red
    Write-Host "A porta está livre! Você pode iniciar o backend." -ForegroundColor Green
}

Write-Host ""
Write-Host "Pressione qualquer tecla para sair..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")


