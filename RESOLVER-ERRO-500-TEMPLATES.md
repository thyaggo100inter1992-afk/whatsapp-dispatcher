# 🐛 RESOLVER ERRO 500 - Templates

## ❌ ERRO:
```
GET http://localhost:3001/api/qr-templates 500 (Internal Server Error)
```

---

## 🔧 SOLUÇÃO RÁPIDA (3 Passos):

### **Passo 1: Aplicar Migration**
```bash
.\APLICAR-QR-TEMPLATES.bat
```

Isso cria as tabelas no banco de dados.

### **Passo 2: Parar Backend**
```bash
# Pressione Ctrl+C no terminal do backend
# Ou feche a janela
```

### **Passo 3: Iniciar Backend Novamente**
```bash
.\INICIAR_BACKEND.bat
```

### **Passo 4: Testar**
Acesse: `http://localhost:3000/qr-templates`

---

## 🔍 SE AINDA NÃO FUNCIONAR:

### **1. Verificar se o Backend está rodando:**
```bash
# Deve aparecer algo como:
# "Server running on port 3001"
```

### **2. Testar API manualmente:**
Abra o navegador e acesse:
```
http://localhost:3001/api/qr-templates
```

**Deve retornar:**
```json
{
  "success": true,
  "data": [],
  "total": 0
}
```

### **3. Verificar tabelas no banco:**
```bash
psql -U postgres -d whatsapp_dispatcher
```

Depois:
```sql
\dt qr_*
```

**Deve mostrar:**
```
           Lista de relações
 Esquema |       Nome        | Tipo  |  Dono    
---------+-------------------+-------+----------
 public  | qr_template_media | table | postgres
 public  | qr_templates      | table | postgres
```

### **4. Ver logs do backend:**
No terminal do backend, procure por erros como:
```
❌ relation "qr_templates" does not exist
❌ Cannot find module...
❌ pool.query is not a function
```

---

## 🛠️ CORREÇÕES AUTOMÁTICAS:

Fizemos as seguintes correções nos arquivos:

✅ **Controller convertido para TypeScript**
- `qr-template.controller.js` → `qr-template.controller.ts`
- Corrigidos imports ES6

✅ **Rotas convertidas para TypeScript**
- `qr-templates.routes.js` → `qr-templates.routes.ts`
- Corrigidos imports

✅ **Index.ts atualizado**
- Import correto das novas rotas

---

## 📋 CHECKLIST:

- [ ] 1. Executei `.\APLICAR-QR-TEMPLATES.bat`
- [ ] 2. Parei o backend
- [ ] 3. Iniciei o backend novamente
- [ ] 4. Aguardei 10 segundos
- [ ] 5. Atualizei a página no navegador (F5)
- [ ] 6. Testei acessar `/qr-templates`

---

## 🎯 SCRIPT AUTOMÁTICO:

Execute:
```bash
.\CORRIGIR-ERRO-TEMPLATES.bat
```

Este script:
1. ✅ Verifica tabelas
2. ✅ Para o backend
3. ✅ Reinicia o backend

---

## ⚠️ ERROS COMUNS E SOLUÇÕES:

### **Erro: "relation qr_templates does not exist"**
**Causa:** Tabelas não foram criadas  
**Solução:** Execute `.\APLICAR-QR-TEMPLATES.bat`

### **Erro: "Cannot find module"**
**Causa:** Backend não foi recompilado  
**Solução:** 
1. Pare o backend
2. Delete pasta `backend/dist/` (se existir)
3. Inicie novamente

### **Erro: "ECONNREFUSED"**
**Causa:** Backend não está rodando  
**Solução:** Execute `.\INICIAR_BACKEND.bat`

### **Erro: "pool.query is not a function"**
**Causa:** Import incorreto da conexão  
**Solução:** Já foi corrigido! Reinicie o backend.

---

## 🔄 REINICIAR COMPLETAMENTE:

Se nada funcionar, faça um reset completo:

```bash
# 1. Parar tudo
taskkill /F /IM node.exe /T

# 2. Aplicar migrations
.\APLICAR-QR-TEMPLATES.bat

# 3. Limpar cache (se houver)
cd backend
rmdir /S /Q dist
cd ..

# 4. Iniciar backend
.\INICIAR_BACKEND.bat

# 5. Aguardar 10 segundos
# 6. Testar novamente
```

---

## 📞 VERIFICAÇÃO FINAL:

**Teste 1: API Backend**
```
http://localhost:3001/api/qr-templates
```
✅ Deve retornar JSON com success: true

**Teste 2: Frontend**
```
http://localhost:3000/qr-templates
```
✅ Deve carregar a página (mesmo vazia)

**Teste 3: Console do navegador (F12)**
```
GET http://localhost:3001/api/qr-templates 200 OK
```
✅ Status deve ser 200, não 500

---

## ✅ QUANDO ESTIVER FUNCIONANDO:

Você verá:
- ✅ Página carrega sem erro
- ✅ "0 template(s) encontrado(s)"
- ✅ Botão "Criar Novo Template" funciona
- ✅ Console sem erros 500

---

**Siga os passos na ordem e o erro será resolvido! 🚀**










