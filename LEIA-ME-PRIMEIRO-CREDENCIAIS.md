# 🔍 EXPLICAÇÃO COMPLETA: Sistema de Credenciais WhatsApp

**Data:** 24/11/2024  
**Problema Reportado:** Sistema não reconhece qual credencial o tenant foi criado

---

## 📖 O QUE SÃO AS CREDENCIAIS?

As **credenciais UAZAP** são as contas do WhatsApp API onde suas instâncias (conexões) são criadas.

Pense assim:
- Você tem **contas diferentes** no UAZAP (WhatsApp API)
- Cada conta tem sua **URL** e **Token** próprios
- Quando você cria uma instância (conexão WhatsApp), ela é criada **dentro de uma dessas contas**

---

## 🎯 COMO O SISTEMA FUNCIONA (CORRETO)

### 1️⃣ NÍVEL 1: Cadastro de Credenciais
Você cadastra suas credenciais UAZAP no sistema:
- **"WhatsApp Produção"** → `https://conta1.uazapi.com`
- **"WhatsApp Teste"** → `https://conta2.uazapi.com`
- **"WhatsApp Backup"** → `https://conta3.uazapi.com`

Uma delas você marca como **PADRÃO** ⭐

### 2️⃣ NÍVEL 2: Tenant Recebe Credencial
Quando você cria um **tenant** (cliente/empresa), ele automaticamente recebe a credencial **PADRÃO**.

Exemplo:
```
Tenant: "Empresa ABC"
Credencial vinculada: "WhatsApp Produção"
```

Você pode mudar depois se quiser!

### 3️⃣ NÍVEL 3: Instância Lembra Sua Credencial
Quando você cria uma **instância** (conexão WhatsApp) para o tenant, o sistema:
1. Pega a credencial do tenant
2. Cria a instância **naquela conta UAZAP**
3. **SALVA** qual credencial foi usada na instância

Exemplo:
```
Instância: "Vendas 1"
Criada na conta: "WhatsApp Produção"
credential_id: 1 ✅ (LEMBRA qual conta é!)
```

---

## ❌ O QUE PODE DAR ERRADO?

### PROBLEMA 1: Tenant Sem Credencial
```
Tenant: "Empresa ABC"
Credencial: NULL ❌
```

**Consequência:**
- Sistema não sabe qual conta UAZAP usar
- Não consegue criar instâncias
- Não consegue enviar mensagens

**Solução:**
```sql
-- Vincular à credencial padrão
UPDATE tenants 
SET uazap_credential_id = <ID_CREDENCIAL>
WHERE id = <ID_TENANT>;
```

### PROBLEMA 2: Instância Sem credential_id
```
Instância: "Vendas 1"
Criada na conta: "WhatsApp Produção" (realmente criada lá)
credential_id: NULL ❌ (não sabe que foi criada lá!)
```

**Consequência:**
- Instância existe na conta "WhatsApp Produção"
- Mas o sistema não sabe disso
- Tenta buscar na conta errada
- **Erro: "Invalid token"**

**Solução:**
```sql
-- Informar à instância qual credencial ela usa
UPDATE uaz_instances 
SET credential_id = <ID_CREDENCIAL>
WHERE id = <ID_INSTANCIA>;
```

### PROBLEMA 3: Mudou a Credencial Padrão Depois
```
Situação:
1. Credencial Padrão era "WhatsApp Teste"
2. Tenant 1 criou 10 instâncias (na conta "Teste")
3. Você mudou Credencial Padrão para "WhatsApp Produção"
4. Tenant 1 tenta usar as instâncias antigas
5. Sistema busca em "Produção", mas instâncias estão em "Teste"
6. ❌ ERRO!
```

**Solução:**
- Cada instância tem `credential_id` e sabe onde foi criada
- Sistema SEMPRE usa a credencial DA INSTÂNCIA, não do tenant

---

## 🔧 COMO DIAGNOSTICAR SEU SISTEMA?

### OPÇÃO 1: Página Visual (Recomendado)
1. Acesse: `http://localhost:3000/diagnostic/credentials`
2. Veja todos os tenants e suas credenciais
3. Veja todas as instâncias e onde foram criadas
4. Identifique problemas visualmente

