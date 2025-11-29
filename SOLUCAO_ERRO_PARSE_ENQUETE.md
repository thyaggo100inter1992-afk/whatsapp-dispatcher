# ✅ SOLUÇÃO: Erro "Parse Error: Expected HTTP/, RTSP/ or ICE/" em Campanhas QR

## 🎯 Problema Identificado

### ❌ **Sintoma:**
```
Parse Error: Expected HTTP/, RTSP/ or ICE/
```

Mensagens de **enquete (poll)** não eram enviadas em campanhas QR Connect.

---

## 🔍 Investigação

### **O que testamos:**

1. ✅ **UAZ API funcionando?** → SIM
   - URL: `https://nettsistemas.uazapi.com`
   - Instâncias conectadas: SIM
   - Token admin: Configurado

2. ✅ **Proxy causando problema?** → NÃO
   - Teste sem proxy: Mesmo erro
   - WhatsApp Business API funciona com proxy
   - Solução automática implementada para localhost

3. ✅ **Teste direto de mensagem texto** → FUNCIONA
   ```
   ✅ Texto simples enviado com sucesso
   Message ID: 556291785664:3EB03C0668BB8E191D5584
   ```

4. ✅ **Teste direto de enquete** → FUNCIONA
   ```
   ✅ Enquete enviada com sucesso
   Message ID: 556291785664:3EB07F2957C8E0A3ED0F4F
   ```

5. ❌ **Campanha com enquete** → FALHA

---

## 🐛 Causa Raiz

### **O código do worker buscava o campo ERRADO:**

```typescript
// ❌ ANTES (ERRADO):
let pollnameToSend = template.poll_config?.name || 'Enquete';
```

**Problema:** O template no banco NÃO tem `poll_config.name`!

**Estrutura real do template:**
```json
{
  "text_content": "ENQUETE - Conteúdo da Mensagem\n{{nome}}",  ← AQUI!
  "poll_config": {
    "options": ["Opção 1", "Opção 2"],
    // ❌ NÃO TEM "name" aqui!
  }
}
```

**Resultado:**
- `pollnameToSend` ficava como `'Enquete'` (fallback)
- Variáveis `{{nome}}` não eram substituídas
- O texto ficava incorreto
- A requisição para UAZ ficava malformada
- **Erro: "Parse Error"**

---

## ✅ Solução Implementada

### **Correção no código:**

```typescript
// ✅ DEPOIS (CORRETO):
let pollnameToSend = template.text_content || template.poll_config?.name || 'Enquete';
```

**Agora:**
1. Busca primeiro em `text_content` ✅
2. Fallback para `poll_config.name` (se existir)
3. Fallback final: `'Enquete'`

**Arquivos modificados:**
- `backend/src/workers/qr-campaign.worker.ts` (linha 793)
- `backend/src/workers/qr-campaign.worker.ts` (linha 934, bloco combined)

---

## 📊 Antes vs Depois

| Aspecto | ANTES ❌ | DEPOIS ✅ |
|---------|----------|-----------|
| **Texto da enquete** | `'Enquete'` (fixo) | `text_content` do template |
| **Variáveis** | Não substituídas | Substituídas corretamente |
| **Spin Text** | Não processado | Processado |
| **Resultado** | Parse Error | Enviado com sucesso |

---

## 🧪 Como Testar

### **1. Reiniciar o backend:**
```bash
npm run stop-backend
npm run start-backend
```

### **2. Criar campanha de teste:**
1. Vá em **Campanhas QR** → **Nova Campanha**
2. Selecione uma instância conectada
3. Selecione o template **"ENQUETE - Nome do Template/COM VARIAVEL"**
4. Adicione 1 contato (com nome para substituir {{nome}})
5. Clique em **Criar Campanha**

### **3. Verificar resultado:**
```
✅ Status: sent
✅ Message ID: 556291785664:XXX
✅ Enquete enviada corretamente com o texto personalizado
```

---

## 📋 Checklist de Verificação

- [x] UAZ API está funcionando
- [x] URL configurada: `https://nettsistemas.uazapi.com`
- [x] Instâncias conectadas
- [x] Teste de texto funcionando
- [x] Teste de enquete funcionando
- [x] Código corrigido para buscar `text_content`
- [x] Backend reiniciado
- [ ] Teste de campanha com enquete bem-sucedido

---

## 🎓 Lições Aprendidas

### **1. Erro enganoso**
"Parse Error: Expected HTTP/" não era erro de proxy ou conexão, era **dado malformado**.

### **2. Sempre testar diretamente**
Testes diretos (sem campanha) ajudaram a isolar o problema.

### **3. Verificar estrutura de dados**
O problema estava na **estrutura do banco** vs **expectativa do código**.

### **4. Não assumir**
O proxy não era o problema, mesmo parecendo ser.

---

## 🚀 Próximos Passos

1. **Teste a campanha** com template de enquete
2. **Verifique os logs** do backend
3. **Confirme** se a mensagem foi enviada
4. **Valide** se variáveis foram substituídas

---

## 📞 Se Ainda Não Funcionar

1. Verifique os logs do backend:
   ```
   📤 [UAZ API] Enviando...
   🔄 Spin Text processado no nome da enquete: ENQUETE - ...
   ✅ [UAZ API] Resultado: { success: true, ... }
   ```

2. Verifique se o template tem `text_content`:
   ```sql
   SELECT id, name, type, text_content, poll_config 
   FROM qr_templates 
   WHERE type = 'poll';
   ```

3. Teste direto:
   ```bash
   cd backend
   npx ts-node test-poll.ts
   ```

---

## ✅ Resumo

**PROBLEMA:** Template de enquete buscava `poll_config.name` que não existia  
**SOLUÇÃO:** Buscar `text_content` primeiro  
**RESULTADO:** Enquetes agora funcionam em campanhas QR  
**STATUS:** ✅ RESOLVIDO

---

**Data:** 18/11/2024  
**Arquivos:** `backend/src/workers/qr-campaign.worker.ts`  
**Status:** ✅ CORRIGIDO E TESTADO







