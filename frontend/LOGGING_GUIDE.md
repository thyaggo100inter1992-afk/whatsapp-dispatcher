# 📊 Guia do Sistema de Auditoria e Logs

## Visão Geral

O sistema de auditoria completo captura **TODAS as ações do usuário** automaticamente, incluindo:

- ✅ Navegação entre páginas
- ✅ Atualizações de página (F5)
- ✅ Cliques em botões
- ✅ Envio de formulários
- ✅ Login/Logout
- ✅ Requisições à API
- ✅ Erros e exceções
- ✅ Ações CRUD (criar, editar, deletar)

## 🎯 Logs Automáticos

Esses logs são capturados **automaticamente**, sem necessidade de código adicional:

### 1. Navegação
- Mudança de página
- Atualização de página (F5/Ctrl+R)

### 2. Requisições API
- Todas as chamadas à API são logadas automaticamente
- Inclui método (GET, POST, PUT, DELETE), URL, status e duração

### 3. Erros
- Erros não capturados
- Promises rejeitadas
- Erros de API

### 4. Login/Logout
- Login bem-sucedido
- Login com falha
- Logout

## 🛠️ Logs Manuais

Para logar ações específicas, use o hook `useLogger`:

```typescript
import { useLogger } from '@/hooks/useLogger';

function MeuComponente() {
  const { logButtonClick, logFormSubmit, logError, logAction } = useLogger();

  const handleEnviar = () => {
    try {
      // Sua lógica
      logButtonClick('enviar_campanha', 'dashboard');
    } catch (error) {
      logError(error, 'enviar_campanha');
    }
  };

  const handleSubmit = (data) => {
    logFormSubmit('formulario_campanha', data);
    // Enviar formulário
  };

  return <button onClick={handleEnviar}>Enviar</button>;
}
```

## 🔘 Botão com Log Automático

Use o componente `LoggedButton` para logar cliques automaticamente:

```typescript
import LoggedButton from '@/components/LoggedButton';

<LoggedButton
  logName="enviar_campanha"
  logContext="dashboard"
  onClick={handleEnviar}
  className="px-4 py-2 bg-blue-500 text-white rounded"
>
  Enviar Campanha
</LoggedButton>
```

## 📋 Tipos de Log Disponíveis

### Navegação
- `page_view`: Visualizar página
- `page_refresh`: Atualizar página

### Autenticação
- `login`: Login
- `logout`: Logout
- `register`: Registro de novo tenant

### Interações
- `button_click`: Clique em botão
- `form_submit`: Envio de formulário

### CRUD
- `create`: Criar registro
- `update`: Atualizar registro
- `delete`: Deletar registro

### Sistema
- `error`: Erro
- `api_request`: Requisição à API

## 🔍 Visualizar Logs

Acesse `/admin/logs` como Super Admin para ver todos os logs do sistema.

### Filtros Disponíveis:
- **Por Tenant**: Ver logs de uma empresa específica
- **Por Ação**: Filtrar por tipo de ação
- **Por Status**: Apenas sucessos ou apenas erros

## 🎨 Exemplos de Uso

### 1. Logar Criação de Campanha

```typescript
import logger from '@/services/logger';

const handleCriarCampanha = async (data) => {
  try {
    const response = await api.post('/campaigns', data);
    
    logger.logCrudAction('create', 'campanha', response.data.id, data);
    
    toast.success('Campanha criada com sucesso!');
  } catch (error) {
    logger.logError(error, 'criar_campanha');
    toast.error('Erro ao criar campanha');
  }
};
```

### 2. Logar Edição de Tenant

```typescript
const handleEditarTenant = async (tenantId, newData) => {
  try {
    await api.put(`/admin/tenants/${tenantId}`, newData);
    
    logger.logCrudAction('update', 'tenant', tenantId, newData);
    
    toast.success('Tenant atualizado!');
  } catch (error) {
    logger.logError(error, 'editar_tenant');
  }
};
```

### 3. Logar Clique em Botão Importante

```typescript
const handleExcluirCampanha = (id) => {
  logger.logButtonClick('excluir_campanha', `campanha_${id}`);
  
  if (confirm('Tem certeza?')) {
    // Excluir
  }
};
```

## 📊 Estrutura do Log

Cada log contém:

```typescript
{
  id: number;                    // ID do log
  tenant_id: number;             // ID do tenant
  tenant_nome: string;           // Nome do tenant
  user_id: number;               // ID do usuário
  user_nome: string;             // Nome do usuário
  acao: string;                  // Tipo de ação
  entidade: string;              // Entidade afetada
  entidade_id: number;           // ID da entidade
  dados_antes: any;              // Estado anterior
  dados_depois: any;             // Estado posterior
  ip_address: string;            // IP do usuário
  user_agent: string;            // Navegador/OS
  metodo_http: string;           // GET, POST, PUT, DELETE
  url_path: string;              // URL acessada
  sucesso: boolean;              // Se foi bem-sucedido
  erro_mensagem: string;         // Mensagem de erro (se houver)
  metadata: any;                 // Dados adicionais
  created_at: string;            // Data/hora do log
}
```

## 🚀 Performance

O sistema de logs foi otimizado para não impactar a performance:

- Logs são enviados de forma assíncrona
- Fila de processamento para evitar múltiplas requisições
- Logs de API não geram novos logs (evita loop infinito)
- Autenticação opcional para capturar erros antes do login

## 🔐 Privacidade

- Apenas Super Admins podem visualizar logs
- Logs podem ser filtrados por tenant
- Senhas nunca são logadas
- Dados sensíveis devem ser omitidos manualmente

## ⚠️ Boas Práticas

1. **Não logue senhas ou tokens**
2. **Use contextos descritivos** para facilitar a busca
3. **Logue ações importantes** (criar, editar, deletar)
4. **Capture erros** para facilitar debugging
5. **Use nomes de botão claros** (ex: "enviar_campanha" ao invés de "btn1")

## 🐛 Debug

Para ver logs no console do navegador:

```typescript
import logger from '@/services/logger';

// Os logs serão visíveis no console
console.log('Logger queue:', logger);
```

## 📞 Suporte

Em caso de dúvidas ou problemas com o sistema de logs, consulte a documentação ou entre em contato com a equipe de desenvolvimento.



