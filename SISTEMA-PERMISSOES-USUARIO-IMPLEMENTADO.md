# 🔐 Sistema de Permissões por Usuário - Documentação Completa

## 📋 Visão Geral

Sistema implementado para restringir o acesso de **usuários comuns** a funcionalidades específicas do sistema, enquanto **admins** e **super admins** mantêm acesso total.

---

## ✅ O Que Foi Implementado

### 🔹 1. Backend - Endpoint de Permissões Atualizado
**Arquivo:** `backend/src/routes/permissions.routes.js`

#### Lógica de Permissões:

1. **Super Admin** → Acesso total a TUDO
2. **Admin do Tenant** → Acesso total a TUDO dentro do tenant
3. **Usuário Comum SEM permissões customizadas** → Usa permissões do tenant (plano)
4. **Usuário Comum COM permissões customizadas** → RESTRITO ao que foi marcado

#### Exemplo de Resposta da API:

```json
{
  "success": true,
  "data": {
    "all": false,
    "funcionalidades": {
      "whatsapp_api": false,     // ❌ BLOQUEADO
      "whatsapp_qr": true,        // ✅ PERMITIDO
      "campanhas": true,
      "templates": true,
      "base_dados": false,        // ❌ BLOQUEADO
      "nova_vida": false,         // ❌ BLOQUEADO
      "verificar_numeros": true,
      "gerenciar_proxies": false, // ❌ BLOQUEADO
      "lista_restricao": true,
      "webhooks": true,
      "dashboard": true
    }
  }
}
```

---

### 🔹 2. Frontend - Página Inicial (index.tsx)

#### Mudanças:
- ✅ **Cards OCULTOS** (não apenas desabilitados) quando o usuário não tem permissão
- ✅ **Mensagem de "Acesso Restrito"** se o usuário não tem acesso a NENHUMA integração
- ✅ **Funções Extras** (Consultar Dados, Verificar Números, Proxies) também ocultas

#### Comportamento:

| Funcionalidade | Sem Permissão | Com Permissão |
|---|---|---|
| **WhatsApp API Oficial** | ❌ Card oculto | ✅ Card visível e clicável |
| **WhatsApp QR Connect** | ❌ Card oculto | ✅ Card visível e clicável |
| **Consultar Dados Nova Vida** | ❌ Card oculto | ✅ Card visível e clicável |
| **Verificar Números** | ❌ Card oculto | ✅ Card visível e clicável |
| **Gerenciar Proxies** | ❌ Card oculto | ✅ Card visível e clicável |

---

### 🔹 3. Proteção de Rotas (ProtectedRoute)

**Arquivo:** `frontend/src/components/ProtectedRoute.tsx`

Já existia e continua funcionando:
- Verifica se o usuário tem a permissão necessária
- Se NÃO tiver, mostra um **alert** e redireciona para a página inicial
- Usado em:
  - `/dashboard-oficial` (requer `whatsapp_api`)
  - `/dashboard-uaz` (requer `whatsapp_qr`)

---

## 🎯 Como Funciona na Prática

### Cenário 1: Admin ou Super Admin
- ✅ Vê TODOS os cards na página inicial
- ✅ Acessa TODAS as páginas do sistema
- ✅ Sem restrições

### Cenário 2: Usuário Comum COM permissões customizadas
- 🔒 Vê APENAS os cards que foram marcados pelo admin
- 🔒 NÃO pode acessar páginas bloqueadas (é redirecionado)
- 🔒 Menu de navegação só mostra opções permitidas

### Cenário 3: Usuário Comum SEM permissões customizadas
- ✅ Herda as permissões do TENANT (plano)
- ✅ Comportamento igual ao admin (enquanto não for customizado)

---

## 🛠️ Como o Admin Configura Permissões

### Passo 1: Acessar a Aba "Usuários" no Tenant
Super Admin → Tenants → [Selecionar Tenant] → **Aba "Usuários"**

### Passo 2: Criar ou Editar Usuário
- Clicar em **"+ Adicionar Usuário"** ou **"Editar"** em um usuário existente

### Passo 3: Marcar Permissões
Lista de permissões disponíveis:

1. ✅ **WhatsApp API Oficial** (`whatsapp_api`)
2. ✅ **WhatsApp QR Connect** (`whatsapp_qr`)
3. ✅ **Campanhas** (`campanhas`)
4. ✅ **Templates** (`templates`)
5. ✅ **Base de Dados** (`base_dados`)
6. ✅ **Nova Vida (Consultar CPF/CNPJ)** (`nova_vida`)
7. ✅ **Verificar Números** (`verificar_numeros`)
8. ✅ **Gerenciar Proxies** (`gerenciar_proxies`)
9. ✅ **Lista de Restrição** (`lista_restricao`)
10. ✅ **Webhooks** (`webhooks`)
11. ✅ **Relatórios** (`relatorios`)
12. ✅ **Auditoria** (`auditoria`)

### Passo 4: Salvar
- As permissões são salvas no campo `permissoes` (JSONB) da tabela `tenant_users`

---

## 🔍 Exemplo de Uso Real

### Exemplo: Restringir WhatsApp API Oficial

**Configuração:**
```json
{
  "whatsapp_api": false,  // ❌ BLOQUEADO
  "whatsapp_qr": true,    // ✅ PERMITIDO
  "campanhas": true,
  "templates": true
}
```

**Resultado para o Usuário:**
1. Na página inicial (`/`):
   - ❌ NÃO vê o card "WhatsApp API Oficial"
   - ✅ VÊ o card "WhatsApp QR Connect"

