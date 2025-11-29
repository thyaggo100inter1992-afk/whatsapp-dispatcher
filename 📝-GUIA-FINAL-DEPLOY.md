# 🎉 DEPLOY COMPLETO - GUIA FINAL

**Data:** 29/11/2025  
**Repositório:** https://github.com/thyaggo100inter1992-afk/whatsapp-dispatcher  
**Servidor:** 72.60.141.244  
**Status:** ✅ PRONTO PARA INSTALAR NO SERVIDOR

---

## ✅ PARTE 1: WINDOWS (CONCLUÍDA!)

```
✅ node_modules removidos (~1 GB)
✅ Arquivos compilados removidos
✅ Git inicializado
✅ 1.015 arquivos commitados
✅ Código enviado para GitHub
```

**Repositório GitHub:** https://github.com/thyaggo100inter1992-afk/whatsapp-dispatcher

---

## 🖥️ PARTE 2: SERVIDOR (AGORA!)

### **Opção A: Copiar Blocos Manualmente** ⭐ RECOMENDADO

1. **Abrir arquivo:** `SERVIDOR-COMANDOS-COMPLETOS.sh`
2. **Conectar SSH:**
   ```bash
   ssh root@72.60.141.244
   # Senha: Tg74108520963,
   ```
3. **Copiar cada BLOCO** (2 a 10) e colar no terminal
4. **Aguardar** cada bloco terminar antes do próximo

**Tempo total:** ~20-25 minutos

---

### **Opção B: Upload e Executar Script** (Mais Rápido)

1. **Conectar SSH:**
   ```bash
   ssh root@72.60.141.244
   # Senha: Tg74108520963,
   ```

2. **Criar o script no servidor:**
   ```bash
   cd /root
   nano install.sh
   ```

3. **Copiar TODO o conteúdo** de `SERVIDOR-COMANDOS-COMPLETOS.sh`

4. **Colar no nano** (Ctrl+Shift+V)

5. **Salvar:** Ctrl+O, Enter, Ctrl+X

6. **Executar:**
   ```bash
   chmod +x install.sh
   ./install.sh
   ```

**Tempo total:** ~20 minutos (automático)

---

## ⚠️ IMPORTANTE - DNS

**ANTES de executar os comandos, configure o DNS:**

No painel do seu domínio (onde você registrou sistemasnettsistemas.com.br):

```
Tipo: A
Host: api
Valor: 72.60.141.244
TTL: 3600
```

**Verificar se está apontado:**
```bash
nslookup api.sistemasnettsistemas.com.br
```

Deve retornar: `72.60.141.244`

---

## 📋 CHECKLIST DE EXECUÇÃO

### Antes de começar:
```
☐ DNS da API configurado (api.sistemasnettsistemas.com.br → 72.60.141.244)
☐ Acesso SSH funcionando (ssh root@72.60.141.244)
☐ Arquivo SERVIDOR-COMANDOS-COMPLETOS.sh aberto
```

### Durante a instalação:
```
☐ BLOCO 2: Dependências instaladas (Node.js, PostgreSQL, NGINX, PM2)
☐ BLOCO 3: Banco de dados criado e testado
☐ BLOCO 4: Repositório clonado do GitHub
☐ BLOCO 5: Backend configurado (.env criado, npm install, compilado)
☐ BLOCO 6: Frontend configurado (.env.local criado, npm install, compilado)
☐ BLOCO 7: NGINX configurado (proxy reverso)
☐ BLOCO 8: Serviços iniciados com PM2
☐ BLOCO 8b: Comando pm2 startup executado
☐ BLOCO 9: SSL configurado (certbot)
☐ BLOCO 10: Verificações OK
```

### Após instalação:
```
☐ pm2 list mostra 2 serviços rodando
☐ curl http://localhost:3001/api/health responde
☐ https://sistemasnettsistemas.com.br abre
☐ https://api.sistemasnettsistemas.com.br/api/health responde
```

---

## 🎯 ESTRUTURA NO SERVIDOR

```
/root/
└── whatsapp-dispatcher/
    ├── backend/
    │   ├── .env                    (criado pelo script)
    │   ├── node_modules/           (instalado pelo npm)
    │   ├── dist/                   (compilado)
    │   ├── src/
    │   └── package.json
    │
    ├── frontend/
    │   ├── .env.local              (criado pelo script)
    │   ├── node_modules/           (instalado pelo npm)
    │   ├── .next/                  (compilado)
    │   ├── src/
    │   └── package.json
    │
    └── [arquivos do projeto]
```

