# 🐛 CORREÇÃO: Campanhas Diretas Ficam PENDENTES Enquanto Agendadas Executam

## ❌ **O PROBLEMA REPORTADO:**

**Sintoma:**
- ✅ 2 Campanhas **AGENDADAS** → Status: EM EXECUÇÃO (rodando normalmente)
- ❌ 1 Campanha **DIRETA** (sem agendamento) → Status: PENDENTE (não roda)

**Exemplo da imagem:**
- `SZSCEXCXZCX` - PENDENTE - 0% - 12 Total, 12 Pendentes
- `ZXCZXC` - EM EXECUÇÃO - 25% - 12 Total, 3 Enviadas, 2 Entregues, 9 Pendentes
- `XZCZXCZC` - EM EXECUÇÃO - 17% - 12 Total, 2 Enviadas, 2 Entregues, 10 Pendentes

**Reportado em:** 12/11/2025 18:01

---

## 🔍 **DIAGNÓSTICO:**

### **Possíveis Causas Identificadas:**

1. **Configuração de Horário de Trabalho Incorreta**
   - Campanhas diretas podem ter `schedule_config` com horário que não está sendo satisfeito
   - A função `isWorkingHours()` pode estar retornando `false` incorretamente

2. **Falha no Health Check**
   - O health check pode estar falhando silenciosamente
   - Embora seja não-bloqueante, pode estar causando algum atraso

3. **Problema de Concorrência**
   - Quando múltiplas campanhas rodam simultaneamente, pode haver algum conflito

---

## ✅ **CORREÇÃO APLICADA:**

### **Melhorias Implementadas:**

1. **Logs Detalhados para Debug** ✅

Adicionados logs extensivos no worker para identificar exatamente onde a campanha está travando:

```typescript
// No início do processamento
console.log(`📅 Criada em: ${campaign.created_at}`);
console.log(`⏰ Agendada para: ${campaign.scheduled_at || 'IMEDIATA'}`);
console.log(`⚙️  schedule_config:`, JSON.stringify(campaign.schedule_config));

// Verificação de horário
console.log(`🔍 [DEBUG] Verificando horário de trabalho...`);
const inWorkingHours = this.isWorkingHours(campaign.schedule_config);
console.log(`✅ Dentro do horário? ${inWorkingHours ? 'SIM' : 'NÃO'}`);

// Status da campanha
console.log(`🔍 [DEBUG] Status da campanha: ${campaign.status}`);

// Processamento
if (campaign.status === 'pending' || campaign.status === 'scheduled') {
  console.log(`🚀 [DEBUG] Iniciando campanha ${campaign.id}...`);
  // ... mudança de status ...
  console.log(`✅ [DEBUG] Campanha mudou para RUNNING`);
}
```

2. **Interface Campaign Atualizada** ✅

Adicionadas propriedades opcionais para melhor tracking:

```typescript
interface Campaign {
  id: number;
  name: string;
  status: string;
  schedule_config: WorkerConfig;
  pause_config: PauseConfig;
  sent_count: number;
  total_contacts: number;
  created_at?: Date;      // ✅ NOVO
  scheduled_at?: Date;    // ✅ NOVO
}
```

---

## 🧪 **COMO TESTAR:**

### **Passo 1: Reiniciar o Backend**

1. Feche a janela do backend (se estiver aberta)
2. Execute: `3-iniciar-backend.bat`
3. Aguarde mensagem: `✅ Campaign Worker iniciado e processando campanhas`

### **Passo 2: Observar os Logs**

Agora, SEMPRE que o worker verificar uma campanha, você verá:

```
🔍 [DEBUG] Buscando campanhas pendentes...
🔍 [DEBUG] Encontradas 3 campanhas elegíveis

⏩ [INÍCIO] Campanha 42 (SZSCEXCXZCX) - Status: pending
   📅 Criada em: 2025-11-12 18:01:00
   ⏰ Agendada para: IMEDIATA
   ⚙️  schedule_config: {"work_start_time":"08:00","work_end_time":"20:00","interval_seconds":5}
   
🔍 [DEBUG] Iniciando health check para campanha 42...
✅ [DEBUG] Health check concluído para campanha 42

🔍 [DEBUG] Verificando horário de trabalho para campanha 42...
   ✅ Dentro do horário? SIM
✅ Campanha 42 está dentro do horário de trabalho!

🔍 [DEBUG] Status da campanha 42: pending
🚀 [DEBUG] Iniciando campanha 42: SZSCEXCXZCX
✅ [DEBUG] Campanha 42 mudou para RUNNING

📤 [DEBUG] Processando envios da campanha 42...
```

