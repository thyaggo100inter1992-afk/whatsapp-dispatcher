# Sistema de Plano de Teste (Trial)

Sistema completo de plano de teste com bloqueio e deleção automática.

## 📋 Regras do Plano Teste

### ⏱️ Timeline
1. **Dia 0**: Usuário se registra com plano "Teste Grátis"
   - Conta criada com status `trial`
   - Campo `trial_ends_at` definido para **hoje + 3 dias**

2. **Dia 3**: Trial expira
   - Worker verifica automaticamente (a cada 6 horas)
   - Status mudado para `blocked`
   - Campo `blocked_at` registra data/hora do bloqueio
   - Campo `will_be_deleted_at` definido para **hoje + 12 dias** (15 dias total)
   - Usuário **NÃO consegue mais fazer login**

3. **Dia 15**: Conta deletada
   - Worker deleta permanentemente:
     - Usuários do tenant
     - Contas WhatsApp
     - Campanhas
     - Templates
     - Logs
     - Tenant
   - Sem possibilidade de recuperação

### 🚨 Avisos ao Usuário

#### Durante o Registro
- Box amarelo com informações claras:
  ```
  📋 Regras do Plano Teste:
  • 3 dias gratuitos para testar
  • Após 3 dias: Conta bloqueada automaticamente
  • Após 15 dias total: Conta deletada permanentemente
  • Faça upgrade a qualquer momento para manter sua conta
  
  ⚠️ Não perca seus dados! Faça upgrade antes que o período expire.
  ```

#### No Login (após bloqueio)
- Mensagem de erro:
  ```
  Sua conta está bloqueada. O período de teste expirou.
  Você tem X dias para fazer upgrade antes da conta ser deletada.
  ```

## 🎯 Limites do Plano Teste

| Recurso | Limite |
|---------|--------|
| Usuários | 2 |
| Contas WhatsApp | 1 |
| Campanhas/mês | 10 |
| Mensagens/dia | 100 |
| Consultas Nova Vida/mês | 50 |
| Duração | 3 dias |
| Preço | R$ 0,00 |

## 🔧 Implementação Técnica

### Banco de Dados

#### Tabela `plans`
```sql
duracao_trial_dias INTEGER DEFAULT NULL
-- NULL = não é plano teste
-- > 0 = quantidade de dias de teste
```

#### Tabela `tenants`
```sql
trial_ends_at TIMESTAMP DEFAULT NULL
-- Data/hora em que o trial expira

blocked_at TIMESTAMP DEFAULT NULL
-- Data/hora em que foi bloqueado

will_be_deleted_at TIMESTAMP DEFAULT NULL
-- Data/hora em que será deletado
```

### Worker: `trial-cleanup.worker.js`

#### Função 1: `blockExpiredTrials()`
- Busca tenants com `trial_ends_at <= NOW()`
- Status = `active`
- Não bloqueados (`blocked_at IS NULL`)
- Bloqueia e define data de deleção

#### Função 2: `deleteExpiredTenants()`
- Busca tenants com `will_be_deleted_at <= NOW()`
- Status = `blocked`
- Deleta em cascata:
  1. Usuários
  2. Contas WhatsApp
  3. Campanhas
  4. Templates
  5. Logs
  6. Tenant

#### Agendamento
- Executa **a cada 6 horas**
- Primeira execução ao iniciar o servidor
- Schedule cron: `0 */6 * * *`

### Registro de Tenants

#### Fluxo
1. Usuário seleciona plano "Teste Grátis"
2. Backend busca `duracao_trial_dias` do plano
3. Se > 0, calcula `trial_ends_at = NOW() + duracao_trial_dias`
4. Cria tenant com:
   - `status = 'trial'`
   - `trial_ends_at` definido
   - `plan_id` do plano teste

### Login

#### Validação Adicional
Após validar senha, verifica:
```javascript
if (tenant.status === 'blocked' || tenant.blocked_at) {
  return error: 'TENANT_BLOCKED'
}
```

Mensagem inclui:
- Data do bloqueio
- Dias restantes até deleção
- Sugestão para fazer upgrade

## 📱 Interface do Usuário

### Página de Registro

#### Select de Plano
```html
<option value="teste">🎁 Teste Grátis - 3 dias</option>
```

#### Box de Informações (quando "teste" selecionado)
- Background amarelo
- Ícone de aviso
- Lista de regras clara
- Call-to-action para upgrade

### Página Admin

#### Dashboard
- Card mostrando tenants em trial
- Alerta para trials prestes a expirar
- Botão para fazer upgrade

## 🔄 Como Fazer Upgrade

### Manualmente (Super Admin)
1. Acessar `/admin/tenants`
2. Editar tenant
3. Mudar plano para pago
4. Salvar

