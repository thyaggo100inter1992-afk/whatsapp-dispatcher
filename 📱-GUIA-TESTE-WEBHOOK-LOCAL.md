# 📱 GUIA COMPLETO - TESTE DE WEBHOOK LOCAL

## 🎯 OBJETIVO
Testar o webhook no servidor LOCAL para verificar se o problema está no código ou na configuração do Facebook.

---

## ⚙️ CONFIGURAÇÃO ATUAL

### Servidor Local:
- **Porta:** 3001
- **Token:** `WhatsApp_Webhook_2025_Thyag_Secure_Token_9X7K2P4M`
- **URL do Webhook:** `http://localhost:3001/api/webhook/tenant-4`

---

## 📋 PASSO A PASSO

### **PASSO 1: Iniciar o Servidor Local**

1. Execute o arquivo: **`INICIAR-E-MONITORAR-SERVIDOR-LOCAL.bat`**

2. Aguarde até ver:
   ```
   ✅ Server running on port 3001
   ```

3. **DEIXE ESTE TERMINAL ABERTO!** Ele vai mostrar os logs em tempo real.

---

### **PASSO 2: Testar o Webhook Localmente**

**Abra um NOVO terminal** e execute: **`TESTAR-WEBHOOK-LOCAL.bat`**

Você verá 2 testes:

#### ✅ **Teste 1: Verificação (GET)**
```bash
GET http://localhost:3001/api/webhook/tenant-4?hub.mode=subscribe&...
```

**Resultado esperado:**
```
teste123
```

#### ✅ **Teste 2: Recebimento (POST)**
```bash
POST http://localhost:3001/api/webhook/tenant-4
```

**Resultado esperado:**
```
200 OK
```

---

### **PASSO 3: Observar os Logs**

**No terminal do PASSO 1**, você deve ver:

```
📥 Webhook recebido: GET /api/webhook/tenant-4
✅ Verificação do webhook bem-sucedida
---
📥 Webhook recebido: POST /api/webhook/tenant-4
Webhook data: { object: 'whatsapp_business_account', entry: [...] }
```

---

## 🌐 EXPOR O SERVIDOR LOCAL PARA A INTERNET

Para testar com o Facebook, você precisa expor o servidor local. Existem 2 opções:

### **OPÇÃO 1: Usar ngrok (Recomendado para testes)**

1. **Instale o ngrok:**
   - Baixe em: https://ngrok.com/download
   - Extraia o arquivo
   - Coloque na pasta do projeto

2. **Execute:**
   ```bash
   ngrok http 3001
   ```

3. **Copie a URL gerada:**
   ```
   Forwarding: https://abc123.ngrok.io -> http://localhost:3001
   ```

4. **Configure no Facebook:**
   - URL: `https://abc123.ngrok.io/api/webhook/tenant-4`
   - Token: `WhatsApp_Webhook_2025_Thyag_Secure_Token_9X7K2P4M`

---

### **OPÇÃO 2: Liberar porta no roteador**

1. Acesse o roteador (geralmente `192.168.0.1` ou `192.168.1.1`)
2. Configure **Port Forwarding:**
   - Porta externa: `3001`
   - Porta interna: `3001`
   - IP do computador: (seu IP local)
3. Descubra seu IP público: https://www.whatismyip.com/
4. Configure no Facebook:
   - URL: `http://SEU_IP_PUBLICO:3001/api/webhook/tenant-4`
   - Token: `WhatsApp_Webhook_2025_Thyag_Secure_Token_9X7K2P4M`

---

## 🧪 CENÁRIOS DE TESTE

### **CENÁRIO 1: Testes locais funcionam ✅**
- **Conclusão:** O código está correto!
- **Problema:** Configuração do Facebook ou servidor online
- **Solução:** Verificar configuração no Facebook Developers

### **CENÁRIO 2: Testes locais falham ❌**
- **Conclusão:** Problema no código
- **Problema:** Erro na implementação do webhook
- **Solução:** Verificar logs de erro e corrigir o código

### **CENÁRIO 3: Facebook não envia requisições ❌**
- **Conclusão:** Problema na configuração do Facebook
- **Problema:** Webhook não subscrito ou URL errada
- **Solução:** Reconfigurar no Facebook Developers

---

## 📊 CHECKLIST DE VERIFICAÇÃO

Antes de testar com o Facebook:

- [ ] Servidor local iniciado (porta 3001)
- [ ] Teste GET funcionou (retornou "teste123")
- [ ] Teste POST funcionou (retornou 200 OK)
- [ ] Logs mostram "📥 Webhook recebido"
- [ ] ngrok rodando (se usar ngrok)
- [ ] URL pública acessível externamente
- [ ] Configurado no Facebook Developers
- [ ] Eventos subscritos (messages, message_status, etc.)

---

## 🔍 MONITORAMENTO EM TEMPO REAL

### **No terminal do servidor, você verá:**

#### ✅ **Quando o webhook funciona:**
```
📥 Webhook recebido: GET /api/webhook/tenant-4
Query params: { hub.mode: 'subscribe', hub.verify_token: '...', hub.challenge: '...' }
✅ Verificação do webhook bem-sucedida
---
📥 Webhook recebido: POST /api/webhook/tenant-4
Webhook data: { object: 'whatsapp_business_account', entry: [...] }
✅ Webhook processado com sucesso
```

#### ❌ **Quando há erro:**
```
❌ Erro ao processar webhook: [mensagem de erro]
```

#### 🔇 **Quando o Facebook não envia:**
```
(nenhuma requisição de webhook aparece nos logs)
(apenas logs normais do servidor)
```

---

## 🆘 TROUBLESHOOTING

### **Problema: "Cannot GET /health"**
- **Causa:** Servidor não está rodando
- **Solução:** Execute `INICIAR-E-MONITORAR-SERVIDOR-LOCAL.bat`

### **Problema: "Token de verificação inválido"**
- **Causa:** Token no Facebook diferente do `.env`
- **Solução:** Verifique se o token está correto em ambos

### **Problema: "Connection refused"**
- **Causa:** Porta 3001 não está acessível
- **Solução:** Verifique firewall e se o servidor está rodando

### **Problema: Facebook não envia requisições**
- **Causa:** Eventos não subscritos ou URL errada
- **Solução:** Reconfigure no Facebook Developers

---

## 📸 TIRE SCREENSHOTS

Para diagnóstico, tire screenshots de:

1. **Terminal do servidor** (mostrando os logs)
2. **Resultado dos testes** (TESTAR-WEBHOOK-LOCAL.bat)
3. **Configuração do Facebook** (URL e token)
4. **Eventos subscritos** (messages, message_status, etc.)

---

## 🎯 PRÓXIMOS PASSOS

1. **Execute:** `INICIAR-E-MONITORAR-SERVIDOR-LOCAL.bat`
2. **Execute:** `TESTAR-WEBHOOK-LOCAL.bat` (em outro terminal)
3. **Observe:** Os logs no primeiro terminal
4. **Me mostre:** O resultado dos testes

**Estou monitorando! Pode começar os testes! 🚀**




