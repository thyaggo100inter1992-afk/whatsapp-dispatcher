@echo off
chcp 65001 >nul
echo.
echo ========================================
echo 🧪 SIMULAR EVENTO DE WEBHOOK
echo ========================================
echo.
echo Este script vai simular um evento REAL do WhatsApp
echo para ativar o status do webhook.
echo.
echo ⚠️  IMPORTANTE: Deixe o servidor rodando!
echo.
pause
echo.

echo 📤 Enviando evento simulado para o webhook...
echo.

curl -X POST "http://localhost:3001/api/webhook/tenant-1" ^
  -H "Content-Type: application/json" ^
  -d "{\"object\":\"whatsapp_business_account\",\"entry\":[{\"id\":\"123456\",\"changes\":[{\"value\":{\"messaging_product\":\"whatsapp\",\"metadata\":{\"display_phone_number\":\"5511999999999\",\"phone_number_id\":\"123456\"},\"messages\":[{\"from\":\"5511988888888\",\"id\":\"wamid.test123\",\"timestamp\":\"1234567890\",\"type\":\"text\",\"text\":{\"body\":\"Teste de webhook\"}}]}}]}]}"

echo.
echo.
echo ========================================
echo 📊 RESULTADO
echo ========================================
echo.
echo ✅ Se retornou 200 OK = Evento processado!
echo ❌ Se retornou erro = Verifique os logs do servidor
echo.
echo.
echo 🔍 Agora faça:
echo 1. Recarregue a página de configurações
echo 2. Verifique se o status mudou para ATIVO
echo.
pause







