# Integração — Gestão completa de contas WhatsApp (API Oficial)

Use este documento no **sistema de múltiplas contas (Facebook)** para criar e gerenciar contas WhatsApp no Nett Disparador **com o mesmo poder** das telas:

1. Card da conta (listagem / Configurações)
2. Formulário Nova Conta / Editar Conta
3. Configurações da Conta (abas Básico, Perfil, Segurança, Webhooks, Templates, Financeiro, Avançado)

Base URL: `https://api.sistemasnettsistemas.com.br`

---

## Autenticação

Mesma chave do tenant (`nsk_...`) criada em **Integração** no painel do disparador.

```
X-Api-Key: nsk_...
```

Ou:

```
Authorization: Bearer nsk_...
```

Opcional (recomendado se quiser contabilizar como um usuário específico):

```
X-Dispatcher-User-Id: 15
```

Sem `user_id`, a API usa o admin do tenant (comportamento padrão).

Todas as rotas abaixo estão em:

`/api/integration/v1/...`

---

## 1) Card / listagem (tela Configurações)

| Ação | Método | Endpoint |
|------|--------|----------|
| Listar contas | `GET` | `/whatsapp-accounts` |
| Contas ativas | `GET` | `/whatsapp-accounts/active` |
| Status / estatísticas | `GET` | `/whatsapp-accounts/status` |
| Atualizar Meta (qualidade, foto, etc.) | `GET` | `/whatsapp-accounts/{id}/details?light=1` |
| Testar conexão (sem salvar) | `POST` | `/whatsapp-accounts/test-connection` |
| Ativar / desativar | `PATCH` | `/whatsapp-accounts/{id}/toggle` |
| Ativar várias | `POST` | `/whatsapp-accounts/activate-multiple` |
| Desativar várias | `POST` | `/whatsapp-accounts/deactivate-multiple` |
| Ativar todas | `POST` | `/whatsapp-accounts/activate-all` |
| Desativar todas | `POST` | `/whatsapp-accounts/deactivate-all` |
| Excluir | `DELETE` | `/whatsapp-accounts/{id}` |
| Subir ordem | `POST` | `/whatsapp-accounts/{id}/move-up` |
| Descer ordem | `POST` | `/whatsapp-accounts/{id}/move-down` |
| Inscrever webhook nesta WABA | `POST` | `/whatsapp-accounts/{id}/subscribe-webhook` |
| Inscrever webhook em lote | `POST` | `/whatsapp-accounts/subscribe-webhooks-all` |
| Ver campos realmente assinados na Meta | `GET` | `/whatsapp-accounts/{id}/webhook-fields` |
| Setar todos os campos de novo + confirmar | `POST` | `/whatsapp-accounts/{id}/webhook-fields/resubscribe` |
| Status webhook (1 conta) | `GET` | `/webhook/status?account_id={id}&period=24h` |
| Status webhook (lote) | `GET` | `/webhook/status-batch?period=24h` |
| Remover proxy em massa | `POST` | `/whatsapp-accounts/remove-proxies` |

### Inscrever webhook em lote

`POST /api/integration/v1/whatsapp-accounts/subscribe-webhooks-all`

```json
{
  "mode": "waba",
  "account_ids": [8, 9, 25]
}
```

- `mode: "waba"` (padrão) — inscreve o App na WABA (`subscribed_apps`). **Não precisa de App Secret.**
- `mode: "fields"` — assina **todos** os campos de webhook do App. **Precisa de App ID + App Secret** em cada conta; as que não tiverem falham.
- Sem `account_ids`, aplica em todas as contas ativas do tenant.

---

### Testar conexão

`POST /api/integration/v1/whatsapp-accounts/test-connection`

```json
{
  "access_token": "EAA...",
  "phone_number_id": "772680659260321"
}
```

---

## 2) Criar / Editar (formulário)

| Ação | Método | Endpoint |
|------|--------|----------|
| Criar conta | `POST` | `/whatsapp-accounts` |
| Buscar conta | `GET` | `/whatsapp-accounts/{id}` |
| Atualizar conta | `PUT` | `/whatsapp-accounts/{id}` |
| Listar proxies ativos (dropdown) | `GET` | `/proxies/active` |
| Listar todos proxies | `GET` | `/proxies` |
| Criar proxy | `POST` | `/proxies` |
| Atualizar proxy | `PUT` | `/proxies/{id}` |
| Excluir proxy | `DELETE` | `/proxies/{id}` |
| Testar proxy | `POST` | `/proxies/{id}/test` |

