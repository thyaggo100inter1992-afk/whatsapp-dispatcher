# Integração Disparador ↔ Sistema de Vendas

Documento para o desenvolvedor do **sistema de vendas**.
Leia até o final antes de alterar código. Tudo abaixo já está (ou será) no disparador. O trabalho de vocês é **guardar 1 token por cliente** e usar esse token em todas as chamadas.

---

## 1. O que mudou, em uma frase

Antes: o vendas autenticava nas APIs do disparador com **e-mail + senha** do usuário.
Agora: o vendas autentica com **1 token por cliente** (`nsk_...`).
Esse token identifica o **tenant** daquele cliente. Só aparecem conexões, listas, templates e consultas **dele**. Não usa login do super admin. Não mistura clientes.

E-mail e senha **ainda funcionam** nas APIs antigas. Não quebra o que já está no ar. A troca é gradual.

---

## 2. URL base

```
https://api.sistemasnettsistemas.com.br
```

Telas embed (iframe):

```
https://sistemasnettsistemas.com.br
```

Content-Type de todas as POSTs: `application/json`

---

## 3. Token (obrigatório entender isso)

### O que é
String que começa com `nsk_`. Exemplo:

```
nsk_a1b2c3d4e5f6...
```

### De onde vem
No **disparador**, o **admin da conta daquele cliente** (não o super admin do sistema) entra em:

**Integração → Gerar chave**

A chave aparece **uma vez**. Depois some. Guardem no cadastro do cliente no vendas.

### Onde guardar no vendas
Campo no cadastro do cliente, por exemplo:

```
clientes.token_disparador = "nsk_..."
```

1 cliente de vendas = 1 token = 1 tenant no disparador.

### Como enviar o token (qualquer uma das formas)

**Recomendado — header:**
```
X-Api-Key: nsk_...
```

**Alternativa — body:**
```json
{ "token": "nsk_..." }
```

**Alternativa — Authorization:**
```
Authorization: Bearer nsk_...
```

Se mandar token **e** e-mail/senha, o **token ganha**.

### O que NÃO fazer
- Não mandar usuário e senha do disparador no iframe.
- Não usar um token só para todos os clientes.
- Não criar usuário no disparador a cada venda.
- Não autenticar com o super admin.

---

## 4. O que vocês PRECISAM atualizar (APIs que já usam hoje)

Troquem e-mail/senha pelo token. URLs **não mudam**. Campos de negócio **não mudam**.

### 4.1 Consultar telefone na lista de restrição

`POST /api/public/restriction-list/consultar`

**Antes:**
```json
{
  "email": "usuario@empresa.com",
  "senha": "senha",
  "telefone": "5511999999999"
}
```

**Agora:**
```json
{
  "token": "nsk_...",
  "telefone": "5511999999999"
}
```

`telefone` pode ser string ou array:
```json
{
  "token": "nsk_...",
  "telefone": ["5511999999999", "5521888888888"]
}
```

Resposta continua igual (`sucesso`, `restrito`, `listas`, etc.).

---

### 4.2 Cadastrar telefone na restrição

`POST /api/public/restriction-list/add`

```json
{
  "token": "nsk_...",
  "telefone": "5511999999999",
  "lista": "nao_me_perturbe",
  "nome": "João Silva",
  "cpf": "123.456.789-00"
}
```

`lista` (obrigatório): `nao_me_perturbe` | `bloqueado` | `sem_interesse` | `sem_whatsapp`

`nome` e `cpf` são opcionais.

---

### 4.3 Remover telefone da restrição

`POST /api/public/restriction-list/remover`

```json
{
  "token": "nsk_...",
  "telefone": "5511999999999",
  "lista": "bloqueado"
}
```

Se omitir `lista`, remove de **todas** as listas daquele tenant.

---

### 4.4 Verificar se o número tem WhatsApp (consulta de telefone)

`POST /api/public/whatsapp/verificar`

```json
{
  "token": "nsk_...",
  "telefone": "5511999999999",
  "buscar_foto": true
}
```

`buscar_foto` opcional, padrão `true`.

Resposta:
```json
{
  "sucesso": true,
  "telefone": "5511999999999",
  "tem_whatsapp": true,
  "nome": "Nome no WhatsApp",
  "foto_perfil": "https://...",
  "instancia_usada": "CELULAR 01",
  "verificado_em": "2026-08-26T23:00:00.000Z"
}
```

