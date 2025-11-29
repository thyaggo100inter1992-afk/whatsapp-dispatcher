# 🖱️ Rastreamento de Cliques em Botões

Documentação completa sobre o sistema de rastreamento de cliques em botões dos templates do WhatsApp.

---

## 📋 Visão Geral

O sistema agora rastreia quando usuários clicam em botões dos templates do WhatsApp Business API. Todos os cliques são registrados no banco de dados e aparecem no relatório Excel na **Aba 7**.

---

## 🗄️ Estrutura do Banco de Dados

### Tabela: `button_clicks`

```sql
CREATE TABLE button_clicks (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER,              -- Campanha relacionada
    message_id INTEGER,               -- Mensagem relacionada
    contact_id INTEGER,               -- Contato que clicou
    phone_number VARCHAR(50),         -- Telefone do contato
    contact_name VARCHAR(255),        -- Nome do contato
    button_text VARCHAR(255),         -- Texto do botão clicado
    button_payload VARCHAR(500),      -- Payload/ação do botão
    clicked_at TIMESTAMP,             -- Data e hora do clique
    created_at TIMESTAMP
);
```

---

## 📊 Aba 7 do Relatório

### Estrutura:

| Coluna | Descrição | Exemplo |
|--------|-----------|---------|
| **Quem Clicou** | Nome completo do contato | "João Silva" |
| **Telefone** | Número do contato | "+5562991234567" |
| **Nome do Botão** | Texto exibido no botão | "Quero mais informações" |
| **Template Usado** | Template que tinha o botão | "template_ofertas" |
| **Mensagem Enviada Em** | Quando a mensagem foi enviada | "12/11/2025 10:30" |
| **Clique Em (Data)** | Data do clique | "12/11/2025" |
| **Clique Em (Hora)** | Hora do clique | "10:45" |
| **Ação/Payload** | ID da ação do botão | "info_request" |

---

## 🔔 Como Funciona

### 1. Template com Botão

Templates do WhatsApp podem ter botões:

```json
{
  "type": "button",
  "buttons": [
    {
      "type": "quick_reply",
      "text": "Quero mais informações",
      "payload": "info_request"
    },
    {
      "type": "quick_reply",
      "text": "Falar com atendente",
      "payload": "contact_support"
    }
  ]
}
```

### 2. Usuário Clica no Botão

Quando o usuário clica em um botão no WhatsApp, o Meta envia um webhook com os dados do clique.

### 3. Webhook Captura o Clique

O sistema recebe o webhook e salva no banco:

```javascript
{
  "type": "button_reply",
  "button": {
    "text": "Quero mais informações",
    "payload": "info_request"
  },
  "from": "5562991234567",
  "timestamp": "2025-11-12T10:45:30Z"
}
```

### 4. Clique Salvo no Banco

```sql
INSERT INTO button_clicks (
  campaign_id, 
  message_id,
  contact_id,
  phone_number,
  contact_name,
  button_text,
  button_payload,
  clicked_at
) VALUES (
  123,
  456,
  789,
  '5562991234567',
  'João Silva',
  'Quero mais informações',
  'info_request',
  '2025-11-12 10:45:30'
);
```

### 5. Aparece no Relatório

Ao gerar o relatório Excel da campanha, a Aba 7 mostra todos os cliques registrados.

---

## 🔧 Implementação no Webhook (Para Desenvolvedores)

### Atualizar `webhook.controller.ts`