### OPÇÃO 2: Script SQL
1. Execute o arquivo: `DIAGNOSTICO-EXECUTAR-AGORA.sql`
2. No **pgAdmin**:
   - Abra o Query Tool
   - Abra o arquivo SQL
   - Execute (F5)
3. Ou use o **PowerShell**:
   ```powershell
   psql -U postgres -d <nome_banco> -f DIAGNOSTICO-EXECUTAR-AGORA.sql
   ```

### OPÇÃO 3: Script Automático (Windows)
```cmd
EXECUTAR-DIAGNOSTICO.bat
```
Este script vai pedir suas credenciais do banco e executar o diagnóstico.

---

## ✅ COMO CORRIGIR?

### CORREÇÃO 1: Tenants Sem Credencial
```sql
-- Arquivo: CORRIGIR-TENANTS-SEM-CREDENCIAL.sql
-- Execute no pgAdmin ou psql
```

Este script vai:
1. Verificar qual credencial é a padrão
2. Vincular todos os tenants sem credencial a ela

### CORREÇÃO 2: Instâncias Sem credential_id
```sql
-- Arquivo: CORRIGIR-INSTANCIAS-SEM-CREDENCIAL.sql
-- Execute no pgAdmin ou psql
```

Este script vai:
1. Pegar o `uazap_credential_id` de cada tenant
2. Atribuir às instâncias daquele tenant
3. Assim cada instância saberá sua credencial

---

## 📊 QUERIES ÚTEIS PARA VOCÊ

### Ver Todas as Credenciais:
```sql
SELECT 
  id,
  name,
  server_url,
  is_default,
  (SELECT COUNT(*) FROM tenants WHERE uazap_credential_id = uazap_credentials.id) as tenants_usando
FROM uazap_credentials
ORDER BY is_default DESC;
```

### Ver Seu Tenant e Credencial:
```sql
SELECT 
  t.id,
  t.nome,
  t.uazap_credential_id,
  uc.name as credencial
FROM tenants t
LEFT JOIN uazap_credentials uc ON t.uazap_credential_id = uc.id
WHERE t.id = <SEU_TENANT_ID>;
```

### Ver Suas Instâncias e Credenciais:
```sql
SELECT 
  ui.id,
  ui.name,
  ui.credential_id,
  uc.name as credencial,
  ui.is_connected
FROM uaz_instances ui
LEFT JOIN uazap_credentials uc ON ui.credential_id = uc.id
WHERE ui.tenant_id = <SEU_TENANT_ID>;
```

### Identificar Problemas:
```sql
-- Tenants sem credencial
SELECT id, nome FROM tenants WHERE uazap_credential_id IS NULL;

-- Instâncias sem credential_id
SELECT id, name, tenant_id FROM uaz_instances WHERE credential_id IS NULL;
```

---

## 🎬 PASSO A PASSO COMPLETO

### 1️⃣ DIAGNÓSTICO
```bash
# Opção A: Página visual
Acesse: http://localhost:3000/diagnostic/credentials

# Opção B: Script SQL
psql -U postgres -d disparador -f DIAGNOSTICO-EXECUTAR-AGORA.sql

# Opção C: Bat automático
EXECUTAR-DIAGNOSTICO.bat
```

### 2️⃣ CORREÇÃO (se necessário)
```bash
# Se houver tenants sem credencial:
psql -U postgres -d disparador -f CORRIGIR-TENANTS-SEM-CREDENCIAL.sql

# Se houver instâncias sem credential_id:
psql -U postgres -d disparador -f CORRIGIR-INSTANCIAS-SEM-CREDENCIAL.sql
```

### 3️⃣ TESTE
```bash
1. Acesse o sistema
2. Tente criar uma nova instância
3. Tente enviar uma mensagem
4. Verifique os logs do backend (deve mostrar qual credencial está usando)
```

---

## 📝 LOGS IMPORTANTES

### ✅ Quando está CORRETO:
```
🔍 Buscando credenciais UAZAP para tenant 1...
✅ Usando credencial específica do tenant: "WhatsApp Produção"
   URL: https://nettsistemas.uazapi.com

🔍 ============ BUSCAR INSTÂNCIA COM CREDENCIAIS ============
📋 Instância ID: 123
👤 Tenant ID: 1
✅ Usando credencial DA INSTÂNCIA:
   ID: 1
   Nome: WhatsApp Produção
   URL: https://nettsistemas.uazapi.com
🎯 Credencial correta encontrada! (DA INSTÂNCIA)
```

