# 🏢 MIGRATIONS MULTI-TENANT - FASE 1

Este diretório contém as migrations para transformar o sistema em multi-tenant (banco único).

---

## 📋 ANTES DE COMEÇAR

### ⚠️ CHECKLIST OBRIGATÓRIO

- [ ] ✅ **Fazer backup do banco de dados**
- [ ] ✅ **Parar o backend** (`pm2 stop backend` ou `Ctrl+C`)
- [ ] ✅ **Garantir que ninguém está usando o sistema**
- [ ] ✅ **Ler e entender o que cada migration faz**

---

## 🔄 MIGRATIONS DISPONÍVEIS

### Migration 001: Criar Tabelas de Controle
**Arquivo:** `001_create_control_tables.sql`  
**O que faz:**
- ✅ Cria tabela `tenants` (clientes)
- ✅ Cria tabela `tenant_users` (usuários)
- ✅ Cria tabela `subscriptions` (assinaturas)
- ✅ Cria tabela `payments` (pagamentos)
- ✅ Cria tabela `tenant_usage` (métricas de uso)
- ✅ Cria tabela `audit_logs` (logs de auditoria)
- ✅ Cria tabela `schema_migrations` (controle)

**Impacto:** Nenhum dado existente é afetado

---

### Migration 002: Adicionar tenant_id nas Tabelas
**Arquivo:** `002_add_tenant_id_to_tables.sql`  
**O que faz:**
- ✅ Adiciona coluna `tenant_id` em **TODAS** as tabelas existentes:
  - `whatsapp_accounts`
  - `campaigns`
  - `qr_campaigns`
  - `templates`
  - `qr_templates`
  - `contacts`
  - `messages`
  - `base_dados_completa`
  - `novavida_consultas`
  - `novavida_jobs`
  - `lista_restricao`
  - `webhook_logs`
  - ... todas as outras tabelas

**Impacto:** Adiciona coluna vazia, dados não são alterados

---

### Migration 003: Popular Tenant Padrão
**Arquivo:** `003_populate_default_tenant.sql`  
**O que faz:**
- ✅ Cria **Tenant 1** (seus dados atuais)
- ✅ Atribui `tenant_id = 1` em **TODOS** os dados existentes
- ✅ Cria usuário admin padrão
- ✅ Cria assinatura inicial

**⭐ IMPORTANTE:** Esta migration **PRESERVA TODOS OS SEUS DADOS**!

**Credenciais criadas:**
- Email: `admin@minhaempresa.com`
- Senha: `admin123`
- **⚠️ ALTERE A SENHA APÓS O PRIMEIRO LOGIN!**

---

### Migration 004: Criar Índices
**Arquivo:** `004_create_indexes.sql`  
**O que faz:**
- ✅ Cria índices otimizados para `tenant_id`
- ✅ Melhora performance das queries multi-tenant

**Impacto:** Apenas melhora performance, dados não são alterados

---

### Migration 005: Habilitar Row Level Security
**Arquivo:** `005_enable_rls.sql`  
**O que faz:**
- ✅ Habilita Row Level Security (RLS) em todas as tabelas
- ✅ Cria políticas de isolamento automático
- ✅ Garante que cada tenant vê apenas seus dados

**🔒 SEGURANÇA:** Mesmo com bug no código, dados não vazam!

---

## 🚀 COMO APLICAR AS MIGRATIONS

### Opção 1: Script Automático (Recomendado)

#### Windows:
```batch
# 1. Fazer backup
cd backend
.\scripts\backup-before-migration.bat

# 2. Aplicar migrations
node src\scripts\apply-multi-tenant-migration.js
```

#### Linux/Mac:
```bash
# 1. Fazer backup
cd backend
chmod +x scripts/backup-before-migration.sh
./scripts/backup-before-migration.sh

# 2. Aplicar migrations
node src/scripts/apply-multi-tenant-migration.js
```

---

### Opção 2: Manual (Mais Controle)

#### 1. Fazer Backup
```bash
# Windows
.\scripts\backup-before-migration.bat

# Linux/Mac
./scripts/backup-before-migration.sh
```

#### 2. Aplicar cada migration manualmente

**Windows (PowerShell):**
```powershell
$env:PGPASSWORD = "sua_senha"

psql -h localhost -U postgres -d whatsapp_dispatcher -f "src/database/migrations/multi-tenant/001_create_control_tables.sql"

psql -h localhost -U postgres -d whatsapp_dispatcher -f "src/database/migrations/multi-tenant/002_add_tenant_id_to_tables.sql"

psql -h localhost -U postgres -d whatsapp_dispatcher -f "src/database/migrations/multi-tenant/003_populate_default_tenant.sql"

psql -h localhost -U postgres -d whatsapp_dispatcher -f "src/database/migrations/multi-tenant/004_create_indexes.sql"

psql -h localhost -U postgres -d whatsapp_dispatcher -f "src/database/migrations/multi-tenant/005_enable_rls.sql"
```

