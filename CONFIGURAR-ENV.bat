@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   CONFIGURAR ARQUIVO .ENV
echo ========================================
echo.
echo Vou te ajudar a configurar o arquivo .env
echo.
pause

echo.
echo Abrindo o arquivo .env para edição...
notepad backend\.env

echo.
echo ========================================
echo   COLE ESTAS INFORMAÇÕES NO ARQUIVO:
echo ========================================
echo.
echo DB_PASSWORD=Tg130992*
echo.
echo REDIS_HOST=redis-16620:c99.us-east-1-4.ec2.redis.redis-cloud.com
echo REDIS_PORT=16620
echo REDIS_PASSWORD=SUA_SENHA_DO_REDIS_AQUI
echo.
echo ========================================
echo.
echo Após colar, salve (Ctrl+S) e feche o Notepad.
echo.
pause


