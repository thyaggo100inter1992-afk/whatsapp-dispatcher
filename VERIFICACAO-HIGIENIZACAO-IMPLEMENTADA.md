# ✅ Nova Funcionalidade: Verificação e Higienização de CPFs

## 📋 Resumo

Foi implementada uma **nova aba** na página "Consultar Dados Nova Vida" que permite verificar quais CPFs estão ou não cadastrados na base de dados e higienizar os não cadastrados via API.

---

## 🎯 Funcionalidades

### 1. **Upload/Cole de CPFs**
- Campo de texto para colar CPFs (um por linha)
- Botão para fazer upload de arquivo Excel/CSV
- Validação automática dos CPFs
- Suporta CPF com ou sem formatação

### 2. **Verificação Automática na Base**
O sistema:
- Busca todos os CPFs na base de dados local (PostgreSQL)
- Separa em 2 grupos:
  - ✅ **CPFs Cadastrados** → já existem na base
  - ❌ **CPFs Não Cadastrados** → não existem na base
- Mostra estatísticas em tempo real

### 3. **Configurações de Higienização**

#### 🕐 Delay entre Consultas
- Configurável de 1 a 10 segundos
- Recomendado: 2-3 segundos para evitar sobrecarga da API
- Aplicado entre cada consulta na API

#### 📱 Verificação de WhatsApp
- Opção de ativar/desativar verificação
- **Escolha de coluna** para verificar:
  - **1️⃣ Primeira coluna** (Telefone 1)
  - **2️⃣ Segunda coluna** (Telefone 2)
  - **3️⃣ Terceira coluna** (Telefone 3)
  - **🔄 Todas as colunas** (verifica todos)
- Aviso claro sobre qual coluna será verificada

### 4. **Higienização via API**
- Consulta automática dos CPFs não cadastrados
- Progresso em tempo real mostrando:
  - 📊 Total de CPFs
  - ✅ CPFs já consultados
  - ⏳ CPFs que faltam
  - Barra de progresso visual com percentual
- Salvamento automático na base de dados

### 5. **Salvamento Inteligente**
O sistema implementa lógica inteligente:
- **CPF Novo (não existe)** → **CRIA** novo registro (INSERT)
- **CPF Existente** → **ATUALIZA** dados (UPDATE)
  - Faz merge de telefones, emails e endereços
  - Não duplica registros
  - Mantém histórico completo

### 6. **Tratamento de CPFs Sem Telefone**
- CPFs higienizados sem telefone são incluídos no Excel
- Marcação clara: **"⚠️ SEM TELEFONE"**
- Ainda assim salvos na base de dados

### 7. **Download de Arquivos**

#### Opção 1: Baixar Somente Cadastrados
- Disponível quando há CPFs encontrados
- Excel com todos os CPFs que já estavam na base
- Nome do arquivo: `CPFs-Cadastrados-[timestamp].xlsx`

#### Opção 2: Baixar Base Completa
- Disponível após higienização
- Excel com **TODOS os dados numa única aba**:
  - CPFs que já estavam cadastrados (marcados como "✅ Cadastrado")
  - CPFs higienizados (marcados como "🌐 Higienizado")
  - CPFs sem telefone (marcados como "⚠️ SEM TELEFONE")
- Nome do arquivo: `Base-Completa-[timestamp].xlsx`

---

## 🔧 Arquivos Modificados

### Frontend
- **`frontend/src/pages/consultar-dados.tsx`**
  - Adicionado novo tipo de aba: `'verification'`
  - Criados estados para gerenciar verificação e higienização
  - Implementadas funções:
    - `handleVerificationFileUpload` - Upload de arquivo
    - `handleVerifyCpfs` - Verificação na base
    - `handleHygienize` - Higienização via API
    - `handleDownloadFoundOnly` - Download apenas cadastrados
    - `handleDownloadComplete` - Download completo
  - Interface completa com:
    - Área de texto para colar CPFs
    - Upload de arquivo Excel/CSV
    - Estatísticas visuais (cards com números)
    - Configurações de delay e WhatsApp
    - Progresso em tempo real
    - Botões de download

### Backend
- **`backend/src/routes/novaVida.js`**
  - Novo endpoint: `POST /novavida/verificar-lista`
    - Recebe array de CPFs
    - Busca na base de dados
    - Retorna encontrados e não encontrados
  - Modificado endpoint: `POST /novavida/consultar`
    - Adicionado parâmetro `whatsappColumn` ('first', 'second', 'third', 'all')
    - Implementada lógica para verificar apenas telefones selecionados
  - Função `salvarNaBaseDados` já implementava:
    - Lógica de INSERT/UPDATE automática
    - Merge inteligente de dados

---

## 📊 Estrutura do Excel Gerado

### Colunas do Excel:
1. CPF/CNPJ
2. Nome
3. Nome Mãe
4. Sexo
5. Data Nascimento
6. Telefone 1
7. WhatsApp 1 (Sim/Não)
8. Telefone 2
9. WhatsApp 2 (Sim/Não)
10. Telefone 3
11. WhatsApp 3 (Sim/Não)
12. Email 1
13. Email 2
14. Email 3
15. CEP
16. Logradouro
17. Número
18. Complemento
19. Bairro
20. Cidade
21. UF
22. **Status** (✅ Cadastrado | 🌐 Higienizado | ⚠️ SEM TELEFONE)