**Linux/Mac:**
```bash
export PGPASSWORD=sua_senha

psql -h localhost -U postgres -d whatsapp_dispatcher -f src/database/migrations/multi-tenant/001_create_control_tables.sql

psql -h localhost -U postgres -d whatsapp_dispatcher -f src/database/migrations/multi-tenant/002_add_tenant_id_to_tables.sql

psql -h localhost -U postgres -d whatsapp_dispatcher -f src/database/migrations/multi-tenant/003_populate_default_tenant.sql

psql -h localhost -U postgres -d whatsapp_dispatcher -f src/database/migrations/multi-tenant/004_create_indexes.sql

psql -h localhost -U postgres -d whatsapp_dispatcher -f src/database/migrations/multi-tenant/005_enable_rls.sql
```

---

## ✅ VERIFICAR SE DEU CERTO

Após aplicar as migrations, execute estas queries para verificar:

```sql
-- 1. Verificar se tenant foi criado
SELECT * FROM tenants WHERE id = 1;

-- 2. Verificar se usuário foi criado
SELECT * FROM tenant_users WHERE tenant_id = 1;

-- 3. Verificar se dados foram atribuídos ao tenant 1
SELECT COUNT(*) FROM whatsapp_accounts WHERE tenant_id = 1;
SELECT COUNT(*) FROM campaigns WHERE tenant_id = 1;
SELECT COUNT(*) FROM contacts WHERE tenant_id = 1;
SELECT COUNT(*) FROM templates WHERE tenant_id = 1;

-- 4. Verificar se RLS está habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('campaigns', 'contacts', 'templates');
-- Resultado esperado: rowsecurity = true

-- 5. Verificar migrations aplicadas
SELECT * FROM schema_migrations ORDER BY version;
-- Deve mostrar versões 1, 2, 3, 4, 5
```

Se todos os resultados estiverem corretos, **a Fase 1 está concluída!** ✅

---

## 🔄 ROLLBACK (Se necessário)

Se algo der errado, você pode restaurar o backup:

**Windows:**
```batch
psql -h localhost -U postgres -d whatsapp_dispatcher < backups\backup_before_multi_tenant_XXXXX.sql
```

**Linux/Mac:**
```bash
psql -h localhost -U postgres -d whatsapp_dispatcher < backups/backup_before_multi_tenant_XXXXX.sql
```

Substitua `XXXXX` pelo timestamp do seu backup.

---

## 📊 O QUE ACONTECEU COM MEUS DADOS?

### ✅ ANTES DA MIGRATION:
```
Banco: whatsapp_dispatcher
├─ templates (15 registros)
├─ whatsapp_accounts (3 registros)
├─ campaigns (50 registros)
├─ contacts (10.000 registros)
└─ ...
```

### ✅ DEPOIS DA MIGRATION:
```
Banco: whatsapp_dispatcher
├─ tenants (1 registro) ← NOVO
│  └─ ID 1: "Minha Empresa"
│
├─ tenant_users (1 registro) ← NOVO
│  └─ admin@minhaempresa.com
│
├─ templates (15 registros, todos com tenant_id=1) ← PRESERVADOS
├─ whatsapp_accounts (3 registros, todos com tenant_id=1) ← PRESERVADOS
├─ campaigns (50 registros, todos com tenant_id=1) ← PRESERVADOS
├─ contacts (10.000 registros, todos com tenant_id=1) ← PRESERVADOS
└─ ...
```

**🎯 RESULTADO:** Nada foi perdido! Tudo foi preservado e atribuído ao Tenant 1!

---

## 🚨 PROBLEMAS COMUNS

### Erro: "relation does not exist"
**Causa:** Alguma tabela não existe no seu banco  
**Solução:** É normal, a migration pula tabelas que não existem

### Erro: "permission denied"
**Causa:** Usuário do banco não tem permissões  
**Solução:** Use um usuário com permissões de admin

### Erro: "duplicate key value violates unique constraint"
**Causa:** Migration já foi aplicada antes  
**Solução:** Verifique `schema_migrations` para ver quais já foram aplicadas

### Erro: "psql: command not found"
**Causa:** PostgreSQL não está no PATH  
**Solução:** 
- **Windows:** Adicione `C:\Program Files\PostgreSQL\XX\bin` ao PATH
- **Linux:** `sudo apt install postgresql-client`
- **Mac:** `brew install postgresql`

---

## 📞 SUPORTE

Se encontrar problemas:
1. ✅ Verifique os logs do PostgreSQL
2. ✅ Consulte o arquivo `MULTI-TENANT-IMPLEMENTATION.md` na raiz do projeto
3. ✅ Verifique se o backup foi criado antes de restaurar

---

## 📈 PRÓXIMOS PASSOS

Após aplicar com sucesso:
1. ✅ **Fase 1 concluída** (Banco de dados)
2. ⏳ **Fase 2:** Sistema de autenticação e middleware
3. ⏳ **Fase 3:** Atualizar controllers do backend
4. ⏳ **Fase 4:** Implementar frontend
5. ⏳ **Fase 5:** Testes finais

Acompanhe o progresso no arquivo `MULTI-TENANT-IMPLEMENTATION.md`!

---

**Última atualização:** 20/11/2024





