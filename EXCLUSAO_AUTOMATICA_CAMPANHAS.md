# 🗑️ Sistema de Exclusão Automática de Campanhas

Sistema completo para gerenciar e limpar campanhas finalizadas automaticamente.

---

## 📋 Funcionalidades Implementadas

### 1. ✅ Botão "Excluir Finalizadas" (Exclusão em Massa)

**Localização:** Topo da página de Campanhas

**Funcionalidade:**
- Exclui TODAS as campanhas com status `completed` ou `cancelled` de uma só vez
- Mostra o número de campanhas que serão excluídas
- Solicita confirmação antes de executar

**Quando aparece:**
- Apenas quando existem campanhas finalizadas

**O que é excluído:**
- ✅ As campanhas
- ✅ Todas as mensagens das campanhas
- ✅ Todos os templates associados
- ✅ Todas as associações de contatos

---

### 2. ✅ Botão "Excluir" Individual

**Localização:** Em cada card de campanha finalizada

**Funcionalidade:**
- Exclui UMA campanha específica
- Disponível apenas para campanhas com status `completed` ou `cancelled`
- Solicita confirmação mostrando o nome da campanha

**Como usar:**
1. Encontre uma campanha concluída ou cancelada
2. Clique no botão vermelho "Excluir" 🗑️
3. Confirme a exclusão

---

### 3. ✅ Limpeza Automática (Cron Job)

**Frequência:** Todos os dias às 3h da manhã

**Funcionalidade:**
- Executa automaticamente sem intervenção humana
- Exclui campanhas finalizadas há **mais de 7 dias**
- Registra no log do servidor quantas campanhas foram excluídas

**Critérios:**
- Status: `completed` ou `cancelled`
- Data de conclusão: Há mais de 7 dias

---

## 🚀 Como Usar

### Excluir Todas as Campanhas Finalizadas:

1. Acesse a página **Campanhas**
2. Localize o botão vermelho no topo: **"Excluir Finalizadas (X)"**
3. Clique no botão
4. Confirme a ação no popup
5. Aguarde a mensagem de sucesso

**Exemplo de confirmação:**
```
⚠️ ATENÇÃO: Deseja EXCLUIR TODAS as 5 campanha(s) finalizada(s)?

🗑️ Esta ação irá remover:
• 5 campanha(s) concluída(s) ou cancelada(s)
• Todas as mensagens destas campanhas
• Todos os dados relacionados

❌ ESTA AÇÃO NÃO PODE SER DESFEITA!
```

---

### Excluir Uma Campanha Individual:

1. Acesse a página **Campanhas**
2. Encontre a campanha finalizada que deseja excluir
3. Clique no botão vermelho **"Excluir"** 🗑️
4. Confirme a exclusão
5. A campanha será removida imediatamente

**Exemplo de confirmação:**
```
⚠️ ATENÇÃO: Deseja EXCLUIR PERMANENTEMENTE a campanha "Teste 01"?

🗑️ Esta ação irá remover:
• A campanha
• Todas as mensagens
• Todos os dados relacionados

❌ ESTA AÇÃO NÃO PODE SER DESFEITA!
```

---

## ⚙️ Configuração da Limpeza Automática

### Alterar o Período de Retenção (7 dias)

Para mudar quantos dias as campanhas ficam antes de serem excluídas automaticamente:

1. Abra o arquivo: `backend/src/server.ts`
2. Localize a linha:
```typescript
const deletedCount = await campaignController.deleteOldFinished(7); // 7 dias
```
3. Altere o número `7` para o desejado:
   - `7` = 7 dias
   - `15` = 15 dias
   - `30` = 30 dias (1 mês)
4. Reinicie o backend

### Alterar o Horário da Execução

Para mudar quando a limpeza automática é executada:

1. Abra o arquivo: `backend/src/server.ts`
2. Localize a linha:
```typescript
cron.schedule('0 3 * * *', async () => {
```
3. Altere o horário no formato cron:
   - `'0 3 * * *'` = 03:00 (3h da manhã)
   - `'0 2 * * *'` = 02:00 (2h da manhã)
   - `'30 4 * * *'` = 04:30 (4h30 da manhã)
   - `'0 0 * * *'` = 00:00 (meia-noite)
4. Reinicie o backend

**Formato Cron:**
```
┌───────────── minuto (0 - 59)
│ ┌───────────── hora (0 - 23)
│ │ ┌───────────── dia do mês (1 - 31)
│ │ │ ┌───────────── mês (1 - 12)
│ │ │ │ ┌───────────── dia da semana (0 - 6) (0 = Domingo)
│ │ │ │ │
│ │ │ │ │
* * * * *
```

**Exemplos:**
- `'0 3 * * *'` - Todos os dias às 3h
- `'0 */6 * * *'` - A cada 6 horas
- `'0 0 * * 0'` - Todo domingo à meia-noite
- `'0 2 1 * *'` - Dia 1 de cada mês às 2h

### Desabilitar a Limpeza Automática

Se quiser desativar completamente:

1. Abra: `backend/src/server.ts`
2. Comente ou remova o bloco:
```typescript
// cron.schedule('0 3 * * *', async () => {
//   console.log('⏰ Executando limpeza automática...');
//   try {
//     const { campaignController } = await import('./controllers/campaign.controller');
//     const deletedCount = await campaignController.deleteOldFinished(7);
//     console.log(`✅ Limpeza automática concluída: ${deletedCount} campanha(s) excluída(s)`);
//   } catch (error) {
//     console.error('❌ Erro na limpeza automática:', error);
//   }
// });
```
3. Reinicie o backend

