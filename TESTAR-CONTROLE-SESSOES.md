# 🧪 GUIA DE TESTES: CONTROLE DE SESSÕES SIMULTÂNEAS

**Data:** 22/11/2024  
**Status:** ✅ PRONTO PARA TESTAR

---

## 📋 PRÉ-REQUISITOS

### 1. Aplicar Migração do Banco de Dados
```bash
APLICAR-CONTROLE-SESSOES.bat
```

Ou manualmente:
```bash
psql -U postgres -d whatsapp_dispatcher -f backend\src\database\migrations\create_user_sessions.sql
```

### 2. Reiniciar Backend
```bash
3-iniciar-backend.bat
```

### 3. Iniciar Frontend (se não estiver rodando)
```bash
4-iniciar-frontend.bat
```

---

## 🧪 TESTE 1: Login Único (Comportamento Normal)

### Objetivo
Verificar que um login único funciona normalmente.

### Passos

1. **Abra o navegador (Chrome)**
   - Acesse: `http://localhost:3000/login`

2. **Faça login**
   - Email: `seu-email@teste.com`
   - Senha: `sua-senha`
   - Clique em "Entrar"

3. **Navegue pelo sistema**
   - Acesse diferentes páginas
   - Faça algumas ações (criar campanha, ver templates, etc)

### Resultado Esperado
✅ Tudo funciona normalmente  
✅ Não há mensagens de erro  
✅ Todas as requisições passam  

---

## 🧪 TESTE 2: Login Simultâneo (Bloqueio de Sessão Anterior)

### Objetivo
Verificar que um novo login invalida sessões anteriores.

### Passos

1. **Abra o navegador 1 (Chrome)**
   - Acesse: `http://localhost:3000/login`
   - Faça login com: `usuario@teste.com`
   - ✅ Login bem-sucedido

2. **Deixe o Chrome aberto e navegue pelo sistema**
   - Acesse alguma página (ex: `/`)
   - Sistema deve funcionar normalmente

3. **Abra o navegador 2 (Firefox ou Chrome Anônimo)**
   - Acesse: `http://localhost:3000/login`
   - Faça login com o **MESMO USUÁRIO**: `usuario@teste.com`
   - ✅ Login bem-sucedido

4. **Volte para o navegador 1 (Chrome)**
   - **NÃO recarregue a página**
   - Tente fazer alguma ação (clicar em um menu, abrir uma página, etc)
   - Aguarde a próxima requisição ao backend

### Resultado Esperado
🔐 **Alerta aparece:**
```
🔐 Sua sessão foi encerrada porque você fez login em outro dispositivo.

Você será redirecionado para o login.
```

✅ localStorage é limpo  
✅ Redirecionamento automático para `/login?reason=session_invalid`  
✅ Navegador 2 (Firefox) continua funcionando normalmente  

---

## 🧪 TESTE 3: Múltiplos Logins Consecutivos

### Objetivo
Verificar que apenas a última sessão permanece ativa.

### Passos

1. **Faça login em 3 navegadores diferentes:**
   - Chrome: Login com `usuario@teste.com` → ✅
   - Firefox: Login com `usuario@teste.com` → ✅ (Chrome deslogado)
   - Edge: Login com `usuario@teste.com` → ✅ (Firefox deslogado)

2. **Tente usar Chrome (primeiro login)**
   - Deve ser deslogado automaticamente

3. **Tente usar Firefox (segundo login)**
   - Deve ser deslogado automaticamente

4. **Use Edge (último login)**
   - ✅ Deve funcionar normalmente

### Resultado Esperado
✅ Apenas o último login (Edge) está ativo  
❌ Logins anteriores (Chrome, Firefox) são invalidados  
🔐 Mensagem clara de sessão invalidada  

---

## 🧪 TESTE 4: Logout Manual

### Objetivo
Verificar que logout manual invalida a sessão.

### Passos

1. **Faça login no Chrome**
   - Email: `usuario@teste.com`
   - ✅ Login bem-sucedido

2. **Clique no botão "Sair"**
   - Logout bem-sucedido
   - Redirecionado para `/login`

3. **Verifique no banco de dados**
   ```sql
   SELECT is_active FROM user_sessions 
   WHERE user_id = (SELECT id FROM tenant_users WHERE email = 'usuario@teste.com')
   ORDER BY created_at DESC LIMIT 1;
   ```

### Resultado Esperado
✅ Sessão marcada como `is_active = false`  
✅ Redirecionamento para login  
✅ localStorage limpo  

---

## 🧪 TESTE 5: Verificar Logs do Backend

### Objetivo
Verificar que o sistema está logando as operações de sessão.

### Passos

1. **Faça login**
   - Email: `usuario@teste.com`

2. **Verifique os logs no terminal do backend**

### Logs Esperados

**No login:**
```
🔐 Sessões anteriores do usuário 5 foram invalidadas
✅ Nova sessão criada para usuário 5 (Token: e8f3a2c1d4...)
```

**Em requisições normais (silencioso - não há log):**
```
(nenhum log, apenas atualização silenciosa de last_activity)
```

**Ao tentar usar sessão invalidada:**
```
⚠️  Sessão inválida ou expirada para usuário 5
```

