# 🎯 Customização de Limites por Tenant

## 📋 Visão Geral

O sistema agora permite que o **Super Admin** customize os limites de cada plano individualmente para cada tenant, mantendo os limites padrão do plano como base.

## ✅ Como Funciona

### 1. **Limites Padrão**
Por padrão, cada tenant usa os limites do plano que foi atribuído a ele:
- Limite de usuários
- Limite de contas WhatsApp
- Limite de campanhas simultâneas
- Limite de mensagens por dia
- Limite de consultas Nova Vida por mês

### 2. **Customização de Limites**
O Super Admin pode marcar a opção **"Customizar Limites para este Tenant"** e definir limites específicos que sobrescrevem os limites padrão do plano.

### 3. **Prioridade**
- Se `limites_customizados = false` → Usa limites do plano
- Se `limites_customizados = true` → Usa limites customizados do tenant

## 🎨 Interface do Usuário

### Página: `/admin/tenants`

1. **Lista de Tenants**
   - Mostra todos os tenants com seus planos
   - Botão "Editar" para cada tenant

2. **Modal de Edição**
   - Campos padrão: Nome, Email, Telefone, Documento
   - **Seleção de Plano**: Dropdown com todos os planos cadastrados
   - **Checkbox "Customizar Limites"**: Habilita a customização
   - **Campos de Limites** (aparecem quando checkbox marcado):
     - Limite de Usuários (mostra valor padrão do plano)
     - Limite de Contas WhatsApp (mostra valor padrão do plano)
     - Campanhas Simultâneas (mostra valor padrão do plano)
     - Mensagens por Dia (mostra valor padrão do plano)
     - Consultas Nova Vida por Mês (mostra valor padrão do plano)

3. **Valores Especiais**
   - **-1**: Ilimitado
   - **null/vazio**: Usa o valor padrão do plano

## 🗄️ Estrutura do Banco de Dados

### Tabela: `tenants`

Novas colunas adicionadas:

```sql
-- Flag para indicar se usa limites customizados
limites_customizados BOOLEAN DEFAULT FALSE

-- Limites customizados (NULL = usa padrão do plano)
limite_usuarios_customizado INTEGER
limite_whatsapp_customizado INTEGER
limite_campanhas_simultaneas_customizado INTEGER
limite_mensagens_dia_customizado INTEGER
limite_novavida_mes_customizado INTEGER
```

## 🔧 Backend

### Controller: `tenants.controller.js`

#### Método `updateTenant`
Atualizado para receber e salvar os limites customizados:

```javascript
const updateTenant = async (req, res) => {
  const { 
    nome, email, telefone, documento, plano, status,
    plan_id,
    limites_customizados,
    limite_usuarios_customizado,
    limite_whatsapp_customizado,
    limite_campanhas_simultaneas_customizado,
    limite_mensagens_dia_customizado,
    limite_novavida_mes_customizado
  } = req.body;

  // Se limites_customizados = false, os limites customizados são setados para NULL
  // Se limites_customizados = true, os limites customizados são salvos
};
```

#### Método `getAllTenants` e `getTenantById`
Atualizados para incluir:
- Dados do tenant (incluindo limites customizados)
- Dados do plano (limites padrão)
- JOIN com tabela `plans`

## 💻 Frontend

### Componente: `/admin/tenants.tsx`

#### Estado `editForm`
```typescript
const [editForm, setEditForm] = useState({
  nome: '',
  email: '',
  telefone: '',
  documento: '',
  plano: 'basico',
  plan_id: null,
  status: 'active',
  limites_customizados: false,
  limite_usuarios_customizado: null,
  limite_whatsapp_customizado: null,
  limite_campanhas_simultaneas_customizado: null,
  limite_mensagens_dia_customizado: null,
  limite_novavida_mes_customizado: null
});
```

#### UI/UX
- **Checkbox**: Ativa/desativa customização
- **Campos condicionais**: Aparecem apenas quando customização ativa
- **Dicas visuais**: Mostra o valor padrão do plano ao lado de cada campo
- **Validação**: Aceita -1 (ilimitado) ou valores positivos

## 📊 Exemplos de Uso

### Exemplo 1: Tenant com Limites Padrão
```json
{
  "nome": "Empresa A",
  "plan_id": 1,
  "limites_customizados": false,
  "limite_usuarios_customizado": null,
  "limite_whatsapp_customizado": null
}
```
**Resultado**: Usa todos os limites do plano ID 1

### Exemplo 2: Tenant com Limites Customizados
```json
{
  "nome": "Empresa B",
  "plan_id": 1,
  "limites_customizados": true,
  "limite_usuarios_customizado": 50,
  "limite_whatsapp_customizado": 10,
  "limite_campanhas_simultaneas_customizado": 5,
  "limite_mensagens_dia_customizado": 5000,
  "limite_novavida_mes_customizado": 1000
}
```
**Resultado**: Usa os limites customizados ao invés dos limites do plano

### Exemplo 3: Tenant com Alguns Limites Customizados
```json
{
  "nome": "Empresa C",
  "plan_id": 2,
  "limites_customizados": true,
  "limite_usuarios_customizado": 100,
  "limite_whatsapp_customizado": null,
  "limite_campanhas_simultaneas_customizado": null,
  "limite_mensagens_dia_customizado": 10000,
  "limite_novavida_mes_customizado": null
}
```
**Resultado**: Usa limites customizados para usuários e mensagens, usa limites do plano para os outros

## 🎯 Casos de Uso

### 1. Cliente VIP
Um cliente paga pelo plano "Pro" mas precisa de mais usuários:
- Seleciona plano "Pro"
- Marca "Customizar Limites"
- Define `limite_usuarios_customizado: 100`
- Mantém outros limites do plano Pro

### 2. Teste Gratuito com Limites Reduzidos
Um cliente está em período de teste do plano "Enterprise":
- Seleciona plano "Enterprise"
- Marca "Customizar Limites"
- Define limites reduzidos:
  - `limite_usuarios_customizado: 5`
  - `limite_whatsapp_customizado: 2`
  - `limite_mensagens_dia_customizado: 100`

### 3. Cliente Ilimitado
Um cliente especial precisa de recursos ilimitados:
- Seleciona qualquer plano
- Marca "Customizar Limites"
- Define todos os limites como `-1` (ilimitado)

## 🚀 Como Usar

### Passo a Passo:

1. **Acesse** `/admin/tenants` como Super Admin
2. **Clique** em "Editar" no tenant desejado
3. **Selecione** o plano base no dropdown
4. **Marque** o checkbox "Customizar Limites para este Tenant"
5. **Preencha** os limites customizados desejados
   - Use `-1` para ilimitado
   - Deixe vazio para usar o padrão do plano
6. **Salve** as alterações

## ⚠️ Observações Importantes

1. **Validação de Limites**: Ainda precisa ser implementada no sistema para verificar se o tenant está dentro dos limites
2. **Migração de Dados**: Tenants existentes terão `limites_customizados = false` por padrão
3. **Performance**: Os limites customizados são carregados em todas as consultas de tenant
4. **Auditoria**: Todas as mudanças de limites são logadas no sistema de auditoria

## 🔮 Próximas Melhorias

1. ✅ Implementar validação de limites em tempo real
2. ✅ Dashboard mostrando uso atual vs. limites
3. ✅ Alertas quando um tenant estiver próximo do limite
4. ✅ Histórico de mudanças de limites
5. ✅ Relatório de uso de limites por tenant

## 📞 Suporte

Para dúvidas ou problemas, consulte a documentação ou entre em contato com a equipe de desenvolvimento.



