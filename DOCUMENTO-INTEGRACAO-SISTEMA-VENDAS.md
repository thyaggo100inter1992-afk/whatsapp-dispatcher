# Integração Disparador ↔ Sistema de Vendas

Documento para o desenvolvedor do **sistema de vendas**.
Leia até o final antes de alterar código. Tudo abaixo já está (ou será) no disparador. O trabalho de vocês é **guardar 1 token por cliente** e usar esse token em todas as chamadas.

---

## 1. O que mudou, em uma frase

Antes: o vendas autenticava nas APIs do disparador com **e-mail + senha** do usuário.
Agora: o vendas autentica com **1 token por cliente** (`nsk_...`).
Esse token identifica o **tenant** daquele cliente.

O token **não** escolhe o operador. Para isso o vendas lista os usuários do tenant, vincula na mão (Maria do vendas → Maria do disparador) e manda o `user_id` em toda chamada. Envios, restrição e conexões valem como aquele usuário. Relatório no disparador soma o que ela fez no login e o que o vendas fez no nome dela.

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

## 3.1 Vincular usuário do vendas ao usuário do disparador (obrigatório)

A chave `nsk_...` identifica o **cliente/tenant**. Ela **não** identifica a Maria, o João, etc.

Os dois sistemas têm usuários com o mesmo nome, mas **não adivinham** que são a mesma pessoa. O vendas faz o vínculo **na mão**.

### Fluxo

1. O vendas cola a chave do cliente.
2. O vendas chama `GET /api/integration/v1/users` com essa chave.
3. O disparador devolve os usuários **ativos daquele tenant** (`id`, `nome`, `email`, `role`).
4. No cadastro do operador do vendas, o admin escolhe: “este usuário do vendas = este `id` do disparador”.
5. Em **toda** chamada seguinte (restrição, WhatsApp, envio, iframe), o vendas manda a chave **e** o `user_id` do disparador vinculado àquele operador.

### Como mandar o usuário (qualquer uma)

**Recomendado — header:**
```
X-Dispatcher-User-Id: 15
```

**Alternativa — body ou query:**
```json
{ "token": "nsk_...", "user_id": 15 }
```

O `15` é o `id` que veio em `GET /users`. **Não** é o id do usuário do vendas.

### O que isso muda

- Envio, consulta de restrição e verificação de WhatsApp passam a valer **como aquele usuário logado no disparador**.
- Conexões: se a Maria no disparador **não** tem a API `2569`, o vendas **também não** vê e **não consegue** enviar por ela.
- Relatório no disparador: “quantos envios a Maria fez?” = o que ela fez com login **e** o que o vendas fez no nome dela. Uma conta só.

### Listar usuários

`GET /api/integration/v1/users`

Header: `X-Api-Key: nsk_...`

Resposta:
```json
{
  "success": true,
  "data": [
    { "id": 15, "nome": "Maria", "email": "maria@empresa.com", "role": "user" },
    { "id": 8, "nome": "João Admin", "email": "admin@empresa.com", "role": "admin" }
  ]
}
```

Guardem `id` no mapeamento. `role` `admin` ou `super_admin` vê todas as conexões do tenant. `user` vê só as que o admin do disparador liberou para ele em Gestão.

Se o `user_id` não existir naquele tenant ou estiver inativo: **403**.

Sem `user_id` as APIs ainda funcionam (comportamento antigo, como o admin do tenant). **Não usem isso em produção.** Sempre mandem o usuário vinculado.

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
  "user_id": 15,
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
  "user_id": 15,
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
  "user_id": 15,
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
  "user_id": 15,
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
  "user_id": 15,
  "documento": "00000000000",
  "verificarWhatsapp": true,
  "whatsappColumn": "all"
}
```

| Campo | Obrigatório | Padrão | O que é |
|---|---|---|---|
| `token` | sim (ou header) | — | Token do cliente |
| `user_id` | sim | — | `id` do usuário do disparador vinculado no vendas |
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
  src="https://sistemasnettsistemas.com.br/embed/oficial?key=nsk_TOKEN_DO_CLIENTE&user_id=15"
  style="width:100%;height:900px;border:0;"
  allow="clipboard-write"
></iframe>
```

