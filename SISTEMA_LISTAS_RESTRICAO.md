# 📋 Sistema de Listas de Restrição

## 📌 Visão Geral

Sistema completo para gerenciar contatos que não devem receber mensagens via WhatsApp. Implementa 3 tipos de listas com diferentes prazos de restrição e métodos de adição automática ou manual.

---

## 🎯 Funcionalidades Principais

### ✅ **Implementado com Sucesso**

#### 1️⃣ **3 Tipos de Listas**
- **Não Me Perturbe** 🔕
  - Tempo: **Indeterminado** (permanente)
  - Adição: Manual apenas
  - Exclusão: Manual apenas

- **Bloqueado** 🚫
  - Tempo: **365 dias** (exclusão automática)
  - Adição: Manual OU Automática (webhook)
  - Exclusão: Automática após 365 dias OU manual

- **Não Tenho Interesse** 👎
  - Tempo: **7 dias** (exclusão automática)
  - Adição: Manual OU Automática (webhook)
  - Exclusão: Automática após 7 dias OU manual

#### 2️⃣ **Cadastro Duplo de Números (REGRA OBRIGATÓRIA)**
✅ Sempre cadastra 2 versões do número:
- Com nono dígito: `5511987654321`
- Sem nono dígito: `5511987654321` → `5511987654321`

Isso acontece **AUTOMATICAMENTE** em:
- Cadastro manual
- Upload de arquivo
- Adição via webhook

#### 3️⃣ **Adição Automática via Webhook**
✅ Detecta e adiciona contatos automaticamente quando:
- Cliente **clica em botão** configurado
- Cliente **digita palavra-chave** configurada

Configurável por:
- **Tipo**: Texto digitado, Texto do botão, Payload do botão
- **Correspondência**: Exato, Contém, Começa com, Termina com
- **Case sensitive**: Sim/Não

#### 4️⃣ **Gerenciamento Completo**
- ✅ Listagem com filtros (lista, conta, método, busca)
- ✅ Adicionar contato manual
- ✅ Remover contato individual
- ✅ Remover múltiplos contatos (seleção em massa)
- ✅ Importar base de contatos (CSV)
- ✅ Exportar relatório (Excel)
- ✅ Verificação de duplicados (não cadastra se já existe)

#### 5️⃣ **Dashboard com Estatísticas**
- ✅ Totais globais de cada lista
- ✅ Detalhes por conta WhatsApp
- ✅ Análise por método de adição (Manual, Botão, Palavra-chave, Importação)
- ✅ Timeline de evolução (últimos 30 dias)
- ✅ Alertas de contatos expirando

#### 6️⃣ **Configuração de Palavras-Chave**
- ✅ Interface para gerenciar palavras-chave
- ✅ Ativar/desativar palavras-chave
- ✅ Suporte para múltiplas contas WhatsApp
- ✅ Exemplos práticos de uso

#### 7️⃣ **Limpeza Automática**
- ✅ Worker executa **a cada hora**
- ✅ Remove automaticamente:
  - Contatos bloqueados há mais de 365 dias
  - Contatos sem interesse há mais de 7 dias
- ✅ Registra logs de todas as ações
- ✅ Atualiza estatísticas automaticamente

#### 8️⃣ **Validação de Números**
- ✅ Valida formato brasileiro (DDI 55)
- ✅ Valida DDDs válidos
- ✅ Adiciona DDD padrão (11) se não fornecido
- ✅ Formata números para exibição

---

## 🗂️ Estrutura do Banco de Dados

### Tabelas Criadas

1. **`restriction_list_types`** - Tipos de listas (3 pré-configurados)
2. **`restriction_list_entries`** - Entradas/contatos nas listas
3. **`restriction_list_keywords`** - Palavras-chave configuradas
4. **`restriction_list_logs`** - Log de todas as ações
5. **`restriction_list_stats`** - Estatísticas diárias

### Views

1. **`active_restriction_entries`** - Entradas ativas (não expiradas)
2. **`restriction_list_overview`** - Visão geral de todas as listas

### Triggers e Functions