---

## 📊 Monitoramento

### Ver Logs da Limpeza Automática

Os logs aparecem no console do backend:

```bash
# Quando a limpeza é executada:
⏰ Executando limpeza automática de campanhas finalizadas antigas...
🗑️ Limpeza automática: Excluindo campanhas finalizadas há mais de 7 dias...
📋 Encontradas 3 campanhas antigas (>7 dias)
🗑️ 45 mensagens excluídas
🗑️ 9 templates excluídos
🗑️ 150 associações de contatos excluídas
✅ Limpeza automática: 3 campanhas antigas excluídas
✅ Limpeza automática concluída: 3 campanha(s) excluída(s)
```

```bash
# Quando não há nada para excluir:
⏰ Executando limpeza automática de campanhas finalizadas antigas...
🗑️ Limpeza automática: Excluindo campanhas finalizadas há mais de 7 dias...
✅ Nenhuma campanha antiga para excluir
✅ Limpeza automática concluída: 0 campanha(s) excluída(s)
```

---

## 🔒 Segurança

### Campanhas que NÃO podem ser excluídas:

- ❌ Campanhas **ativas** (status: `running`)
- ❌ Campanhas **pausadas** (status: `paused`)
- ❌ Campanhas **agendadas** (status: `scheduled`)
- ❌ Campanhas **pendentes** (status: `pending`)

### Apenas estas podem ser excluídas:

- ✅ Campanhas **concluídas** (status: `completed`)
- ✅ Campanhas **canceladas** (status: `cancelled`)

---

## 📱 Interface do Usuário

### Botões Visíveis:

**Página de Campanhas:**

```
┌─────────────────────────────────────────────────────────────┐
│  📊 Campanhas                                                │
│                                                               │
│  [🗑️ Excluir Finalizadas (3)]  [➕ Nova Campanha]          │
└─────────────────────────────────────────────────────────────┘
```

**Card de Campanha Finalizada:**

```
┌─────────────────────────────────────────────────────────────┐
│  Nome da Campanha          ✅ CONCLUÍDA                      │
│  📅 Criada em: 11/11/2025 21:40                              │
│  ✅ Concluída em: 11/11/2025 21:48                           │
│                                                               │
│  [👁️ Detalhes]  [🗑️ Excluir]                                │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚡ Performance

### Exclusão em Lote

O sistema usa **exclusão em batch** para melhor performance:

```sql
-- Ao invés de excluir uma por vez:
DELETE FROM messages WHERE campaign_id = 1;
DELETE FROM messages WHERE campaign_id = 2;
DELETE FROM messages WHERE campaign_id = 3;

-- Excluímos todas de uma vez:
DELETE FROM messages WHERE campaign_id IN (1, 2, 3);
```

**Benefícios:**
- ✅ Muito mais rápido
- ✅ Menos carga no banco de dados
- ✅ Transação única (tudo ou nada)

---

## 🆘 Troubleshooting

### "Nenhuma campanha finalizada para excluir"

**Causa:** Todas as suas campanhas estão ativas, pausadas ou pendentes.

**Solução:** Aguarde uma campanha concluir ou cancele uma campanha manualmente.

---

### Botão "Excluir Finalizadas" não aparece

**Causa:** Não há campanhas com status `completed` ou `cancelled`.

**Solução:** O botão aparece automaticamente quando houver campanhas finalizadas.

---

### Erro ao excluir: "Campanha não encontrada"

**Causa:** A campanha já foi excluída ou o ID está incorreto.

**Solução:** Recarregue a página (`F5`) e tente novamente.

---

### Limpeza automática não está funcionando

**Verificações:**

1. **Backend está rodando?**
```bash
# Verifique se há logs no console
✅ Limpeza automática de campanhas configurada (todos os dias às 3h)
```

2. **Cron job está ativo?**
```bash
# Procure por esta linha nos logs às 3h da manhã
⏰ Executando limpeza automática de campanhas finalizadas antigas...
```

3. **Há campanhas antigas?**
- Só são excluídas campanhas finalizadas há **mais de 7 dias**

---

## 🎯 Resumo

| Funcionalidade | Descrição | Frequência |
|----------------|-----------|------------|
| **Excluir Todas** | Botão manual para excluir todas as campanhas finalizadas | Manual |
| **Excluir Individual** | Botão em cada campanha para excluir uma por vez | Manual |
| **Limpeza Automática** | Executa automaticamente todos os dias | Diariamente às 3h |
| **Período de Retenção** | Campanhas são mantidas por 7 dias após finalização | Configurável |

---

## 📚 Arquivos Modificados

### Backend:
- `backend/src/controllers/campaign.controller.ts` - Lógica de exclusão
- `backend/src/routes/index.ts` - Novas rotas
- `backend/src/server.ts` - Cron job automático

### Frontend:
- `frontend/src/pages/campanhas.tsx` - Interface com botões
- `frontend/src/services/api.ts` - Cliente API

---

## 🎉 Pronto!

Agora você tem um sistema completo de gerenciamento de campanhas antigas com:

✅ Exclusão manual individual  
✅ Exclusão manual em massa  
✅ Limpeza automática diária  
✅ Configurável e flexível  
✅ Seguro e com confirmações  

**O sistema cuida da limpeza automaticamente, mantendo seu banco de dados organizado! 🚀**