---

## 🚀 Como Usar

### Passo 1: Acessar a Nova Aba
1. Acesse: **Consultar Dados Nova Vida**
2. Clique na aba: **"Verificação e Higienização"**

### Passo 2: Inserir CPFs
**Opção A - Colar CPFs:**
```
12345678901
98765432100
11122233344
```

**Opção B - Upload de Arquivo:**
- Excel ou CSV
- CPFs devem estar na **primeira coluna**

### Passo 3: Verificar
1. Clique em **"Verificar CPFs na Base"**
2. Sistema mostra:
   - ✅ Quantos estão cadastrados
   - ❌ Quantos não estão cadastrados

### Passo 4A: Baixar Somente Cadastrados (Opcional)
Se não quiser higienizar:
1. Clique em **"Baixar Somente Cadastrados"**
2. Excel será gerado apenas com os CPFs encontrados

### Passo 4B: Higienizar Não Cadastrados
Se quiser higienizar:

1. **Configure o Delay:**
   - Defina quantos segundos entre consultas (recomendado: 2-3s)

2. **Configure Verificação WhatsApp:**
   - Clique em "✅ SIM" ou "❌ NÃO"
   - Se SIM, escolha qual coluna verificar:
     - 1️⃣ Primeira
     - 2️⃣ Segunda
     - 3️⃣ Terceira
     - 🔄 Todas

3. **Iniciar Higienização:**
   - Clique em **"Higienizar X CPFs via API"**
   - Acompanhe o progresso em tempo real

4. **Baixar Base Completa:**
   - Após conclusão, clique em **"Baixar Base Completa"**
   - Excel terá todos os dados numa única aba

---

## ⚙️ Características Técnicas

### Performance
- Consultas com delay configurável (proteção contra sobrecarga)
- Progresso em tempo real com atualização a cada CPF consultado
- Barra de progresso visual com percentual
- Processamento assíncrono no frontend

### Segurança
- Validação de CPFs no frontend e backend
- Sanitização de documentos (remove caracteres especiais)
- Tratamento de erros em todas as etapas
- Logs detalhados no backend

### Base de Dados
- Salvamento automático após higienização
- Merge inteligente (não duplica registros)
- Flag `consultado_nova_vida` para rastreamento
- Histórico completo de alterações

### WhatsApp
- Rotação automática de instâncias QR Connect
- Suporte a múltiplas instâncias ativas
- Verificação seletiva por coluna de telefone
- Marcação de telefones verificados

---

## 🎨 Interface Visual

### Cards de Estatísticas
```
┌─────────────────────────┐  ┌─────────────────────────┐
│ ✅ CADASTRADOS          │  │ ❌ NÃO CADASTRADOS      │
│                         │  │                         │
│    150                  │  │    50                   │
└─────────────────────────┘  └─────────────────────────┘
```

### Progresso de Higienização
```
🔄 Higienização em Andamento

📊 Total: 50
✅ Consultados: 23
⏳ Faltam: 27

[████████████░░░░░░░░] 46%
```

---

## 📝 Nomenclatura

**IMPORTANTE:** Conforme solicitado, o termo "Nova Vida" **NÃO é mencionado** na interface desta aba. Utilizamos:
- ✅ "Higienização via API"
- ✅ "Verificação de CPFs"
- ❌ ~~"Higienizar com Nova Vida"~~

---

## ✅ Checklist de Testes

- [x] Upload de arquivo Excel com CPFs
- [x] Colar CPFs manualmente
- [x] Verificação de CPFs na base
- [x] Estatísticas mostradas corretamente
- [x] Configuração de delay funcional
- [x] Configuração de verificação WhatsApp
- [x] Escolha de coluna de telefone (1ª, 2ª, 3ª, Todas)
- [x] Progresso em tempo real durante higienização
- [x] Salvamento automático na base (INSERT/UPDATE)
- [x] CPFs sem telefone incluídos no Excel
- [x] Download somente cadastrados
- [x] Download base completa (cadastrados + higienizados)
- [x] Tratamento de erros em todas as etapas

---

## 🔄 Próximos Passos (Sugestões)

1. **Relatórios:**
   - Histórico de higienizações realizadas
   - Estatísticas de CPFs sem telefone

2. **Otimizações:**
   - Processamento em lote (jobs assíncronos para grandes volumes)
   - Cache de resultados recentes

3. **Notificações:**
   - Email ao concluir higienização de grandes volumes
   - Alertas de CPFs com problemas

---

## 📞 Suporte

Em caso de dúvidas ou problemas:
1. Verifique os logs do backend (console)
2. Verifique se a base de dados está acessível
3. Verifique se há instâncias QR Connect ativas (para verificação WhatsApp)
4. Reinicie o backend se necessário: `3-iniciar-backend.bat`

---

**Funcionalidade implementada e testada com sucesso! 🚀**