1. **`calculate_restriction_expiry()`** - Calcula data de expiração automaticamente
2. **`update_restriction_timestamp()`** - Atualiza timestamp de updated_at
3. **`log_restriction_action()`** - Registra ações automaticamente

---

## 🔧 Arquivos Criados

### Backend

#### Migrations
- `backend/src/database/migrations/009_create_restriction_lists.sql` - Schema completo

#### Services
- `backend/src/services/phone-validation.service.ts` - Validação de números

#### Models
- `backend/src/models/RestrictionList.ts` - Interfaces e DTOs

#### Controllers
- `backend/src/controllers/restriction-list.controller.ts` - Todas as operações CRUD

#### Workers
- `backend/src/workers/restriction-cleanup.worker.ts` - Limpeza automática

#### Rotas
- `backend/src/routes/index.ts` - Rotas API (atualizado)

#### Webhook
- `backend/src/controllers/webhook.controller.ts` - Integração com webhook (atualizado)

#### Server
- `backend/src/server.ts` - Inicialização do worker (atualizado)

#### Scripts
- `backend/run-migration-009.js` - Script para executar migration

### Frontend

#### Páginas
- `frontend/src/pages/listas-restricao.tsx` - Gerenciamento de listas
- `frontend/src/pages/listas-restricao/dashboard.tsx` - Dashboard com estatísticas
- `frontend/src/pages/listas-restricao/configuracoes.tsx` - Configuração de palavras-chave

---

## 📡 Endpoints da API

### Entradas das Listas

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/restriction-lists` | Listar entradas (com filtros) |
| `POST` | `/api/restriction-lists` | Adicionar contato |
| `DELETE` | `/api/restriction-lists/:id` | Remover contato |
| `DELETE` | `/api/restriction-lists/bulk` | Remover múltiplos |

### Importação e Exportação

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/restriction-lists/import` | Importar CSV |
| `GET` | `/api/restriction-lists/export` | Exportar Excel |

### Palavras-Chave

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/restriction-lists/keywords` | Listar palavras-chave |
| `POST` | `/api/restriction-lists/keywords` | Adicionar palavra-chave |
| `DELETE` | `/api/restriction-lists/keywords/:id` | Remover palavra-chave |
| `PATCH` | `/api/restriction-lists/keywords/:id/toggle` | Ativar/desativar |

### Verificação

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/restriction-lists/check` | Verificar se contato está em lista |

