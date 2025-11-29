@echo off
cd /d "%~dp0backend"
echo Iniciando backend e salvando log...
npm run dev 2>&1 | tee backend-error.log
pause





