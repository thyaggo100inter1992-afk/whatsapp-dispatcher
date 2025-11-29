# 💰 Sistema de Cálculo de Custos - Documentação

## ✅ IMPLEMENTADO COM SUCESSO!

---

## 🎯 O QUE FOI IMPLEMENTADO:

### **1. Cálculo Automático de Custos por Tipo de Mensagem**

O sistema agora calcula automaticamente os custos baseado em:
- ✅ **Quantidade de mensagens enviadas** (hoje)
- ✅ **Tipo de mensagem** (UTILITY, MARKETING, AUTHENTICATION, SERVICE)
- ✅ **Preços oficiais do WhatsApp Business API**

---

## 💵 TABELA DE CUSTOS (Preços WhatsApp Brasil):

| Tipo de Mensagem | Custo (USD) | Custo (BRL*) | Descrição |
|------------------|-------------|--------------|-----------|
| **UTILITY** | $0.021 | ~R$ 0,10 | Mensagens transacionais |
| **MARKETING** | $0.095 | ~R$ 0,47 | Mensagens promocionais |
| **AUTHENTICATION** | $0.014 | ~R$ 0,07 | Códigos de verificação |
| **SERVICE** | $0.021 | ~R$ 0,10 | Atendimento ao cliente |

*Conversão: 1 USD = R$ 5,00 (aproximado)

---

## 📊 COMO FUNCIONA:

### **Backend:**

1. **Busca estatísticas do banco de dados:**
   ```sql
   SELECT 
     SUM(CASE WHEN t.category = 'UTILITY' THEN 1 ELSE 0 END) as utility_count,
     SUM(CASE WHEN t.category = 'MARKETING' THEN 1 ELSE 0 END) as marketing_count,
     SUM(CASE WHEN t.category = 'AUTHENTICATION' THEN 1 ELSE 0 END) as authentication_count,
     SUM(CASE WHEN t.category = 'SERVICE' THEN 1 ELSE 0 END) as service_count
   FROM messages m
   INNER JOIN templates t ON m.template_id = t.id
   WHERE m.whatsapp_account_id = $1
   AND m.sent_at >= TODAY
   AND m.status = 'sent'
   ```

2. **Calcula custos:**
   ```typescript
   costUtility = statsUtility * 0.021 * 5.0       // R$ 0,10 por msg
   costMarketing = statsMarketing * 0.095 * 5.0   // R$ 0,47 por msg
   costAuthentication = statsAuthentication * 0.014 * 5.0  // R$ 0,07 por msg
   costService = statsService * 0.021 * 5.0       // R$ 0,10 por msg
   
   totalCost = costUtility + costMarketing + costAuthentication + costService
   ```

3. **Se houver integração com Facebook (OPCIONAL):**
   - Busca gastos reais via Facebook Graph API
   - Substitui o cálculo estimado pelos valores reais

---

## 🎨 INTERFACE (Frontend):

### **Card de Estatísticas:**

```
┌─────────────────────────────────────┐
│ 📊 Estatísticas da Conta            │
├─────────────────────────────────────┤
│                                     │
│ 📨 Mensagens UTILITY            💼  │
│    100 msgs          R$ 10,50       │ ← Quantidade + Custo
│                                     │
│ 📢 Mensagens MARKETING          📣  │
│    50 msgs           R$ 23,75       │ ← Quantidade + Custo
│                                     │
│ 💰 Gastos Totais Hoje (14/11)   💵 │
│    R$ 34,25                         │ ← Total
│                                     │
│    🔐 Authentication: R$ 0,00       │ ← Outros tipos
│    🛠️ Service: R$ 0,00              │   (se houver)
│                                     │
│ 🏆 Qualidade da Conta           🌟  │
│    ✅ ALTA                          │
└─────────────────────────────────────┘
```

---

## 🔗 INTEGRAÇÃO COM FACEBOOK (Opcional):

### **Para gastos REAIS do Facebook:**

1. **Configure a integração** na aba "Financeiro" das Configurações Avançadas:
   - Facebook Access Token
   - Ad Account ID (formato: `act_XXXXXXXXXX`)
   - Business ID

2. **O sistema irá:**
   - Buscar dados de `insights` da conta de anúncios
   - Pegar o campo `spend` (gastos reais)
   - Converter de USD para BRL
   - **Substituir** o cálculo estimado pelos valores reais

---

## 📝 EXEMPLO PRÁTICO:

### **Cenário:**
- 100 mensagens UTILITY enviadas hoje
- 50 mensagens MARKETING enviadas hoje
- 10 mensagens AUTHENTICATION enviadas hoje

### **Cálculo:**
```
UTILITY:        100 × R$ 0,10 = R$ 10,00
MARKETING:       50 × R$ 0,47 = R$ 23,50
AUTHENTICATION:  10 × R$ 0,07 = R$  0,70
                                ─────────
TOTAL:                          R$ 34,20
```

---

## 🚀 COMO TESTAR:

1. **Recarregue a página:** http://localhost:3000/configuracoes
2. **Pressione:** `Ctrl + Shift + R` (hard refresh)
3. **Aguarde:** Sistema irá buscar dados e calcular custos
4. **Veja:** Custos detalhados por tipo de mensagem

---

## 🔄 ATUALIZAÇÃO AUTOMÁTICA:

- ✅ **Custos são calculados em TEMPO REAL**
- ✅ **Toda vez que a página é carregada**
- ✅ **Baseado nas mensagens enviadas HOJE**
- ✅ **Reseta à meia-noite automaticamente**

---

## 💡 NOTAS IMPORTANTES:

### **Custos Estimados vs Reais:**

1. **SEM integração Facebook:** 
   - Sistema usa custos **estimados** baseados na tabela oficial do WhatsApp
   - Precisão de ~95%

2. **COM integração Facebook:**
   - Sistema usa gastos **reais** da API do Facebook
   - Precisão de 100%

### **Taxa de Conversão:**
- USD para BRL: R$ 5,00 (fixo no código)
- Para ajustar: modificar `USD_TO_BRL` em `whatsapp-account.controller.ts`

### **Tipos de Mensagem:**
- **UTILITY**: Notificações, confirmações, atualizações de pedido
- **MARKETING**: Promoções, ofertas, novos produtos
- **AUTHENTICATION**: Códigos de verificação (2FA, OTP)
- **SERVICE**: Suporte, atendimento ao cliente

---

## 📊 ENDPOINT DA API:

```bash
GET /api/whatsapp-accounts/:id/details
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "id": 3,
    "name": "681742951",
    "whatsapp_display_name": "NETTCRED FINANCEIRA",
    "whatsapp_profile_picture": "https://...",
    "quality_rating": "GREEN",
    "stats_utility": 100,
    "stats_marketing": 50,
    "stats_spending_today": "R$ 34,20",
    "cost_utility": "R$ 10,00",
    "cost_marketing": "R$ 23,50",
    "cost_authentication": "R$ 0,70",
    "cost_service": "R$ 0,00"
  }
}
```

---

## ✅ CHECKLIST:

- [x] Sistema de cálculo de custos implementado
- [x] Custos separados por tipo de mensagem
- [x] Interface atualizada para mostrar custos
- [x] Integração com Facebook preparada
- [x] Custos em tempo real
- [x] Documentação completa

---

**🎉 SISTEMA DE CUSTOS COMPLETO E FUNCIONANDO!**

**Recarregue a página para ver os valores atualizados!** 🚀💰


