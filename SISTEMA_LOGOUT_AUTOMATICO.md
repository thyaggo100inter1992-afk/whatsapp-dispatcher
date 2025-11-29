# ⏱️ SISTEMA DE LOGOUT AUTOMÁTICO POR INATIVIDADE

## 📋 REGRAS IMPLEMENTADAS

### 1️⃣ Logout por Inatividade (1 hora)
- ⏱️ **Tempo de inatividade**: 1 hora (60 minutos)
- ✅ **Se o usuário estiver ATIVO**: Permanece logado indefinidamente
- ❌ **Se o usuário ficar INATIVO por 1 hora**: Logout automático

### 2️⃣ Detecção de Atividade
O sistema detecta atividade do usuário através dos seguintes eventos:
- 🖱️ `mousedown` - Clicar com o mouse
- 🖱️ `mousemove` - Mover o mouse
- ⌨️ `keypress` - Pressionar tecla
- ⌨️ `keydown` - Segurar tecla
- 📜 `scroll` - Rolar a página
- 👆 `touchstart` - Tocar na tela (mobile)
- 🖱️ `click` - Clicar em qualquer elemento

**Qualquer um desses eventos RENOVA a sessão e reseta o timer de inatividade.**

### 3️⃣ Logout Forçado ao Bloquear Tenant
- 🚫 Quando um **tenant é bloqueado/desativado**, todos os usuários daquele tenant são **imediatamente deslogados**
- 🔔 Mensagem de alerta é exibida explicando o motivo
- 🔄 Redirecionamento automático para a tela de login

---

## 🏗️ ARQUITETURA DA SOLUÇÃO

### Frontend

#### 1. **Hook Customizado: `useInactivityLogout.ts`**

Localização: `frontend/src/hooks/useInactivityLogout.ts`

**Funcionalidades:**
- 📌 Detecta eventos de atividade do usuário
- 💾 Armazena timestamp da última atividade no `localStorage`
- ⏲️ Verifica a cada 1 minuto se passou 1 hora sem atividade
- 🚪 Faz logout automático se inatividade >= 1 hora
- 📊 Logs de debug para monitoramento

**Configuração:**
```typescript
const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hora em milissegundos
const CHECK_INTERVAL = 60 * 1000; // Verifica a cada 1 minuto
```

**Eventos Monitorados:**
```typescript
const events = [
  'mousedown',   // Clicar
  'mousemove',   // Mover mouse
  'keypress',    // Pressionar tecla
  'keydown',     // Segurar tecla
  'scroll',      // Rolar página
  'touchstart',  // Tocar (mobile)
  'click'        // Clicar em elemento
];
```

#### 2. **Integração no `_app.tsx`**

```typescript
import { useInactivityLogout } from '@/hooks/useInactivityLogout';

function MyApp({ Component, pageProps }: AppProps) {
  // ⏱️ HOOK DE LOGOUT POR INATIVIDADE (ativo globalmente)
  useInactivityLogout();
  
  // ... resto do código
}
```

#### 3. **Interceptor de API: `api.ts`**

**Melhorias Aplicadas:**
- ✅ Detecta resposta 401 com flag `forceLogout`
- 🔔 Exibe mensagem customizada quando tenant é bloqueado
- 🧹 Limpa todos os dados do `localStorage`
- 🔄 Redireciona para login com query param `?reason=unauthorized`

**Código:**
```typescript
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const forceLogout = error.response?.data?.forceLogout;
      const message = error.response?.data?.message;
      
      if (forceLogout && message) {
        alert(`🚫 ${message}\n\nVocê será redirecionado para o login.`);
      }
      
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('lastActivity');
      window.location.href = '/login?reason=unauthorized';
    }
    return Promise.reject(error);
  }
);
```

---

### Backend

#### 1. **Middleware de Autenticação: `auth.middleware.js`**

**Alterações:**
- ✅ Retorna **401** (ao invés de 403) quando tenant está inativo
- 🏷️ Adiciona flag `forceLogout: true` na resposta
- 📝 Mensagem clara: "Sua sessão foi encerrada porque a conta foi desativada."

**Código:**
```javascript
if (user.role !== 'super_admin' && (!user.tenant_ativo || user.tenant_status !== 'active')) {
  return res.status(401).json({
    success: false,
    message: 'Sua sessão foi encerrada porque a conta foi desativada.',
    code: 'TENANT_INACTIVE',
    forceLogout: true // Flag para frontend fazer logout imediato
  });
}
```

---

## 🔄 FLUXO DE FUNCIONAMENTO

### Cenário 1: Usuário Ativo (Navegando)

