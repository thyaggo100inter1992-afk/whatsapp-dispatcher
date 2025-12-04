const express = require('express');
const router = express.Router();
const { pool } = require('../database/connection');

// ============================================
// LISTAR TODOS OS CPFs BLOQUEADOS
// ============================================
router.get('/', async (req, res) => {
  try {
    console.log('📋 Buscando lista de restrição...');
    
    // 🔒 SEGURANÇA: Filtrar por tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }
    
    const result = await pool.query(
      `SELECT id, cpf, data_adicao 
       FROM lista_restricao 
       WHERE ativo = true AND tenant_id = $1
       ORDER BY data_adicao DESC`,
      [tenantId]
    );
    
    console.log(`✅ ${result.rows.length} CPFs bloqueados encontrados`);
    
    res.json({
      cpfs: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('❌ Erro ao buscar lista de restrição:', error);
    res.status(500).json({ error: 'Erro ao buscar lista de restrição' });
  }
});

// ============================================
// VERIFICAR SE UM CPF ESTÁ BLOQUEADO
// ============================================
router.post('/verificar', async (req, res) => {
  try {
    const { cpf } = req.body;
    
    if (!cpf) {
      return res.status(400).json({ error: 'CPF é obrigatório' });
    }
    
    // 🔒 SEGURANÇA: Filtrar por tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }
    
    // Remover formatação
    const cpfLimpo = String(cpf).replace(/\D/g, '');
    
    const result = await pool.query(
      `SELECT id, cpf, data_adicao 
       FROM lista_restricao 
       WHERE cpf = $1 AND ativo = true AND tenant_id = $2`,
      [cpfLimpo, tenantId]
    );
    
    const bloqueado = result.rows.length > 0;
    
    if (bloqueado) {
      console.log(`🚫 CPF ${cpfLimpo} está na lista de restrição`);
    }
    
    res.json({
      bloqueado,
      cpf: cpfLimpo,
      dados: bloqueado ? result.rows[0] : null
    });
  } catch (error) {
    console.error('❌ Erro ao verificar CPF:', error);
    res.status(500).json({ error: 'Erro ao verificar CPF' });
  }
});

// ============================================
// VERIFICAR MÚLTIPLOS CPFs DE UMA VEZ
// ============================================
router.post('/verificar-lista', async (req, res) => {
  try {
    const { cpfs } = req.body;
    
    // 🔒 SEGURANÇA: Obter tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant não identificado' });
    }
    
    if (!cpfs || !Array.isArray(cpfs) || cpfs.length === 0) {
      return res.status(400).json({ error: 'Lista de CPFs é obrigatória' });
    }
    
    // Limpar CPFs
    const cpfsLimpos = cpfs.map(cpf => String(cpf).replace(/\D/g, ''));
    
    // Criar placeholders: $1, $2, ... para os CPFs, e o último para tenant_id
    const placeholders = cpfsLimpos.map((_, i) => `$${i + 1}`).join(',');
    const tenantParam = cpfsLimpos.length + 1;
    
    const result = await pool.query(
      `SELECT cpf FROM lista_restricao 
       WHERE cpf IN (${placeholders}) AND ativo = true AND tenant_id = $${tenantParam}`,
      [...cpfsLimpos, tenantId]
    );
    
    const bloqueados = result.rows.map(row => row.cpf);
    const permitidos = cpfsLimpos.filter(cpf => !bloqueados.includes(cpf));
    
    console.log(`🔍 Verificação de lista: ${bloqueados.length} bloqueados, ${permitidos.length} permitidos (tenant ${tenantId})`);
    
    res.json({
      bloqueados,
      permitidos,
      totalBloqueados: bloqueados.length,
      totalPermitidos: permitidos.length
    });
  } catch (error) {
    console.error('❌ Erro ao verificar lista de CPFs:', error);
    res.status(500).json({ error: 'Erro ao verificar lista de CPFs' });
  }
});

// ============================================
// ADICIONAR CPF À LISTA DE RESTRIÇÃO
// ============================================
router.post('/', async (req, res) => {
  try {
    const { cpf } = req.body;
    
    // 🔒 SEGURANÇA: Obter tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant não identificado' });
    }
    
    if (!cpf) {
      return res.status(400).json({ error: 'CPF é obrigatório' });
    }
    
    // Remover formatação
    const cpfLimpo = String(cpf).replace(/\D/g, '');
    
    // Validar tamanho
    if (cpfLimpo.length !== 11 && cpfLimpo.length !== 14) {
      return res.status(400).json({ error: 'CPF/CNPJ inválido' });
    }
    
    // Verificar se já existe ATIVO para ESTE TENANT
    const existeAtivo = await pool.query(
      'SELECT id FROM lista_restricao WHERE cpf = $1 AND ativo = true AND tenant_id = $2',
      [cpfLimpo, tenantId]
    );
    
    if (existeAtivo.rows.length > 0) {
      return res.status(400).json({ error: 'CPF já está na lista de restrição' });
    }
    
    // Verificar se existe INATIVO para ESTE TENANT (para reativar)
    const existeInativo = await pool.query(
      'SELECT id FROM lista_restricao WHERE cpf = $1 AND ativo = false AND tenant_id = $2',
      [cpfLimpo, tenantId]
    );
    
    let result;
    
    if (existeInativo.rows.length > 0) {
      // REATIVAR CPF que estava inativo
      result = await pool.query(
        `UPDATE lista_restricao 
         SET ativo = true, data_adicao = NOW() 
         WHERE cpf = $1 AND tenant_id = $2
         RETURNING id, cpf, data_adicao`,
        [cpfLimpo, tenantId]
      );
      console.log(`♻️ CPF ${cpfLimpo} reativado na lista de restrição (tenant ${tenantId})`);
    } else {
      // INSERIR novo CPF COM tenant_id
      result = await pool.query(
        `INSERT INTO lista_restricao (cpf, tenant_id) 
         VALUES ($1, $2) 
         RETURNING id, cpf, data_adicao`,
        [cpfLimpo, tenantId]
      );
      console.log(`✅ CPF ${cpfLimpo} adicionado à lista de restrição (tenant ${tenantId})`);
    }
    
    res.json({
      message: 'CPF adicionado à lista de restrição',
      cpf: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao adicionar CPF:', error);
    res.status(500).json({ error: 'Erro ao adicionar CPF à lista de restrição' });
  }
});

// ============================================
// ADICIONAR MÚLTIPLOS CPFs (UPLOAD)
// ============================================
router.post('/adicionar-lista', async (req, res) => {
  try {
    const { cpfs } = req.body;
    
    // 🔒 SEGURANÇA: Obter tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant não identificado' });
    }
    
    if (!cpfs || !Array.isArray(cpfs) || cpfs.length === 0) {
      return res.status(400).json({ error: 'Lista de CPFs é obrigatória' });
    }
    
    console.log(`📥 Recebidos ${cpfs.length} CPFs para adicionar (tenant ${tenantId})`);
    
    // Limpar e validar CPFs
    const cpfsLimpos = cpfs
      .map(cpf => String(cpf).replace(/\D/g, ''))
      .filter(cpf => cpf.length === 11 || cpf.length === 14);
    
    console.log(`✅ ${cpfsLimpos.length} CPFs válidos`);
    
    let adicionados = 0;
    let jaExistentes = 0;
    let erros = 0;
    
    for (const cpf of cpfsLimpos) {
      try {
        // Verificar se já existe para ESTE TENANT
        const existe = await pool.query(
          'SELECT id FROM lista_restricao WHERE cpf = $1 AND ativo = true AND tenant_id = $2',
          [cpf, tenantId]
        );
        
        if (existe.rows.length > 0) {
          jaExistentes++;
          continue;
        }
        
        // Inserir COM tenant_id
        await pool.query(
          'INSERT INTO lista_restricao (cpf, tenant_id) VALUES ($1, $2)',
          [cpf, tenantId]
        );
        
        adicionados++;
        console.log(`  ✅ [${adicionados}/${cpfsLimpos.length}] CPF ${cpf} adicionado`);
      } catch (error) {
        erros++;
        console.error(`  ❌ Erro ao adicionar CPF ${cpf}:`, error);
      }
    }
    
    console.log(`\n📊 Resumo:`);
    console.log(`  ✅ Adicionados: ${adicionados}`);
    console.log(`  ⚠️  Já existentes: ${jaExistentes}`);
    console.log(`  ❌ Erros: ${erros}`);
    
    res.json({
      message: 'Processamento concluído',
      adicionados,
      jaExistentes,
      erros,
      total: cpfsLimpos.length
    });
  } catch (error) {
    console.error('❌ Erro ao adicionar lista de CPFs:', error);
    res.status(500).json({ error: 'Erro ao adicionar lista de CPFs' });
  }
});

// ============================================
// REMOVER CPF DA LISTA DE RESTRIÇÃO
// ============================================
router.delete('/:cpf', async (req, res) => {
  try {
    const { cpf } = req.params;
    
    // 🔒 SEGURANÇA: Obter tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant não identificado' });
    }
    
    if (!cpf) {
      return res.status(400).json({ error: 'CPF é obrigatório' });
    }
    
    // Remover formatação
    const cpfLimpo = String(cpf).replace(/\D/g, '');
    
    const result = await pool.query(
      `UPDATE lista_restricao 
       SET ativo = false 
       WHERE cpf = $1 AND ativo = true AND tenant_id = $2
       RETURNING id`,
      [cpfLimpo, tenantId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'CPF não encontrado na lista de restrição' });
    }
    
    console.log(`✅ CPF ${cpfLimpo} removido da lista de restrição (tenant ${tenantId})`);
    
    res.json({
      message: 'CPF removido da lista de restrição',
      cpf: cpfLimpo
    });
  } catch (error) {
    console.error('❌ Erro ao remover CPF:', error);
    res.status(500).json({ error: 'Erro ao remover CPF da lista de restrição' });
  }
});

// ============================================
// LIMPAR TODA A LISTA DE RESTRIÇÃO
// ============================================
router.delete('/', async (req, res) => {
  try {
    // 🔒 SEGURANÇA: Obter tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant não identificado' });
    }
    
    console.log(`🗑️  Limpando toda a lista de restrição do tenant ${tenantId}...`);
    
    const result = await pool.query(
      `UPDATE lista_restricao 
       SET ativo = false 
       WHERE ativo = true AND tenant_id = $1
       RETURNING id`,
      [tenantId]
    );
    
    console.log(`✅ ${result.rows.length} CPFs removidos da lista (tenant ${tenantId})`);
    
    res.json({
      message: 'Lista de restrição limpa com sucesso',
      total: result.rows.length
    });
  } catch (error) {
    console.error('❌ Erro ao limpar lista:', error);
    res.status(500).json({ error: 'Erro ao limpar lista de restrição' });
  }
});

module.exports = router;