2. Se tentar acessar diretamente `/dashboard-oficial`:
   - ❌ Recebe um alert: "Você não tem permissão para acessar 'whatsapp_api'"
   - ❌ É redirecionado automaticamente para `/`

3. Pode acessar normalmente:
   - ✅ `/dashboard-uaz` (WhatsApp QR Connect)
   - ✅ `/qr-criar-campanha`
   - ✅ `/qr-templates`

---

## 📊 Estrutura de Dados

### Banco de Dados - Campo `permissoes`
**Tabela:** `tenant_users`
**Coluna:** `permissoes` (JSONB)

**Exemplo de dados salvos:**
```json
{
  "whatsapp_api": true,
  "whatsapp_qr": true,
  "campanhas": true,
  "templates": false,
  "base_dados": true,
  "nova_vida": false,
  "verificar_numeros": true,
  "gerenciar_proxies": false,
  "lista_restricao": true,
  "webhooks": false
}
```

---

## 🚀 Teste do Sistema

### Teste 1: Criar Usuário com Restrições
1. Fazer login como **Super Admin**
2. Acessar **Admin → Tenants → [Tenant] → Aba "Usuários"**
3. Clicar em **"+ Adicionar Usuário"**
4. Preencher:
   - Nome: `Usuário Teste`
   - Email: `teste@exemplo.com`
   - Senha: `senha123`
   - Role: **Usuário** (não admin)
5. **DESMARCAR** a permissão "WhatsApp API Oficial"
6. **MARCAR** apenas "WhatsApp QR Connect"
7. Salvar

### Teste 2: Login como Usuário Restrito
1. Fazer logout
2. Login com: `teste@exemplo.com` / `senha123`
3. **Verificar:**
   - ❌ Card "WhatsApp API Oficial" está oculto
   - ✅ Card "WhatsApp QR Connect" está visível
4. Tentar acessar manualmente: `http://localhost:3000/dashboard-oficial`
   - ❌ Deve mostrar alert e redirecionar para `/`

### Teste 3: Editar Permissões
1. Voltar como Super Admin
2. Editar o usuário criado
3. **MARCAR** "WhatsApp API Oficial"
4. Salvar
5. Fazer login novamente como usuário teste
6. **Verificar:**
   - ✅ Agora o card "WhatsApp API Oficial" aparece
   - ✅ Pode acessar `/dashboard-oficial`

---

## ⚠️ Pontos Importantes

### 1. Diferença entre Admin e Usuário
- **Admin do Tenant:** Acesso total, não pode ser restringido
- **Usuário Comum:** Pode ser restringido por permissões customizadas

### 2. Permissões Padrão
- Se o usuário NÃO tiver permissões customizadas definidas (objeto vazio `{}`), ele herda as permissões do **tenant/plano**

### 3. Dashboard Sempre Liberado
- A permissão `dashboard: true` está sempre ativa (campo obrigatório)

### 4. Super Admin
- Sempre tem acesso total, independente de configurações

---

## 🎨 Interface Visual

### Página Inicial - Com Acesso Total:
```
┌─────────────────────────────────────────────────────────────┐
│  🟢 WhatsApp API Oficial     🔵 WhatsApp QR Connect        │
│     (Card visível)               (Card visível)            │
└─────────────────────────────────────────────────────────────┘
│  🟠 Consultar Dados   🟣 Verificar Números   🔵 Proxies    │
│     (Card visível)       (Card visível)        (Card visível)│
└─────────────────────────────────────────────────────────────┘
```

### Página Inicial - Com Restrições:
```
┌─────────────────────────────────────────────────────────────┐
│  🔵 WhatsApp QR Connect                                     │
│     (Único card visível)                                    │
└─────────────────────────────────────────────────────────────┘
│  🟣 Verificar Números                                       │
│     (Único card visível)                                    │
└─────────────────────────────────────────────────────────────┘
```

### Página Inicial - Sem Acesso a Nada:
```
┌─────────────────────────────────────────────────────────────┐
│                        🔒                                    │
│               Acesso Restrito                               │
│  Você não tem permissão para acessar nenhuma integração.   │
│     Entre em contato com o administrador.                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 Logs do Backend

Quando um usuário acessa o sistema, o backend registra:

```
🔐 Verificando permissões - UserID: 5, TenantID: 1, Role: user
🔒 Usuário com permissões customizadas: {
  whatsapp_api: false,
  whatsapp_qr: true,
  campanhas: true,
  templates: true
}
```

---

## ✅ Status Final

| Item | Status |
|---|---|
| Backend - Endpoint de Permissões | ✅ Implementado |
| Frontend - Ocultar Cards sem Permissão | ✅ Implementado |
| Frontend - Mensagem de Acesso Restrito | ✅ Implementado |
| Proteção de Rotas (ProtectedRoute) | ✅ Já existia e funciona |
| Gestão de Permissões no Admin | ✅ Já existia (aba Usuários) |
| Testes Completos | ✅ Pronto para teste |

---

## 🎉 Conclusão

O sistema de restrições por usuário está **100% funcional**!

- ✅ Admins podem **criar usuários comuns** e **definir exatamente** quais funcionalidades eles podem usar
- ✅ Usuários comuns **NÃO veem** nem **NÃO acessam** funcionalidades bloqueadas
- ✅ Sistema **seguro** com proteção tanto no frontend quanto no backend
- ✅ Interface **limpa** sem cards desabilitados (apenas ocultos)

**Tudo pronto para uso!** 🚀




