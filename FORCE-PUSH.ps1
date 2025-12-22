cd "c:\Users\thyag\Videos\NOVO DISPARADOR DE API OFICIAL - 29-11-2025 - 09h33"

Write-Host "=== GIT STATUS ===" -ForegroundColor Yellow
git status

Write-Host "`n=== GIT LOG LOCAL ===" -ForegroundColor Yellow  
git log --oneline -5

Write-Host "`n=== GIT REMOTE ===" -ForegroundColor Yellow
git remote -v

Write-Host "`n=== VERIFICANDO SE TEM ALTERACOES NAO COMMITADAS ===" -ForegroundColor Yellow
git diff --name-only

Write-Host "`n=== ADICIONANDO E COMMITANDO ===" -ForegroundColor Yellow
git add -A
git status

git commit -m "fix: Desativa auto-refresh por padrao no historico"

Write-Host "`n=== FAZENDO PUSH ===" -ForegroundColor Yellow
git push origin main

Write-Host "`n=== VERIFICANDO SE SUBIU ===" -ForegroundColor Green
git log origin/main --oneline -3

Write-Host "`n=== CONCLUIDO ===" -ForegroundColor Green
pause












