# 🚀 Como Iniciar o Backend CORRETAMENTE

## ⚠️ **MUITO IMPORTANTE - LEIA ISSO!**

### ❌ **NUNCA FAÇA ISSO:**
```bash
cd backend
npm run dev    # ❌ NÃO EXECUTE DIRETAMENTE!
```

**Por quê?**
- Se o backend já estiver rodando, vai dar erro `EADDRINUSE`
- Você vai ter que ficar matando processos manualmente
- Pode causar problemas de porta ocupada

---

## ✅ **FORMA CORRETA: Use o Script**

### **Opção 1: Clique no arquivo**
1. Vá na pasta do projeto
2. Clique **duas vezes** no arquivo:
   ```
   INICIAR_BACKEND.bat
   ```
3. Pronto! Uma janela do CMD vai abrir com o backend rodando

### **Opção 2: Execute via terminal**
```bash
.\INICIAR_BACKEND.bat
```

---

## 🔧 **O Que o Script Faz Automaticamente**

### **1. Para processos antigos**
```
========================================
  PARANDO PROCESSOS ANTIGOS...
========================================

🔴 Parando processo 12345...
```

### **2. Aguarda 2 segundos**
- Garante que a porta foi liberada

### **3. Inicia o backend**
```
========================================
  INICIANDO BACKEND
========================================

Backend rodará em: http://localhost:3001
```

---

## 🛑 **Como PARAR o Backend**

### **Método 1: Ctrl+C (Recomendado)**
1. Vá na janela do CMD onde o backend está rodando
2. Pressione **Ctrl+C**
3. Aguarde o processo terminar

### **Método 2: Fechar a Janela**
1. Clique no **X** da janela do CMD
2. Confirme se perguntado

### **Método 3: Matar Processo Manualmente**
```bash
# Encontra o PID
netstat -ano | findstr :3001

# Mata o processo
taskkill /F /PID [número]
```

---

## 🔄 **Como REINICIAR o Backend**

### **Quando reiniciar?**
- Depois de fazer alterações no código
- Se o backend travou
- Se quer aplicar novas configurações

### **Como fazer:**
1. **Pare** o backend (Ctrl+C na janela do CMD)
2. **Execute** novamente:
   ```bash
   .\INICIAR_BACKEND.bat
   ```

**OU simplesmente:**
- Execute `.\INICIAR_BACKEND.bat` novamente
- O script vai **automaticamente** parar o processo antigo!

---

## 📊 **Status do Backend**

### **Como verificar se está rodando:**

#### **Método 1: Via Browser**
Abra no navegador:
```
http://localhost:3001/api/health
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "API is running",
  "timestamp": "2025-11-15T21:55:43.902Z"
}
```

#### **Método 2: Via PowerShell**
```powershell
curl http://localhost:3001/api/health
```

#### **Método 3: Verificar porta**
```bash
netstat -ano | findstr :3001
```
- Se mostrar algum resultado → Backend está rodando
- Se não mostrar nada → Backend está parado

---

## 🚨 **Problemas Comuns**

### **Problema 1: "EADDRINUSE: address already in use"**

**Causa:** Backend já está rodando na porta 3001

**Solução:**
1. Use `.\INICIAR_BACKEND.bat` (o script mata processos automaticamente)
2. **OU** mate o processo manualmente:
   ```bash
   # PowerShell
   netstat -ano | findstr :3001
   taskkill /F /PID [número]
   ```

### **Problema 2: Backend não inicia**

**Possíveis causas:**
- Banco de dados não está rodando
- Variáveis de ambiente (.env) estão erradas
- Dependências não foram instaladas

**Solução:**
1. Verifique se PostgreSQL está rodando
2. Verifique o arquivo `.env` no backend
3. Execute:
   ```bash
   cd backend
   npm install
   ```

### **Problema 3: Backend trava ou não responde**

**Solução:**
1. Pressione **Ctrl+C** na janela do CMD
2. Execute novamente:
   ```bash
   .\INICIAR_BACKEND.bat
   ```

---

## 📝 **Checklist Rápido**

Antes de testar o sistema:

- [ ] Backend está rodando? (janela CMD aberta)
- [ ] Backend responde em http://localhost:3001/api/health?
- [ ] PostgreSQL está rodando?
- [ ] Arquivo .env está configurado?

---

## 🎯 **Comandos Úteis**

### **Ver logs do backend em tempo real**
- Os logs aparecem automaticamente na janela do CMD

### **Verificar se porta 3001 está ocupada**
```bash
netstat -ano | findstr :3001
```

### **Matar TODOS os processos Node.js** (CUIDADO!)
```bash
taskkill /F /IM node.exe /T
```
⚠️ **Atenção:** Isso vai matar TODOS os processos Node.js, incluindo frontend, etc.

---

## ✅ **Resumo**

### **Para Iniciar:**
```bash
.\INICIAR_BACKEND.bat
```

### **Para Parar:**
- Pressione **Ctrl+C** na janela do CMD

### **Para Reiniciar:**
```bash
.\INICIAR_BACKEND.bat
```
(O script mata processos antigos automaticamente)

### **NUNCA faça:**
```bash
cd backend
npm run dev    # ❌ NÃO!
```

---

## 🆘 **Precisa de Ajuda?**

Se o backend não iniciar após seguir estes passos:

1. ✅ Copie a mensagem de erro COMPLETA
2. ✅ Tire um print da janela do CMD
3. ✅ Verifique se PostgreSQL está rodando
4. ✅ Me envie as informações

---

**Data de Criação:** 15/11/2025  
**Versão:** 1.0  
**Status:** ✅ Script atualizado com auto-kill de processos antigos










