# Script de Migração Automática de Controllers
# PowerShell Script

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  MIGRAÇÃO AUTOMÁTICA DE CONTROLLERS PARA MULTI-TENANT" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$controllersDir = "..\src\controllers"
$backupDir = "controller-backups-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

# Criar diretório de backup
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Write-Host "📁 Backups salvos em: $backupDir" -ForegroundColor Green
Write-Host ""

# Lista de controllers para migrar
$controllers = @(
    "bulk-profile.controller.ts",
    "template.controller.ts",
    "whatsapp-catalog.controller.ts",
    "analytics.controller.ts",
    "proxy.controller.ts",
    "qr-webhook.controller.ts",
    "whatsapp-settings.controller.ts",
    "proxy-manager.controller.ts",
    "qr-campaign.controller.ts",
    "webhook.controller.ts",
    "campaign.controller.ts",
    "restriction-list.controller.ts"
)

$total = $controllers.Count
$migrated = 0
$notFound = 0

for ($i = 0; $i -lt $total; $i++) {
    $controller = $controllers[$i]
    $num = $i + 1
    $filepath = Join-Path $controllersDir $controller
    
    Write-Host "[$num/$total] $controller" -ForegroundColor Yellow
    
    if (Test-Path $filepath) {
        # Backup
        Copy-Item $filepath -Destination $backupDir -Force
        
        # Ler conteúdo
        $content = Get-Content $filepath -Raw
        
        # Substituições
        $content = $content -replace "import { query } from '../database/connection';", "import { tenantQuery } from '../database/tenant-query';"
        $content = $content -replace 'import { query } from "../database/connection";', 'import { tenantQuery } from "../database/tenant-query";'
        $content = $content -replace 'await query\(', 'await tenantQuery(req, '
        
        # Salvar
        Set-Content $filepath -Value $content -NoNewline
        
        Write-Host "   ✅ Import atualizado" -ForegroundColor Green
        Write-Host "   ✅ Queries migradas (revise manualmente!)" -ForegroundColor Green
        $migrated++
    } else {
        Write-Host "   ⚠️  Arquivo não encontrado" -ForegroundColor Red
        $notFound++
    }
    
    Write-Host ""
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  MIGRAÇÃO CONCLUÍDA!" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Migrados com sucesso: $migrated" -ForegroundColor Green
Write-Host "⚠️  Não encontrados: $notFound" -ForegroundColor Yellow
Write-Host "📁 Backups em: $backupDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  PRÓXIMOS PASSOS:" -ForegroundColor Yellow
Write-Host "1. Revise cada controller manualmente" -ForegroundColor White
Write-Host "2. Adicione tenant_id nos INSERTs" -ForegroundColor White
Write-Host "3. Converta transações para tenantTransaction" -ForegroundColor White
Write-Host "4. Teste com 2 tenants diferentes" -ForegroundColor White
Write-Host ""
Write-Host "📖 Consulte: INSTRUCOES-MIGRACAO-POR-CONTROLLER.md" -ForegroundColor Cyan
Write-Host ""