### ❌ Quando há PROBLEMA:
```
⚠️ Tenant sem credencial específica, buscando padrão...
⚠️ Instância SEM credential_id específico
🔄 Usando credencial do TENANT como fallback...
⚠️ ATENÇÃO: Esta instância deveria ter credential_id!
   Recomendação: Recriar a instância para vinculá-la à credencial correta
```

---

## 🆘 PERGUNTAS FREQUENTES

### P: Posso ter várias credenciais cadastradas?
**R:** Sim! Você pode ter quantas quiser. Cada tenant pode usar uma diferente.

### P: O que significa "credencial padrão"?
**R:** É a credencial que será usada automaticamente quando você criar um **novo tenant**. Você pode mudar depois.

### P: Posso mudar a credencial de um tenant?
**R:** Sim! Mas atenção:
- Instâncias antigas continuarão na conta antiga
- Novas instâncias irão para a conta nova
- Cada instância lembra onde foi criada (credential_id)

### P: E se eu deletar uma credencial?
**R:** O sistema impede deletar se houver tenants usando. Você precisa primeiro mudar a credencial dos tenants.

### P: Preciso recriar as instâncias?
**R:** **NÃO!** Os scripts de correção ajustam o banco de dados. Suas instâncias continuam funcionando.

### P: Como sei qual credencial minha instância está usando?
**R:** Olhe a página de diagnóstico ou execute:
```sql
SELECT ui.name, uc.name as credencial
FROM uaz_instances ui
JOIN uazap_credentials uc ON ui.credential_id = uc.id
WHERE ui.id = <ID_INSTANCIA>;
```

---

## 📁 ARQUIVOS IMPORTANTES

```
📁 Raiz do Projeto/
├── 📄 LEIA-ME-PRIMEIRO-CREDENCIAIS.md       ← VOCÊ ESTÁ AQUI
├── 📄 DIAGNOSTICO-CREDENCIAIS-COMPLETO.md    ← Documentação técnica
├── 📄 DIAGNOSTICO-EXECUTAR-AGORA.sql         ← Script de diagnóstico
├── 📄 CORRIGIR-TENANTS-SEM-CREDENCIAL.sql    ← Correção de tenants
├── 📄 CORRIGIR-INSTANCIAS-SEM-CREDENCIAL.sql ← Correção de instâncias
└── 📄 EXECUTAR-DIAGNOSTICO.bat               ← Script automático Windows
```

---

## ✅ CHECKLIST FINAL

Depois de executar tudo, verifique:

- [ ] Existe pelo menos UMA credencial cadastrada?
- [ ] Existe UMA credencial marcada como padrão (`is_default = true`)?
- [ ] Todos os tenants têm `uazap_credential_id` preenchido?
- [ ] Todas as instâncias têm `credential_id` preenchido?
- [ ] Consegue criar nova instância sem erro?
- [ ] Consegue enviar mensagem sem erro?
- [ ] Os logs mostram "✅ Usando credencial DA INSTÂNCIA"?

Se todos os itens estiverem ✅, seu sistema está funcionando corretamente!

---

## 🎯 RESUMO DO RESUMO

**PROBLEMA:** Sistema não reconhece qual credencial o tenant foi criado.

**CAUSA:** Falta de vínculo entre:
- Tenant ↔ Credencial (`uazap_credential_id`)
- Instância ↔ Credencial (`credential_id`)

**SOLUÇÃO:**
1. Execute: `DIAGNOSTICO-EXECUTAR-AGORA.sql`
2. Se houver problemas, execute os scripts de correção
3. Teste criando instância e enviando mensagem

**RESULTADO:** Sistema sempre usa a credencial correta, sem erros de "Invalid token".

---

🎉 **Pronto! Agora você entende como funciona o sistema de credenciais!**

Se tiver dúvidas, consulte: `DIAGNOSTICO-CREDENCIAIS-COMPLETO.md`






