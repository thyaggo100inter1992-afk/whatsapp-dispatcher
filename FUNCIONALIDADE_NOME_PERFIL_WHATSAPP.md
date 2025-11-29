# 👤 Funcionalidade: Nome do Perfil do WhatsApp

## 📋 Resumo

Sistema completo para gerenciar o **Nome do Perfil do WhatsApp** - o nome que seus contatos veem quando você envia mensagens. Agora você tem controle total sobre dois nomes distintos:

1. **Nome da Instância** - Nome interno do sistema (para sua organização)
2. **Nome do Perfil WhatsApp** - Nome público que aparece para seus contatos

---

## 🎯 O Que Foi Implementado

### 1️⃣ **Campo no Banco de Dados** ✅
- Coluna `profile_name` na tabela `uaz_instances`
- Armazena o nome do perfil do WhatsApp

### 2️⃣ **API Backend** ✅
- Função `updateProfileName()` no `uazService.js`
- Endpoint: `POST /profile/name` na API UAZ
- Atualização automática ao editar

### 3️⃣ **Interface Frontend** ✅
- Campo "Nome do Perfil do WhatsApp" no formulário de edição
- Aparece apenas ao editar (não na criação)
- Atualização automática ao salvar

---

## 📊 Diferença Entre os Dois Nomes

| Campo | Onde Aparece | Quem Vê | Pode Editar |
|-------|--------------|---------|-------------|
| **Nome da Instância** | Sistema interno | Só você | ✅ Sempre |
| **Nome do Perfil WhatsApp** | WhatsApp | Seus contatos | ✅ Se conectado |

---

## 🎨 Interface

### Ao Criar Nova Conexão:
```
┌────────────────────────────────────────┐
│  Nova Instância                        │
├────────────────────────────────────────┤
│                                        │
│  Nome da Conexão *                     │
│  [Marketing Principal________]        │
│                                        │
│  Nome da Sessão (único) *              │
│  [marketing01____________]            │
│                                        │
│  (Nome do Perfil NÃO aparece aqui)    │
└────────────────────────────────────────┘
```

### Ao Editar Conexão:
```
┌────────────────────────────────────────┐
│  ✏️ Editar Instância                   │
├────────────────────────────────────────┤
│                                        │
│  ✏️ Nome da Conexão *                  │
│  [Marketing Principal________]        │
│  ✅ Atualiza automaticamente           │
│                                        │
│  👤 Nome do Perfil do WhatsApp         │
│  [Minha Empresa - Atendimento____]    │
│  💬 Nome visível para seus contatos    │
│                                        │
│  (Outros campos...)                    │
└────────────────────────────────────────┘
```

---

## 🔄 Como Funciona

### Cenário 1: Editar Nome da Instância

```
1. Usuário edita "Nome da Conexão"
   └─ Muda de "122522" para "Marketing Principal"

2. Clica em "Atualizar Instância"

3. Backend:
   ├─ POST /instance/updateInstanceName
   └─ Atualiza na API UAZ

4. Resultado:
   ├─ Sistema: "Marketing Principal"
   └─ API UAZ: "Marketing Principal"
```

### Cenário 2: Editar Nome do Perfil

```
1. Usuário preenche "Nome do Perfil do WhatsApp"
   └─ Digite: "Minha Empresa - Atendimento"

2. Clica em "Atualizar Instância"

3. Backend:
   ├─ POST /profile/name
   └─ Atualiza nome do perfil no WhatsApp

4. Resultado:
   ├─ WhatsApp: Nome do perfil atualizado
   └─ Contatos veem: "Minha Empresa - Atendimento"
```

### Cenário 3: Editar Ambos

```
1. Usuário altera AMBOS os nomes:
   ├─ Nome da Conexão: "Vendas Team"
   └─ Nome do Perfil: "Vendas - Loja ABC"

2. Clica em "Atualizar Instância"

3. Backend atualiza OS DOIS:
   ├─ POST /instance/updateInstanceName
   └─ POST /profile/name

4. Mensagem de sucesso:
   "Nome da instância atualizado e Nome do perfil do WhatsApp atualizado"
```

---

## ⚠️ Requisitos Importantes

### Para Atualizar Nome do Perfil:

1. ✅ **Instância deve estar CONECTADA**
   - Status: `connected`
   - Se desconectada, aparece aviso

2. ✅ **Deve ter token da instância**
   - `instance_token` não pode ser nulo

3. ✅ **Sessão ativa no WhatsApp**
   - Se aparecer erro "No session", reconecte

---

## 📂 Arquivos Criados/Modificados

### Criados:
1. ✅ `ADICIONAR-PROFILE-NAME.sql` - SQL para adicionar coluna
2. ✅ `APLICAR-PROFILE-NAME.bat` - Script automático
3. ✅ `FUNCIONALIDADE_NOME_PERFIL_WHATSAPP.md` - Este documento

### Modificados:
1. ✅ `backend/src/services/uazService.js`
   - Adicionado `updateProfileName()` (linha ~327)

2. ✅ `backend/src/routes/uaz.js`
   - Rota PUT atualizada (linha ~343) - Atualiza nome da instância E nome do perfil
   - Rota GET /status atualizada (linha ~753) - Salva profileName ao verificar status

