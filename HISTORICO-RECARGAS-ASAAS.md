# 📊 Histórico de Recargas - Inclusão de Pagamentos Asaas

## 🎯 Objetivo

Incluir no **Histórico de Recargas** as consultas avulsas adquiridas através de pagamentos confirmados via Asaas, além das recargas manuais já existentes.

## 📝 Problema Anterior

O histórico de recargas exibia apenas:
- ✅ Recargas manuais adicionadas por administradores (audit_logs)
- ❌ **NÃO mostrava** pagamentos confirmados via Asaas

Isso causava confusão, pois clientes que compravam consultas via PIX não viam essas transações no histórico.

## ✅ Solução Implementada

### Backend (`backend/src/controllers/admin/tenants.controller.js`)

**Modificação na função `getConsultasAvulsasHistory`:**

1. **UNION de duas fontes de dados:**
   - **Audit Logs**: Recargas/remoções manuais por administradores
   - **Payments**: Pagamentos confirmados via Asaas (status `RECEIVED` ou `CONFIRMED`)

2. **Campos adicionados:**
   - `source`: Identifica a origem ('manual' ou 'asaas')
   - `payment_id`: ID do pagamento no Asaas (quando aplicável)
   - `valor`: Valor pago (para pagamentos Asaas)

3. **Query SQL Atualizada:**
```sql
-- Recargas manuais do audit_logs
SELECT 
  'manual_' || al.id::text as id,
  al.acao as action,
  al.metadata,
  al.dados_antes,
  al.dados_depois,
  al.created_at,
  u.nome as admin_name,
  NULL as payment_id,
  NULL as valor,
  'manual' as source
FROM audit_logs al
LEFT JOIN tenant_users u ON al.user_id = u.id
WHERE al.tenant_id = $1 
  AND (al.acao = 'add_consultas_avulsas' OR al.acao = 'remove_consultas_avulsas')

UNION ALL

-- Pagamentos confirmados via Asaas
SELECT 
  'payment_' || p.id::text as id,
  'add_consultas_avulsas' as action,
  p.metadata,
  NULL as dados_antes,
  NULL as dados_depois,
  COALESCE(p.data_pagamento, p.confirmed_at, p.created_at) as created_at,
  'Pagamento Asaas' as admin_name,
  p.asaas_payment_id as payment_id,
  p.valor,
  'asaas' as source
FROM payments p
WHERE p.tenant_id = $1 
  AND p.metadata->>'tipo' = 'consultas_avulsas'
  AND p.status IN ('RECEIVED', 'CONFIRMED')

ORDER BY created_at DESC
LIMIT 100
```

4. **Motivo automático para pagamentos:**
   - Se for pagamento Asaas, o motivo exibe: `"Pagamento via PIX - R$ XX,XX"`
   - Extrai `quantidade_consultas` do campo `metadata` do pagamento

### Frontend (`frontend/src/pages/admin/tenants/[id].tsx`)

**Indicador visual de origem:**

Adicionado badge para identificar pagamentos via Asaas:

```tsx
{item.source === 'asaas' && (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600/30 text-blue-300 rounded text-xs font-medium border border-blue-500/50">
    💳 Pagamento Asaas
  </span>
)}
```

## 🎨 Interface Atualizada

### Antes:
```
📊 3 recargas | 💎 150 créditos
(Apenas recargas manuais)
```

### Depois:
```
📊 5 recargas | 💎 300 créditos
(Recargas manuais + Pagamentos Asaas)
```

### Exemplo de Exibição:

| Data/Hora | Ação | Quantidade | Motivo | Administrador |
|-----------|------|------------|--------|---------------|
| 25/11/2025, 16:56 | ➕ Adicionou<br>💳 Pagamento Asaas | +50 | Pagamento via PIX - R$ 60,00 | Pagamento Asaas |
| 25/11/2025, 14:09 | ➕ Adicionou | +2 | dfvds | Super Administrador |
| 25/11/2025, 14:00 | ➕ Adicionou | +2 | 55 | Super Administrador |

## 🔍 Detalhes Técnicos

### Estrutura do Registro

**Recarga Manual:**
```json
{
  "id": "manual_1234",
  "action": "add_consultas_avulsas",
  "created_at": "2025-11-25T14:09:00Z",
  "admin_name": "Super Administrador",
  "source": "manual",
  "payment_id": null,
  "details": {
    "quantidade": 2,
    "motivo": "Recarga teste"
  }
}
```

**Pagamento Asaas:**
```json
{
  "id": "payment_5678",
  "action": "add_consultas_avulsas",
  "created_at": "2025-11-25T16:56:00Z",
  "admin_name": "Pagamento Asaas",
  "source": "asaas",
  "payment_id": "pay_abc123xyz",
  "details": {
    "quantidade": 50,
    "motivo": "Pagamento via PIX - R$ 60.00"
  }
}
```

## ✅ Benefícios

1. **Transparência Total**: Cliente vê todas as recargas, incluindo pagamentos
2. **Rastreabilidade**: ID do pagamento Asaas é preservado
3. **Identificação Visual**: Badge azul diferencia pagamentos de recargas manuais
4. **Valor Exibido**: Mostra quanto foi pago no PIX
5. **Histórico Completo**: União de ambas as fontes em ordem cronológica

## 🧪 Como Testar

1. Acesse: `/admin/tenants/[id]` (página de detalhes do tenant)
2. Role até a seção **"Consultas Avulsas (Nova Vida)"**
3. Localize o **"Histórico de Recargas"**
4. Clique em **"Atualizar"**
5. Verifique se aparecem:
   - ✅ Recargas manuais (sem badge)
   - ✅ Pagamentos Asaas (com badge azul 💳)

## 📊 Impacto

- **Dados**: Nenhuma migração necessária (usa dados existentes)
- **Performance**: Query otimizada com UNION e LIMIT 100
- **Compatibilidade**: Mantém estrutura anterior, apenas adiciona novos registros
- **UX**: Melhora significativa na transparência do sistema

## 🔄 Endpoint Afetado

**GET** `/api/admin/tenants/:id/consultas-avulsas/history`

**Response (atualizada):**
```json
{
  "success": true,
  "history": [
    {
      "id": "payment_123",
      "action": "add_consultas_avulsas",
      "created_at": "2025-11-25T16:56:00Z",
      "admin_name": "Pagamento Asaas",
      "source": "asaas",
      "payment_id": "pay_abc123",
      "details": {
        "quantidade": 50,
        "motivo": "Pagamento via PIX - R$ 60.00"
      }
    }
  ]
}
```

## 📅 Data da Alteração

**25 de Novembro de 2025**

---

**Status**: ✅ Implementado e Testado
**Versão**: 1.0

