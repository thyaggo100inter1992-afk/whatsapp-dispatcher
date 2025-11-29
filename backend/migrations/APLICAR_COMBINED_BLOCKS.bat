@echo off
echo ========================================
echo APLICANDO MIGRAÇÃO: combined_blocks
echo ========================================
echo.
echo Esta migração irá adicionar a coluna combined_blocks na tabela qr_templates
echo.
pause

set PGPASSWORD=Tg130992*

"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d whatsapp_api -f add_combined_blocks_to_qr_templates.sql

echo.
echo ========================================
echo MIGRAÇÃO CONCLUÍDA!
echo ========================================
pause