**QR Connect (Envio Único com template):**
```html
<iframe
  src="https://sistemasnettsistemas.com.br/embed/qr?key=nsk_TOKEN_DO_CLIENTE&user_id=15"
  style="width:100%;height:900px;border:0;"
  allow="clipboard-write"
></iframe>
```

O iframe já:
- autentica com o token **e** o `user_id` daquele operador
- lista só as conexões que aquele usuário pode usar no disparador
- lista só os templates daquele cliente
- dispara o envio único **contado para aquele usuário**

Vocês **não** montam o formulário. Só embutem a tela.

Substituam `nsk_TOKEN_DO_CLIENTE` pelo token salvo naquele cliente e `15` pelo `id` do usuário do disparador vinculado ao operador logado no vendas. Sem token na URL o iframe não abre. Sem `user_id` o envio não entra na conta da Maria/João.

---

### Forma B — REST (se quiserem disparar no backend, sem iframe)

Todas abaixo exigem `X-Api-Key: nsk_...` **e** `X-Dispatcher-User-Id: 15` (ou `user_id` no body/query).

#### 6.0 Listar usuários do disparador (para o mapeamento)
`GET /api/integration/v1/users`

Header: `X-Api-Key: nsk_...`

Devolve `id`, `nome`, `email`, `role`. Usem `id` no vínculo com o usuário do vendas. Chamem **uma vez** quando colarem a chave (e de novo se o admin incluir usuário novo no disparador).

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
2. **Sempre** o `user_id` do disparador vinculado ao operador do vendas.
3. Telefone: só dígitos, com DDI `55`.
4. CPF/CNPJ: só dígitos.
5. CORS já está liberado nessas rotas. Chamem direto do backend do vendas (preferível) ou do front.
6. 401 = token errado, desativado ou ausente. 403 = tenant inativo, limite de consulta, número/CPF restrito, **usuário inválido** ou **sem permissão naquela conexão**.
7. Iframe e REST usam o **mesmo** token e o **mesmo** `user_id`.
8. Não loguem o token em texto puro em produção.

---

## 8. Checklist do que criar/alterar no vendas

**Cadastro do cliente**
- [ ] Campo `token_disparador` (string, secreto).
- [ ] Tela/admin para colar o token gerado no disparador (Integração → Gerar chave).
- [ ] Ao salvar a chave, chamar `GET /api/integration/v1/users` e guardar a lista.
- [ ] Em cada usuário/operador do vendas, campo para escolher o `user_id` do disparador (mapeamento manual).

**APIs que vocês já chamam**
- [ ] Restrição consultar / add / remover → parar de mandar `email` e `senha`; mandar `token` + `user_id`.
- [ ] WhatsApp verificar → idem (`token` + `user_id`).

**Novo**
- [ ] Tela ou backend de consulta Nova Vida → `POST /api/public/novavida/consultar` com `user_id`.
- [ ] Disparo WhatsApp: iframe Oficial + iframe QR **com** `user_id` **ou** REST da seção 6 com `X-Dispatcher-User-Id`.

**Não precisa**
- [ ] Não criar login no disparador.
- [ ] Não mandar senha do cliente do disparador.
- [ ] Não alterar URLs das APIs antigas (só o campo de autenticação).

---

## 9. Mapa rápido

| O que o vendas precisa | Endpoint | Auth |
|---|---|---|
| Listar usuários do tenant | `GET /api/integration/v1/users` | token |
| Consultar restrição | `POST /api/public/restriction-list/consultar` | token + user_id |
| Cadastrar restrição | `POST /api/public/restriction-list/add` | token + user_id |
| Remover restrição | `POST /api/public/restriction-list/remover` | token + user_id |
| Número tem WhatsApp? | `POST /api/public/whatsapp/verificar` | token + user_id |
| Consulta CPF/CNPJ completa | `POST /api/public/novavida/consultar` | token + user_id |
| Tela envio Oficial | `/embed/oficial?key=nsk_...&user_id=15` | token + user_id na URL |
| Tela envio QR | `/embed/qr?key=nsk_...&user_id=15` | token + user_id na URL |
| Envio Oficial via API | `POST /api/integration/v1/oficial/send` | token + user_id |
| Envio QR via API | `POST /api/integration/v1/qr/send` | token + user_id |

Dúvida de payload: copiem os JSON desta página. Não inventem campos. Se algo falhar, mandem status HTTP + body da resposta.