### Criar conta (mesmo payload da tela)

`POST /api/integration/v1/whatsapp-accounts`

```json
{
  "name": "8141-2569 - OFICIAL",
  "phone_number": "556281742569",
  "access_token": "EAA...",
  "phone_number_id": "772680659260321",
  "business_account_id": "2163147244203490",
  "app_id": "4343644755904651",
  "app_secret": "xxxxxxxx",
  "subscribe_all_webhooks": true,
  "proxy_id": 4,
  "is_active": true
}
```

Campos obrigatórios: `name`, `phone_number`, `access_token`, `phone_number_id`, `business_account_id`, `app_id`, `app_secret`.  
Opcionais: `webhook_verify_token`, `proxy_id`, `is_active`, `webhook_fields` (lista).

`subscribe_all_webhooks` (padrão **true**): marca **todos** os campos de webhook.  
Se `false`, envie `webhook_fields: ["messages", "account_update", ...]`.

Ao criar/atualizar, o disparador:
1. Inscreve o App na WABA (`subscribed_apps`)
2. Tenta assinar os campos de webhook do App (`/{app-id}/subscriptions`)

Obs.: a Meta pode exigir que os toggles do App Dashboard sejam ligados **uma vez por App**; a inscrição da WABA por conta continua automática.

### Atualizar conta

`PUT /api/integration/v1/whatsapp-accounts/{id}`

Mesmo body do criar.

---

## 3) Configurações da Conta (todas as abas)

### Básico

| Ação | Método | Endpoint |
|------|--------|----------|
| Dados da conta | `GET` | `/whatsapp-accounts/{id}` |
| Atualizar dados | `PUT` | `/whatsapp-accounts/{id}` |
| Detalhes Meta | `GET` | `/whatsapp-accounts/{id}/details` |
| Nome do App Meta | `GET` | `/whatsapp-accounts/{id}/meta-app` |
| Alterar nome do App Meta | `POST` | `/whatsapp-accounts/{id}/meta-app` |

### Nome do aplicativo Meta (App Dashboard)

Não é o **nome de exibição** do WhatsApp. É o nome do App em **Meta for Developers → Configurações → Básico**. Precisa de **App ID + App Secret** na conta. Alterar vale para **todas** as contas/WABAs ligadas ao mesmo App ID. A Meta pode recusar se o App estiver Live ou o nome for inválido.

`GET /api/integration/v1/whatsapp-accounts/{id}/meta-app`

```json
{
  "success": true,
  "message": "App: NettSistemas",
  "data": {
    "id": "4343644755904651",
    "name": "NettSistemas",
    "app_name": "NettSistemas",
    "link": "https://www.facebook.com/games/?app_id=4343644755904651"
  }
}
```

`POST /api/integration/v1/whatsapp-accounts/{id}/meta-app`

```json
{
  "app_name": "NettSistemas Oficial"
}
```

Opcional no POST: `app_id`, `app_secret` (senão usa os gravados na conta). Nome: 2 a 32 caracteres.

---

### Perfil

| Ação | Método | Endpoint |
|------|--------|----------|
| Buscar perfil | `GET` | `/whatsapp-accounts/{id}/profile` |
| Atualizar perfil | `POST` | `/whatsapp-accounts/{id}/profile` |
| Upload foto de perfil | `POST` | `/whatsapp-accounts/{id}/profile-photo` (multipart `photo`) |
| Teste upload foto | `POST` | `/whatsapp-accounts/{id}/test-profile-photo-upload` (multipart `photo`) |
| Testar permissões | `GET` | `/whatsapp-accounts/{id}/test-permissions` |

### Segurança

| Ação | Método | Endpoint |
|------|--------|----------|
| Registrar / alterar PIN 2 etapas | `POST` | `/whatsapp-accounts/{id}/two-step-pin` |

```json
{
  "pin": "123456",
  "action": "set"
}
```

`action`:
- `set` — registrar PIN novo na Meta  
- `change` — alterar PIN existente  
- `register` — gravar PIN **e** registrar o número na Cloud API (`/{phone_number_id}/register`) — use quando o PIN “não pega”

Também aceita `"also_register": true` com `action: "set"` ou `"change"`.

O disparador grava o PIN e a data (`two_step_pin`, `two_step_pin_set_at`) na conta.