```typescript
// backend/src/controllers/webhook.controller.ts

async receive(req: Request, res: Response) {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (value?.messages) {
      // Mensagens recebidas
      for (const message of value.messages) {
        // Verificar se é um clique em botão
        if (message.type === 'button' && message.button) {
          await this.handleButtonClick(message, value);
        }
      }
    }

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Erro no webhook:', error);
    res.status(500).json({ success: false });
  }
}

private async handleButtonClick(message: any, value: any) {
  try {
    const phoneNumber = message.from;
    const buttonText = message.button.text;
    const buttonPayload = message.button.payload;
    const timestamp = new Date(parseInt(message.timestamp) * 1000);

    console.log(`🖱️ Clique em botão detectado:`);
    console.log(`   Telefone: ${phoneNumber}`);
    console.log(`   Botão: ${buttonText}`);
    console.log(`   Payload: ${buttonPayload}`);

    // Buscar a mensagem original
    const messageResult = await query(
      `SELECT m.*, c.name as contact_name
       FROM messages m
       LEFT JOIN contacts c ON m.contact_id = c.id
       WHERE m.phone_number = $1
       ORDER BY m.sent_at DESC
       LIMIT 1`,
      [phoneNumber]
    );

    if (messageResult.rows.length === 0) {
      console.log('⚠️ Mensagem original não encontrada');
      return;
    }

    const originalMessage = messageResult.rows[0];

    // Salvar clique no banco
    await query(
      `INSERT INTO button_clicks (
        campaign_id,
        message_id,
        contact_id,
        phone_number,
        contact_name,
        button_text,
        button_payload,
        clicked_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        originalMessage.campaign_id,
        originalMessage.id,
        originalMessage.contact_id,
        phoneNumber,
        originalMessage.contact_name,
        buttonText,
        buttonPayload,
        timestamp
      ]
    );

    console.log('✅ Clique em botão salvo no banco');
  } catch (error: any) {
    console.error('❌ Erro ao salvar clique:', error);
  }
}
```

---

## 📊 Tipos de Botões do WhatsApp

### 1. Quick Reply Buttons
Botões de resposta rápida que aparecem abaixo da mensagem:

```json
{
  "type": "quick_reply",
  "text": "Sim, quero!",
  "payload": "accept_offer"
}
```

### 2. Call-to-Action Buttons
Botões com ações específicas:

```json
{
  "type": "url",
  "text": "Visitar site",
  "url": "https://exemplo.com"
}
```

```json
{
  "type": "phone_number",
  "text": "Ligar agora",
  "phone_number": "+5562999999999"
}
```

### 3. Reply Buttons
Botões em templates interativos:

```json
{
  "type": "button",
  "sub_type": "quick_reply",
  "index": "0",
  "reply": {
    "id": "button_1",
    "title": "Confirmar"
  }
}
```

---

## 📈 Análises Possíveis

Com os dados de cliques, você pode:

### 1. Taxa de Cliques (CTR)
```
CTR = (Cliques / Mensagens Entregues) * 100
```

### 2. Botão Mais Clicado
```sql
SELECT button_text, COUNT(*) as total_clicks
FROM button_clicks
WHERE campaign_id = 123
GROUP BY button_text
ORDER BY total_clicks DESC;
```

### 3. Horários com Mais Cliques
```sql
SELECT EXTRACT(HOUR FROM clicked_at) as hora, COUNT(*) as cliques
FROM button_clicks
WHERE campaign_id = 123
GROUP BY hora
ORDER BY hora;
```

### 4. Tempo Médio até o Clique
```sql
SELECT AVG(
  EXTRACT(EPOCH FROM (bc.clicked_at - m.sent_at)) / 60
) as minutos_medios
FROM button_clicks bc
JOIN messages m ON bc.message_id = m.id
WHERE bc.campaign_id = 123;
```

---

## 🎯 Casos de Uso

### 1. Campanhas de Vendas
- Botão "Comprar agora"
- Botão "Ver mais produtos"
- Botão "Falar com vendedor"

### 2. Suporte ao Cliente
- Botão "Problemas técnicos"
- Botão "Dúvidas comerciais"
- Botão "Falar com atendente"

### 3. Pesquisas de Satisfação
- Botão "Muito satisfeito"
- Botão "Satisfeito"
- Botão "Insatisfeito"

### 4. Confirmações
- Botão "Confirmar presença"
- Botão "Cancelar"
- Botão "Reagendar"

---

## ⚠️ Limitações

### 1. Botões URL
Cliques em botões de URL (que abrem links externos) **NÃO são rastreados** pelo WhatsApp API.

### 2. Botões de Telefone
Cliques em botões de "Ligar" também **NÃO são rastreados**.

### 3. Apenas Quick Reply
Apenas botões do tipo **Quick Reply** enviam webhooks de clique.

---

## 🔒 Privacidade

### Dados Armazenados:
- ✅ Telefone do usuário
- ✅ Nome do contato
- ✅ Texto do botão clicado
- ✅ Data e hora do clique

### Recomendações:
1. Informe os usuários sobre o rastreamento
2. Use dados apenas para análises internas
3. Não compartilhe dados de cliques publicamente
4. Respeite LGPD/GDPR

---

## 📊 Exemplo no Relatório

### Cenário: Campanha de Black Friday

**500 mensagens enviadas**  
**120 cliques registrados**  
**Taxa de cliques: 24%**

**Aba 7 - Cliques de Botões:**

| Quem Clicou | Telefone | Nome do Botão | Template | Mensagem Enviada Em | Clique (Data) | Clique (Hora) | Ação |
|-------------|----------|---------------|----------|---------------------|---------------|---------------|------|
| João Silva | +5562... | Ver ofertas | black_friday_2025 | 12/11/2025 09:00 | 12/11/2025 | 10:30 | view_offers |
| Maria Santos | +5562... | Comprar agora | black_friday_2025 | 12/11/2025 09:02 | 12/11/2025 | 10:32 | buy_now |
| Pedro Costa | +5562... | Ver ofertas | black_friday_2025 | 12/11/2025 09:05 | 12/11/2025 | 10:35 | view_offers |
| Ana Lima | +5562... | Falar com vendedor | black_friday_2025 | 12/11/2025 09:10 | 12/11/2025 | 10:40 | contact_sales |

**Insights:**
- 60% clicaram em "Ver ofertas"
- 25% clicaram em "Comprar agora"
- 15% clicaram em "Falar com vendedor"
- Maior volume de cliques entre 10h-12h

---

## ✅ Resumo

| Funcionalidade | Status |
|----------------|--------|
| Tabela no banco de dados | ✅ Criada |
| Aba no relatório Excel | ✅ Implementada |
| Webhook para capturar cliques | ⚠️ Precisa ser implementado |
| Análises e métricas | ✅ Possível com SQL |

---

## 🚀 Próximos Passos

Para começar a rastrear cliques:

1. ✅ Tabela criada (já feito)
2. ✅ Aba no relatório (já feito)
3. ⚠️ Implementar webhook handler (código de exemplo fornecido acima)
4. ⚠️ Testar com template que tenha botões
5. ✅ Gerar relatório e ver cliques na Aba 7

---

**📊 Aba 7 está pronta para uso! Basta implementar a captura via webhook!**

