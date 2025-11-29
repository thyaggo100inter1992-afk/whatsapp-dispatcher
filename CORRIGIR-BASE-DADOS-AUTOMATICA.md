# 🔧 CORRIGIR: Consultas não salvam automaticamente na Base de Dados

## 🔍 Problema Identificado

Você está fazendo consultas (CPF/CNPJ) na Nova Vida, mas os dados **não estão sendo salvos automaticamente** na aba "Base de Dados".

### Causa Provável
A tabela `base_dados_completa` pode:
- ❌ Não existir no banco de dados
- ❌ Estar com estrutura incorreta
- ❌ Ter permissões incorretas

---

## ✅ SOLUÇÃO RÁPIDA (3 Passos)

### **Passo 1:** Criar/Verificar a Tabela
Execute este arquivo:
```
VERIFICAR-E-CRIAR-TABELA-BASE.bat
```

Isso irá:
- ✅ Criar a tabela `base_dados_completa` se não existir
- ✅ Criar todos os índices necessários
- ✅ Migrar dados antigos se houver

### **Passo 2:** Reiniciar o Backend
Após criar a tabela, reinicie o backend:
```
REINICIAR-BACKEND-AGORA.bat
```

### **Passo 3:** Testar
1. Acesse a página "Consultar Dados Nova Vida"
2. Faça uma consulta de teste (CPF ou CNPJ)
3. Vá para a aba "Base de Dados"
4. O registro deve aparecer automaticamente!

---

## 🔍 Como Verificar se Está Funcionando

### No Console do Backend, você verá:

**✅ FUNCIONANDO:**
```
📋 Nova consulta: 12345678900
💾 Salvando na base de dados completa...
💾 ✅ Salvo na base de dados: 12345678900
```

**❌ COM PROBLEMA:**
```
📋 Nova consulta: 12345678900
💾 Salvando na base de dados completa...
❌ ERRO ao salvar na base de dados: relation "base_dados_completa" does not exist
⚠️ A consulta foi realizada mas NÃO foi salva na base de dados!
⚠️ Execute: VERIFICAR-E-CRIAR-TABELA-BASE.bat
```

---

## 📊 O que é Salvo Automaticamente

Quando você faz uma consulta, o sistema salva:

### 📋 Dados Cadastrais
- Nome completo / Razão Social
- CPF ou CNPJ
- Data de nascimento
- Nome da mãe
- Sexo

### 📞 Contatos
- Telefones (com DDD e operadora)
- ✅ Verificação automática de WhatsApp
- E-mails

### 📍 Endereços
- Logradouro, número, complemento
- Bairro, cidade, UF, CEP
- Indicador de área de risco

### 💼 Dados CNPJ (quando aplicável)
- CNAE
- Situação cadastral
- Capital social
- Data de abertura

### 🏷️ Metadados
- Origem: "consulta_unica" ou "consulta_massa"
- Data da consulta
- Status de verificação WhatsApp

---

## 🔧 Melhorias Implementadas

### Logs Aprimorados
Agora o backend mostra **detalhes completos** dos erros:
- ✅ Indica exatamente onde o erro ocorreu
- ✅ Mostra a mensagem de erro completa
- ✅ Sugere a solução (executar o .bat)

### Salvamento Não-Bloqueante
- ✅ Se falhar ao salvar na base, a consulta continua funcionando
- ✅ O resultado é exibido normalmente
- ✅ O histórico é mantido

---

## 🔄 Fluxo Completo

```
┌─────────────────────┐
│  Usuário faz        │
│  Consulta CPF/CNPJ  │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│  API Nova Vida      │
│  retorna dados      │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│  Verificar WhatsApp │
│  (se habilitado)    │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│  Salvar no          │
│  Histórico          │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│  Salvar na Base     │ ← AQUI ESTAVA FALHANDO
│  de Dados Completa  │    AGORA VAI FUNCIONAR!
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│  Retornar resultado │
│  para o frontend    │
└─────────────────────┘
```

---

## 🚨 Solução de Problemas

### Problema: "relation does not exist"
**Solução:** Execute `VERIFICAR-E-CRIAR-TABELA-BASE.bat`

### Problema: "permission denied"
**Solução:** Verifique as credenciais do banco no arquivo `.env`

### Problema: Tabela criada mas continua não salvando
**Solução:**
1. Reinicie o backend
2. Verifique os logs no console
3. Teste com uma nova consulta

### Problema: Erro de conexão com banco
**Solução:**
1. Verifique se o PostgreSQL está rodando
2. Execute: `DIAGNOSTICAR-BACKEND.bat`
3. Verifique o arquivo `.env`

---

## 📝 Estrutura da Tabela

```sql
base_dados_completa
├── id (SERIAL PRIMARY KEY)
├── tipo_origem (VARCHAR) → 'consulta_unica', 'consulta_massa', etc
├── tipo_documento (VARCHAR) → 'CPF' ou 'CNPJ'
├── documento (VARCHAR UNIQUE) → Documento único
├── nome (TEXT)
├── telefones (JSONB) → Array de telefones
├── emails (JSONB) → Array de emails
├── enderecos (JSONB) → Array de endereços
├── whatsapp_verificado (BOOLEAN)
├── data_adicao (TIMESTAMP)
└── ... (outros campos)
```

---

## ✅ Checklist Final

Após executar a correção, verifique:

- [ ] Tabela `base_dados_completa` criada
- [ ] Backend reiniciado sem erros
- [ ] Console mostra "✅ Salvo na base de dados"
- [ ] Registros aparecem na aba "Base de Dados"
- [ ] Filtros funcionam corretamente
- [ ] Estatísticas são atualizadas

---

## 💡 Dica Pro

Para verificar manualmente se a tabela existe:
```sql
SELECT COUNT(*) FROM base_dados_completa;
```

Se retornar um número (mesmo que 0), a tabela existe! ✅

---

**Status:** 🔧 Correção pronta para aplicar
**Tempo estimado:** 2 minutos
**Impacto:** ⚡ Nenhum - não afeta consultas em andamento






