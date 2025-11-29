# ⚡ CHECKLIST VISUAL - INSTALAÇÃO SERVIDOR

**Data:** 29/11/2025  
**Tempo Total Estimado:** 2-3 horas  
**Dificuldade:** Intermediária

---

## 📊 PROGRESSO DA INSTALAÇÃO

```
[  ] 1. Preparação do Servidor (15 min)
[  ] 2. Banco de Dados (10 min)
[  ] 3. Código e Configuração (20 min)
[  ] 4. Migrations (15 min)
[  ] 5. Build dos Projetos (15 min)
[  ] 6. NGINX (20 min)
[  ] 7. SSL/HTTPS (10 min)
[  ] 8. PM2 (10 min)
[  ] 9. Testes (15 min)
[  ] 10. Verificações Finais (10 min)

Total: 0/10 etapas concluídas
```

---

## 1️⃣ PREPARAÇÃO DO SERVIDOR (15 min)

### ✅ Tarefas

```bash
☐ Conectar via SSH ao servidor
☐ Atualizar sistema (apt update && upgrade)
☐ Instalar Node.js 20.x
☐ Instalar PostgreSQL
☐ Instalar NGINX
☐ Instalar PM2
☐ Instalar Certbot
```

### 🔍 Verificação

```bash
# Copiar e colar no terminal:
echo "=== VERIFICAÇÃO DE INSTALAÇÕES ==="
echo "Node.js: $(node -v)"
echo "npm: $(npm -v)"
echo "PostgreSQL: $(psql --version | head -1)"
echo "NGINX: $(nginx -v 2>&1)"
echo "PM2: $(pm2 -v)"
echo "Certbot: $(certbot --version 2>&1 | head -1)"
echo "=================================="
```

**Resultado Esperado:**
```
=== VERIFICAÇÃO DE INSTALAÇÕES ===
Node.js: v20.x.x
npm: 10.x.x
PostgreSQL: psql (PostgreSQL) 14.x
NGINX: nginx version: nginx/1.18.x
PM2: 5.x.x
Certbot: certbot 1.x.x
==================================
```

### ✅ Status
- [ ] Todas as dependências instaladas
- [ ] Versões corretas verificadas

---

## 2️⃣ BANCO DE DADOS (10 min)

### ✅ Tarefas

```bash
☐ Criar banco de dados "whatsapp_dispatcher"
☐ Criar usuário "whatsapp_user"
☐ Definir senha forte
☐ Dar permissões ao usuário
☐ Testar conexão
```

### 🔍 Verificação

```bash
# Testar conexão (vai pedir senha)
psql -U whatsapp_user -d whatsapp_dispatcher -h localhost -c "SELECT version();"
```

**Resultado Esperado:**
```
PostgreSQL 14.x on x86_64-pc-linux-gnu, compiled by gcc...
```

### ✅ Status
- [ ] Banco criado com sucesso
- [ ] Usuário criado e com permissões
- [ ] Conexão testada e funcionando

---

## 3️⃣ CÓDIGO E CONFIGURAÇÃO (20 min)

### ✅ Tarefas - Backend

```bash
☐ Código enviado para /root/apps/whatsapp-dispatcher/
☐ Arquivo .env criado
☐ Variáveis configuradas (DB_*, JWT_SECRET, etc)
☐ npm install executado
☐ Sem erros de dependências
```

### ✅ Tarefas - Frontend

```bash
☐ Arquivo .env.local criado
☐ NEXT_PUBLIC_API_URL configurado
☐ NEXT_PUBLIC_SOCKET_URL configurado
☐ npm install executado
☐ Sem erros de dependências
```

### 🔍 Verificação

```bash
# Verificar arquivos de configuração
echo "=== BACKEND .env ==="
ls -la /root/apps/whatsapp-dispatcher/backend/.env && echo "✅ Existe" || echo "❌ NÃO EXISTE"
echo ""
echo "=== FRONTEND .env.local ==="
ls -la /root/apps/whatsapp-dispatcher/frontend/.env.local && echo "✅ Existe" || echo "❌ NÃO EXISTE"
echo ""
echo "=== DEPENDÊNCIAS ==="
ls -la /root/apps/whatsapp-dispatcher/backend/node_modules/ > /dev/null && echo "✅ Backend: node_modules existe" || echo "❌ Backend: node_modules NÃO existe"
ls -la /root/apps/whatsapp-dispatcher/frontend/node_modules/ > /dev/null && echo "✅ Frontend: node_modules existe" || echo "❌ Frontend: node_modules NÃO existe"
```

