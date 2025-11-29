# 🔴 Erro: "Parse Error: Expected HTTP/, RTSP/ or ICE/"

## ❌ O Problema

Ao tentar enviar uma mensagem, aparece o erro:
```
Parse Error: Expected HTTP/, RTSP/ or ICE/
```

**Status:** ❌ Falhou  
**Causa:** Problema com o **proxy** configurado na instância  

---

## 🔍 O Que Significa?

Esse erro acontece quando:
1. **O proxy está configurado mas não funciona** (offline, bloqueado, etc)
2. **O proxy retorna resposta inválida** (não é HTTP válido)
3. **Há problema de comunicação** entre seu servidor e o proxy
4. **O proxy está bloqueando** a requisição para o UAZ API

**Em resumo:** O sistema tentou usar um proxy para enviar a mensagem, mas o proxy não respondeu corretamente.

---

## ✅ SOLUÇÃO 1: Desabilitar o Proxy (Mais Rápida)

### **Opção A: Via SQL (Recomendado)**

1. Abra o **pgAdmin** ou **psql**
2. Execute o comando:

```sql
-- Desabilitar proxy da instância 556291785664
UPDATE uaz_instances
SET proxy_enabled = false
WHERE phone_number = '556291785664';

-- Verificar
SELECT phone_number, proxy_host, proxy_enabled
FROM uaz_instances
WHERE phone_number = '556291785664';
```

### **Opção B: Via Interface (Se tiver)**

1. Vá em **Configurações → Instâncias**
2. Encontre a instância **556291785664**
3. Desmarque a opção **"Usar Proxy"**
4. Salve

### **Opção C: Remover Proxy Completamente**

```sql
-- Remover todas as configurações de proxy
UPDATE uaz_instances
SET 
    proxy_host = NULL,
    proxy_port = NULL,
    proxy_username = NULL,
    proxy_password = NULL,
    proxy_enabled = false
WHERE phone_number = '556291785664';
```

---

## ✅ SOLUÇÃO 2: Sistema de Retry Automático (JÁ IMPLEMENTADO)

**BOA NOTÍCIA:** O sistema agora tenta **automaticamente sem proxy** se o proxy falhar!

### **Como Funciona:**

```
1. Tenta enviar COM proxy
        ↓ (falhou)
2. Detecta erro de proxy
        ↓
3. Tenta novamente SEM proxy
        ↓
4. Sucesso! ✅
```

**Logs que você verá:**
```
🌐 [UAZ Service] Configurando proxy: proxy.example.com:8080
⚠️  [UAZ Service] Erro com proxy, tentando sem proxy...
✅ [UAZ Service] Sucesso na segunda tentativa SEM proxy!
```

---

## 🧪 TESTAR A CORREÇÃO

### **1. Reinicie o Backend**

```bash
cd backend
npm run stop-backend
npm run start-backend
```

### **2. Tente Enviar Novamente**

1. Crie uma nova campanha de teste
2. Adicione **UM** número apenas
3. Clique em "Criar Campanha"
4. **Monitore os logs** do backend

### **3. Verifique os Logs**

**Se funcionou COM proxy:**
```
🌐 [UAZ Service] Configurando proxy: ...
📩 UAZ Response - Message ID: 556291785664:XXX
✅ Mensagem enviada!
```

**Se funcionou SEM proxy (fallback):**
```
🌐 [UAZ Service] Configurando proxy: ...
⚠️  [UAZ Service] Erro com proxy, tentando sem proxy...
📡 [UAZ Service] Usando conexão direta (sem proxy)
✅ [UAZ Service] Sucesso na segunda tentativa SEM proxy!
📩 UAZ Response - Message ID: 556291785664:XXX
```

**Se falhou em ambas:**
```
🌐 [UAZ Service] Configurando proxy: ...
⚠️  [UAZ Service] Erro com proxy, tentando sem proxy...
❌ [UAZ Service] Falhou também sem proxy: [erro]
```

---

## 🔧 SOLUÇÃO 3: Corrigir o Proxy

Se você **PRECISA** do proxy (por exemplo, para evitar bloqueios), veja como corrigir:

### **Verificar Proxy:**

1. **Teste se o proxy está online:**
   ```bash
   curl -x http://proxy.example.com:8080 http://google.com
   ```

2. **Verifique as credenciais:**
   ```sql
   SELECT proxy_host, proxy_port, proxy_username
   FROM uaz_instances
   WHERE phone_number = '556291785664';
   ```

3. **Teste o proxy com o UAZ:**
   ```bash
   curl -x http://proxy.example.com:8080 http://localhost:8081/instance/status
   ```

### **Configurações Comuns de Proxy:**

```sql
-- Proxy sem autenticação
UPDATE uaz_instances
SET 
    proxy_host = '123.45.67.89',
    proxy_port = 8080,
    proxy_username = NULL,
    proxy_password = NULL,
    proxy_enabled = true
WHERE phone_number = '556291785664';

-- Proxy com autenticação
UPDATE uaz_instances
SET 
    proxy_host = '123.45.67.89',
    proxy_port = 8080,
    proxy_username = 'usuario',
    proxy_password = 'senha',
    proxy_enabled = true
WHERE phone_number = '556291785664';
```

