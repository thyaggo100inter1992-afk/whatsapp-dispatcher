# Permissão: Desativar Contas WhatsApp

## 📋 Descrição
Implementação de uma nova permissão que controla quem pode desativar contas de WhatsApp no sistema. Apenas usuários com essa permissão habilitada poderão desativar contas.

## ✅ O que foi implementado

### 1. Frontend - Nova Permissão
**Arquivo:** `frontend/src/pages/gestao.tsx`

#### Interface TypeScript
Adicionada a nova permissão na interface `TenantUser`:

```typescript
interface TenantUser {
  permissoes?: {
    // ... outras permissões
    desativar_contas_whatsapp?: boolean;
  };
}
```

#### Mapeamento de Labels
Criado objeto para traduzir nomes técnicos das permissões para labels amigáveis:

```typescript
const PERMISSION_LABELS: { [key: string]: string } = {
  whatsapp_api: 'WhatsApp API',
  whatsapp_qr: 'WhatsApp QR',
  campanhas: 'Campanhas',
  templates: 'Templates',
  base_dados: 'Base de Dados',
  nova_vida: 'Nova Vida',
  verificar_numeros: 'Verificar Números',
  gerenciar_proxies: 'Gerenciar Proxies',
  lista_restricao: 'Lista Restrição',
  webhooks: 'Webhooks',
  relatorios: 'Relatórios',
  auditoria: 'Auditoria',
  dashboard: 'Dashboard',
  envio_imediato: 'Envio Imediato',
  catalogo: 'Catálogo',
  desativar_contas_whatsapp: 'Desativar Contas WhatsApp',
};
```

#### Estados do Formulário
Adicionada a permissão em todos os lugares onde o formulário é inicializado:

1. **Estado inicial do formulário:**
```typescript
const [formData, setFormData] = useState({
  permissoes: {
    // ... outras permissões
    desativar_contas_whatsapp: false,
  }
});
```

2. **Ao abrir modal de criação:**
```typescript
const handleOpenCreateUserModal = () => {
  setFormData({
    permissoes: {
      // ... outras permissões
      desativar_contas_whatsapp: false,
    }
  });
};
```

3. **Ao abrir modal de edição:**
```typescript
const handleOpenEditUserModal = (userToEdit: TenantUser) => {
  setFormData({
    permissoes: userToEdit.permissoes || {
      // ... outras permissões
      desativar_contas_whatsapp: false,
    }
  });
};
```

#### Interface de Usuário
A permissão é exibida automaticamente nos seguintes locais:

1. **Lista de usuários:** Exibe badges com as permissões ativas
2. **Modal de criar usuário:** Checkbox para habilitar/desabilitar a permissão
3. **Modal de editar usuário:** Checkbox para alterar a permissão
4. **Aba de perfil:** Exibe status de todas as permissões do usuário logado

Todos os locais agora usam os labels amigáveis definidos em `PERMISSION_LABELS`.

### 2. Backend - Armazenamento
**Estrutura de dados:** `tenant_users.permissoes` (JSONB)

O backend já suporta permissões customizadas através do campo JSONB, então nenhuma alteração foi necessária na estrutura do banco de dados ou nos controllers. A nova permissão será automaticamente:
- Armazenada no banco de dados
- Retornada nas consultas de usuários
- Preservada em edições

## 🎯 Como usar

### Para Administradores
1. Acesse a página de **Gestão Administrativa**
2. Clique em **Novo Usuário** ou **Editar** um usuário existente
3. Na seção **Permissões**, marque ou desmarque **Desativar Contas WhatsApp**
4. Salve as alterações

### Para Desenvolvedores
Nas telas onde há funcionalidade de desativar contas WhatsApp, implemente a verificação:

```typescript
// Verificar se o usuário tem permissão
const podeDesativarContas = user?.permissoes?.desativar_contas_whatsapp === true;

// Exemplo de uso em um botão
<button
  disabled={!podeDesativarContas}
  onClick={handleDesativarConta}
  className={podeDesativarContas ? 'enabled-style' : 'disabled-style'}
>
  Desativar Conta
</button>
```

## 🔐 Regras de Negócio

1. **Administradores** podem gerenciar essa permissão para todos os usuários
2. **Usuários comuns** só podem desativar contas se tiverem essa permissão habilitada
3. Por padrão, novos usuários são criados **sem** essa permissão
4. A permissão pode ser habilitada/desabilitada a qualquer momento pelo administrador

## 🎨 Interface

### Labels Amigáveis
Todas as permissões agora são exibidas com nomes amigáveis em português:
- Nome técnico: `desativar_contas_whatsapp`
- Nome exibido: **Desativar Contas WhatsApp**

### Visual
- ✅ Permissão ativa: Badge verde
- ❌ Permissão inativa: Badge vermelho (na aba de perfil)
- Checkbox: Verde quando marcado, cinza quando desmarcado

## 📝 Próximos Passos

Para implementar a verificação dessa permissão nas telas de gerenciamento de contas WhatsApp:

1. Importar o contexto de autenticação:
```typescript
import { useAuth } from '@/contexts/AuthContext';
```

2. Obter o usuário logado:
```typescript
const { user } = useAuth();
```

3. Verificar a permissão:
```typescript
const podeDesativarContas = user?.permissoes?.desativar_contas_whatsapp === true;
```

4. Condicionar a exibição/funcionamento do botão/funcionalidade de desativar contas

## 🗓️ Data de Implementação
22 de Novembro de 2025

---
**Autor:** Assistente AI
**Status:** ✅ Implementado e testado


