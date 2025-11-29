# 🔍 Diagnóstico: Webhooks QR Connect não Contabilizam Status

## ❌ O Problema

Suas campanhas QR estão **enviando mensagens** (12 enviadas), mas **não estão contabilizando**:
- ❌ **0 Entregues** (deveria atualizar quando o WhatsApp entregar)
- ❌ **0 Lidas** (deveria atualizar quando o destinatário ler)
- ❌ **0 Cliques** (se houver botões/listas)

**Isso significa que os webhooks NÃO estão funcionando corretamente.**

---

## 🔍 Causas Possíveis

### **1. UAZ API não está enviando webhooks**
   - O servidor UAZ não foi configurado para enviar webhooks
   - A URL do webhook está incorreta
   - O UAZ não está alcançando seu servidor

### **2. Formato do Message ID está incorreto**
   - O ID salvo no banco está diferente do ID que o webhook envia
   - O webhook não consegue encontrar a mensagem no banco

### **3. Webhook endpoint não está recebendo**
   - Firewall bloqueando
   - Porta não acessível
   - Servidor não está rodando

---

## 🧪 Como Diagnosticar

### **PASSO 1: Execute o Script de Teste**

```bash
cd backend
node test-webhook-qr.js
```

**O que ele testa:**
1. ✅ Se o endpoint `/api/qr-webhook/health` está acessível
2. 🔍 Se consegue encontrar uma mensagem no banco
3. 📩 Simula webhook de "entregue"
4. 📩 Simula webhook de "lida"

**Resultado esperado:**
```
═══════════════════════════════════════════
  TESTE 1: Health Check do Webhook
═══════════════════════════════════════════
✅ Endpoint acessível!

═══════════════════════════════════════════
  TESTE 4: Consultar Mensagem no Banco
═══════════════════════════════════════════
✅ Mensagem encontrada no banco!
   Status: sent
   Enviada em: 2025-11-17T22:22:23.000Z
   
═══════════════════════════════════════════
  TESTE 2: Webhook de Mensagem ENTREGUE
═══════════════════════════════════════════
✅ Webhook processado com sucesso!
```

---

### **PASSO 2: Pegue um Message ID Real**

Quando enviar uma mensagem de teste, procure nos logs do backend por:

```
📩 UAZ Response - Message ID: 556298669726:3EB02A34933B0CA045B697
```

Copie esse ID completo (incluindo os dois pontos e tudo depois).

---

### **PASSO 3: Teste com o Message ID Real**

```bash
node test-webhook-qr.js "556298669726:3EB02A34933B0CA045B697"
```

**Se não encontrar a mensagem:**
```
❌ Mensagem NÃO encontrada!
```

**Significa:** O Message ID não foi salvo corretamente no banco.

---

## 🔧 Soluções

### **Solução 1: Configurar Webhooks no UAZ API**

O UAZ API precisa enviar webhooks para seu servidor. Configure:

**URL do Webhook:**
```
http://SEU_SERVIDOR:3001/api/qr-webhook/uaz-event
```

**Eventos para escutar:**
- `message.ack` (mensagem entregue)
- `message.read` (mensagem lida)
- `button.click` (clique em botão - se disponível)

**Exemplo de configuração (se o UAZ suportar):**
```json
{
  "webhook_url": "http://localhost:3001/api/qr-webhook/uaz-event",
  "events": ["message.ack", "message.read"]
}
```

---

### **Solução 2: Verificar Formato do Message ID**

O Message ID deve estar neste formato:
```
556298669726:3EB02A34933B0CA045B697
{phone_number}:{message_id}
```

**Verificar no Banco:**
```sql
SELECT 
  id, phone_number, template_name, status, whatsapp_message_id
FROM qr_campaign_messages 
WHERE campaign_id = 15
ORDER BY created_at DESC
LIMIT 10;
```