**No logout:**
```
🚪 Sessão invalidada (Token: e8f3a2c1d4...)
```

---

## 🧪 TESTE 6: Verificar Banco de Dados

### Objetivo
Confirmar que as sessões estão sendo registradas corretamente.

### Query 1: Ver Sessões Ativas
```sql
SELECT 
  u.nome as usuario,
  u.email,
  s.created_at as login_em,
  s.last_activity as ultima_atividade,
  s.is_active as ativo,
  s.device_info as dispositivo,
  s.ip_address as ip
FROM user_sessions s
INNER JOIN tenant_users u ON u.id = s.user_id
WHERE s.is_active = true
ORDER BY s.created_at DESC;
```

### Query 2: Histórico de Sessões de um Usuário
```sql
SELECT 
  created_at as login_em,
  last_activity as ultima_atividade,
  is_active as ativo,
  device_info->>'browser' as navegador,
  device_info->>'os' as sistema,
  ip_address as ip,
  expires_at as expira_em
FROM user_sessions
WHERE user_id = (SELECT id FROM tenant_users WHERE email = 'usuario@teste.com')
ORDER BY created_at DESC
LIMIT 10;
```

### Resultado Esperado
✅ Apenas 1 sessão ativa por usuário  
✅ Sessões antigas com `is_active = false`  
✅ `last_activity` atualizada em tempo real  
✅ `device_info` com navegador e SO  
✅ `expires_at` = created_at + 7 dias  

---

## 🧪 TESTE 7: Testar Diferentes Cenários de Erro

### Cenário A: Token Expirado (JWT)
**Como testar:**
1. Modifique temporariamente o tempo de expiração do JWT para 1 minuto
2. Faça login
3. Aguarde 2 minutos
4. Tente fazer uma requisição

**Resultado esperado:**
⏰ "Sua sessão expirou. Você será redirecionado para o login."

### Cenário B: Tenant Desativado
**Como testar:**
1. Faça login com um usuário
2. Admin desativa o tenant
3. Tente fazer uma requisição

**Resultado esperado:**
🚫 "Sua sessão foi encerrada porque a conta foi desativada."

### Cenário C: Sessão Invalidada (Login em outro dispositivo)
**Como testar:**
1. Faça login no Chrome
2. Faça login no Firefox (mesmo usuário)
3. Tente usar Chrome

**Resultado esperado:**
🔐 "Sua sessão foi encerrada porque você fez login em outro dispositivo."

---

## 📊 CHECKLIST COMPLETO

### Backend
- [ ] Tabela `user_sessions` criada
- [ ] Índices criados
- [ ] Serviço `session.service.js` funcional
- [ ] `auth.controller.js` atualizado (login, logout, register)
- [ ] `auth.middleware.js` atualizado (verificação de sessão)
- [ ] Backend reiniciado

### Frontend
- [ ] Interceptor atualizado em `api.ts`
- [ ] Tratamento de erro `SESSION_INVALID`
- [ ] Mensagens específicas para cada erro
- [ ] Frontend reiniciado

### Testes Funcionais
- [ ] Login único funciona
- [ ] Login simultâneo invalida sessão anterior
- [ ] Mensagem clara de sessão invalidada
- [ ] Logout manual invalida sessão
- [ ] Apenas última sessão está ativa
- [ ] Logs aparecem corretamente no backend

### Testes no Banco
- [ ] Sessões sendo criadas
- [ ] Sessões antigas sendo invalidadas
- [ ] `last_activity` sendo atualizada
- [ ] `device_info` sendo preenchida
- [ ] `expires_at` correta

---

## 🐛 TROUBLESHOOTING

### Problema: Mensagem não aparece ao fazer segundo login
**Solução:** Aguarde a próxima requisição do primeiro navegador. A validação acontece no middleware, não em tempo real.

### Problema: Erro "Tabela user_sessions não existe"
**Solução:** Execute `APLICAR-CONTROLE-SESSOES.bat` e reinicie o backend.

### Problema: Todos os logins funcionam simultaneamente
**Solução:** 
1. Verifique se o backend foi reiniciado após a atualização
2. Verifique se a tabela foi criada: `\dt user_sessions`
3. Verifique os logs do backend durante o login

### Problema: Erro "session_token does not exist"
**Solução:** Certifique-se de que aplicou a migração corretamente.

---

## ✅ CONFIRMAÇÃO FINAL

Após executar todos os testes, você deve ter:

✅ **Segurança:** Apenas 1 login ativo por usuário  
✅ **Clareza:** Mensagens específicas para cada situação  
✅ **Performance:** Verificação rápida (< 50ms)  
✅ **Auditoria:** Histórico completo no banco  
✅ **UX:** Logout automático e redirecionamento  

---

## 🎉 PRONTO!

Se todos os testes passaram, o sistema de controle de sessões simultâneas está **100% funcional!**

### Benefícios Implementados:
- 🔒 **Segurança aprimorada**
- 🎯 **Controle total de acessos**
- 👤 **Melhor experiência do usuário**
- 📊 **Rastreamento completo de sessões**
- ⚡ **Performance otimizada**

---

**Documentado por:** IA Assistant  
**Data:** 22/11/2024