Telefone sempre com DDI: `55` + DDD + número. Ex: `5511999999999`.

---

## 5. API NOVA — Consulta Nova Vida (CPF/CNPJ)

Vocês ainda **não tinham** isso por API pública. Agora têm.

`POST /api/public/novavida/consultar`

```json
{
  "token": "nsk_...",
  "documento": "00000000000",
  "verificarWhatsapp": true,
  "whatsappColumn": "all"
}
```

| Campo | Obrigatório | Padrão | O que é |
|---|---|---|---|
| `token` | sim (ou header) | — | Token do cliente |
| `documento` | sim | — | CPF ou CNPJ (só números). Também aceita `cpf` ou `cnpj` |
| `verificarWhatsapp` | não | `true` | Marca se os telefones têm WhatsApp |
| `whatsappColumn` | não | `first` | `first` \| `second` \| `third` \| `all` |

Consome o **limite mensal de consultas** daquele tenant no disparador. Se o limite acabar e não tiver consulta avulsa, retorna **403**.

Resposta = **o mesmo JSON da tela “Consultar Dados” do disparador**. Não resumimos. Usem `dados` inteiro.

Exemplo (CPF):
```json
{
  "success": true,
  "tipo": "CPF",
  "documento": "00000000000",
  "dados": {
    "CADASTRAIS": {
      "NOME": "...",
      "MAE": "...",
      "SEXO": "...",
      "NASC": "...",
      "IDADE": "...",
      "ESTADOCIVIL": "...",
      "RG": "...",
      "ORGAOEMISSOR": "...",
      "TITULO": "...",
      "RENDA": "...",
      "SCORE": "...",
      "SCORE_DIGITAL": "...",
      "FLAG_DE_OBITO": "...",
      "FLAG_FGTS": "..."
    },
    "TELEFONES": [
      {
        "DDD": "11",
        "TELEFONE": "999999999",
        "HAS_WHATSAPP": true,
        "WHATSAPP_VERIFIED": true
      }
    ],
    "EMAILS": [{ "EMAIL": "..." }],
    "ENDERECOS": [
      {
        "LOGRADOURO": "...",
        "NUMERO": "...",
        "COMPLEMENTO": "...",
        "BAIRRO": "...",
        "CIDADE": "...",
        "UF": "...",
        "CEP": "..."
      }
    ]
  }
}
```

CNPJ vem com `CADASTRAIS.RAZAO`, `NOME_FANTASIA`, `CNAE`, `SITUACAO`, `CAPITAL_SOCIAL`, `QSA`, etc.

Se `success` for `false`, olhem `erro`.
Se o CPF estiver na lista de restrição **de CPF** daquele tenant: **403** `{ "error": "CPF Lista de Restrição", "bloqueado": true }`.

---

## 6. API NOVA — Disparo WhatsApp (Oficial e QR)

Duas formas. Escolham **uma** (podem usar as duas).

### Forma A — Iframe (mais simples, mesma tela do disparador)

Cole no vendas, um iframe por tipo, **com o token daquele cliente na URL**:

**API Oficial (Envio Rápido — template Meta):**
```html
<iframe
  src="https://sistemasnettsistemas.com.br/embed/oficial?key=nsk_TOKEN_DO_CLIENTE"
  style="width:100%;height:900px;border:0;"
  allow="clipboard-write"
></iframe>
```

**QR Connect (Envio Único com template):**
```html
<iframe
  src="https://sistemasnettsistemas.com.br/embed/qr?key=nsk_TOKEN_DO_CLIENTE"
  style="width:100%;height:900px;border:0;"
  allow="clipboard-write"
></iframe>
```

O iframe já:
- autentica com o token
- lista só as conexões daquele cliente
- lista só os templates daquele cliente
- dispara o envio único

Vocês **não** montam o formulário. Só embutem a tela.

Substituam `nsk_TOKEN_DO_CLIENTE` pelo token salvo naquele cliente. Sem token na URL o iframe não abre.

---

### Forma B — REST (se quiserem disparar no backend, sem iframe)

Todas abaixo exigem `X-Api-Key: nsk_...` (ou `token` no body).

#### 6.1 Listar conexões
`GET /api/integration/v1/connections?channel=oficial`  
`GET /api/integration/v1/connections?channel=qr`  
`GET /api/integration/v1/connections` (os dois)

