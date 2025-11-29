# 📝 Sistema de Log/Histórico de Conexões UAZ

## 📋 Resumo

Sistema completo de auditoria e rastreamento de **TODOS os eventos** que acontecem com cada instância/conexão UAZ. Registra automaticamente:

- 📅 **Data de Criação** - Quando a conexão foi criada
- ✅ **Data de Conexão** - Quando o QR code foi escaneado e conectou
- 🔌 **Data de Desconexão** - Quando foi desconectada
- 🗑️ **Data de Exclusão** - Quando foi deletada/excluída
- ✏️ **Data de Alterações** - Quando o nome ou dados foram alterados
- 🔍 **Verificações de Status** - Cada vez que o status foi verificado
- 🔲 **Geração de QR Code** - Quando um QR code foi gerado
- ❌ **Erros** - Qualquer erro que ocorreu

---

## 🎯 Estrutura da Tabela

### `uaz_instance_logs`

```sql
CREATE TABLE uaz_instance_logs (
    id SERIAL PRIMARY KEY,
    instance_id INTEGER,              -- ID da instância
    instance_name VARCHAR(255),       -- Nome da instância (na hora do evento)
    session_name VARCHAR(255),        -- Nome da sessão
    event_type VARCHAR(50),           -- Tipo de evento
    event_description TEXT,           -- Descrição legível
    old_value JSONB,                  -- Valor anterior (para updates)
    new_value JSONB,                  -- Valor novo
    metadata JSONB,                   -- Dados adicionais
    created_at TIMESTAMP              -- Quando o evento ocorreu
);
```

### Tipos de Eventos (`event_type`)

| Tipo | Descrição |
|------|-----------|
| `created` | Instância criada no sistema |
| `connected` | QR code escaneado, conectou ao WhatsApp |
| `disconnected` | Desconectada do WhatsApp |
| `deleted` | Excluída do sistema |
| `updated` | Dados atualizados (nome, proxy, etc) |
| `status_check` | Status verificado manualmente |
| `qr_code_generated` | QR code gerado |
| `error` | Erro ocorreu |

---

## 🔧 Como Instalar

### Passo 1: Criar a Tabela no Banco de Dados

Execute o arquivo `APLICAR-LOG-UAZ.bat`:

```batch
APLICAR-LOG-UAZ.bat
```

Ou execute manualmente o SQL:

```sql
psql -U postgres -d disparador_massa -f EXECUTAR-LOG-UAZ.sql
```

### Passo 2: Reiniciar o Backend

Após criar a tabela, reinicie o backend para que os helpers de log sejam carregados.

---

## 📝 Como Usar os Helpers

### JavaScript/TypeScript

```javascript
const {
  logInstanceCreated,
  logInstanceConnected,
  logInstanceDisconnected,
  logInstanceDeleted,
  logInstanceUpdated,
  logStatusCheck,
  logQRCodeGenerated,
  logInstanceError,
  getInstanceHistory
} = require('../helpers/uaz-log.helper');
```

### Exemplos de Uso

#### 1. Registrar Criação de Instância

```javascript
// Após criar instância no banco
await logInstanceCreated(instanceId, {
  name: 'Marketing Principal',
  session_name: 'marketing01',
  is_active: true,
  proxy_id: null
});
```

#### 2. Registrar Conexão (QR Code Escaneado)

```javascript
// Quando QR code for escaneado e conectar
await logInstanceConnected(instanceId, 'Marketing Principal', '+5511999999999');
```

#### 3. Registrar Desconexão

```javascript
// Quando desconectar
await logInstanceDisconnected(instanceId, 'Marketing Principal', 'Desconexão manual');
```

#### 4. Registrar Exclusão

```javascript
// Antes de excluir do banco
await logInstanceDeleted(instanceId, 'Marketing Principal', true); // true = deletou da API UAZ
```

#### 5. Registrar Atualização