```mermaid
1. Usuário faz login
2. Hook monitora eventos (click, scroll, etc)
3. A cada evento: atualiza lastActivity
4. Timer verifica a cada 1 minuto
5. lastActivity < 1 hora? ✅ Continua logado
6. Usuário continua navegando normalmente
```

### Cenário 2: Usuário Inativo (1 hora sem atividade)

```mermaid
1. Usuário para de usar a plataforma
2. 60 minutos passam sem nenhum evento
3. Timer detecta: lastActivity >= 1 hora
4. Exibe alerta: "Sua sessão expirou por inatividade"
5. Limpa localStorage
6. Faz logout automático
7. Redireciona para /login?reason=inactivity
```

### Cenário 3: Tenant Bloqueado (Logout Forçado)

```mermaid
1. Super Admin desativa tenant
2. Usuário do tenant tenta fazer requisição
3. Middleware detecta tenant_status !== 'active'
4. Retorna 401 com forceLogout: true
5. Interceptor no frontend detecta
6. Exibe alerta: "Conta foi desativada"
7. Limpa localStorage
8. Redireciona para /login?reason=unauthorized
```

---

## 📊 LOGS DE MONITORAMENTO

O sistema gera logs detalhados no console do navegador:

### Logs de Inicialização:
```
🕐 Sistema de logout por inatividade ATIVADO
⏱️  Timeout configurado: 60 minutos
```

### Logs de Atividade (a cada 5 minutos de uso):
```
✅ Atividade detectada - sessão renovada
```

### Logs de Inatividade (a cada 10 minutos de inatividade):
```
⏱️  Tempo inativo: 10 minutos (limite: 60 minutos)
⏱️  Tempo inativo: 20 minutos (limite: 60 minutos)
...
```

### Logs de Logout:
```
⚠️  INATIVIDADE DETECTADA!
⏱️  Tempo inativo: 60 minutos
🚪 Fazendo logout automático...
```

---

## 🧪 COMO TESTAR

### Teste 1: Logout por Inatividade

1. **Faça login** no sistema
2. **Abra o console** do navegador (F12)
3. **Não faça nada** (não mova o mouse, não clique, não digite)
4. **Aguarde 1 hora** (ou ajuste `INACTIVITY_TIMEOUT` para 5 minutos para testar)
5. **Resultado esperado**: Alerta + Logout automático

### Teste 2: Renovação de Sessão

1. **Faça login** no sistema
2. **Use normalmente** (clique, navegue, digite)
3. **Continue usando** por mais de 1 hora
4. **Resultado esperado**: Permanece logado

### Teste 3: Logout ao Bloquear Tenant

1. **Usuário A**: Faz login como usuário normal
2. **Super Admin**: Desativa o tenant do Usuário A
3. **Usuário A**: Tenta fazer qualquer ação (clicar, navegar)
4. **Resultado esperado**: Alerta + Logout imediato

---

## ⚙️ CONFIGURAÇÕES

### Ajustar Tempo de Inatividade

Edite o arquivo `frontend/src/hooks/useInactivityLogout.ts`:

```typescript
// Para 30 minutos:
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

// Para 2 horas:
const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000;

// Para 5 minutos (teste):
const INACTIVITY_TIMEOUT = 5 * 60 * 1000;
```

### Ajustar Frequência de Verificação

```typescript
// Verificar a cada 30 segundos:
const CHECK_INTERVAL = 30 * 1000;

// Verificar a cada 5 minutos:
const CHECK_INTERVAL = 5 * 60 * 1000;
```

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

- ✅ Hook `useInactivityLogout.ts` criado
- ✅ Integrado no `_app.tsx` (ativo globalmente)
- ✅ Detecção de 7 tipos de eventos de atividade
- ✅ Verificação periódica (1 minuto)
- ✅ Logs de monitoramento
- ✅ Middleware backend retorna 401 + forceLogout
- ✅ Interceptor de API detecta logout forçado
- ✅ Mensagens de alerta customizadas
- ✅ Limpeza completa do localStorage
- ✅ Redirecionamento com reason (inactivity/unauthorized)
- ✅ Documentação completa

---

## 🚀 PRÓXIMOS PASSOS

1. **REINICIE O BACKEND**:
   ```bash
   cd backend
   npm run dev
   ```

2. **REINICIE O FRONTEND**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **TESTE** os 3 cenários descritos acima

---

## 🎯 RESULTADO FINAL

✅ **Usuários ativos permanecem logados indefinidamente**  
✅ **Usuários inativos são deslogados após 1 hora**  
✅ **Tenants bloqueados causam logout imediato**  
✅ **Sistema robusto com logs e monitoramento**  
✅ **Experiência do usuário otimizada**

---

**Data**: ${new Date().toLocaleString('pt-BR')}  
**Status**: ✅ 100% IMPLEMENTADO