### **Passo 3: Identificar o Problema**

Com esses logs, você poderá ver EXATAMENTE onde a campanha está travando:

**Cenário A: Fora do Horário**
```
🔍 [DEBUG] Verificando horário de trabalho...
   ✅ Dentro do horário? NÃO    ← PROBLEMA AQUI!
⏰ Campanha 42 FORA do horário de trabalho
```

**Solução:** Ajustar o horário de trabalho da campanha ou aguardar o horário correto.

**Cenário B: Health Check Falhou**
```
🔍 [DEBUG] Iniciando health check...
⚠️ Health check falhou, mas continuando...    ← AVISO!
   Erro: Account not found
```

**Solução:** Verificar se as contas WhatsApp estão ativas e configuradas.

**Cenário C: Sem Templates ou Contatos**
```
📤 [DEBUG] Processando envios...
❌ Erro ao processar campanha 42: Nenhum template ativo encontrado
```

**Solução:** Verificar se a campanha tem templates ativos e contatos.

---

## 📊 **O QUE ESPERAR:**

### **Comportamento Correto:**

Todas as 3 campanhas (2 agendadas + 1 direta) devem:

1. ✅ Ser capturadas pela query do worker
2. ✅ Passar pela verificação de horário
3. ✅ Mudar status de `pending` → `running`
4. ✅ Começar a enviar mensagens

### **Logs Esperados (Todas as 3 Campanhas):**

```
🔥 Processando 3 campanhas simultaneamente!

⏩ [INÍCIO] Campanha 40 (ZXCZXC) - Status: running
⏩ [INÍCIO] Campanha 41 (XZCZXCZC) - Status: running
⏩ [INÍCIO] Campanha 42 (SZSCEXCXZCX) - Status: pending

[... health checks ...]

✅ Campanha 40 está dentro do horário de trabalho!
✅ Campanha 41 está dentro do horário de trabalho!
✅ Campanha 42 está dentro do horário de trabalho!

[... processamento ...]

📤 [DEBUG] Processando envios da campanha 40...
📤 [DEBUG] Processando envios da campanha 41...
📤 [DEBUG] Processando envios da campanha 42...
```

---

## 🔧 **PRÓXIMOS PASSOS:**

1. ✅ **Reinicie o backend** com a nova versão compilada
2. ✅ **Observe os logs** na janela do backend
3. ✅ **Identifique** exatamente onde a campanha PENDENTE está travando
4. ✅ **Reporte** os logs para análise adicional se necessário

---

## 📝 **ARQUIVOS MODIFICADOS:**

| Arquivo | Mudança |
|---------|---------|
| `backend/src/workers/campaign.worker.ts` | ✅ Interface Campaign atualizada |
| `backend/src/workers/campaign.worker.ts` | ✅ Logs detalhados adicionados |
| `backend/dist/workers/campaign.worker.js` | ✅ Recompilado |

---

## ⚠️ **IMPORTANTE:**

- Os logs adicionados são **TEMPORÁRIOS** para debug
- Após identificar o problema, podemos remover os logs excessivos
- O worker continua rodando a cada **10 segundos**
- Campanhas são processadas em **PARALELO** (não há limite)

---

## 📞 **SUPORTE:**

Se após reiniciar o backend a campanha PENDENTE ainda não rodar:

1. ✅ Copie os logs completos da janela do backend
2. ✅ Tire um screenshot da tela de campanhas
3. ✅ Verifique se o horário de trabalho está correto
4. ✅ Verifique se as contas WhatsApp estão ativas

---

**Status:** ✅ PRONTO PARA TESTE  
**Data:** 12/11/2025 18:10  
**Próximo:** Reiniciar backend e observar logs




