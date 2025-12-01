# 🔧 CORRIGIR WEBHOOK NO SERVIDOR ONLINE

## 🔍 SITUAÇÃO ATUAL

Você já configurou:
- ✅ Webhook no Facebook Developers
- ✅ URL: `https://api.sistemasnettsistemas.com.br/api/webhook/tenant-4`
- ✅ Token de verificação configurado
- ❌ **Status: INATIVO** - Servidor não está respondendo

---

## 🎯 PROBLEMA

O servidor online **NÃO está respondendo** às requisições de verificação do Facebook.

---

## ✅ SOLUÇÃO - CONECTAR NO SERVIDOR

### 1️⃣ Conectar via SSH no servidor

```bash
ssh root@72.60.141.244
```

Ou use o IP do seu servidor.

---

### 2️⃣ Verificar se o backend está rodando

```bash
pm2 status
```

**Resultado esperado:**
```
┌─────┬──────────┬─────────┬─────────┐
│ id  │ name     │ status  │ cpu     │
├─────┼──────────┼─────────┼─────────┤
│ 0   │ backend  │ online  │ 0%      │
└─────┴──────────┴─────────┴─────────┘
```

**Se o backend NÃO estiver rodando:**
```bash
cd /var/www/disparador-api-oficial/backend
pm2 start npm --name backend -- start
```

---

### 3️⃣ Verificar se as variáveis de webhook estão no .env

```bash
cd /var/www/disparador-api-oficial/backend
cat .env | grep WEBHOOK
```

**Resultado esperado:**
```
WEBHOOK_VERIFY_TOKEN=seu_token_secreto
WEBHOOK_BASE_URL=https://api.sistemasnettsistemas.com.br
WEBHOOK_URL=https://api.sistemasnettsistemas.com.br/api/webhook
```

**Se NÃO aparecer nada:**

```bash
nano .env
```

Adicione estas linhas no final:

```env
# Webhook do WhatsApp
WEBHOOK_VERIFY_TOKEN=seu_token_secreto_aqui
WEBHOOK_BASE_URL=https://api.sistemasnettsistemas.com.br
WEBHOOK_URL=https://api.sistemasnettsistemas.com.br/api/webhook
```

**⚠️ IMPORTANTE:** Use o **MESMO token** que você configurou no Facebook Developers!

Salve e saia:
- `CTRL + O` (salvar)
- `ENTER` (confirmar)
- `CTRL + X` (sair)

**Reinicie o backend:**
```bash
pm2 restart backend
```

---

### 4️⃣ Verificar se o Nginx está configurado corretamente

```bash
cat /etc/nginx/sites-available/default | grep webhook
```

**Deve ter algo como:**

