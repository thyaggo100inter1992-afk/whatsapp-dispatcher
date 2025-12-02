# 🚀 EXECUTAR ATUALIZAÇÃO NO SERVIDOR - AGORA!

## ✅ STATUS ATUAL:

| Item | Status |
|------|--------|
| Problema | ✅ Identificado |
| Código | ✅ Corrigido |
| Git | ✅ Commitado |
| GitHub | ✅ Atualizado |
| **Servidor** | ⏳ **AGUARDANDO EXECUÇÃO** |

---

## 📋 O QUE FOI FEITO:

✅ Corrigido o problema da prévia de imagem em templates QR Connect
✅ URL relativa agora é convertida para URL absoluta
✅ Commit e push feitos com sucesso
✅ Código está no GitHub pronto para ser baixado

---

## 🎯 AGORA VOCÊ PRECISA FAZER:

### **PASSO 1: Conectar ao Servidor**

Abra o **PowerShell** e execute:

```powershell
ssh root@72.60.141.244
```

Quando pedir a senha, digite: `Tg74108520963,` (com a vírgula no final)

---

### **PASSO 2: Executar Atualização Automática**

Após conectar, copie e cole este comando (tudo em uma linha):

```bash
cd /root/whatsapp-dispatcher && curl -O https://raw.githubusercontent.com/thyaggo100inter1992-afk/whatsapp-dispatcher/main/atualizar-sistema-completo.sh && chmod +x atualizar-sistema-completo.sh && ./atualizar-sistema-completo.sh
```

Esse comando vai:
1. 📥 Baixar o código atualizado do GitHub
2. 🔧 Recompilar o backend
3. 🎨 Recompilar o frontend
4. 🔄 Reiniciar todos os serviços

---

## 🆘 SE PREFERIR FAZER MANUALMENTE:

Se o script automático não funcionar, execute estes comandos **um por um**:

```bash
# 1. Ir para a pasta do projeto
cd /root/whatsapp-dispatcher

# 2. Baixar código do GitHub
git pull origin main

# 3. Backend - Recompilar
cd backend
rm -rf dist
npm install
npm run build

# 4. Frontend - Recompilar
cd ../frontend
npm install
npm run build

# 5. Reiniciar serviços
pm2 restart whatsapp-backend
pm2 restart whatsapp-frontend

# 6. Verificar status
pm2 status
```

---

## ✅ DEPOIS DE ATUALIZAR:

1. Acesse: **https://sistemasnettsistemas.com.br**
2. Pressione **Ctrl + Shift + R** para recarregar sem cache
3. Vá em **"Criar Template"** no QR Connect
4. Selecione o tipo **"Imagem"**
5. Faça upload de uma imagem
6. **A prévia deve aparecer agora!** 🎉

---

## 📊 VERIFICAÇÃO FINAL:

Execute no servidor para ver se os serviços estão rodando:

```bash
pm2 status
```

Deve mostrar:
- ✅ whatsapp-backend: **online**
- ✅ whatsapp-frontend: **online**

---

## 🚨 SE DER ERRO:

Execute:

```bash
pm2 logs whatsapp-backend --lines 50
```

E me envie os últimos erros que aparecerem.

---

**Pronto para executar? Vamos lá! 🚀**

