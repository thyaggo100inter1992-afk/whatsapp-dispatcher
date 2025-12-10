#!/bin/bash
# Script de deploy com logging completo

LOG_FILE="/root/deploy-relatorio-fix.log"

echo "======================================" > $LOG_FILE
echo "DEPLOY CORREÇÃO RELATÓRIO" >> $LOG_FILE
echo "Data: $(date)" >> $LOG_FILE
echo "======================================" >> $LOG_FILE
echo "" >> $LOG_FILE

cd /root/whatsapp-dispatcher

echo "1. Git status ANTES do pull:" >> $LOG_FILE
git status >> $LOG_FILE 2>&1
echo "" >> $LOG_FILE

echo "2. Executando git pull:" >> $LOG_FILE
git pull >> $LOG_FILE 2>&1
echo "Exit code: $?" >> $LOG_FILE
echo "" >> $LOG_FILE

echo "3. Git log (último commit):" >> $LOG_FILE
git log -1 --oneline >> $LOG_FILE 2>&1
echo "" >> $LOG_FILE

echo "4. Verificando arquivo report.service.ts:" >> $LOG_FILE
head -35 backend/src/services/report.service.ts | tail -20 >> $LOG_FILE 2>&1
echo "" >> $LOG_FILE

cd backend

echo "5. Executando npm install:" >> $LOG_FILE
npm install >> $LOG_FILE 2>&1
echo "Exit code: $?" >> $LOG_FILE
echo "" >> $LOG_FILE

echo "6. Removendo dist:" >> $LOG_FILE
rm -rf dist >> $LOG_FILE 2>&1
ls -la | grep dist >> $LOG_FILE 2>&1
echo "" >> $LOG_FILE

echo "7. Executando npm run build:" >> $LOG_FILE
npm run build >> $LOG_FILE 2>&1
echo "Exit code: $?" >> $LOG_FILE
echo "" >> $LOG_FILE

echo "8. Verificando arquivo compilado:" >> $LOG_FILE
if [ -f "dist/services/report.service.js" ]; then
  echo "Arquivo compilado existe!" >> $LOG_FILE
  head -50 dist/services/report.service.js >> $LOG_FILE 2>&1
else
  echo "ERRO: Arquivo compilado NÃO existe!" >> $LOG_FILE
fi
echo "" >> $LOG_FILE

echo "9. Reiniciando PM2:" >> $LOG_FILE
pm2 restart whatsapp-backend >> $LOG_FILE 2>&1
echo "Exit code: $?" >> $LOG_FILE
echo "" >> $LOG_FILE

echo "10. Status do PM2:" >> $LOG_FILE
pm2 status whatsapp-backend >> $LOG_FILE 2>&1
echo "" >> $LOG_FILE

echo "======================================" >> $LOG_FILE
echo "DEPLOY CONCLUÍDO!" >> $LOG_FILE
echo "======================================" >> $LOG_FILE

echo "Log salvo em: $LOG_FILE"
cat $LOG_FILE












