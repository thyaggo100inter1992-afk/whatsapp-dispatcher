# Script de Diagnóstico - Sistema de Disparador
# Execute: .\diagnostico.ps1

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DIAGNOSTICO DO SISTEMA" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar Node.js
Write-Host "[1/6] Verificando Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "  ✓ Node.js instalado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Node.js NAO encontrado!" -ForegroundColor Red
    exit 1
}

# 2. Verificar npm
Write-Host "[2/6] Verificando npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "  ✓ npm instalado: v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ npm NAO encontrado!" -ForegroundColor Red
    exit 1
}

# 3. Verificar se backend existe
Write-Host "[3/6] Verificando pasta backend..." -ForegroundColor Yellow
if (Test-Path ".\backend") {
    Write-Host "  ✓ Pasta backend encontrada" -ForegroundColor Green
    
    # Verificar se dist existe
    if (Test-Path ".\backend\dist") {
        Write-Host "  ✓ Backend compilado (dist/ existe)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Backend NAO compilado (dist/ nao existe)" -ForegroundColor Red
        Write-Host "    Execute: cd backend && npm run build" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ✗ Pasta backend NAO encontrada!" -ForegroundColor Red
    exit 1
}

# 4. Verificar se frontend existe
Write-Host "[4/6] Verificando pasta frontend..." -ForegroundColor Yellow
if (Test-Path ".\frontend") {
    Write-Host "  ✓ Pasta frontend encontrada" -ForegroundColor Green
} else {
    Write-Host "  ✗ Pasta frontend NAO encontrada!" -ForegroundColor Red
    exit 1
}

# 5. Verificar porta 3001 (Backend)
Write-Host "[5/6] Verificando porta 3001 (Backend)..." -ForegroundColor Yellow
$backendPort = netstat -ano | Select-String ":3001"
if ($backendPort) {
    Write-Host "  ✓ Backend esta rodando na porta 3001" -ForegroundColor Green
} else {
    Write-Host "  ✗ Backend NAO esta rodando!" -ForegroundColor Red
    Write-Host "    Execute: cd backend && npm start" -ForegroundColor Yellow
}

# 6. Verificar porta 3000 (Frontend)
Write-Host "[6/6] Verificando porta 3000 (Frontend)..." -ForegroundColor Yellow
$frontendPort = netstat -ano | Select-String ":3000"
if ($frontendPort) {
    Write-Host "  ✓ Frontend esta rodando na porta 3000" -ForegroundColor Green
} else {
    Write-Host "  ✗ Frontend NAO esta rodando!" -ForegroundColor Red
    Write-Host "    Execute: cd frontend && npm run dev" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DIAGNOSTICO CONCLUIDO" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Resumo
Write-Host "PROXIMOS PASSOS:" -ForegroundColor Cyan
Write-Host ""

$needsCompile = !(Test-Path ".\backend\dist")
$backendRunning = $backendPort -ne $null
$frontendRunning = $frontendPort -ne $null

if ($needsCompile) {
    Write-Host "1. RECOMPILAR BACKEND:" -ForegroundColor Yellow
    Write-Host "   cd backend" -ForegroundColor White
    Write-Host "   npm run build" -ForegroundColor White
    Write-Host ""
}

if (!$backendRunning) {
    Write-Host "2. INICIAR BACKEND:" -ForegroundColor Yellow
    Write-Host "   cd backend" -ForegroundColor White
    Write-Host "   npm start" -ForegroundColor White
    Write-Host ""
}

if (!$frontendRunning) {
    Write-Host "3. INICIAR FRONTEND:" -ForegroundColor Yellow
    Write-Host "   cd frontend" -ForegroundColor White
    Write-Host "   npm run dev" -ForegroundColor White
    Write-Host ""
}

if (!$needsCompile -and $backendRunning -and $frontendRunning) {
    Write-Host "✓ TUDO FUNCIONANDO!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Acesse: http://localhost:3000/listas-restricao" -ForegroundColor Cyan
}

Write-Host ""