**Resultado Esperado:**
```
=== BACKEND .env ===
✅ Existe

=== FRONTEND .env.local ===
✅ Existe

=== DEPENDÊNCIAS ===
✅ Backend: node_modules existe
✅ Frontend: node_modules existe
```

### ✅ Status
- [ ] Arquivos de configuração criados
- [ ] Dependências instaladas sem erros

---

## 4️⃣ MIGRATIONS (15 min)

### ✅ Tarefas

```bash
☐ Scripts SQL identificados
☐ Ordem de execução definida
☐ Migrations executadas
☐ Sem erros de SQL
☐ Tabelas criadas com sucesso
```

### 🔍 Verificação

```bash
# Listar tabelas criadas
psql -U whatsapp_user -d whatsapp_dispatcher -h localhost -c "\dt" | grep -E "table|tenants|users|whatsapp"
```

**Resultado Esperado:** (exemplo)
```
 public | tenants              | table | whatsapp_user
 public | users                | table | whatsapp_user
 public | whatsapp_accounts    | table | whatsapp_user
 public | campaigns            | table | whatsapp_user
 public | messages             | table | whatsapp_user
 ...
```

### 🚨 Problema Comum

Se aparecer "relation does not exist" nos logs do backend, é porque as migrations não foram executadas.

### ✅ Status
- [ ] Migrations executadas
- [ ] Tabelas principais criadas
- [ ] Sem erros de SQL

---

## 5️⃣ BUILD DOS PROJETOS (15 min)

### ✅ Tarefas - Backend

```bash
☐ npm run build executado
☐ Pasta dist/ criada
☐ Arquivos .js gerados
☐ Sem erros de TypeScript
```

### ✅ Tarefas - Frontend

```bash
☐ npm run build executado
☐ Pasta .next/ criada
☐ Build bem-sucedido
☐ Sem erros de compilação
```

### 🔍 Verificação

```bash
echo "=== VERIFICAÇÃO DE BUILD ==="
echo ""
echo "Backend (dist/):"
ls -la /root/apps/whatsapp-dispatcher/backend/dist/ > /dev/null && echo "✅ Pasta dist/ existe" || echo "❌ Pasta dist/ NÃO EXISTE"
ls /root/apps/whatsapp-dispatcher/backend/dist/*.js > /dev/null 2>&1 && echo "✅ Arquivos .js encontrados" || echo "❌ Arquivos .js NÃO encontrados"
echo ""
echo "Frontend (.next/):"
ls -la /root/apps/whatsapp-dispatcher/frontend/.next/ > /dev/null && echo "✅ Pasta .next/ existe" || echo "❌ Pasta .next/ NÃO EXISTE"
echo ""
echo "==========================="
```

**Resultado Esperado:**
```
=== VERIFICAÇÃO DE BUILD ===

Backend (dist/):
✅ Pasta dist/ existe
✅ Arquivos .js encontrados

Frontend (.next/):
✅ Pasta .next/ existe

===========================
```

### ✅ Status
- [ ] Backend compilado (TypeScript → JavaScript)
- [ ] Frontend compilado (Next.js build)
- [ ] Sem erros de build

---

## 6️⃣ NGINX (20 min)

### ✅ Tarefas

```bash
☐ Configuração da API criada
☐ Configuração do Frontend criada
☐ Links simbólicos criados (sites-enabled)
☐ Configuração testada (nginx -t)
☐ NGINX recarregado
```

### 🔍 Verificação

```bash
echo "=== VERIFICAÇÃO DO NGINX ==="
echo ""
echo "Configurações criadas:"
ls /etc/nginx/sites-available/api.sistemasnettsistemas.com.br > /dev/null 2>&1 && echo "✅ API config existe" || echo "❌ API config NÃO existe"
ls /etc/nginx/sites-available/sistemasnettsistemas.com.br > /dev/null 2>&1 && echo "✅ Frontend config existe" || echo "❌ Frontend config NÃO existe"
echo ""
echo "Links simbólicos:"
ls /etc/nginx/sites-enabled/api.sistemasnettsistemas.com.br > /dev/null 2>&1 && echo "✅ API habilitada" || echo "❌ API NÃO habilitada"
ls /etc/nginx/sites-enabled/sistemasnettsistemas.com.br > /dev/null 2>&1 && echo "✅ Frontend habilitado" || echo "❌ Frontend NÃO habilitado"
echo ""
echo "Teste de configuração:"
sudo nginx -t
echo ""
echo "=========================="
```