```javascript
// Quando atualizar dados
await logInstanceUpdated(
  instanceId,
  'Marketing Principal',
  { name: 'Marketing Principal' },      // Valor antigo
  { name: 'Marketing Atualizado' },     // Valor novo
  ['name']                               // Campos alterados
);
```

#### 6. Registrar Verificação de Status

```javascript
// Quando verificar status
await logStatusCheck(instanceId, 'Marketing Principal', {
  is_connected: true,
  status: 'connected',
  phone_number: '+5511999999999'
});
```

#### 7. Registrar Geração de QR Code

```javascript
// Quando gerar QR code
await logQRCodeGenerated(instanceId, 'Marketing Principal');
```

#### 8. Registrar Erro

```javascript
// Quando ocorrer erro
await logInstanceError(instanceId, 'Marketing Principal', 'Falha ao conectar: timeout');
```

---

## 🔍 Como Buscar o Histórico

### Backend - Buscar Histórico de Uma Instância

```javascript
const history = await getInstanceHistory(instanceId);

console.log(history);
// [
//   {
//     id: 1,
//     instance_id: 5,
//     instance_name: 'Marketing Principal',
//     event_type: 'created',
//     event_description: 'Instância "Marketing Principal" criada no sistema',
//     created_at: '2024-11-15T10:30:00Z'
//   },
//   ...
// ]
```

### API Endpoint - Rota para Visualizar Histórico

Adicione esta rota em `backend/src/routes/uaz.js`:

```javascript
/**
 * GET /api/uaz/instances/:id/history
 * Obtém histórico completo de uma instância
 */
router.get('/instances/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verifica se instância existe
    const instance = await pool.query('SELECT * FROM uaz_instances WHERE id = $1', [id]);
    if (instance.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }
    
    // Busca histórico
    const history = await getInstanceHistory(id);
    
    res.json({
      success: true,
      instance: instance.rows[0],
      history: history,
      total: history.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

---

## 📊 Exemplo de Resposta da API

### GET /api/uaz/instances/5/history

```json
{
  "success": true,
  "instance": {
    "id": 5,
    "name": "Marketing Principal",
    "session_name": "marketing01",
    "is_connected": true,
    "created_at": "2024-11-15T10:30:00Z"
  },
  "history": [
    {
      "id": 10,
      "instance_id": 5,
      "instance_name": "Marketing Principal",
      "session_name": "marketing01",
      "event_type": "connected",
      "event_description": "Instância \"Marketing Principal\" conectada ao WhatsApp (+5511999999999)",
      "old_value": null,
      "new_value": {
        "is_connected": true,
        "phone_number": "+5511999999999",
        "connected_at": "2024-11-15T10:35:00Z"
      },
      "metadata": {},
      "created_at": "2024-11-15T10:35:00Z"
    },
    {
      "id": 9,
      "instance_id": 5,
      "instance_name": "Marketing Principal",
      "session_name": "marketing01",
      "event_type": "qr_code_generated",
      "event_description": "QR Code gerado para \"Marketing Principal\"",
      "old_value": null,
      "new_value": null,
      "metadata": {
        "generated_at": "2024-11-15T10:32:00Z"
      },
      "created_at": "2024-11-15T10:32:00Z"
    },
    {
      "id": 8,
      "instance_id": 5,
      "instance_name": "Marketing Principal",
      "session_name": "marketing01",
      "event_type": "created",
      "event_description": "Instância \"Marketing Principal\" criada no sistema",
      "old_value": null,
      "new_value": {
        "name": "Marketing Principal",
        "session_name": "marketing01",
        "is_active": true,
        "proxy_id": null
      },
      "metadata": {},
      "created_at": "2024-11-15T10:30:00Z"
    }
  ],
  "total": 3
}
```

---

## 🎨 Interface Frontend (Sugestão)

### Componente React para Exibir Histórico

```tsx
import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { FaClock, FaCheck, FaTimes, FaTrash, FaEdit, FaQrcode } from 'react-icons/fa';

interface HistoryEvent {
  id: number;
  event_type: string;
  event_description: string;
  created_at: string;
  new_value?: any;
  metadata?: any;
}

