# Script PowerShell para iniciar o backend

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  INICIANDO BACKEND COM LIMITE CORRIGIDO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Finalizar processos na porta 3001
Write-Host "Verificando porta 3001..." -ForegroundColor Yellow
$processes = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique

if ($processes) {
    Write-Host "Finalizando processos antigos..." -ForegroundColor Yellow
    foreach ($pid in $processes) {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        Write-Host "  Processo $pid finalizado" -ForegroundColor Green
    }
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "Iniciando backend..." -ForegroundColor Green
Write-Host ""

# Ir para a pasta backend e iniciar
Set-Location backend
npm run dev





