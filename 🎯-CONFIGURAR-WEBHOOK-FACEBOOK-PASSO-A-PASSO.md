# 🎯 CONFIGURAR WEBHOOK NO FACEBOOK - PASSO A PASSO

## ✅ STATUS DO SERVIDOR
- ✅ Servidor online funcionando
- ✅ Token de verificação configurado: `seu_token_secreto_aqui`
- ✅ URL do webhook: `https://api.sistemasnettsistemas.com.br/api/webhook/tenant-4`
- ✅ Validação funcionando (testado com curl)

---

## 🚨 PROBLEMA IDENTIFICADO

**O Facebook NÃO está enviando requisições para o servidor!**

Os logs do servidor mostram:
- ✅ Queries do banco de dados
- ✅ Audit logs
- ❌ **NENHUMA requisição de webhook do Facebook**

---

## 📋 PASSO A PASSO PARA RESOLVER

### **PASSO 1: Acesse o Facebook Developers**
1. Vá para: https://developers.facebook.com/
2. Entre no seu App
3. Vá em **WhatsApp** > **Configuração**

---

### **PASSO 2: REMOVA o webhook atual**

**IMPORTANTE:** Você precisa remover o webhook antigo primeiro!

1. Na seção **Webhook**, clique em **Editar**
2. Clique em **Remover** ou **Excluir**
3. Confirme a remoção
4. **Aguarde 1 minuto** (para limpar o cache do Facebook)

---

### **PASSO 3: ADICIONE o webhook novamente**

1. Clique em **Configurar Webhook** ou **Adicionar Webhook**

2. Preencha os campos:
   ```
   URL de retorno de chamada:
   https://api.sistemasnettsistemas.com.br/api/webhook/tenant-4
   
   Token de verificação:
   seu_token_secreto_aqui
   ```

3. Clique em **Verificar e salvar**

4. **AGUARDE a verificação:**
   - ✅ Se aparecer "Verificado com sucesso" → Continue
   - ❌ Se der erro → Me mostre o erro exato

---

### **PASSO 4: SUBSCREVER aos eventos (CRUCIAL!)**

**ESTE É O PASSO QUE PROVAVELMENTE ESTÁ FALTANDO!**

Depois de verificar o webhook, você precisa **subscrever aos eventos**:

1. Na mesma página, procure por **Campos do Webhook** ou **Webhook Fields**

2. **Marque TODAS estas opções:**
   - ✅ `messages` (Mensagens recebidas)
   - ✅ `message_status` (Status das mensagens: enviada, entregue, lida)
   - ✅ `messaging_postbacks` (Respostas de botões)
   - ✅ `message_echoes` (Eco de mensagens)

3. Clique em **Salvar** ou **Subscribe**

---

### **PASSO 5: VERIFICAR se está funcionando**

1. **No servidor, deixe os logs rodando:**
   ```bash
   pm2 logs whatsapp-backend --lines 50
   ```

2. **Envie uma mensagem de teste:**
   - Envie uma mensagem para o número do WhatsApp Business
   - Ou responda uma mensagem

3. **Verifique os logs:**
   - ✅ Se aparecer `📥 Webhook recebido` → **FUNCIONOU!**
   - ❌ Se não aparecer nada → O Facebook ainda não está enviando

---

## 🔍 COMO SABER SE ESTÁ FUNCIONANDO

### ✅ **Webhook ATIVO:**
```
Logs do servidor mostram:
📥 Webhook recebido: POST /api/webhook/tenant-4
Webhook data: { object: 'whatsapp_business_account', entry: [...] }
```

### ❌ **Webhook INATIVO:**
```
Logs do servidor mostram:
(apenas queries do banco de dados e audit logs)
(NENHUMA requisição de webhook)
```

---

## 🎯 CHECKLIST FINAL

Antes de testar, confirme:

- [ ] Removi o webhook antigo do Facebook
- [ ] Aguardei 1 minuto após remover
- [ ] Adicionei o webhook novamente com a URL correta
- [ ] Verifiquei e salvei o webhook (verificação passou)
- [ ] **SUBSCREVI aos eventos** (messages, message_status, etc.)
- [ ] Deixei os logs rodando no servidor
- [ ] Enviei uma mensagem de teste
- [ ] Verifiquei os logs para ver se o webhook chegou

---

## 📸 TIRE SCREENSHOTS

Para eu te ajudar melhor, tire screenshots de:

1. **Configuração do Webhook no Facebook:**
   - Mostrando a URL e o token
   - Mostrando o status "Verificado"

2. **Campos subscritos:**
   - Mostrando quais eventos estão marcados

3. **Logs do servidor:**
   - Depois de enviar uma mensagem de teste

---

## 🆘 SE AINDA NÃO FUNCIONAR

Me mostre:
1. Screenshot da configuração do webhook no Facebook
2. Screenshot dos campos subscritos
3. Os logs do servidor após enviar uma mensagem

---

## 💡 DICA IMPORTANTE

O problema mais comum é **esquecer de subscrever aos eventos**!

Muitas pessoas verificam o webhook, mas esquecem de marcar os campos (messages, message_status, etc.).

**SEM subscrever aos eventos, o Facebook NÃO envia nada para o seu servidor!**

---

**Siga estes passos com atenção e me mostre o resultado! 🚀**










