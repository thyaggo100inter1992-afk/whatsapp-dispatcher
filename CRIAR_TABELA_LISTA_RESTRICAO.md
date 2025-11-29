# 🔧 Criar Tabela: lista_restricao

## 🚨 Problema

Erro 500 ao adicionar CPF porque a tabela `lista_restricao` **não existe** no banco de dados.

---

## ✅ Solução: Criar a Tabela

### **Opção 1: Script Automático (Recomendado)**

Execute o arquivo:
```bash
criar_tabela_lista_restricao.bat
```

O script vai pedir:
- Host do banco (ex: `localhost`)
- Porta (ex: `5432`)
- Nome do banco (ex: `whatsapp_dispatcher`)
- Usuário (ex: `postgres`)
- Senha

---

### **Opção 2: Manual (Se o script não funcionar)**

#### **Passo 1: Abrir pgAdmin ou psql**

**pgAdmin:**
1. Abra o pgAdmin
2. Conecte ao servidor
3. Expanda: Databases > [seu banco] > Schemas > public
4. Clique com botão direito em "Tables" > Query Tool

**psql (Linha de Comando):**
```bash
psql -U postgres -d whatsapp_dispatcher
```

#### **Passo 2: Executar SQL**

Cole e execute este SQL:

```sql
-- CRIAR TABELA LISTA_RESTRICAO
CREATE TABLE IF NOT EXISTS lista_restricao (
  id SERIAL PRIMARY KEY,
  cpf VARCHAR(14) NOT NULL UNIQUE,
  motivo TEXT,
  ativo BOOLEAN DEFAULT true,
  data_adicao TIMESTAMP DEFAULT NOW(),
  adicionado_por VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lista_restricao_cpf ON lista_restricao(cpf);
CREATE INDEX IF NOT EXISTS idx_lista_restricao_ativo ON lista_restricao(ativo);

-- Comentários
COMMENT ON TABLE lista_restricao IS 'Lista de CPFs/CNPJs bloqueados para consulta de dados';
COMMENT ON COLUMN lista_restricao.cpf IS 'CPF ou CNPJ sem formatação (apenas números)';

-- Verificar
SELECT 'Tabela lista_restricao criada com sucesso!' as status;
```

#### **Passo 3: Verificar**

Execute para confirmar:
```sql
SELECT * FROM lista_restricao;
```

Deve retornar uma tabela vazia (0 linhas).

---

## 🎯 Estrutura da Tabela

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | SERIAL | ID único (auto-incremento) |
| `cpf` | VARCHAR(14) | CPF/CNPJ sem formatação (UNIQUE) |
| `motivo` | TEXT | Motivo do bloqueio (opcional) |
| `ativo` | BOOLEAN | Se está ativo (default: true) |
| `data_adicao` | TIMESTAMP | Data de criação (auto) |
| `adicionado_por` | VARCHAR(100) | Usuário que adicionou (opcional) |

---

## 🧪 Testar Após Criar

### **1. Adicionar um CPF de teste:**
```sql
INSERT INTO lista_restricao (cpf) VALUES ('12345678901');
```

### **2. Verificar:**
```sql
SELECT * FROM lista_restricao;
```

### **3. Remover o teste:**
```sql
DELETE FROM lista_restricao WHERE cpf = '12345678901';
```

---

## 🚀 Depois de Criar a Tabela

1. **Recarregue o navegador:** `F5` ou `Ctrl + Shift + R`
2. **Vá em:** Consultar Dados > Lista de Restrição
3. **Digite um CPF:** `03769336151`
4. **Clique em:** "Adicionar"
5. **Resultado esperado:** ✅ CPF adicionado à lista de restrição

---

## 🔍 Troubleshooting

### **Erro: "permission denied for table lista_restricao"**
**Solução:** Dar permissões ao usuário:
```sql
GRANT ALL PRIVILEGES ON TABLE lista_restricao TO seu_usuario;
GRANT USAGE, SELECT ON SEQUENCE lista_restricao_id_seq TO seu_usuario;
```

### **Erro: "relation lista_restricao already exists"**
**Solução:** A tabela já existe! Não precisa criar novamente.

### **Erro: "database does not exist"**
**Solução:** Verifique o nome do banco no arquivo `.env`:
```
DB_NAME=whatsapp_dispatcher
```

---

## 📊 Consultas Úteis

### **Ver todos os CPFs bloqueados:**
```sql
SELECT cpf, data_adicao FROM lista_restricao WHERE ativo = true ORDER BY data_adicao DESC;
```

### **Contar CPFs bloqueados:**
```sql
SELECT COUNT(*) as total FROM lista_restricao WHERE ativo = true;
```

### **Remover todos os CPFs (CUIDADO!):**
```sql
DELETE FROM lista_restricao;
```

### **Desativar um CPF (sem deletar):**
```sql
UPDATE lista_restricao SET ativo = false WHERE cpf = '12345678901';
```

---

## ✅ Arquivos Criados

1. **`backend/src/database/migrations/criar_tabela_lista_restricao.sql`**
   - Script SQL para criar a tabela

2. **`criar_tabela_lista_restricao.bat`**
   - Script Windows para executar automaticamente

3. **`CRIAR_TABELA_LISTA_RESTRICAO.md`** (este arquivo)
   - Documentação completa

---

## 🎉 Pronto!

Após criar a tabela, o sistema vai funcionar normalmente! 🚀





