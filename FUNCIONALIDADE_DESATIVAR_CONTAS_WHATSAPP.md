# 📴 Funcionalidade: Desativar Contas WhatsApp

## 📋 Descrição
Implementação completa de funcionalidade para desativar contas/instâncias de WhatsApp (API Oficial e QR Connect), com opções de seleção individual e desativação em massa.

## ✅ O que foi implementado

### 1. Frontend - API Oficial WhatsApp (`frontend/src/pages/configuracoes.tsx`)

#### Estados Adicionados
```typescript
const [selectedAccounts, setSelectedAccounts] = useState<Set<number>>(new Set());
const [deactivating, setDeactivating] = useState(false);
```

#### Funções Implementadas
1. **`handleToggleSelectAccount(accountId: number)`** - Seleciona/desseleciona uma conta individual
2. **`handleSelectAllAccounts()`** - Seleciona/desseleciona todas as contas
3. **`handleDeactivateSelected()`** - Desativa contas selecionadas
4. **`handleDeactivateAll()`** - Desativa todas as contas

#### Interface Visual
- **Barra de Ação em Massa:**
  - Botão "Selecionar Todas/Desselecionar Todas"
  - Contador de contas selecionadas
  - Botão "Desativar Selecionadas" (laranja)
  - Botão "Desativar TODAS" (vermelho)

- **Cada Card de Conta:**
  - Checkbox grande para seleção individual
  - Feedback visual ao selecionar (ícone muda de FaSquare para FaCheckSquare)

### 2. Backend - API Oficial WhatsApp

#### Endpoints Criados
**`POST /api/whatsapp-accounts/deactivate-multiple`**
```javascript
Body: {
  account_ids: [1, 2, 3] // Array de IDs
}

Response: {
  success: true,
  message: "3 conta(s) desativada(s) com sucesso"
}
```

**`POST /api/whatsapp-accounts/deactivate-all`**
```javascript
Response: {
  success: true,
  message: "5 conta(s) desativada(s) com sucesso"
}
```

#### Controller (`backend/src/controllers/whatsapp-account.controller.ts`)
- **`deactivateMultiple(req, res)`** - Desativa múltiplas contas
- **`deactivateAll(req, res)`** - Desativa todas as contas do tenant

#### Model (`backend/src/models/WhatsAppAccount.ts`)
- **`deactivate(id, tenantId)`** - Desativa uma conta específica
- **`deactivateAll(tenantId)`** - Desativa todas as contas do tenant

### 3. Frontend - WhatsApp QR Connect (`frontend/src/pages/configuracoes-uaz.tsx`)

#### Estados Adicionados
```typescript
const [selectedForDeactivation, setSelectedForDeactivation] = useState<Set<number>>(new Set());
const [deactivating, setDeactivating] = useState(false);
```

#### Funções Implementadas
1. **`handleToggleSelectInstance(instanceId: number)`** - Seleciona/desseleciona uma instância
2. **`handleSelectAllInstances()`** - Seleciona/desseleciona todas
3. **`handleDeactivateSelected()`** - Desativa instâncias selecionadas
4. **`handleDeactivateAll()`** - Desativa todas as instâncias

#### Interface Visual
- **Barra de Seleção em Massa:**
  - Botão "Selecionar Todas/Desselecionar Todas" (roxo/purple)
  - Contador de instâncias selecionadas
  - Integrada com botões existentes (Pausar Todas, Ativar Todas, etc.)

- **Botões de Ação:**
  - "Desativar Selecionadas" (laranja)
  - "Desativar TODAS" (vermelho)

- **Cada Card de Instância:**
  - Checkbox grande ao lado da foto de perfil
  - Feedback visual ao selecionar

### 4. Backend - WhatsApp QR Connect (`backend/src/routes/uaz.js`)

#### Endpoints Criados
**`POST /api/uaz/instances/deactivate-multiple`**
```javascript
Body: {
  instance_ids: [1, 2, 3] // Array de IDs
}

Response: {
  success: true,
  deactivated_count: 3,
  deactivated_templates: 15,
  instances: [...],
  message: "3 instância(s) desativada(s). 15 template(s) desativados nas campanhas."
}
```