```nginx
location /api/webhook {
    proxy_pass http://localhost:3001/api/webhook;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

**Se NÃO tiver, adicione:**

```bash
sudo nano /etc/nginx/sites-available/default
```

Adicione dentro do bloco `server`:

```nginx
location /api/webhook {
    proxy_pass http://localhost:3001/api/webhook;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

**Teste a configuração:**
```bash
sudo nginx -t
```

**Se OK, reinicie o Nginx:**
```bash
sudo systemctl restart nginx
```

---

### 5️⃣ Testar o webhook manualmente

```bash
curl -X GET "https://api.sistemasnettsistemas.com.br/api/webhook/tenant-4?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=teste123"
```

**Resultado esperado:** `teste123`

**Se retornar erro:**
- `404` → Rota não existe (problema no Nginx ou backend)
- `403` → Token errado
- `500` → Erro no backend (veja os logs)

---

### 6️⃣ Verificar logs do backend

```bash
pm2 logs backend --lines 50
```

**Procure por:**
- ✅ `🔔 Verificação de webhook recebida`
- ✅ `✅ Webhook verificado com sucesso!`
- ❌ `❌ Token de verificação inválido`

---

### 7️⃣ Verificar porta 3001

```bash
netstat -tulpn | grep 3001
```

**Resultado esperado:**
```
tcp        0      0 0.0.0.0:3001            0.0.0.0:*               LISTEN      12345/node
```

**Se NÃO aparecer nada:**
- Backend não está rodando
- Porta está errada no .env

---

### 8️⃣ Verificar firewall

```bash
sudo ufw status
```

**Certifique-se que as portas estão abertas:**
```
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
3001/tcp                   ALLOW       Anywhere
```

**Se a porta 3001 não estiver aberta:**
```bash
sudo ufw allow 3001/tcp
sudo ufw reload
```

---

## 🧪 TESTE FINAL

Após fazer as correções, teste novamente no Facebook Developers:

1. Vá em: **WhatsApp** → **Configuration** → **Webhooks**
2. Clique em **"Edit"**
3. Clique em **"Verify and Save"** novamente

**Resultado esperado:**
- ✅ Verificação bem-sucedida
- ✅ Status muda para "Ativo"

---

## 📊 CHECKLIST DE VERIFICAÇÃO NO SERVIDOR

Execute estes comandos no servidor:

```bash
# 1. Backend está rodando?
pm2 status | grep backend

# 2. Variáveis de webhook estão configuradas?
cat backend/.env | grep WEBHOOK

# 3. Porta 3001 está aberta?
netstat -tulpn | grep 3001

# 4. Nginx está configurado?
cat /etc/nginx/sites-available/default | grep webhook

# 5. Teste manual funciona?
curl -X GET "https://api.sistemasnettsistemas.com.br/api/webhook/tenant-4?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=teste"

# 6. Logs mostram algo?
pm2 logs backend --lines 20
```

---

## 🐛 PROBLEMAS COMUNS

### Problema 1: Backend não está rodando

**Sintoma:** `pm2 status` não mostra "backend" ou mostra "stopped"

**Solução:**
```bash
cd /var/www/disparador-api-oficial/backend
pm2 start npm --name backend -- start
pm2 save
```

---

### Problema 2: Variáveis não estão no .env

**Sintoma:** `cat .env | grep WEBHOOK` não retorna nada

**Solução:**
```bash
nano backend/.env
```

Adicione:
```env
WEBHOOK_VERIFY_TOKEN=seu_token_secreto
WEBHOOK_BASE_URL=https://api.sistemasnettsistemas.com.br
WEBHOOK_URL=https://api.sistemasnettsistemas.com.br/api/webhook
```

Reinicie:
```bash
pm2 restart backend
```

---

### Problema 3: Nginx não está redirecionando

**Sintoma:** `curl` retorna 404

**Solução:**
```bash
sudo nano /etc/nginx/sites-available/default
```

Adicione a configuração do webhook (veja passo 4).

Reinicie:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

### Problema 4: Token está errado

**Sintoma:** Logs mostram "❌ Token de verificação inválido"

**Solução:**
- Verifique o token no `.env` do servidor
- Verifique o token no Facebook Developers
- **DEVEM SER IGUAIS!**

---

### Problema 5: Porta 3001 bloqueada

**Sintoma:** `netstat` não mostra porta 3001

**Solução:**
```bash
# Verificar se o backend está rodando
pm2 status

# Se estiver rodando, verificar firewall
sudo ufw allow 3001/tcp
sudo ufw reload
```

---

## 📞 COMANDOS ÚTEIS

```bash
# Ver logs em tempo real
pm2 logs backend

# Reiniciar backend
pm2 restart backend

# Ver status
pm2 status

# Testar Nginx
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx

# Ver logs do Nginx
sudo tail -f /var/log/nginx/error.log

# Testar webhook
curl -X GET "https://api.sistemasnettsistemas.com.br/api/webhook/tenant-4?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=teste"
```

---

## 🎯 RESUMO

O problema é que o servidor online:
1. ❌ Não tem as variáveis de webhook no `.env`
2. ❌ Ou o backend não está rodando
3. ❌ Ou o Nginx não está configurado corretamente

**Solução:**
1. Conecte no servidor via SSH
2. Adicione as variáveis no `.env`
3. Reinicie o backend
4. Verifique o Nginx
5. Teste manualmente
6. Verifique novamente no Facebook Developers

---

**✅ Após corrigir, o webhook vai funcionar e o status mudará para "Ativo"!**



