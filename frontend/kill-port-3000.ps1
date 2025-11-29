# Script PowerShell para matar processo na porta 3000
Write-Host "🔍 Procurando processos na porta 3000..." -ForegroundColor Cyan

$process = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique

if ($process) {
    Write-Host "✅ Processo encontrado: PID $process" -ForegroundColor Green
    Write-Host "🔪 Matando processo..." -ForegroundColor Yellow
    Stop-Process -Id $process -Force
    Write-Host "✅ Processo encerrado!" -ForegroundColor Green
    Start-Sleep -Seconds 1
} else {
    Write-Host "⚠️  Nenhum processo encontrado na porta 3000" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Pressione qualquer tecla para continuar..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")


