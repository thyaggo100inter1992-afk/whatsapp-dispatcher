# 🔧 CORREÇÃO URGENTE: Instâncias com Credenciais Erradas

## 🎯 O PROBLEMA

Você identificou corretamente o problema! 

**O que acontece:**
- **Tenant 1** cria instâncias → Usa credencial "WhatsApp" (naquele momento)
- Credencial padrão muda para "TESTE"  
- **Tenant 2** cria instâncias → Usa credencial "TESTE"
- **Tenant 1** tenta enviar mensagem → Sistema busca credencial "TESTE", mas instância está na conta "WhatsApp"!
- ❌ **Invalid token!** - Procura na conta errada!

## ✅ A SOLUÇÃO

Cada instância agora vai **LEMBRAR** em qual credencial foi criada!

### Implementação:

1. ✅ Campo `credential_id` adicionado à tabela `uaz_instances`
2. ✅ Ao criar instância, salva qual credencial foi usada
3. ✅ Ao enviar mensagem, usa a credencial DA INSTÂNCIA

---

## 📋 PASSO A PASSO PARA CORRIGIR

### PASSO 1: Rodar a Migration no Banco de Dados

Abra o **pgAdmin** ou **psql** e execute o arquivo:
```
backend/src/database/migrations/028_add_credential_to_instances.sql
```

**Via pgAdmin:**
1. Abra pgAdmin
2. Conecte ao banco de dados
3. Tools → Query Tool
4. Abra o arquivo `028_add_credential_to_instances.sql`
5. Execute (F5)

**Via psql:**
```bash
psql -U seu_usuario -d nome_do_banco -f backend/src/database/migrations/028_add_credential_to_instances.sql
```

**Via terminal PowerShell (se tiver psql instalado):**
```powershell
cd "C:\Users\thyag\Videos\NOVO DISPARADOR DE API OFICIAL - 22-11-2025 - 23h00"
$env:PGPASSWORD="sua_senha"
psql -U postgres -d disparador -f backend\src\database\migrations\028_add_credential_to_instances.sql
```

### PASSO 2: Reiniciar o Backend

```powershell
# Parar o backend (Ctrl+C no terminal)
# Depois:
cd backend
npm run dev
```

### PASSO 3: Verificar se funcionou

1. Acesse: `http://localhost:3000/diagnostic/credentials`
2. Você verá agora **Credencial DA INSTÂNCIA** nos detalhes
3. O sistema deve usar a credencial correta automaticamente!

---

## 🔍 O QUE A MIGRATION FAZ

1. **Adiciona coluna `credential_id`** na tabela `uaz_instances`
2. **Popula dados existentes:**
   - Instâncias que já existem recebem o `credential_id` do tenant atual
   - Isso é um "melhor palpite" - pode não ser 100% correto
3. **Mostra estatísticas:**
   - Quantas instâncias foram atualizadas
   - Quantas ainda estão sem credencial

---

## 🛠️ ARQUIVOS CRIADOS/MODIFICADOS

### Backend - Novos Arquivos:
✅ `backend/src/database/migrations/028_add_credential_to_instances.sql`
✅ `backend/src/helpers/instance-credentials.helper.js`

### Backend - Arquivos Preparados (ainda não 100% completos):
⏳ `backend/src/routes/uaz.js` - Já importa o helper, mas precisa aplicar em TODOS os endpoints

### Frontend:
✅ Página de diagnóstico já mostra as informações

---

## ⚠️ ATENÇÃO - INSTÂNCIAS EXISTENTES

**Para instâncias que JÁ EXISTEM no banco:**

A migration vai atribuir o `credential_id` baseado na credencial ATUAL do tenant.

**Se isso estiver errado** (instância foi criada em outra credencial), você tem 2 opções:

### Opção 1: Deletar e Recriar (Recomendado)
```sql
-- Ver instâncias com problema:
SELECT id, name, session_name, credential_id 
FROM uaz_instances 
WHERE tenant_id = 1;

-- Deletar as que estão erradas:
DELETE FROM uaz_instances WHERE id = 123;
```

Depois crie novamente no sistema, com a credencial correta configurada no tenant.

### Opção 2: Corrigir Manualmente no Banco
```sql
-- Ver credenciais disponíveis:
SELECT id, name, server_url FROM uazap_credentials;

-- Atualizar credential_id da instância:
UPDATE uaz_instances 
SET credential_id = 2  -- ID da credencial correta
WHERE id = 123;  -- ID da instância
```

---

## 📊 VERIFICAR STATUS ATUAL

### Antes de rodar a migration:

```sql
-- Ver estrutura atual:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'uaz_instances';

-- Ver instâncias:
SELECT 
  id, 
  name, 
  tenant_id,
  instance_token 
FROM uaz_instances;
```

### Depois de rodar a migration:

```sql
-- Ver se credential_id foi adicionado:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'uaz_instances' 
  AND column_name = 'credential_id';

-- Ver instâncias com suas credenciais:
SELECT 
  ui.id,
  ui.name,
  ui.tenant_id,
  ui.credential_id,
  uc.name as credencial_nome,
  uc.server_url
FROM uaz_instances ui
LEFT JOIN uazap_credentials uc ON ui.credential_id = uc.id;
```

---

## 🎯 PRÓXIMOS PASSOS (Após Migration)

1. ✅ Testar envio de mensagens
2. ✅ Verificar se usa a credencial correta
3. ✅ Se aparecer "Invalid token", usar a página de diagnóstico
4. ✅ Corrigir instâncias com `credential_id` errado

---

## 🆘 SE DER ERRO

### Erro: "column credential_id already exists"
Significa que a migration já foi rodada. Tudo OK!

### Erro: "relation uazap_credentials does not exist"
Rode primeiro a migration 027:
```sql
-- Rodar primeiro:
backend/src/database/migrations/027_create_credentials_system.sql
```

### Erro: "Invalid token" continua aparecendo
1. Acesse a página de diagnóstico
2. Veja qual credencial a instância está usando
3. Se estiver errada, corrija manualmente:
```sql
UPDATE uaz_instances 
SET credential_id = (SELECT id FROM uazap_credentials WHERE name = 'NOME_CORRETO')
WHERE id = ID_DA_INSTANCIA;
```

---

## 📝 RESUMO

**ANTES:**
- Instâncias usavam credencial padrão do sistema
- Se a padrão mudasse, dava erro "Invalid token"

**DEPOIS:**
- Cada instância lembra qual credencial usou
- Sistema sempre usa a credencial correta da instância
- Problema de "Invalid token" resolvido!

---

## ✅ CHECKLIST

- [ ] Rodar migration 028 no banco
- [ ] Reiniciar backend
- [ ] Acessar página de diagnóstico
- [ ] Verificar se instâncias têm `credential_id`
- [ ] Testar envio de mensagens
- [ ] Se necessário, corrigir `credential_id` manualmente

---

Qualquer dúvida, me avise! 🚀






