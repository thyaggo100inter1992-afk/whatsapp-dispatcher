#!/bin/bash
# Capturar logs do erro de relatório

LOG_OUTPUT="/root/logs-relatorio-erro-$(date +%Y%m%d-%H%M%S).txt"

echo "==================================" > $LOG_OUTPUT
echo "LOGS DE ERRO - RELATÓRIO CAMPANHA" >> $LOG_OUTPUT
echo "Data: $(date)" >> $LOG_OUTPUT
echo "==================================" >> $LOG_OUTPUT
echo "" >> $LOG_OUTPUT

echo "1. PM2 LOGS (últimas 100 linhas):" >> $LOG_OUTPUT
pm2 logs whatsapp-backend --lines 100 --nostream >> $LOG_OUTPUT 2>&1
echo "" >> $LOG_OUTPUT

echo "2. PM2 ERROR LOG:" >> $LOG_OUTPUT
tail -100 /root/.pm2/logs/whatsapp-backend-error.log >> $LOG_OUTPUT 2>&1
echo "" >> $LOG_OUTPUT

echo "3. REPORT ERRORS LOG:" >> $LOG_OUTPUT
if [ -f "/root/whatsapp-dispatcher/backend/dist/report-errors.log" ]; then
  cat /root/whatsapp-dispatcher/backend/dist/report-errors.log >> $LOG_OUTPUT 2>&1
else
  echo "Arquivo report-errors.log não existe" >> $LOG_OUTPUT
fi
echo "" >> $LOG_OUTPUT

echo "4. ÚLTIMA QUERY NA CAMPANHA 20:" >> $LOG_OUTPUT
cd /root/whatsapp-dispatcher
echo "SELECT * FROM campaigns WHERE id = 20;" | su - postgres -c "psql whatsapp_dispatcher" >> $LOG_OUTPUT 2>&1
echo "" >> $LOG_OUTPUT

echo "==================================" >> $LOG_OUTPUT
echo "LOGS CAPTURADOS!" >> $LOG_OUTPUT
echo "Arquivo: $LOG_OUTPUT" >> $LOG_OUTPUT
echo "==================================" >> $LOG_OUTPUT

echo "LOG SALVO EM: $LOG_OUTPUT"
ls -lh $LOG_OUTPUT