### Estatísticas

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/restriction-lists/stats/dashboard` | Estatísticas detalhadas |
| `GET` | `/api/restriction-lists/stats/overview` | Visão geral de todas as listas |

---

## 🚀 Como Usar

### 1. Acesso às Páginas

#### Gerenciamento de Listas
```
http://localhost:3000/listas-restricao
```
- Visualizar todos os contatos nas listas
- Adicionar contatos manualmente
- Remover contatos (individual ou em massa)
- Importar/Exportar contatos
- Buscar e filtrar

#### Dashboard
```
http://localhost:3000/listas-restricao/dashboard
```
- Ver totais globais
- Análise por conta
- Estatísticas de adição
- Timeline de evolução

#### Configurações
```
http://localhost:3000/listas-restricao/configuracoes
```
- Configurar palavras-chave
- Configurar botões para detecção automática
- Ativar/desativar regras

### 2. Adicionar Contato Manual

1. Acesse `/listas-restricao`
2. Clique em **"➕ Adicionar Contato"**
3. Preencha:
   - Lista (Não Me Perturbe, Bloqueado ou Sem Interesse)
   - Conta WhatsApp
   - Telefone (com DDI, ex: `5511987654321`)
   - Nome (opcional)
   - Observações (opcional)
4. Clique em **"Adicionar"**

✅ O sistema criará automaticamente as 2 versões do número!

### 3. Importar Base de Contatos

1. Acesse `/listas-restricao`
2. Clique em **"📤 Importar CSV"**
3. Selecione:
   - Lista de destino
   - Conta WhatsApp
4. Faça upload do arquivo CSV:

**Formato do CSV:**
```csv
telefone,nome,observacoes
5511987654321,João Silva,Cliente VIP
5521987654321,Maria Santos,Solicitou bloqueio
```

5. Clique em **"Importar"**

### 4. Exportar Relatório

1. Acesse `/listas-restricao`
2. Aplique filtros (opcional):
   - Lista específica
   - Conta WhatsApp
3. Clique em **"📥 Exportar Excel"**

O arquivo será baixado com todas as informações!

### 5. Configurar Adição Automática

#### Exemplo 1: Cliente digita "PARAR"

1. Acesse `/listas-restricao/configuracoes`
2. Clique em **"➕ Adicionar Palavra-Chave"**
3. Configure:
   - **Lista de Destino:** Não Me Perturbe
   - **Conta WhatsApp:** Selecione a conta
   - **Tipo:** 💬 Texto Digitado pelo Cliente
   - **Palavra-Chave:** `PARAR`
   - **Correspondência:** Contém
   - **Case sensitive:** Não
4. Clique em **"Adicionar"**

✅ Agora, quando o cliente digitar qualquer mensagem contendo "PARAR", será automaticamente adicionado à lista!

#### Exemplo 2: Cliente clica em botão "Não tenho interesse"

1. Acesse `/listas-restricao/configuracoes`
2. Clique em **"➕ Adicionar Palavra-Chave"**
3. Configure:
   - **Lista de Destino:** Sem Interesse (7 dias)
   - **Conta WhatsApp:** Selecione a conta
   - **Tipo:** 🔘 Texto do Botão Clicado
   - **Palavra-Chave:** `Não tenho interesse`
   - **Correspondência:** Exato
4. Clique em **"Adicionar"**

✅ Quando o cliente clicar neste botão específico, será adicionado e ficará 7 dias na lista!

#### Exemplo 3: Vários botões com mesmo payload

1. Crie botões no seu template com `payload: "btn_block"`
2. Configure:
   - **Lista de Destino:** Bloqueado (365 dias)
   - **Conta WhatsApp:** Selecione a conta
   - **Tipo:** 📦 Payload do Botão
   - **Palavra-Chave:** `btn_block`
   - **Correspondência:** Exato

✅ Qualquer botão com esse payload adicionará o contato à lista de bloqueados por 365 dias!

### 6. Verificar se Contato está em Lista (API)

Antes de enviar uma mensagem, verifique:

```javascript
const response = await axios.post('http://localhost:3001/api/restriction-lists/check', {
  phone_number: '5511987654321',
  whatsapp_account_id: 1
});

