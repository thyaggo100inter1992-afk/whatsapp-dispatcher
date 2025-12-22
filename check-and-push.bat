@echo off
echo ======================================
echo VERIFICANDO E ENVIANDO PARA GITHUB
echo ======================================

cd "c:\Users\thyag\Videos\NOVO DISPARADOR DE API OFICIAL - 29-11-2025 - 09h33"

echo.
echo === STATUS GIT ===
git status

echo.
echo === LOG LOCAL (5 ultimos commits) ===
git log --oneline -5

echo.
echo === FAZENDO PUSH ===
git push origin main

echo.
echo === VERIFICANDO SE SUBIU ===
git log origin/main --oneline -3

echo.
pause