Resposta:
```json
{
  "success": true,
  "data": {
    "oficial": [
      { "id": 1, "channel": "oficial", "name": "Conta Meta", "phone_number": "5511...", "is_active": true }
    ],
    "qr": [
      { "id": 10, "channel": "qr", "name": "CELULAR 01", "phone_number": "5511...", "connected": true }
    ]
  }
}
```

Usem `id` como `connection_id` no envio.

#### 6.2 Templates da API Oficial
`GET /api/integration/v1/oficial/{connection_id}/templates`

Só templates **APPROVED**.

#### 6.3 Enviar API Oficial
`POST /api/integration/v1/oficial/send`

```json
{
  "connection_id": 1,
  "number": "5511999999999",
  "template_name": "nome_do_template",
  "variables": { "1": "João", "2": "Pedido 123" },
  "media_url": "https://...",
  "media_type": "image"
}
```

`media_url` / `media_type` só se o template tiver header de mídia.  
Aliases aceitos: `whatsapp_account_id` = `connection_id`, `phone_number` = `number`.

#### 6.4 Templates QR
`GET /api/integration/v1/qr/templates`  
`GET /api/integration/v1/qr/templates/{id}`

#### 6.5 Enviar QR (template único)
`POST /api/integration/v1/qr/send`

```json
{
  "connection_id": 10,
  "template_id": 33,
  "number": "5511999999999",
  "variables": { "nome": "João", "pedido": "123" }
}
```

Variáveis no texto do template usam `{{nome}}`. O disparador substitui.  
Se o número estiver na lista de restrição: **403** `{ "restricted": true }`.  
Se o WhatsApp de origem estiver bloqueado (código 463): **422**.

#### 6.6 (Opcional) Trocar token por JWT de 12h
`POST /api/integration/v1/auth` com `X-Api-Key`.
Devolve JWT. Só precisa se forem chamar as rotas internas do painel. **Para as rotas desta documentação, o `nsk_` basta.** Não usem esse JWT no lugar do token do cliente no banco de vocês.

---

## 7. Regras que evitam bug

1. **Sempre** o token **daquele** cliente. Nunca o do vizinho.
2. Telefone: só dígitos, com DDI `55`.
3. CPF/CNPJ: só dígitos.
4. CORS já está liberado nessas rotas. Chamem direto do backend do vendas (preferível) ou do front.
5. 401 = token errado, desativado ou ausente. 403 = tenant inativo, limite de consulta, ou número/CPF restrito.
6. Iframe e REST usam o **mesmo** token.
7. Não loguem o token em texto puro em produção.

---

## 8. Checklist do que criar/alterar no vendas

**Cadastro do cliente**
- [ ] Campo `token_disparador` (string, secreto).
- [ ] Tela/admin para colar o token gerado no disparador (Integração → Gerar chave).

**APIs que vocês já chamam**
- [ ] Restrição consultar / add / remover → parar de mandar `email` e `senha`; mandar `token`.
- [ ] WhatsApp verificar → idem.

**Novo**
- [ ] Tela ou backend de consulta Nova Vida → `POST /api/public/novavida/consultar`.
- [ ] Disparo WhatsApp: iframe Oficial + iframe QR **ou** REST da seção 6.

**Não precisa**
- [ ] Não criar login no disparador.
- [ ] Não mandar senha do cliente do disparador.
- [ ] Não alterar URLs das APIs antigas (só o campo de autenticação).

---

## 9. Mapa rápido

| O que o vendas precisa | Endpoint | Auth |
|---|---|---|
| Consultar restrição | `POST /api/public/restriction-list/consultar` | token (atualizar) |
| Cadastrar restrição | `POST /api/public/restriction-list/add` | token (atualizar) |
| Remover restrição | `POST /api/public/restriction-list/remover` | token (atualizar) |
| Número tem WhatsApp? | `POST /api/public/whatsapp/verificar` | token (atualizar) |
| Consulta CPF/CNPJ completa | `POST /api/public/novavida/consultar` | token (**novo**) |
| Tela envio Oficial | `/embed/oficial?key=nsk_...` | token na URL (**novo**) |
| Tela envio QR | `/embed/qr?key=nsk_...` | token na URL (**novo**) |
| Envio Oficial via API | `POST /api/integration/v1/oficial/send` | token (**novo**) |
| Envio QR via API | `POST /api/integration/v1/qr/send` | token (**novo**) |

Dúvida de payload: copiem os JSON desta página. Não inventem campos. Se algo falhar, mandem status HTTP + body da resposta.