---

## 📊 Comparação: Com Proxy vs Sem Proxy

| Aspecto | COM Proxy | SEM Proxy |
|---------|-----------|-----------|
| **Velocidade** | 🐢 Mais lento | 🚀 Mais rápido |
| **Confiabilidade** | ⚠️ Depende do proxy | ✅ Mais confiável |
| **Bloqueios** | ✅ Menos bloqueios (com proxy bom) | ⚠️ Mais bloqueios |
| **Custo** | 💰 Pago (proxies premium) | 🆓 Grátis |
| **Setup** | 🔧 Complexo | ✅ Simples |

---

## 🚨 Erros Relacionados

Se você ver esses erros, também pode ser problema de proxy:

| Erro | Causa |
|------|-------|
| `ECONNREFUSED` | Proxy rejeitou a conexão |
| `ETIMEDOUT` | Proxy demorou demais para responder |
| `Parse Error: Expected HTTP/` | Proxy retornou dados inválidos |
| `Socket hang up` | Proxy encerrou a conexão |
| `Network Error` | Proxy não acessível |

**Solução:** Desabilitar proxy ou usar outro proxy.

---

## 📝 Script SQL Completo

Execute este script no banco de dados:

```sql
-- 1. Ver todas instâncias com proxy
SELECT 
    id, phone_number, proxy_host, proxy_port, proxy_enabled
FROM uaz_instances
WHERE proxy_host IS NOT NULL;

-- 2. Desabilitar proxy da instância com problema
UPDATE uaz_instances
SET proxy_enabled = false
WHERE phone_number = '556291785664';

-- 3. Verificar se foi aplicado
SELECT 
    phone_number, 
    proxy_host, 
    proxy_port, 
    proxy_enabled,
    is_connected
FROM uaz_instances
WHERE phone_number = '556291785664';

-- 4. (OPCIONAL) Desabilitar proxy de TODAS as instâncias
-- UPDATE uaz_instances SET proxy_enabled = false;
```

---

## ✅ Checklist de Resolução

- [ ] Identifiquei a instância com problema: **556291785664**
- [ ] Executei o SQL para desabilitar o proxy
- [ ] Reiniciei o backend
- [ ] Testei enviar mensagem novamente
- [ ] Verifiquei os logs do backend
- [ ] Mensagem foi enviada com sucesso ✅

---

## 🎯 Fluxo de Diagnóstico

```
Erro: "Parse Error: Expected HTTP/"
        ↓
É erro de PROXY
        ↓
Opção 1: Desabilitar proxy → TESTE
        ↓ (funcionou)
✅ PROBLEMA RESOLVIDO!

        ↓ (não funcionou)
Opção 2: Verificar UAZ API
        ↓
curl http://localhost:8081/instance/status
        ↓ (offline)
❌ UAZ API não está rodando!
        ↓ (online)
Opção 3: Verificar instância
        ↓
SELECT * FROM uaz_instances WHERE phone_number = '556291785664';
        ↓
Instância desconectada? → Reconectar
        ↓
Token inválido? → Gerar novo token
```

---

## 💡 Recomendação

**Para envios em TESTE:**
- ✅ Use **sem proxy** (mais rápido e confiável)

**Para envios em PRODUÇÃO:**
- ✅ Use **com proxy** (evita bloqueios do WhatsApp)
- ✅ Use proxies **pagos e confiáveis**
- ✅ Teste o proxy antes de usar

---

## 📞 Ainda Não Funcionou?

Se mesmo depois de:
1. ✅ Desabilitar o proxy
2. ✅ Reiniciar o backend
3. ✅ Testar novamente

**Ainda assim falhar:**

### Verifique:

1. **UAZ API está rodando?**
   ```bash
   curl http://localhost:8081/instance/status
   ```

2. **Instância está conectada?**
   ```sql
   SELECT is_connected FROM uaz_instances WHERE phone_number = '556291785664';
   ```

3. **Token está válido?**
   ```sql
   SELECT instance_token FROM uaz_instances WHERE phone_number = '556291785664';
   ```

4. **Verifique o .env:**
   ```env
   UAZ_API_URL=http://localhost:8081
   UAZ_ADMIN_TOKEN=seu_token_aqui
   ```

---

## 📚 Arquivos Criados

1. `backend/fix-proxy-issue.sql` - Script SQL para corrigir
2. `ERRO_PARSE_HTTP_PROXY.md` - Esta documentação
3. **backend/src/services/uazService.js** - Atualizado com retry automático

---

## ✅ Resumo da Solução

**PROBLEMA:** Proxy configurado não funciona  
**SOLUÇÃO RÁPIDA:** Desabilitar proxy  
**SOLUÇÃO AUTOMÁTICA:** Sistema tenta sem proxy se falhar  
**SOLUÇÃO PERMANENTE:** Usar proxy confiável ou desabilitar  

---

**Data:** 18/11/2024  
**Status:** ✅ CORRIGIDO  
**Sistema:** Retry automático implementado  
**Ação necessária:** Desabilitar proxy ou aguardar retry automático







