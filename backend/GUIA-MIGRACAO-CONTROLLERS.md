# 📘 Guia de Migração: Controllers para Multi-Tenant

Este guia explica como atualizar seus controllers existentes para funcionar com o sistema multi-tenant.

---

## 🎯 Conceito Principal

**ANTES:** Queries pegavam TODOS os dados do banco
**DEPOIS:** Queries pegam apenas dados do tenant atual (automático via RLS)

---

## ✅ O QUE VOCÊ PRECISA FAZER

### 1. **Adicionar Middlewares nas Rotas**

**ANTES (sem autenticação):**
```javascript
// routes/campaigns.routes.js
router.get('/campaigns', campaignController.list);
router.post('/campaigns', campaignController.create);
```

**DEPOIS (com autenticação e tenant context):**
```javascript
// routes/campaigns.routes.js
const { authenticate } = require('../middleware/auth.middleware');
const { setTenantContext } = require('../middleware/tenant.middleware');

// Aplicar para todas as rotas
router.use(authenticate);
router.use(setTenantContext);

router.get('/campaigns', campaignController.list);
router.post('/campaigns', campaignController.create);
```

---

### 2. **Usar Cliente do Tenant nos Controllers**

**ANTES (pool direto):**
```javascript
const { Pool } = require('pg');
const pool = new Pool({ /* config */ });

async function list(req, res) {
  const result = await pool.query('SELECT * FROM campaigns');
  return res.json(result.rows);
}
```

**DEPOIS (com contexto do tenant):**
```javascript
const { queryWithTenant } = require('../middleware/tenant.middleware');

async function list(req, res) {
  // RLS aplica automaticamente o filtro tenant_id
  const result = await queryWithTenant(req, 'SELECT * FROM campaigns');
  return res.json(result.rows);
}
```

---

### 3. **Adicionar tenant_id em INSERT/UPDATE**

**ANTES:**
```javascript
async function create(req, res) {
  const { name, description } = req.body;
  
  const result = await pool.query(
    'INSERT INTO campaigns (name, description) VALUES ($1, $2) RETURNING *',
    [name, description]
  );
  
  return res.json(result.rows[0]);
}
```

**DEPOIS (tenant_id adicionado automaticamente):**
```javascript
const { queryWithTenant, addTenantToQuery } = require('../middleware/tenant.middleware');

async function create(req, res) {
  const { name, description } = req.body;
  
  // Adicionar tenant_id automaticamente
  const data = addTenantToQuery(req, { name, description });
  
  const result = await queryWithTenant(
    req,
    'INSERT INTO campaigns (name, description, tenant_id) VALUES ($1, $2, $3) RETURNING *',
    [data.name, data.description, data.tenant_id]
  );
  
  return res.json(result.rows[0]);
}
```

**OU MAIS SIMPLES (RLS faz isso automaticamente):**
```javascript
async function create(req, res) {
  const { name, description } = req.body;
  
  // RLS adiciona tenant_id automaticamente via função set_current_tenant()
  const result = await queryWithTenant(
    req,
    'INSERT INTO campaigns (name, description, tenant_id) VALUES ($1, $2, $3) RETURNING *',
    [name, description, req.tenant.id]
  );
  
  return res.json(result.rows[0]);
}
```

---

## 📦 Exemplo Completo: Campaign Controller

### ANTES (sem multi-tenant):
```javascript
const { Pool } = require('pg');
const pool = new Pool({ /* config */ });

class CampaignController {
  async list(req, res) {
    const result = await pool.query('SELECT * FROM campaigns');
    return res.json(result.rows);
  }

  async create(req, res) {
    const { name, description } = req.body;
    const result = await pool.query(
      'INSERT INTO campaigns (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    return res.json(result.rows[0]);
  }

  async update(req, res) {
    const { id } = req.params;
    const { name, description } = req.body;
    
    const result = await pool.query(
      'UPDATE campaigns SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [name, description, id]
    );
    
    return res.json(result.rows[0]);
  }

  async delete(req, res) {
    const { id } = req.params;
    await pool.query('DELETE FROM campaigns WHERE id = $1', [id]);
    return res.json({ success: true });
  }
}

module.exports = new CampaignController();
```