3. ✅ `frontend/src/pages/configuracoes-uaz.tsx`
   - Campo `profile_name` adicionado ao formData
   - Campo visível apenas ao editar
   - **Busca automática** do nome atual ao abrir para editar
   - Sincronização automática com WhatsApp

---

## 🚀 Como Instalar

### Passo 1: Executar SQL
```batch
APLICAR-PROFILE-NAME.bat
```

Ou manualmente:
```bash
psql -U postgres -d disparador_massa -f ADICIONAR-PROFILE-NAME.sql
```

### Passo 2: Reiniciar Backend
Após adicionar a coluna, reinicie o backend

### Passo 3: Buscar Nome Atual
1. Vá em "Gerenciar Conexões"
2. Clique "Editar" em uma conexão CONECTADA
3. ✅ O campo já virá preenchido com o nome atual do WhatsApp!

### Passo 4: Alterar Nome (se quiser)
1. Mude o texto no campo "Nome do Perfil do WhatsApp"
2. Clique "Atualizar Instância"
3. ✅ Nome será atualizado no WhatsApp e no banco!

### 🔄 Sincronização Automática

**Nome do perfil é atualizado automaticamente em 3 situações:**

1. ✅ **Ao abrir para editar** - Busca o nome atual do WhatsApp
2. ✅ **Ao verificar status** - Salva o nome no banco
3. ✅ **Ao alterar manualmente** - Atualiza no WhatsApp via API

---

## 📝 Exemplos de Uso

### Exemplo 1: Empresa com Múltiplos Setores

```
Instância 1:
├─ Nome da Instância: "Vendas 01"
└─ Nome do Perfil: "Loja ABC - Vendas"

Instância 2:
├─ Nome da Instância: "Suporte 01"
└─ Nome do Perfil: "Loja ABC - Suporte"
```

### Exemplo 2: Diferentes Marcas

```
Instância 1:
├─ Nome da Instância: "Marca A"
└─ Nome do Perfil: "Marca A - Atendimento"

Instância 2:
├─ Nome da Instância: "Marca B"
└─ Nome do Perfil: "Marca B - SAC"
```

---

## 🔍 Logs do Console

### Ao Atualizar Nome do Perfil:

```bash
👤 Atualizando nome do perfil do WhatsApp: Minha Empresa (ID: 5)
   └─ Token: db11cc3f-cfff...
   └─ Novo nome do perfil: Minha Empresa - Atendimento
   └─ Endpoint: POST /profile/name

✅ Nome do perfil atualizado com sucesso no WhatsApp
   └─ Nome do perfil: Minha Empresa - Atendimento
   └─ Response: {
        "success": true,
        "message": "Nome do perfil alterado com sucesso",
        "profile": {
          "name": "Minha Empresa - Atendimento",
          "updated_at": 1704067200
        }
      }

✅ Instância Marketing Principal (ID: 5) atualizada no banco de dados local
```

---

## ❌ Tratamento de Erros

### Erro 1: Instância Desconectada
```
⚠️ Aviso ao atualizar nome do perfil: No session
⚠️ Conexão deve estar ativa para atualizar nome do perfil
```
**Solução:** Conecte a instância escaneando o QR code

### Erro 2: Token Inválido
```
❌ Erro ao atualizar nome do perfil: Unauthorized
```
**Solução:** Recrie a instância com token válido

### Erro 3: Limite de Alterações
```
❌ Erro ao atualizar nome do perfil: Too many requests
```
**Solução:** WhatsApp limita alterações. Aguarde algumas horas

---

## 🎯 Benefícios

1. ✅ **Organização** - Nome interno diferente do público
2. ✅ **Profissionalismo** - Nome adequado para clientes
3. ✅ **Flexibilidade** - Muda quando quiser
4. ✅ **Controle Total** - Gerencia via interface
5. ✅ **Sincronização** - Atualiza automaticamente no WhatsApp

---

## 📊 Estrutura no Banco de Dados

```sql
ALTER TABLE uaz_instances 
ADD COLUMN profile_name VARCHAR(255);

-- Exemplo de dados:
id | name            | session_name | profile_name
---+-----------------+--------------+-------------------------
1  | Marketing 01    | marketing01  | Loja ABC - Marketing
2  | Vendas 01       | vendas01     | Loja ABC - Vendas
3  | Suporte 01      | suporte01    | Loja ABC - Suporte
```

---

## ✅ Checklist de Implementação

- ✅ Coluna `profile_name` adicionada
- ✅ Função `updateProfileName()` criada
- ✅ Endpoint POST /profile/name integrado
- ✅ Campo no formulário de edição
- ✅ Rota PUT atualizada
- ✅ Tratamento de erros implementado
- ✅ Logs detalhados
- ✅ Documentação completa

---

## 🎉 Conclusão

Sistema completo de gerenciamento do **Nome do Perfil do WhatsApp** implementado! Agora você pode:

- ✅ Ter nome interno diferente do público
- ✅ Atualizar nome do perfil via interface
- ✅ Sincronizar automaticamente com WhatsApp
- ✅ Gerenciar múltiplas instâncias com nomes diferentes

**Execute o `APLICAR-PROFILE-NAME.bat` e comece a usar!** 🚀