---

## 🚨 TROUBLESHOOTING

### Se der erro no BLOCO 3 (Banco de Dados):
```bash
# Verificar se PostgreSQL está rodando
systemctl status postgresql

# Se não estiver, iniciar
systemctl start postgresql
systemctl enable postgresql
```

### Se der erro no BLOCO 5 ou 6 (npm install):
```bash
# Limpar cache do npm
npm cache clean --force

# Tentar novamente
npm install
```

### Se der erro no BLOCO 8 (PM2):
```bash
# Ver logs
pm2 logs

# Se backend não iniciar, verificar .env
cat /root/whatsapp-dispatcher/backend/.env

# Se frontend não iniciar, verificar .env.local
cat /root/whatsapp-dispatcher/frontend/.env.local
```

### Se der erro no BLOCO 9 (SSL):
```bash
# Verificar se DNS está apontado
nslookup api.sistemasnettsistemas.com.br
nslookup sistemasnettsistemas.com.br

# Aguardar propagação do DNS (até 24h, mas geralmente 15-30 min)
```

---

## 🔄 ATUALIZAÇÕES FUTURAS

Quando você fizer mudanças no código:

### No Windows:
```bash
git add .
git commit -m "Descrição da mudança"
git push
```

### No Servidor:
```bash
ssh root@72.60.141.244
cd /root/whatsapp-dispatcher

# Baixar atualizações
git pull

# Backend
cd backend
npm install
npm run build
cd ..

# Frontend
cd frontend
npm install
npm run build
cd ..

# Reiniciar serviços
pm2 restart all
```

**Tempo:** ~3-5 minutos ⚡

---

## 📊 COMANDOS ÚTEIS

```bash
# Ver status dos serviços
pm2 list

# Ver logs em tempo real
pm2 logs

# Ver logs do backend
pm2 logs whatsapp-backend

# Ver logs do frontend
pm2 logs whatsapp-frontend

# Reiniciar tudo
pm2 restart all

# Reiniciar só backend
pm2 restart whatsapp-backend

# Reiniciar só frontend
pm2 restart whatsapp-frontend

# Parar tudo
pm2 stop all

# Ver uso de recursos
pm2 monit

# Status do NGINX
systemctl status nginx

# Recarregar NGINX
systemctl reload nginx

# Ver logs do NGINX
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

---

## 🎉 RESULTADO FINAL

Quando tudo estiver funcionando:

✅ **Frontend:** https://sistemasnettsistemas.com.br  
✅ **API:** https://api.sistemasnettsistemas.com.br/api/health  
✅ **SSL:** Certificado válido (cadeado verde)  
✅ **Auto-start:** Serviços reiniciam automaticamente se o servidor reiniciar  
✅ **GitHub:** Código versionado e com backup  

---

## 📞 CREDENCIAIS IMPORTANTES

### Servidor:
```
SSH: root@72.60.141.244
Senha: Tg74108520963,
```

### Banco de Dados:
```
Host: localhost
Port: 5432
Database: whatsapp_dispatcher
User: whatsapp_user
Password: Senhaforte123!@#
```

### GitHub:
```
Repositório: https://github.com/thyaggo100inter1992-afk/whatsapp-dispatcher
Branch: main
```

---

## ⏱️ TEMPO ESTIMADO

| Etapa | Tempo |
|-------|-------|
| Bloco 2: Instalar dependências | 5 min |
| Bloco 3: Banco de dados | 1 min |
| Bloco 4: Clonar repositório | 1 min |
| Bloco 5: Backend (npm install + build) | 5 min |
| Bloco 6: Frontend (npm install + build) | 8 min |
| Bloco 7: NGINX | 1 min |
| Bloco 8: PM2 | 1 min |
| Bloco 9: SSL | 2 min |
| **TOTAL** | **~25 minutos** |

---

## 🎯 PRÓXIMO PASSO

**ABRA O ARQUIVO:**  
`SERVIDOR-COMANDOS-COMPLETOS.sh`

**E EXECUTE OS BLOCOS NO SERVIDOR!**

**Boa sorte! 🚀**

---

**Documento criado em:** 29/11/2025  
**Status:** ✅ Pronto para deploy  
**Método:** GitHub + SSH  
**Prevenção de erros:** ✅ Implementada