**Resultado esperado:**
```
| id | phone_number    | whatsapp_message_id              |
|----|-----------------|----------------------------------|
| 45 | 5511930284611   | 556298669726:3EB02A34933B0CA045 |
| 44 | 5511930284612   | 556298669726:4FC03B45044C1BA156 |
```

**❌ Se estiver NULL ou vazio:** O sistema não está salvando o Message ID!

---

### **Solução 3: Polling Manual (Alternativa)**

Se o UAZ não envia webhooks, podemos implementar um **sistema de polling** que busca o status das mensagens periodicamente.

**Adicionar ao código:**
```typescript
// Buscar status de mensagens pendentes a cada 30 segundos
setInterval(async () => {
  const pendingMessages = await query(
    'SELECT id, whatsapp_message_id FROM qr_campaign_messages WHERE status = "sent" AND sent_at > NOW() - INTERVAL "1 day"'
  );
  
  for (const msg of pendingMessages.rows) {
    const status = await uazAPI.getMessageStatus(msg.whatsapp_message_id);
    // Atualizar status no banco
  }
}, 30000);
```

---

## 📊 Debug Avançado

### **Ver Logs do Backend em Tempo Real**

```bash
# Terminal 1: Backend
npm run start-backend

# Terminal 2: Monitorar logs
tail -f logs/backend.log
```

Procure por:
```
📩 Webhook recebido: { whatsapp_message_id: '...', status: 'delivered' }
✅ Mensagem XXX atualizada para delivered
```

---

### **Testar Webhook Manualmente**

Use o **Postman** ou **curl** para enviar um webhook de teste:

```bash
curl -X POST http://localhost:3001/api/qr-webhook/message-status \
  -H "Content-Type: application/json" \
  -d '{
    "whatsapp_message_id": "556298669726:3EB02A34933B0CA045B697",
    "status": "delivered",
    "timestamp": "2025-11-17T22:30:00Z",
    "instance_id": 13
  }'
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Status atualizado com sucesso"
}
```

---

## ✅ Checklist de Verificação

- [ ] Script de teste executado
- [ ] Endpoint `/api/qr-webhook/health` acessível
- [ ] Message ID real copiado dos logs
- [ ] Message ID encontrado no banco
- [ ] Webhook de teste processado com sucesso
- [ ] UAZ API configurado para enviar webhooks
- [ ] URL do webhook acessível externamente (se necessário)
- [ ] Logs mostram webhooks sendo recebidos

---

## 🎯 Próximos Passos

### **Se o teste funcionar:**
1. Configure o UAZ para enviar webhooks para sua URL
2. Teste enviando mensagem real
3. Monitore os logs do backend

### **Se o teste falhar:**
1. Verifique se o Message ID está sendo salvo no banco
2. Compare o formato do ID nos logs vs banco
3. Verifique se o endpoint está acessível
4. Considere implementar polling como alternativa

---

## 📞 Contato para Suporte

Se nenhuma solução funcionar:

1. Execute `node test-webhook-qr.js` e copie a saída completa
2. Envie junto com:
   - Logs do backend durante envio de mensagem
   - Print da tela mostrando "0 entregues"
   - Resultado da query SQL das mensagens

---

## 🔥 Solução Rápida (Temporária)

Enquanto não resolve os webhooks, adicione um botão manual "Atualizar Status" na interface que:

1. Busca todas as mensagens com `status = 'sent'`
2. Para cada uma, tenta consultar o status no UAZ API
3. Atualiza o banco manualmente

**Não é ideal, mas permite ver os status enquanto investiga o problema dos webhooks.**

---

## 📝 Conclusão

O problema está em **uma** destas áreas:

1. **UAZ não envia webhooks** → Configure o UAZ
2. **Message ID incorreto** → Corrija a extração do ID
3. **Endpoint não acessível** → Libere firewall/porta

**Execute o teste primeiro** para identificar exatamente onde está o problema! 🚀