**Resultado Esperado:**
```
=== VERIFICAÇÃO DO NGINX ===

Configurações criadas:
✅ API config existe
✅ Frontend config existe

Links simbólicos:
✅ API habilitada
✅ Frontend habilitado

Teste de configuração:
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful

==========================
```

### ✅ Status
- [ ] Configurações criadas
- [ ] nginx -t passou sem erros
- [ ] NGINX recarregado

---

## 7️⃣ SSL/HTTPS (10 min)

### ✅ Tarefas

```bash
☐ Certbot executado para API
☐ Certbot executado para Frontend
☐ Certificados gerados com sucesso
☐ Redirecionamento HTTP → HTTPS configurado
☐ Renovação automática testada
```

### 🔍 Verificação

```bash
echo "=== VERIFICAÇÃO DE CERTIFICADOS SSL ==="
echo ""
sudo certbot certificates
echo ""
echo "========================================"
```

**Resultado Esperado:**
```
Certificate Name: api.sistemasnettsistemas.com.br
  Domains: api.sistemasnettsistemas.com.br
  Expiry Date: 2026-02-27 (VALID: 89 days)
  
Certificate Name: sistemasnettsistemas.com.br
  Domains: sistemasnettsistemas.com.br www.sistemasnettsistemas.com.br
  Expiry Date: 2026-02-27 (VALID: 89 days)
```

### ✅ Status
- [ ] Certificados SSL instalados
- [ ] HTTPS funcionando
- [ ] Renovação automática OK

---

## 8️⃣ PM2 (10 min)

### ✅ Tarefas

```bash
☐ Backend iniciado com PM2
☐ Frontend iniciado com PM2
☐ Ambos com status "online"
☐ pm2 save executado
☐ pm2 startup configurado
```

### 🔍 Verificação

```bash
echo "=== STATUS DO PM2 ==="
pm2 list
echo ""
echo "=== LOGS RECENTES ==="
pm2 logs --lines 5 --nostream
echo ""
echo "====================="
```

**Resultado Esperado:**
```
=== STATUS DO PM2 ===
┌────┬────────────────────┬──────────┬──────┬───────────┐
│ id │ name               │ mode     │ ↺    │ status    │
├────┼────────────────────┼──────────┼──────┼───────────┤
│ 0  │ whatsapp-backend   │ fork     │ 0    │ online    │
│ 1  │ whatsapp-frontend  │ fork     │ 0    │ online    │
└────┴────────────────────┴──────────┴──────┴───────────┘
```

### ✅ Status
- [ ] Backend: status "online"
- [ ] Frontend: status "online"
- [ ] PM2 configurado para auto-start

---

## 9️⃣ TESTES (15 min)

### ✅ Tarefas

```bash
☐ Backend local testado (curl localhost:3001)
☐ API externa testada (curl https://api...)
☐ Frontend testado (curl https://...)
☐ Página carrega no navegador
☐ Login funciona
☐ Sem erros 404 no console
☐ Sem erros no Network
```

### 🔍 Verificação

```bash
echo "=== TESTES DE FUNCIONAMENTO ==="
echo ""
echo "1. Backend Local:"
curl -s http://localhost:3001/api/health | head -5
echo ""
echo ""
echo "2. API Externa:"
curl -s https://api.sistemasnettsistemas.com.br/api/health | head -5
echo ""
echo ""
echo "3. Frontend:"
curl -s https://sistemasnettsistemas.com.br | head -10
echo ""
echo "==============================="
```

**Resultado Esperado:**
- Backend local: retorna JSON com `"success": true`
- API externa: retorna o mesmo JSON
- Frontend: retorna HTML do Next.js

### 🌐 Teste no Navegador

1. Abrir: https://sistemasnettsistemas.com.br
2. Deve carregar a página de login
3. Developer Tools (F12) → Console: sem erros
4. Developer Tools → Network: todas requisições 200 OK

### ✅ Status
- [ ] Backend respondendo (local e externo)
- [ ] Frontend carregando
- [ ] Login funcionando
- [ ] Sem erros 404

---

## 🔟 VERIFICAÇÕES FINAIS (10 min)

### 🔍 Checklist Completo

