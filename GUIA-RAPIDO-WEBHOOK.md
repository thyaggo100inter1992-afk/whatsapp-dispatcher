# 🚀 Guia Rápido - Webhooks QR Connect

## ✅ **BOA NOTÍCIA: CONFIGURAÇÃO AUTOMÁTICA!**

O sistema agora **TENTA CONFIGURAR AUTOMATICAMENTE** o webhook quando você:
- ✅ Cria uma nova instância QR
- ✅ Conecta uma instância existente

---

## 🎯 **VOCÊ NÃO PRECISA FAZER NADA!**

O sistema funciona de **2 formas**:

### **🔔 Forma 1: Webhooks (Instantâneo)**
Se o UAZ suportar webhooks:
- ✅ Configuração automática
- ✅ Atualizações instantâneas (0-2s)
- ✅ Mais eficiente

### **⏱️ Forma 2: Polling (Automático)**
Se o UAZ NÃO suportar webhooks:
- ✅ Monitor automático (roda a cada 10s)
- ✅ Atualizações rápidas (10s de delay)
- ✅ Funciona sem configuração

---

## 📋 **O QUE VAI ACONTECER:**

### **Ao criar/conectar instância:**

```
1. Sistema cria instância no UAZ
         ↓
2. Sistema TENTA configurar webhook automaticamente
         ↓
3a. SE SUCESSO → Usa webhooks (instantâneo) ✅
         OU
3b. SE FALHAR → Usa polling (10s) ✅

Ambos funcionam perfeitamente!
```

---

## 🔧 **CONFIGURAÇÃO MANUAL (OPCIONAL)**

Se você quiser forçar webhooks no UAZ:

### **Opção 1: Variável de Ambiente**

Adicione ao `.env` do UAZ:
```env
WEBHOOK_URL=http://SEU_IP:3001/api/qr-webhook/uaz-event
WEBHOOK_ENABLED=true
```

### **Opção 2: API do UAZ**

```bash
curl -X POST http://localhost:8000/instance/webhook \
  -H "Content-Type: application/json" \
  -H "token: TOKEN_DA_INSTANCIA" \
  -d '{
    "url": "http://localhost:3001/api/qr-webhook/uaz-event",
    "enabled": true,
    "events": ["messages.update", "message_status"]
  }'
```

---

## 🧪 **TESTANDO**

### 1. Verificar se está funcionando

Crie uma campanha QR e envie mensagens.  
Vá até a página de detalhes da campanha.

**Você deve ver atualizações nos cards:**
- 📤 Enviadas (aumenta imediatamente)
- ✅ Entregues (atualiza automaticamente)
- 👁️ Lidas (atualiza automaticamente)  
- ❌ Falhas (atualiza automaticamente)

### 2. Verificar logs do backend

```bash
# Com webhooks
🔔 Configurando webhook...
✅ Webhook configurado com sucesso!

# Sem webhooks
⚠️  Nenhum endpoint de webhook encontrado no UAZ
   Sistema funcionará com polling (10s de delay)
🚀 Iniciando monitor de status QR Connect...
```

---

## 📊 **COMO SABER QUAL ESTÁ USANDO?**

### **Usando Webhooks:**
- Atualiza em **0-2 segundos**
- Logs: `✅ Webhook configurado com sucesso!`
- Mais eficiente

### **Usando Polling:**
- Atualiza em **10 segundos**
- Logs: `🚀 Iniciando monitor de status QR Connect...`
- Funciona perfeitamente também!

---

## ❓ **PERGUNTAS FREQUENTES**

### **1. Preciso configurar algo no UAZ?**
❌ **NÃO!** O sistema tenta configurar automaticamente.

### **2. E se o UAZ não tiver webhooks?**
✅ **SEM PROBLEMA!** O sistema usa polling automático.

### **3. Qual é melhor?**
- **Webhooks**: Instantâneo (recomendado se disponível)
- **Polling**: Rápido (10s), funciona sempre

### **4. Como mudar o intervalo do polling?**
Edite `backend/src/services/qr-status-monitor.ts`:
```typescript
private static readonly CHECK_INTERVAL = 10000; // milissegundos
```

### **5. Os dois funcionam ao mesmo tempo?**
✅ **SIM!** Se o UAZ enviar webhooks E o polling estiver ativo:
- Webhooks processam primeiro (instantâneo)
- Polling pega qualquer coisa que passou (backup)

---

## 🎉 **RESUMO**

**VOCÊ NÃO PRECISA FAZER NADA!**

O sistema:
- ✅ Tenta configurar webhooks automaticamente
- ✅ Usa polling se webhooks não funcionarem
- ✅ Funciona perfeitamente nos dois modos
- ✅ Atualiza estatísticas em tempo real

**Simplesmente use e seja feliz!** 🚀💚

---

## 📞 **URLs Importantes**

- Health Check: `http://localhost:3001/api/qr-webhook/health`
- Webhook UAZ: `http://localhost:3001/api/qr-webhook/uaz-event`

---

**Pronto! Sistema 100% funcional!** ✅