if (response.data.restricted) {
  console.log('Contato está em lista de restrição!');
  console.log('Listas:', response.data.lists);
  // NÃO ENVIAR MENSAGEM
} else {
  // OK para enviar
}
```

---

## ⚙️ Funcionamento Técnico

### 1. Adição Automática via Webhook

Quando o WhatsApp envia um webhook:

1. **`webhook.controller.ts`** recebe a notificação
2. Detecta se é **clique em botão** ou **mensagem de texto**
3. Extrai: `buttonText`, `buttonPayload` ou `text`
4. Busca palavras-chave ativas no banco
5. Verifica se há match (exact, contains, etc.)
6. Se houver match:
   - Valida o número de telefone
   - Gera as 2 versões (com/sem 9º dígito)
   - Verifica se já existe na lista
   - Se não existe, adiciona
   - Registra log

### 2. Limpeza Automática

Worker executa **a cada hora**:

1. Busca entradas com `expires_at <= NOW()`
2. Registra logs de cada entrada expirada
3. Deleta as entradas
4. Atualiza estatísticas

### 3. Validação de Números

Service `PhoneValidationService`:

- Remove caracteres não numéricos
- Adiciona código do país (55)
- Valida DDD
- Gera 2 versões:
  - **Versão 1:** Número original normalizado
  - **Versão 2:** Versão alternativa (com/sem 9º dígito)

---

## 📊 Logs e Rastreamento

### Todas as Ações são Registradas

- **Adição:** Manual, webhook_button, webhook_keyword, import
- **Remoção:** Manual
- **Expiração:** Automática

### Informações Armazenadas

- Telefone (ambas as versões)
- Nome do contato
- Palavra-chave ou botão que causou a inclusão
- Campanha e mensagem de origem (se aplicável)
- Data/hora de adição
- Data/hora de expiração
- Método de adição
- Observações

---

## 🎨 Interface do Usuário

### Características

- ✅ Design moderno com Tailwind CSS
- ✅ Responsivo (funciona em mobile)
- ✅ Badges coloridos para cada tipo de lista
- ✅ Alertas visuais para contatos expirando
- ✅ Filtros avançados
- ✅ Busca em tempo real
- ✅ Paginação
- ✅ Seleção múltipla
- ✅ Modals para ações
- ✅ Toast notifications
- ✅ Loading states

---

## ⚠️ Observações Importantes

### Cadastro Duplo é OBRIGATÓRIO

**Por que?**
- Algumas operadoras/regiões usam números com 9º dígito
- Outras não
- Para garantir que o contato seja bloqueado independente do formato, cadastramos as duas versões

**Onde acontece?**
- ✅ Cadastro manual
- ✅ Importação CSV
- ✅ Webhook automático

### Exclusão Automática

- **Lista "Bloqueado":** 365 dias após adição
- **Lista "Sem Interesse":** 7 dias após adição
- **Lista "Não Me Perturbe":** NUNCA (permanente)

### Verificação de Duplicados

O sistema verifica se o número já existe na lista considerando:
- Número principal OU
- Número alternativo OU
- Qualquer uma das versões

**Não cadastra duplicados!**

---

## 🔜 Próximos Passos (Segunda Etapa)

Como solicitado, a integração com o sistema de disparos será feita depois:

### A Fazer Futuramente

1. **Integração com Disparos:**
   - Verificar listas antes de enviar mensagem
   - Bloquear envio automático se contato estiver em lista
   - Contador de disparos bloqueados
   - Relatório de tentativas bloqueadas

2. **Sistema de Usuários:**
   - Ativar log de ações por usuário
   - Permissões por usuário
   - Auditoria completa

---

## ✅ Checklist de Implementação

### Backend
- [x] Migration 009 criada e executada
- [x] Service de validação de números
- [x] Model com interfaces e DTOs
- [x] Controller com todas as operações
- [x] Rotas API configuradas
- [x] Webhook integrado (botões e palavras-chave)
- [x] Worker de limpeza automática
- [x] Server configurado para iniciar worker

### Frontend
- [x] Página de gerenciamento de listas
- [x] Dashboard com estatísticas e gráficos
- [x] Página de configurações de palavras-chave
- [x] Importação de CSV
- [x] Exportação para Excel
- [x] Filtros e busca
- [x] Seleção múltipla
- [x] Modals e UI completa

### Funcionalidades
- [x] 3 tipos de listas configuradas
- [x] Cadastro duplo de números (obrigatório)
- [x] Adição manual
- [x] Adição automática via webhook (botões)
- [x] Adição automática via webhook (palavras-chave)
- [x] Exclusão manual
- [x] Exclusão automática (7 e 365 dias)
- [x] Verificação de duplicados
- [x] Importação em massa
- [x] Exportação de relatórios
- [x] Dashboard completo
- [x] Configuração de palavras-chave
- [x] Logs de ações
- [x] Estatísticas por conta

---

## 🎉 Sistema Completo e Funcional!

Todas as funcionalidades solicitadas foram implementadas com sucesso!

### Para Iniciar o Sistema:

1. **Backend:**
```bash
cd backend
npm run dev
```

2. **Frontend:**
```bash
cd frontend
npm run dev
```

3. **Acesse:**
```
http://localhost:3000/listas-restricao
```

---

## 📞 Suporte

Se tiver dúvidas ou problemas:

1. Verifique os logs do backend
2. Verifique os logs do worker de limpeza
3. Verifique os logs do webhook
4. Consulte este documento

---

**Desenvolvido com ❤️ por IA Assistant**

**Data:** 13 de Novembro de 2025




