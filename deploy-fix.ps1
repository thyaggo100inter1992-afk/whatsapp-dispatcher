# Script para deploy
Write-Host "=== INICIANDO DEPLOY ===" -ForegroundColor Green

# 1. Verificar status do git
Write-Host "`n=== STATUS GIT ===" -ForegroundColor Yellow
git status

# 2. Adicionar arquivos
Write-Host "`n=== ADICIONANDO ARQUIVOS ===" -ForegroundColor Yellow
git add frontend/src/pages/template/historico.tsx
git add frontend/src/pages/template/gerenciar.tsx

# 3. Verificar diff
Write-Host "`n=== ARQUIVOS STAGED ===" -ForegroundColor Yellow
git diff --cached --name-only

# 4. Commit
Write-Host "`n=== FAZENDO COMMIT ===" -ForegroundColor Yellow
git commit -m "fix: Desativa auto-refresh por padrao no historico de templates"

# 5. Push
Write-Host "`n=== FAZENDO PUSH ===" -ForegroundColor Yellow
git push

# 6. Conectar ao servidor
Write-Host "`n=== ATUALIZANDO SERVIDOR ===" -ForegroundColor Yellow
$plinkPath = "$env:USERPROFILE\plink.exe"
& $plinkPath -ssh root@72.60.141.244 -pw "Tg74108520963," -hostkey "ssh-ed25519 255 SHA256:mwH4j3imJiJAwSaKb1IxslHWE8OCPyzy8VOWB6qnWsM" "cd /root/whatsapp-dispatcher && git pull && cd frontend && npm run build && pm2 restart frontend"

Write-Host "`n=== DEPLOY CONCLUIDO ===" -ForegroundColor Green