### Webhooks

| Ação | Método | Endpoint |
|------|--------|----------|
| Config (URL / token) | `GET` | `/webhook/config?account_id={id}` |
| Estatísticas | `GET` | `/webhook/stats?account_id={id}&period=24h` |
| Logs | `GET` | `/webhook/logs?account_id={id}&limit=10` |
| Status | `GET` | `/webhook/status?account_id={id}&period=24h` |
| Inscrever App na WABA | `POST` | `/whatsapp-accounts/{id}/subscribe-webhook` |

`period` aceito: `24h`, `7d`, `30d` (conforme a tela).

### Templates

| Ação | Método | Endpoint |
|------|--------|----------|
| Listar templates | `GET` | `/whatsapp-accounts/{id}/templates` |
| Upload mídia (template) | `POST` | `/whatsapp-accounts/{id}/upload-media` (multipart `media`) |

### Financeiro

| Ação | Método | Endpoint |
|------|--------|----------|
| Analytics / custos | `GET` | `/whatsapp-accounts/{id}/analytics` |
| Billing Facebook | `GET` | `/whatsapp-accounts/{id}/facebook-billing` |

Query de analytics: use os mesmos filtros de data da tela (`start`, `end` ou período rápido), se enviados.

### Avançado

| Ação | Método | Endpoint |
|------|--------|----------|
| Health da conta | `GET` | `/whatsapp-accounts/{id}/health` |
| QR Code | `GET` | `/whatsapp-accounts/{id}/qrcode` |
| Integração Facebook | `POST` | `/whatsapp-accounts/{id}/facebook-integration` |
| Proxy da conta (ler) | `GET` | `/whatsapp-accounts/{id}/proxy` |
| Proxy da conta (salvar) | `POST` | `/whatsapp-accounts/{id}/proxy` |
| Proxy da conta (testar) | `POST` | `/whatsapp-accounts/{id}/proxy/test` |
| Proxy da conta (remover) | `DELETE` | `/whatsapp-accounts/{id}/proxy` |
| Remover proxy em massa | `POST` | `/whatsapp-accounts/remove-proxies` |

`POST /api/integration/v1/whatsapp-accounts/remove-proxies`

```json
{
  "account_ids": [8, 9, 25]
}
```

Sem `account_ids`, remove o proxy de **todas** as contas do tenant que tiverem proxy.

---

## Exemplos rápidos

### Criar conta

```bash
curl -X POST "https://api.sistemasnettsistemas.com.br/api/integration/v1/whatsapp-accounts" \
  -H "X-Api-Key: nsk_..." \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"8141-2569 - OFICIAL\",
    \"phone_number\": \"556281742569\",
    \"access_token\": \"EAA...\",
    \"phone_number_id\": \"772680659260321\",
    \"business_account_id\": \"2163147244203490\",
    \"app_id\": \"4343644755904651\",
    \"is_active\": true
  }"
```

### Atualizar Meta agora

```bash
curl "https://api.sistemasnettsistemas.com.br/api/integration/v1/whatsapp-accounts/123/details?light=1" \
  -H "X-Api-Key: nsk_..."
```

### Inscrever webhook

```bash
curl -X POST "https://api.sistemasnettsistemas.com.br/api/integration/v1/whatsapp-accounts/123/subscribe-webhook" \
  -H "X-Api-Key: nsk_..."
```

---

## Respostas e erros

- `401` — chave ausente, inválida ou desativada  
- `403` — tenant inativo, limite de contas WhatsApp, usuário inválido  
- `404` — conta / proxy não encontrado neste tenant  
- `success: true/false` no JSON, no mesmo formato das telas internas  

Contas **banidas / flagged / restricted** seguem a mesma regra do disparador (ocultas / desativadas onde aplicável).

---

## Checklist para o sistema de múltiplas contas

- [ ] Guardar `X-Api-Key` do tenant no disparador  
- [ ] Tela espelhando **criar/editar** com os mesmos campos  
- [ ] Card com qualidade, status API, webhook, botões (atualizar, testar, ativar, editar, configurar, excluir)  
- [ ] Tela de configurar com as abas Básico / Perfil / Segurança / Webhooks / Templates / Financeiro / Avançado  
- [ ] Após criar, confirmar `webhook_subscribe.success` (ou chamar `subscribe-webhook`)  
- [ ] Usar `GET /proxies/active` no dropdown de proxy  