**`POST /api/uaz/instances/deactivate-all`**
```javascript
Response: {
  success: true,
  deactivated_count: 8,
  deactivated_templates: 42,
  instances: [...],
  message: "8 instância(s) desativada(s). 42 template(s) desativados nas campanhas."
}
```

#### Funcionalidades Adicionais
- **Desativação em Campanhas:** Ao desativar instâncias, os templates associados são automaticamente desativados em campanhas ativas
- **Feedback Detalhado:** Retorna quantas instâncias e templates foram desativados
- **Validação:** Verifica se o array de IDs é válido

## 🎯 Como usar

### Para Usuários

#### API Oficial WhatsApp
1. Acesse **Configurações** (API Oficial)
2. Na **barra de ação em massa** no topo:
   - Clique em "Selecionar Todas" para marcar todas
   - Ou clique nos checkboxes individuais para selecionar contas específicas
3. Clique em **"Desativar Selecionadas"** para desativar as marcadas
4. Ou clique em **"Desativar TODAS"** para desativar todas de uma vez

#### WhatsApp QR Connect
1. Acesse **WhatsApp QR Connect**
2. Use a **barra de seleção** no topo da lista de instâncias
3. Selecione as instâncias desejadas com os checkboxes
4. Clique em **"Desativar Selecionadas"** ou **"Desativar TODAS"**

### Confirmações de Segurança
- **Desativar Selecionadas:** Mostra quantas contas serão desativadas
- **Desativar TODAS:** Aviso em VERMELHO com contagem total
- Todas as ações requerem confirmação do usuário

## 🔐 Segurança

### Autenticação
- Todos os endpoints requerem autenticação
- Respeitam o contexto de tenant (multi-tenant)

### Permissões
A permissão **"Desativar Contas WhatsApp"** pode ser configurada no painel de gestão:
```typescript
user?.permissoes?.desativar_contas_whatsapp === true
```

*Nota: A verificação de permissão pode ser adicionada posteriormente nas funções, se necessário.*

## 📊 Feedback Visual

### Estados dos Botões
- **Normal:** Cor base (laranja ou vermelho)
- **Disabled:** Opacidade 50%, cursor not-allowed
- **Loading:** Spinner animado

### Checkboxes
- **Desmarcado:** `FaSquare` (cinza)
- **Marcado:** `FaCheckSquare` (roxo/azul brilhante)
- **Hover:** Mudança de tom

### Contador
Badge com fundo semi-transparente mostrando:
```
X de Y selecionada(s)
```

## ⚠️ Comportamento Importante

### API Oficial
- Contas desativadas não enviam mensagens
- Podem ser reativadas posteriormente via botão individual

### WhatsApp QR
- Instâncias desativadas são tratadas como **DESCONECTADAS** nas campanhas
- Templates associados são automaticamente **DESATIVADOS** em campanhas ativas
- Ao reativar, templates podem ser reativados manualmente ou automaticamente (conforme configuração)

## 🎨 Cores e Estilo

### API Oficial WhatsApp
- **Selecionar Todas:** Azul primário (`primary-500`)
- **Desativar Selecionadas:** Laranja (`orange-500`)
- **Desativar TODAS:** Vermelho (`red-500`)

### WhatsApp QR Connect
- **Selecionar Todas:** Roxo (`purple-500`)
- **Desativar Selecionadas:** Laranja escuro (`orange-600`)
- **Desativar TODAS:** Vermelho escuro (`red-600`)

## 📝 Exemplos de Código

### Verificar Permissão (Frontend)
```typescript
import { useAuth } from '@/contexts/AuthContext';

const { user } = useAuth();
const podeDesativar = user?.permissoes?.desativar_contas_whatsapp === true;

if (!podeDesativar) {
  // Desabilitar botão ou mostrar mensagem
}
```

### Desativar Múltiplas Contas (API Call)
```typescript
await api.post('/whatsapp-accounts/deactivate-multiple', {
  account_ids: [1, 2, 3]
});
```

### Desativar Todas as Instâncias UAZ (API Call)
```typescript
await api.post('/uaz/instances/deactivate-all');
```

## 🗓️ Data de Implementação
22 de Novembro de 2025

## 👥 Testado Por
- Aguardando teste do usuário

---

**Autor:** Assistente AI  
**Status:** ✅ Implementado e pronto para teste  
**Versão:** 1.0