### Automaticamente (TODO)
- Página de checkout
- Integração com gateway de pagamento
- Mudança automática de plano após pagamento

## 🧪 Como Testar

### 1. Criar Conta Teste
```
1. Acesse: http://localhost:3000/registro
2. Preencha dados da empresa
3. Selecione "Teste Grátis - 3 dias"
4. Veja o aviso amarelo
5. Complete o registro
```

### 2. Verificar no Banco
```sql
SELECT 
  nome,
  status,
  trial_ends_at,
  blocked_at,
  will_be_deleted_at,
  created_at
FROM tenants
WHERE plano = 'teste';
```

### 3. Simular Expiração (para testes)
```sql
-- Fazer o trial expirar imediatamente
UPDATE tenants 
SET trial_ends_at = NOW() - INTERVAL '1 hour'
WHERE id = [ID_DO_TENANT];

-- Executar worker manualmente
-- No terminal do backend, ele roda a cada 6 horas
-- Ou reinicie o backend para executar imediatamente
```

### 4. Testar Login Bloqueado
```
1. Simule expiração (SQL acima)
2. Aguarde worker executar (ou reinicie backend)
3. Tente fazer login
4. Deve ver mensagem de bloqueio
```

### 5. Testar Deleção
```sql
-- Fazer o tenant estar pronto para deleção
UPDATE tenants 
SET 
  trial_ends_at = NOW() - INTERVAL '15 days',
  blocked_at = NOW() - INTERVAL '12 days',
  will_be_deleted_at = NOW() - INTERVAL '1 hour',
  status = 'blocked'
WHERE id = [ID_DO_TENANT];

-- Aguardar worker executar
-- Verificar que tenant foi deletado
```

## 📊 Monitoramento

### Logs do Worker
```
🔍 ===== VERIFICANDO PLANOS DE TESTE =====
⏰ 21/11/2025, 18:00:00

🔒 Verificando trials expirados para bloqueio...
⚠️  Encontrados 2 tenants com trial expirado

🔒 BLOQUEADO: Empresa Teste (teste@empresa.com)
   Trial terminou em: 21/11/2025 15:00:00
   Será deletado em: 03/12/2025 15:00:00

🗑️  Verificando tenants bloqueados para deleção...
✅ Nenhum tenant para deletar

✅ Verificação de trials concluída
====================================================
```

### Verificar Trials Ativos
```sql
SELECT 
  nome,
  email,
  status,
  trial_ends_at,
  EXTRACT(DAY FROM (trial_ends_at - NOW())) as dias_restantes
FROM tenants
WHERE trial_ends_at IS NOT NULL
  AND status = 'trial'
ORDER BY trial_ends_at ASC;
```

### Verificar Tenants Bloqueados
```sql
SELECT 
  nome,
  email,
  blocked_at,
  will_be_deleted_at,
  EXTRACT(DAY FROM (will_be_deleted_at - NOW())) as dias_ate_delecao
FROM tenants
WHERE status = 'blocked'
ORDER BY will_be_deleted_at ASC;
```

## 🚀 Produção

### Configurações Recomendadas

#### Worker Frequency
- Desenvolvimento: A cada 6 horas
- Produção: A cada 1 hora (para resposta mais rápida)

```javascript
// server.ts
cron.schedule('0 * * * *', () => { // A cada hora
  trialCleanupWorker.run();
});
```

#### Notificações por Email
```javascript
// Após bloquear
await sendEmail({
  to: tenant.email,
  subject: 'Trial Expirado - Faça Upgrade',
  body: `
    Seu período de teste expirou.
    Faça upgrade em até 12 dias para manter seus dados.
  `
});

// 2 dias antes da deleção
// 1 dia antes da deleção
// No dia da deleção
```

#### Alertas no Dashboard
- Badge vermelho para trials expirando em 24h
- Email/SMS para admin da conta
- Pop-up ao fazer login

## 🔒 Segurança

### Prevenção de Abuso
- Validar documento (CPF/CNPJ) único
- Validar email único
- Limitar trials por IP (TODO)
- Captcha no registro (TODO)

### Backup Antes da Deleção
```javascript
// Antes de deletar, fazer backup (TODO)
await backupService.createBackup(tenantId);
await s3.upload(`backups/${tenantId}.json`);
```

## 📝 Notas Importantes

1. **Irreversível**: Após 15 dias, a deleção é permanente
2. **Sem recuperação**: Não há como restaurar dados deletados
3. **Upgrade a qualquer momento**: Usuário pode fazer upgrade durante o trial ou após bloqueio
4. **Comunicação clara**: Avisar usuário em todas as etapas

---

**Sistema implementado em: 21/11/2025**
**Versão: 1.0**



