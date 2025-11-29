# 🔧 COMO APLICAR AS MIGRATIONS QR CAMPANHAS

## ⚠️ O comando `psql` não está no PATH

Existem **3 formas** de aplicar as migrations:

---

## 📋 **OPÇÃO 1: pgAdmin (MAIS FÁCIL) ✅**

1. **Abra o pgAdmin**
2. **Conecte** ao servidor PostgreSQL
3. **Selecione** o banco `whatsapp_dispatcher`
4. Clique em **Tools** → **Query Tool** (ou pressione `Alt+Shift+Q`)
5. **Copie e cole** o SQL abaixo:

```sql
-- ============================================
-- ATUALIZAÇÃO: CAMPANHAS QR CONNECT
-- Adicionar colunas faltantes para paridade 100%
-- ============================================

-- Adicionar colunas na tabela qr_campaigns
ALTER TABLE qr_campaigns 
ADD COLUMN IF NOT EXISTS no_whatsapp_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS button_clicks_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_remove_account_failures INT DEFAULT 0;

-- Adicionar colunas de rastreamento de remoções em qr_campaign_templates
ALTER TABLE qr_campaign_templates
ADD COLUMN IF NOT EXISTS removal_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS permanent_removal BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS removal_history JSONB DEFAULT '[]'::jsonb;

-- Comentários
COMMENT ON COLUMN qr_campaigns.no_whatsapp_count IS 'Contador de números sem WhatsApp';
COMMENT ON COLUMN qr_campaigns.button_clicks_count IS 'Contador de cliques em botões';
COMMENT ON COLUMN qr_campaigns.auto_remove_account_failures IS 'Número de falhas para remoção automática (0=desabilitado)';
COMMENT ON COLUMN qr_campaign_templates.removal_count IS 'Quantas vezes a instância foi removida';
COMMENT ON COLUMN qr_campaign_templates.permanent_removal IS 'Se foi removida permanentemente';
COMMENT ON COLUMN qr_campaign_templates.removal_history IS 'Histórico de remoções e reativações';
```

6. Clique em **▶ Execute** (ou pressione `F5`)
7. ✅ **Pronto!** Verifique se apareceu mensagens de sucesso

---

## 📋 **OPÇÃO 2: DBeaver / DataGrip**

1. **Abra** sua ferramenta de banco de dados
2. **Conecte** ao banco `whatsapp_dispatcher`
3. **Abra** um novo SQL Editor
4. **Copie e cole** o SQL acima
5. **Execute** o script
6. ✅ **Pronto!**

---

## 📋 **OPÇÃO 3: Linha de Comando (se psql estiver instalado)**

### **Encontrar o caminho do psql:**

```cmd
# No PowerShell, procure pelo psql.exe
Get-ChildItem -Path "C:\Program Files\PostgreSQL" -Recurse -Filter psql.exe
```

### **Executar com caminho completo:**

```cmd
# Substitua XX pela sua versão do PostgreSQL
"C:\Program Files\PostgreSQL\XX\bin\psql.exe" -U postgres -d whatsapp_dispatcher -f backend\src\database\migrations\update_qr_campaigns.sql
```

**Exemplos:**
```cmd
# PostgreSQL 15
"C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -d whatsapp_dispatcher -f backend\src\database\migrations\update_qr_campaigns.sql

# PostgreSQL 16
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d whatsapp_dispatcher -f backend\src\database\migrations\update_qr_campaigns.sql
```

---

## ✅ **COMO VERIFICAR SE FUNCIONOU:**

Após executar o SQL, verifique se as colunas foram criadas:

### **No pgAdmin:**

```sql
-- Verificar colunas da tabela qr_campaigns
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'qr_campaigns'
ORDER BY ordinal_position;

-- Verificar colunas da tabela qr_campaign_templates
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'qr_campaign_templates'
ORDER BY ordinal_position;
```

### **Você deve ver:**

**Em `qr_campaigns`:**
- ✅ `no_whatsapp_count` (integer, default 0)
- ✅ `button_clicks_count` (integer, default 0)
- ✅ `auto_remove_account_failures` (integer, default 0)

**Em `qr_campaign_templates`:**
- ✅ `removal_count` (integer, default 0)
- ✅ `permanent_removal` (boolean, default false)
- ✅ `removal_history` (jsonb, default [])

---

## 🎉 **APÓS APLICAR:**

1. ✅ Migrations aplicadas
2. 🔄 Reinicie o backend:
   ```bash
   cd backend
   npm run dev
   ```
3. 🔄 Reinicie o frontend:
   ```bash
   cd frontend
   npm run dev
   ```
4. 🚀 Acesse: `http://localhost:3000/qr-campanhas`

---

## ❓ **PROBLEMAS?**

### **"Tabela qr_campaigns não existe"**
Execute primeiro o script de criação:
```cmd
# Via pgAdmin ou ferramenta de DB, execute:
backend\src\database\migrations\create_qr_campaigns.sql
```

### **"Permissão negada"**
- Certifique-se de estar usando o usuário `postgres`
- Ou um usuário com permissões de ALTER TABLE

### **"Sintaxe incorreta"**
- Certifique-se de copiar o SQL completo
- Não adicione caracteres extras

---

## 📞 **PRECISA DE AJUDA?**

Se nenhuma opção funcionar, me avise com:
1. Qual ferramenta de banco você está usando (pgAdmin, DBeaver, etc.)
2. Qual erro exato apareceu
3. Versão do PostgreSQL

---

**🎊 Boa sorte! Em breve suas Campanhas QR estarão 100% funcionais!**








