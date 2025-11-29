# 🎯 Sistema de Controle de Funcionalidades por Plano

Sistema que controla quais funcionalidades cada tenant tem acesso baseado no plano contratado e período de trial.

---

## 📋 Funcionalidades Principais

### Durante o TRIAL (3 dias grátis):
- ✅ WhatsApp API Oficial
- ✅ WhatsApp QR Connect
- ❌ Consulta de Dados
- ❌ Verificar Números
- ❌ Gerenciar Proxies

### Plano BÁSICO:
- ✅ WhatsApp API Oficial
- ✅ WhatsApp QR Connect
- ❌ Consulta de Dados
- ❌ Verificar Números
- ❌ Gerenciar Proxies

### Plano PROFISSIONAL / EMPRESARIAL:
- ✅ WhatsApp API Oficial
- ✅ WhatsApp QR Connect
- ✅ Consulta de Dados
- ✅ Verificar Números
- ✅ Gerenciar Proxies

---

## 🛠️ Como Usar no Frontend

### 1. Importar o Hook

```typescript
import { useFeatures } from '@/hooks/useFeatures';
```

### 2. Usar no Componente

```typescript
export default function MinhaPage() {
  const { hasFeature, lacksFeature, isTrial, getBlockedMessage, loading } = useFeatures();

  if (loading) {
    return <div>Carregando...</div>;
  }

  // Bloquear acesso total à página
  if (lacksFeature('consulta_dados')) {
    return (
      <FeatureBlock 
        message={getBlockedMessage('consulta_dados')} 
      />
    );
  }

  return (
    <div>
      <h1>Consulta de Dados</h1>
      {/* Conteúdo da página */}
    </div>
  );
}
```

### 3. Bloquear Botões/Ações Específicas

```typescript
<button
  disabled={lacksFeature('verificar_numeros')}
  onClick={handleVerificar}
  className={lacksFeature('verificar_numeros') ? 'opacity-50 cursor-not-allowed' : ''}
>
  {lacksFeature('verificar_numeros') ? '🔒 Bloqueado' : 'Verificar Número'}
</button>
```

### 4. Ocultar Itens do Menu

```typescript
// No componente de menu/sidebar
const { hasFeature } = useFeatures();

return (
  <nav>
    <MenuItem href="/" label="Dashboard" />
    
    {hasFeature('whatsapp_api') && (
      <MenuItem href="/whatsapp-api" label="WhatsApp API" />
    )}
    
    {hasFeature('whatsapp_qr') && (
      <MenuItem href="/qr-connect" label="QR Connect" />
    )}
    
    {hasFeature('consulta_dados') && (
      <MenuItem href="/consulta-dados" label="Consulta de Dados" />
    )}
    
    {hasFeature('verificar_numeros') && (
      <MenuItem href="/verificar-numeros" label="Verificar Números" />
    )}
    
    {hasFeature('gerenciar_proxies') && (
      <MenuItem href="/proxies" label="Gerenciar Proxies" />
    )}
  </nav>
);
```

### 5. Exibir Badge de Trial

```typescript
const { isTrial, featuresData } = useFeatures();

return (
  <div>
    {isTrial() && (
      <div className="bg-yellow-500/20 border border-yellow-500 rounded-lg p-4 mb-4">
        <p>🆓 Você está em período de teste!</p>
        <p>Expira em: {new Date(featuresData?.tenant.trial_ends_at).toLocaleDateString()}</p>
      </div>
    )}
  </div>
);
```

---

## 🔧 Backend - Configuração

### Endpoint de Funcionalidades

```
GET /api/features
Authorization: Bearer {token}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "tenant": {
      "id": 4,
      "nome": "Empresa XYZ",
      "plano": "basico",
      "status": "ativo",
      "is_trial": false
    },
    "plan": {
      "id": 1,
      "nome": "Básico",
      "slug": "basico"
    },
    "funcionalidades": {
      "whatsapp_api": true,
      "whatsapp_qr": true,
      "consulta_dados": false,
      "verificar_numeros": false,
      "gerenciar_proxies": false
    }
  }
}
```

### Verificar Funcionalidade Específica

```
GET /api/features/check/consulta_dados
Authorization: Bearer {token}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "feature": "consulta_dados",
    "hasAccess": false,
    "message": "Funcionalidade 'consulta_dados' não disponível no seu plano"
  }
}
```

---

## 🗄️ Banco de Dados

### Tabela `plans`

```sql
-- Adicionar funcionalidades ao plano
UPDATE plans 
SET funcionalidades = '{
  "whatsapp_api": true,
  "whatsapp_qr": true,
  "consulta_dados": true,
  "verificar_numeros": true,
  "gerenciar_proxies": true
}'::jsonb
WHERE slug = 'profissional';
```

### Tabela `tenants`

```sql
-- Customizar funcionalidades para um tenant específico
UPDATE tenants 
SET 
  funcionalidades_customizadas = true,
  funcionalidades_config = '{
    "whatsapp_api": true,
    "whatsapp_qr": true,
    "consulta_dados": true,
    "verificar_numeros": false,
    "gerenciar_proxies": false
  }'::jsonb
WHERE id = 4;
```

---

## 🎨 Componentes Disponíveis

### `<FeatureBlock />`

Componente para exibir mensagem de funcionalidade bloqueada.

```typescript
import FeatureBlock from '@/components/FeatureBlock';

<FeatureBlock 
  message="Esta funcionalidade não está disponível no seu plano"
  showUpgradeButton={true}
/>
```

---

## 🔐 Hierarquia de Permissões

1. **TRIAL** → Apenas API + QR (sempre, independente do plano)
2. **Funcionalidades Customizadas** → Definidas pelo super admin para o tenant
3. **Funcionalidades do Plano** → Baseado no plano contratado
4. **Fallback** → Liberar tudo (caso não encontre configuração)

---

## 📝 Funcionalidades Disponíveis (FeatureKey)

- `whatsapp_api` - WhatsApp API Oficial
- `whatsapp_qr` - WhatsApp QR Connect
- `consulta_dados` - Base de Dados / Consultas
- `verificar_numeros` - Verificação de Números
- `gerenciar_proxies` - Gerenciamento de Proxies
- `campanhas` - Campanhas de Envio
- `templates` - Templates de Mensagens
- `lista_restricao` - Listas de Restrição
- `webhooks` - Webhooks
- `relatorios` - Relatórios
- `nova_vida` - Integração Nova Vida
- `envio_imediato` - Envio Imediato
- `catalogo` - Catálogo de Produtos
- `dashboard` - Dashboard Principal

---

## ✅ Checklist de Implementação

- [x] Script SQL para adicionar campos ao banco
- [x] Controller no backend (`features.controller.js`)
- [x] Rotas no backend (`/api/features`)
- [x] Hook no frontend (`useFeatures`)
- [x] Componente de bloqueio (`FeatureBlock`)
- [ ] Atualizar menu/sidebar com verificações
- [ ] Proteger rotas sensíveis
- [ ] Adicionar badges de trial
- [ ] Testes E2E

---

## 🚀 Próximos Passos

1. Atualizar o menu lateral para ocultar itens bloqueados
2. Adicionar middleware de proteção de rotas no frontend
3. Criar página de upgrade de plano
4. Adicionar notificações quando trial expira
5. Criar relatório de uso de funcionalidades

---

## 💡 Dúvidas?

Entre em contato com o desenvolvedor! 🚀