### DEPOIS (com multi-tenant):
```javascript
const { queryWithTenant } = require('../middleware/tenant.middleware');

class CampaignController {
  async list(req, res) {
    try {
      // RLS filtra automaticamente pelo tenant_id
      const result = await queryWithTenant(
        req,
        'SELECT * FROM campaigns ORDER BY created_at DESC'
      );
      
      return res.json({
        success: true,
        data: result.rows,
        total: result.rows.length
      });
    } catch (error) {
      console.error('Erro ao listar campanhas:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao listar campanhas'
      });
    }
  }

  async create(req, res) {
    try {
      const { name, description } = req.body;
      
      // tenant_id é pego de req.tenant (do middleware)
      const result = await queryWithTenant(
        req,
        `INSERT INTO campaigns (name, description, tenant_id) 
         VALUES ($1, $2, $3) 
         RETURNING *`,
        [name, description, req.tenant.id]
      );
      
      return res.status(201).json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Erro ao criar campanha:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao criar campanha'
      });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      
      // RLS garante que só atualiza se pertence ao tenant
      const result = await queryWithTenant(
        req,
        `UPDATE campaigns 
         SET name = $1, description = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [name, description, id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Campanha não encontrada'
        });
      }
      
      return res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Erro ao atualizar campanha:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao atualizar campanha'
      });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      
      // RLS garante que só deleta se pertence ao tenant
      const result = await queryWithTenant(
        req,
        'DELETE FROM campaigns WHERE id = $1 RETURNING id',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Campanha não encontrada'
        });
      }
      
      return res.json({
        success: true,
        message: 'Campanha deletada com sucesso'
      });
    } catch (error) {
      console.error('Erro ao deletar campanha:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao deletar campanha'
      });
    }
  }
}

module.exports = new CampaignController();
```

---

## 🔑 Acessar Dados do Usuário e Tenant

Dentro dos controllers, você tem acesso a:

```javascript
// Dados do usuário autenticado
req.user = {
  id: 1,
  nome: 'João Silva',
  email: 'joao@empresa.com',
  role: 'admin'
};

// Dados do tenant
req.tenant = {
  id: 1,
  nome: 'Minha Empresa',
  slug: 'minha-empresa',
  plano: 'enterprise'
};
```

**Exemplo de uso:**
```javascript
async function create(req, res) {
  const { name } = req.body;
  
  // Registrar quem criou
  const result = await queryWithTenant(
    req,
    `INSERT INTO campaigns (name, tenant_id, created_by) 
     VALUES ($1, $2, $3) RETURNING *`,
    [name, req.tenant.id, req.user.id]
  );
  
  return res.json(result.rows[0]);
}
```

---

## 🛡️ Segurança Automática com RLS

O **Row Level Security (RLS)** garante que:

✅ **SELECT:** Só retorna dados do tenant atual
✅ **INSERT:** Só permite inserir com tenant_id correto
✅ **UPDATE:** Só atualiza dados do tenant atual
✅ **DELETE:** Só deleta dados do tenant atual

**Você não precisa se preocupar!** O PostgreSQL faz isso automaticamente.

---

## ⚠️ IMPORTANTE: O que NÃO fazer

❌ **NÃO use pool.query() direto:**
```javascript
// ERRADO - RLS não será aplicado
const result = await pool.query('SELECT * FROM campaigns');
```

✅ **USE queryWithTenant():**
```javascript
// CORRETO - RLS aplicado automaticamente
const result = await queryWithTenant(req, 'SELECT * FROM campaigns');
```

---

## 🚀 Checklist de Migração

Para cada controller existente:

- [ ] Adicionar middlewares `authenticate` e `setTenantContext` nas rotas
- [ ] Substituir `pool.query()` por `queryWithTenant(req, ...)`
- [ ] Adicionar `tenant_id: req.tenant.id` em INSERT/UPDATE
- [ ] Usar `req.user` e `req.tenant` quando necessário
- [ ] Adicionar tratamento de erros adequado
- [ ] Testar que usuários de diferentes tenants não veem dados uns dos outros

---

## 📞 Próximo Passo

Agora você precisa:

1. **Atualizar cada controller** seguindo este guia
2. **Registrar as rotas** em `backend/src/routes/index.js`
3. **Testar** criando 2 tenants diferentes e verificando o isolamento

**Precisa de ajuda?** Me avise qual controller quer migrar primeiro!