export default function InstanceHistory({ instanceId }: { instanceId: number }) {
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [instanceId]);

  const loadHistory = async () => {
    try {
      const response = await api.get(`/uaz/instances/${instanceId}/history`);
      if (response.data.success) {
        setHistory(response.data.history);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'created': return '📅';
      case 'connected': return '✅';
      case 'disconnected': return '🔌';
      case 'deleted': return '🗑️';
      case 'updated': return '✏️';
      case 'qr_code_generated': return '🔲';
      case 'status_check': return '🔍';
      case 'error': return '❌';
      default: return '📝';
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'created': return 'bg-blue-500/20 border-blue-500/40 text-blue-300';
      case 'connected': return 'bg-green-500/20 border-green-500/40 text-green-300';
      case 'disconnected': return 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300';
      case 'deleted': return 'bg-red-500/20 border-red-500/40 text-red-300';
      case 'updated': return 'bg-purple-500/20 border-purple-500/40 text-purple-300';
      default: return 'bg-white/10 border-white/20 text-white';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Carregando histórico...</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-bold mb-4">📝 Histórico de Eventos</h3>
      
      {history.length === 0 ? (
        <div className="text-center py-8 text-white/50">
          Nenhum evento registrado ainda
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((event) => (
            <div
              key={event.id}
              className={`p-4 rounded-xl border-2 ${getEventColor(event.event_type)}`}
            >
              <div className="flex items-start gap-3">
                <div className="text-3xl">{getEventIcon(event.event_type)}</div>
                <div className="flex-1">
                  <p className="font-bold text-lg">{event.event_description}</p>
                  <p className="text-sm opacity-75 mt-1">
                    {new Date(event.created_at).toLocaleString('pt-BR')}
                  </p>
                  
                  {event.new_value && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm opacity-75 hover:opacity-100">
                        Ver detalhes
                      </summary>
                      <pre className="mt-2 text-xs bg-black/20 p-2 rounded">
                        {JSON.stringify(event.new_value, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 🔄 Fluxo Completo de Eventos

### Cenário: Criar e Usar Uma Conexão

```
1. 📅 CREATED
   └─ Usuário cria instância "Marketing Principal"
   └─ Log: "Instância criada no sistema"

2. 🔲 QR_CODE_GENERATED
   └─ Usuário acessa QR Code
   └─ Log: "QR Code gerado para Marketing Principal"

3. ✅ CONNECTED
   └─ Usuário escaneia QR code no celular
   └─ Log: "Instância conectada ao WhatsApp (+5511999999999)"

4. 🔍 STATUS_CHECK
   └─ Sistema verifica status automaticamente
   └─ Log: "Status verificado: Conectado"

5. ✏️ UPDATED
   └─ Usuário altera nome para "Marketing Novo"
   └─ Log: "Instância atualizada: name"

6. 🔌 DISCONNECTED
   └─ Usuário clica em "Desconectar"
   └─ Log: "Instância desconectada: manual"

7. 🗑️ DELETED
   └─ Usuário exclui a conexão
   └─ Log: "Instância excluída do sistema e da API UAZ"
```

---

## 📊 Relatórios Possíveis

### 1. Conexões Mais Usadas
```sql
SELECT 
  instance_name,
  COUNT(*) as total_events,
  MAX(created_at) as last_activity
FROM uaz_instance_logs
WHERE event_type IN ('connected', 'status_check')
GROUP BY instance_name
ORDER BY total_events DESC;
```

### 2. Conexões Deletadas Recentemente
```sql
SELECT 
  instance_name,
  event_description,
  created_at as deleted_at
FROM uaz_instance_logs
WHERE event_type = 'deleted'
ORDER BY created_at DESC
LIMIT 10;
```

### 3. Tempo Médio até Primeira Conexão
```sql
SELECT 
  AVG(
    EXTRACT(EPOCH FROM (connected.created_at - created.created_at)) / 60
  ) as minutes_to_connect
FROM (
  SELECT instance_id, MIN(created_at) as created_at
  FROM uaz_instance_logs
  WHERE event_type = 'created'
  GROUP BY instance_id
) created
JOIN (
  SELECT instance_id, MIN(created_at) as created_at
  FROM uaz_instance_logs
  WHERE event_type = 'connected'
  GROUP BY instance_id
) connected ON created.instance_id = connected.instance_id;
```

### 4. Histórico de Erros
```sql
SELECT 
  instance_name,
  event_description,
  metadata,
  created_at
FROM uaz_instance_logs
WHERE event_type = 'error'
ORDER BY created_at DESC;
```

---

## ✅ Checklist de Implementação

### Backend
- ✅ Tabela `uaz_instance_logs` criada
- ✅ Helper `uaz-log.helper.js` criado
- ✅ Funções de log exportadas
- ⏳ Rotas atualizadas para usar logs (a fazer)
- ⏳ Rota GET /instances/:id/history criada (a fazer)

### Frontend
- ⏳ Componente de histórico criado (a fazer)
- ⏳ Botão "Ver Histórico" na tela de conexões (a fazer)
- ⏳ Modal/página para exibir histórico (a fazer)

### Arquivos Criados
- ✅ `backend/src/helpers/uaz-log.helper.js`
- ✅ `backend/src/helpers/uaz-log.helper.ts`
- ✅ `backend/src/database/migrations/020_create_uaz_instance_logs.sql`
- ✅ `EXECUTAR-LOG-UAZ.sql`
- ✅ `APLICAR-LOG-UAZ.bat`
- ✅ `SISTEMA_LOG_HISTORICO_CONEXOES.md` (este arquivo)

---

## 🚀 Próximos Passos

### 1. Executar SQL
```batch
APLICAR-LOG-UAZ.bat
```

### 2. Adicionar Rota de Histórico
Copie o código da rota GET /instances/:id/history para `backend/src/routes/uaz.js`

### 3. Atualizar Rotas Principais
Adicione os logs em cada operação crítica:
- Criação: após INSERT
- Conexão: quando QR code conectar
- Desconexão: no endpoint de disconnect
- Exclusão: antes de DELETE
- Atualização: após UPDATE

### 4. Criar Interface Frontend
Use o componente React sugerido ou crie sua própria interface

---

## 🎯 Benefícios

1. ✅ **Rastreabilidade Total** - Sabe exatamente o que aconteceu e quando
2. ✅ **Auditoria** - Histórico completo para compliance
3. ✅ **Troubleshooting** - Identifica problemas rapidamente
4. ✅ **Relatórios** - Gera relatórios de uso e estatísticas
5. ✅ **Transparência** - Usuários veem o que aconteceu com suas conexões
6. ✅ **Debug** - Facilita identificar bugs e comportamentos inesperados

---

## 📝 Notas Importantes

### Retenção de Logs
- Logs são mantidos indefinidamente por padrão
- Para limpar logs antigos, execute periodicamente:

```sql
-- Deletar logs de mais de 6 meses
DELETE FROM uaz_instance_logs 
WHERE created_at < NOW() - INTERVAL '6 months';
```

### Performance
- Índices criados automaticamente em:
  - `instance_id` (busca por instância)
  - `event_type` (filtro por tipo)
  - `created_at` (ordenação temporal)

### Segurança
- Logs não podem ser editados (apenas INSERT)
- Use `ON DELETE CASCADE` para remover logs quando instância for deletada
- Campos `old_value` e `new_value` em JSONB para flexibilidade

---

## 🎊 Conclusão

Sistema de log/histórico completo implementado! Agora você tem:

- ✅ Tabela de logs pronta
- ✅ Helpers para registrar eventos
- ✅ Exemplos de uso
- ✅ Estrutura para relatórios
- ✅ Sugestão de interface

**Próximo passo:** Execute o `APLICAR-LOG-UAZ.bat` e comece a registrar eventos! 🚀