```bash
☐ Node.js >= 18.x instalado
☐ PostgreSQL rodando
☐ Banco de dados criado
☐ Tabelas criadas (migrations executadas)
☐ NGINX rodando
☐ Certificados SSL instalados
☐ Backend compilado (dist/ existe)
☐ Frontend compilado (.next/ existe)
☐ .env configurado (backend)
☐ .env.local configurado (frontend)
☐ PM2: backend online
☐ PM2: frontend online
☐ PM2 auto-start configurado
☐ curl localhost:3001/api/health funciona
☐ curl https://api.../api/health funciona
☐ https://sistemasnettsistemas.com.br carrega
☐ Login funciona
☐ Sem erros nos logs
☐ Sem erros 404 no navegador
```

### 📊 Status Final

```
Total de Verificações: 19
Concluídas: ___ / 19
Porcentagem: ____%
```

---

## 🚨 PROBLEMAS COMUNS E SOLUÇÕES

### ❌ Problema: Backend não inicia

**Sintomas:**
- PM2 mostra status "errored"
- Logs mostram erros

**Solução:**
```bash
pm2 logs whatsapp-backend --lines 50
# Ver qual é o erro específico

# Erros comuns:
# 1. "Cannot connect to database" → Verificar .env
# 2. "relation does not exist" → Executar migrations
# 3. "Cannot find module" → npm install
```

### ❌ Problema: Frontend mostra página em branco

**Sintomas:**
- Página carrega mas fica branca
- Console do navegador mostra erros 404

**Solução:**
```bash
# Verificar .env.local
cat /root/apps/whatsapp-dispatcher/frontend/.env.local

# Deve ter:
# NEXT_PUBLIC_API_URL=https://api.sistemasnettsistemas.com.br/api

# Rebuild e restart
cd /root/apps/whatsapp-dispatcher/frontend
rm -rf .next
npm run build
pm2 restart whatsapp-frontend
```

### ❌ Problema: Erro 502 Bad Gateway

**Sintomas:**
- NGINX retorna 502
- "Bad Gateway" no navegador

**Causa:** Backend não está rodando ou não responde

**Solução:**
```bash
# Verificar se backend está online
pm2 list

# Reiniciar backend
pm2 restart whatsapp-backend

# Ver logs
pm2 logs whatsapp-backend
```

### ❌ Problema: Erro de CORS

**Sintomas:**
- Console do navegador: "blocked by CORS policy"

**Solução:**
```bash
# Verificar FRONTEND_URL no .env do backend
cat /root/apps/whatsapp-dispatcher/backend/.env | grep FRONTEND_URL

# Deve ser:
# FRONTEND_URL=https://sistemasnettsistemas.com.br

# Se estiver errado, corrigir e reiniciar
nano /root/apps/whatsapp-dispatcher/backend/.env
pm2 restart whatsapp-backend
```

---

## 📞 COMANDOS DE SUPORTE

### Reiniciar Tudo
```bash
pm2 restart all
```

### Ver Logs em Tempo Real
```bash
pm2 logs
```

### Ver Status dos Serviços
```bash
pm2 list
pm2 monit
```

### Testar API
```bash
curl http://localhost:3001/api/health
curl https://api.sistemasnettsistemas.com.br/api/health
```

### Ver Logs do NGINX
```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Recarregar NGINX
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Verificar Tabelas do Banco
```bash
psql -U whatsapp_user -d whatsapp_dispatcher -h localhost -c "\dt"
```

---

## 🎉 INSTALAÇÃO CONCLUÍDA!

Se você marcou ✅ em todas as etapas:

✅ **Sistema 100% funcional**  
✅ **Rodando em produção**  
✅ **HTTPS configurado**  
✅ **Auto-restart habilitado**

**Acesse seu sistema:**
🌐 https://sistemasnettsistemas.com.br

---

## 📚 DOCUMENTOS RELACIONADOS

1. **🚀-GUIA-RAPIDO-INSTALACAO-DO-ZERO.md** - Guia completo passo a passo
2. **📊-ANALISE-COMPLETA-ERROS-INSTALACAO-SERVIDOR.md** - Análise detalhada de erros
3. **📋-RELATORIO-SESSAO-ERROS-404-29-11-2025.md** - Relatório da sessão anterior

---

**Documento criado em:** 29/11/2025  
**Versão:** 1.0  
**Status:** ✅ Pronto para Uso

**Boa sorte! 🚀**

