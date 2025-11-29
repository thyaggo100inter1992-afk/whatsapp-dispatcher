# 📊 Sistema de Auditoria - Backend

## Visão Geral

O backend recebe e armazena todos os logs de atividade do sistema, incluindo ações dos usuários, erros, navegação e requisições à API.

## 🗄️ Estrutura do Banco de Dados

### Tabela: `audit_logs`

```sql
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id),
  user_id INTEGER REFERENCES tenant_users(id),
  acao VARCHAR(50) NOT NULL,
  entidade VARCHAR(50),
  entidade_id INTEGER,
  dados_antes JSONB,
  dados_depois JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  metodo_http VARCHAR(10),
  url_path VARCHAR(255),
  sucesso BOOLEAN DEFAULT true,
  erro_mensagem TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_acao ON audit_logs(acao);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_metadata ON audit_logs USING gin(metadata);
```

## 📡 API Endpoints

### POST `/api/logs/activity`

Registra uma nova atividade no sistema.

**Autenticação:** Opcional (tenta autenticar se token presente)

**Body:**
```json
{
  "acao": "page_view",
  "entidade": "navegacao",
  "entidade_id": null,
  "dados_antes": null,
  "dados_depois": null,
  "metodo_http": "GET",
  "url_path": "/dashboard",
  "erro_mensagem": null,
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "userAgent": "Mozilla/5.0..."
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Log registrado com sucesso",
  "data": {
    "id": 12345
  }
}
```

### GET `/api/admin/logs`

Lista todos os logs (Super Admin apenas).

**Autenticação:** Requerida (Super Admin)

**Query Params:**
- `acao`: Filtrar por tipo de ação
- `tenant_id`: Filtrar por tenant
- `sucesso`: Filtrar por status (true/false)

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [...],
    "total": 1500
  }
}
```

### GET `/api/admin/logs/stats`

Estatísticas de logs (Super Admin apenas).

**Autenticação:** Requerida (Super Admin)

**Response:**
```json
{
  "success": true,
  "data": {
    "totalLogs": 15000,
    "logs24h": 350,
    "successCount": 14500,
    "errorCount": 500,
    "actionsDistribution": [
      { "acao": "page_view", "count": 5000 },
      { "acao": "api_request", "count": 3000 }
    ],
    "tenantsDistribution": [
      { "nome": "Tenant A", "count": 8000 },
      { "nome": "Tenant B", "count": 7000 }
    ]
  }
}
```

## 🔧 Controller

### `activity.controller.js`

**Método:** `logActivity`

- Recebe logs do frontend
- Extrai IP e User-Agent
- Determina sucesso/erro
- Insere no banco de dados
- Retorna 200 mesmo em caso de erro (para não atrapalhar o fluxo do usuário)

```javascript
const logActivity = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const tenantId = req.user?.tenant_id || null;
    
    const {
      acao,
      entidade,
      entidade_id,
      dados_antes,
      dados_depois,
      metodo_http,
      url_path,
      erro_mensagem,
      metadata
    } = req.body;

    // ... inserção no banco
    
    res.status(201).json({
      success: true,
      message: 'Log registrado com sucesso',
      data: { id: result.rows[0].id }
    });
  } catch (error) {
    // Retorna 200 para não atrapalhar o usuário
    res.status(200).json({
      success: false,
      message: 'Erro ao registrar log (silencioso)'
    });
  }
};
```

## 🔐 Middleware de Autenticação

A rota `/api/logs/activity` usa autenticação **opcional**:

```typescript
const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    authenticate(req, res, next);
  } else {
    next();
  }
};

router.use('/logs', optionalAuth, activityLogsRoutes);
```

Isso permite capturar logs mesmo quando o usuário não está autenticado (ex: erros na tela de login).

## 📊 Tipos de Log Suportados

### Navegação
- `page_view`: Visualização de página
- `page_refresh`: Atualização de página

### Autenticação
- `login`: Login bem-sucedido ou falho
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
- `error`: Erro capturado
- `api_request`: Requisição à API

## 🚀 Performance

### Índices Otimizados

```sql
-- Para filtros por tenant
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);

-- Para filtros por usuário
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);

-- Para filtros por ação
CREATE INDEX idx_audit_logs_acao ON audit_logs(acao);

-- Para ordenação por data
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Para busca em metadata (JSON)
CREATE INDEX idx_audit_logs_metadata ON audit_logs USING gin(metadata);
```

### Retenção de Logs

**Recomendação:** Implementar política de retenção de logs para evitar crescimento excessivo da tabela.

```sql
-- Exemplo: Deletar logs com mais de 90 dias
DELETE FROM audit_logs 
WHERE created_at < NOW() - INTERVAL '90 days'
  AND acao NOT IN ('login', 'register', 'delete'); -- Manter logs críticos
```

## 📈 Monitoramento

### Logs de Debug

O controller registra logs no console:

```javascript
console.log('🔍 Log recebido:', { acao, entidade, user_id: userId });
console.error('❌ Erro ao registrar log:', error);
```

### Métricas Importantes

1. **Taxa de erro**: `errorCount / totalLogs`
2. **Logs por hora**: Para detectar anomalias
3. **Ações por tenant**: Para monitorar uso
4. **Top erros**: Agrupar por `erro_mensagem`

## 🔒 Segurança

### Dados Sensíveis

**NUNCA** logue:
- Senhas
- Tokens de autenticação
- Números de cartão
- Dados pessoais sensíveis (CPF completo, etc.)

### Sanitização

```javascript
// Exemplo de sanitização
const sanitizeData = (data) => {
  if (!data) return null;
  
  const sanitized = { ...data };
  delete sanitized.password;
  delete sanitized.token;
  delete sanitized.senha;
  
  return sanitized;
};
```

## 🧪 Testes

### Testar Registro de Log

```bash
curl -X POST http://localhost:3001/api/logs/activity \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "acao": "test",
    "entidade": "teste",
    "metadata": { "test": true }
  }'
```

### Testar Consulta de Logs

```bash
curl -X GET "http://localhost:3001/api/admin/logs?acao=login" \
  -H "Authorization: Bearer SEU_TOKEN_SUPER_ADMIN"
```

## 📦 Dependências

- `pg`: Cliente PostgreSQL
- `express`: Framework web
- Middleware de autenticação

## 🛠️ Manutenção

### Backup de Logs

```bash
pg_dump -U postgres -t audit_logs whatsapp_dispatcher > audit_logs_backup.sql
```

### Análise de Logs

```sql
-- Top 10 ações mais frequentes
SELECT acao, COUNT(*) as total
FROM audit_logs
GROUP BY acao
ORDER BY total DESC
LIMIT 10;

-- Erros por tenant
SELECT t.nome, COUNT(*) as erros
FROM audit_logs al
JOIN tenants t ON al.tenant_id = t.id
WHERE al.sucesso = false
GROUP BY t.nome
ORDER BY erros DESC;

-- Usuários mais ativos
SELECT tu.nome, COUNT(*) as atividades
FROM audit_logs al
JOIN tenant_users tu ON al.user_id = tu.id
WHERE al.created_at > NOW() - INTERVAL '7 days'
GROUP BY tu.nome
ORDER BY atividades DESC
LIMIT 20;
```

## 📞 Suporte

Para dúvidas ou problemas com o sistema de logs do backend, consulte a documentação ou entre em contato com a equipe de desenvolvimento.



