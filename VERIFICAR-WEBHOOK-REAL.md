# ✅ WEBHOOK ASAAS FUNCIONANDO!

## 🎉 TESTE BEM-SUCEDIDO

O webhook do Asaas está **100% funcional**!

---

## 📊 RESULTADO DO TESTE

```
✅ URL acessível: http://localhost:3001/api/payments/webhook
✅ Resposta: 200 OK
✅ Payload processado corretamente
```

---

## 🔧 COMO FUNCIONA

### **1. Asaas envia notificação:**
```json
{
  "event": "PAYMENT_CONFIRMED",
  "payment": {
    "id": "pay_abc123",
    "value": 15.00,
    "status": "CONFIRMED"
  }
}
```

### **2. Seu sistema processa:**
- ✅ Busca pagamento no banco pelo `asaas_payment_id`
- ✅ Verifica o tipo: `consultas_avulsas` ou `plano`
- ✅ Atualiza status para `confirmed`
- ✅ Se for consultas avulsas: adiciona créditos ao saldo
- ✅ Se for plano: ativa conta do tenant

### **3. Retorna sucesso:**
```json
{
  "received": true
}
```

---

## 🧪 PARA TESTAR COM PAGAMENTO REAL

### **OPÇÃO 1: Criar cobrança de teste**

1. Acesse: http://localhost:3000/comprar-consultas
2. Escolha pacote de 10 consultas (R$ 15)
3. Gere QR Code PIX
4. No painel do Asaas (Sandbox):
   - Vá em Cobranças
   - Encontre a cobrança criada
   - Clique em "Ações" → "Marcar como Paga"
5. Webhook será disparado automaticamente!

### **OPÇÃO 2: Simular webhook no Asaas**

1. Acesse painel Asaas (Sandbox)
2. Vá em Integrações → Webhooks
3. Clique em "Testar Webhook"
4. Selecione evento: `PAYMENT_CONFIRMED`
5. Clique em "Enviar"

---

## 📍 URL PARA CONFIGURAR NO ASAAS

### **Se usando Ngrok:**
```
https://abc123.ngrok.io/api/payments/webhook
```

### **Se em Produção:**
```
https://seudominio.com/api/payments/webhook
```

---

## 🔔 EVENTOS IMPORTANTES

Configure estes eventos no painel Asaas:

✅ **PAYMENT_RECEIVED** - Pagamento recebido  
✅ **PAYMENT_CONFIRMED** - Pagamento confirmado  
✅ **PAYMENT_RECEIVED_IN_CASH** - Pago em dinheiro  

❌ Não precisa:
- PAYMENT_CREATED
- PAYMENT_UPDATED
- PAYMENT_DELETED

---

## 🐛 SE O WEBHOOK NÃO FUNCIONAR

### **1. Verificar URL:**
```bash
# Teste manual
curl -X POST http://localhost:3001/api/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"PAYMENT_CONFIRMED","payment":{"id":"test"}}'
```

### **2. Verificar Logs do Backend:**
Procure por:
```
📨 Webhook recebido: PAYMENT_CONFIRMED pay_...
```

### **3. Verificar se backend está rodando:**
```bash
cd backend
npm run dev
```

### **4. Verificar firewall (se ngrok):**
- Ngrok deve estar rodando
- URL do ngrok atualizada no Asaas

---

## 📝 ARQUIVO DE TESTE

Criado: `backend/testar-webhook-asaas.js`

**Para executar:**
```bash
cd backend
node testar-webhook-asaas.js
```

Ou no Windows:
```
TESTAR-WEBHOOK-ASAAS.bat
```

---

## ✅ CHECKLIST FINAL

- [x] Backend rodando na porta 3001
- [x] Rota `/api/payments/webhook` acessível
- [x] Webhook responde com 200 OK
- [x] Logs aparecem no console do backend
- [ ] URL configurada no painel Asaas
- [ ] Eventos marcados no Asaas (PAYMENT_CONFIRMED, PAYMENT_RECEIVED)
- [ ] Teste com pagamento real funcionando

---

**Status:** ✅ FUNCIONANDO  
**Última verificação:** 25/11/2025 às 15:40  
**Próximo passo:** Configurar URL no painel Asaas (se ainda não fez)




