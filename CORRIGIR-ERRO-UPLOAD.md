# ⚠️ ERRO 500 NO UPLOAD DE SCREENSHOTS - SOLUÇÃO

## 🔴 ERRO IDENTIFICADO

```
POST http://localhost:3001/api/admin/screenshots/upload 500 (Internal Server Error)
```

---

## ✅ SOLUÇÕES

### **1️⃣ REINICIAR O BACKEND (Principal)**

O backend precisa ser reiniciado para carregar as novas rotas de screenshots!

**Windows PowerShell:**
```powershell
# No terminal do backend:
Ctrl + C  (para parar)

# Depois:
npm run dev
```

**Ou feche e abra o terminal do backend novamente**

---

### **2️⃣ VERIFICAR PASTA DE UPLOADS**

A pasta já foi criada automaticamente, mas confirme:

```
✅ uploads/screenshots/ 
```

---

### **3️⃣ TESTAR NOVAMENTE**

Após reiniciar o backend:

1. Acesse: `http://localhost:3000/admin/landing-page`
2. Pressione: `Ctrl + F5` (hard refresh)
3. Tente fazer upload novamente
4. ✅ Deve funcionar!

---

## 🔍 SE AINDA DER ERRO

Verifique no terminal do backend se aparece:

```
✅ Rota /admin/screenshots registrada (apenas super_admin)
✅ Rota /public/screenshots registrada (sem autenticação)
```

Se não aparecer essas mensagens, o backend não carregou as novas rotas.

---

## 📋 CHECKLIST

- [ ] Backend reiniciado
- [ ] Pasta `uploads/screenshots/` existe
- [ ] Frontend refreshed (Ctrl+F5)
- [ ] Logged in como Super Admin
- [ ] Arquivo de imagem válido (PNG, JPG, etc)
- [ ] Tamanho menor que 5MB

---

**🔥 REINICIE O BACKEND E TESTE NOVAMENTE!**



