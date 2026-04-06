/**
 * API Pública - Cadastro na Lista de Restrição
 * Permite que sistemas externos adicionem telefones na lista de restrição
 * autenticando com email e senha do usuário.
 */

const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const { pool } = require('../../database/connection');

// Mapeamento de nomes em português para os IDs internos das listas
const LISTAS_VALIDAS = {
  nao_me_perturbe: 'do_not_disturb',
  bloqueado: 'blocked',
  sem_interesse: 'not_interested',
  sem_whatsapp: 'no_whatsapp',
};

const NOMES_LISTAS = {
  nao_me_perturbe: 'Não Me Perturbe',
  bloqueado: 'Bloqueado',
  sem_interesse: 'Sem Interesse',
  sem_whatsapp: 'Sem WhatsApp',
};

/**
 * Normaliza número de telefone para o formato padrão do sistema
 * Remove tudo que não é dígito e garante DDI 55
 */
function normalizarTelefone(telefone) {
  const apenasDigitos = String(telefone).replace(/\D/g, '');

  if (apenasDigitos.startsWith('55') && apenasDigitos.length >= 12) {
    return apenasDigitos;
  }
  if (apenasDigitos.length >= 10) {
    return '55' + apenasDigitos;
  }
  return apenasDigitos;
}

/**
 * Gera a versão alternativa do número (com/sem 9º dígito)
 * Ex: 5511999999999 → 551199999999 (e vice-versa)
 */
function gerarNumeroAlternativo(telefone) {
  const digitos = String(telefone).replace(/\D/g, '');

  // Formato: 55 + DDD (2) + número
  if (digitos.length === 13) {
    // Tem 9 dígito → remover
    const ddd = digitos.substring(2, 4);
    const numero = digitos.substring(4);
    if (numero.startsWith('9')) {
      return '55' + ddd + numero.substring(1);
    }
  } else if (digitos.length === 12) {
    // Sem 9 dígito → adicionar
    const ddd = digitos.substring(2, 4);
    const numero = digitos.substring(4);
    return '55' + ddd + '9' + numero;
  }

  return null;
}

/**
 * POST /api/public/restriction-list/add
 * Adiciona um telefone na lista de restrição
 *
 * Body:
 *   email    (obrigatório) - Email de login
 *   senha    (obrigatório) - Senha de login
 *   telefone (obrigatório) - Número do telefone (ex: 5511999999999)
 *   lista    (obrigatório) - nao_me_perturbe | bloqueado | sem_interesse | sem_whatsapp
 *   nome     (opcional)    - Nome do contato
 *   cpf      (opcional)    - CPF do contato
 */
router.post('/add', async (req, res) => {
  try {
    const { email, senha, telefone, lista, nome, cpf } = req.body;

    // ── Validação dos campos obrigatórios ──────────────────────────────────
    if (!email || !senha) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Email e senha são obrigatórios',
      });
    }

    if (!telefone) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'O campo telefone é obrigatório',
      });
    }

    if (!lista) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'O campo lista é obrigatório. Use: nao_me_perturbe, bloqueado, sem_interesse ou sem_whatsapp',
      });
    }

    if (!LISTAS_VALIDAS[lista]) {
      return res.status(400).json({
        sucesso: false,
        mensagem: `Lista inválida: "${lista}". Use: nao_me_perturbe, bloqueado, sem_interesse ou sem_whatsapp`,
      });
    }

    // ── Autenticação do usuário ────────────────────────────────────────────
    const userResult = await pool.query(
      `SELECT
         u.id,
         u.tenant_id,
         u.nome,
         u.email,
         u.senha_hash,
         u.ativo,
         t.status as tenant_status,
         t.ativo as tenant_ativo
       FROM tenant_users u
       INNER JOIN tenants t ON t.id = u.tenant_id
       WHERE LOWER(u.email) = LOWER($1)`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        sucesso: false,
        mensagem: 'Email ou senha inválidos',
      });
    }

    const usuario = userResult.rows[0];

    // Verificar usuário ativo
    if (!usuario.ativo) {
      return res.status(403).json({
        sucesso: false,
        mensagem: 'Usuário inativo. Entre em contato com o administrador.',
      });
    }

    // Verificar tenant ativo
    if (!usuario.tenant_ativo) {
      return res.status(403).json({
        sucesso: false,
        mensagem: 'Conta suspensa. Entre em contato com o suporte.',
      });
    }

    // Verificar senha
    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaValida) {
      return res.status(401).json({
        sucesso: false,
        mensagem: 'Email ou senha inválidos',
      });
    }

    const tenantId = usuario.tenant_id;
    const listType = LISTAS_VALIDAS[lista];
    const nomeListaExibicao = NOMES_LISTAS[lista];

    // ── Normalizar telefone ────────────────────────────────────────────────
    const telefoneNormalizado = normalizarTelefone(telefone);
    const telefoneAlternativo = gerarNumeroAlternativo(telefoneNormalizado);

    if (telefoneNormalizado.length < 12) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Número de telefone inválido. Use o formato: 5511999999999',
      });
    }

    // ── Preencher campos opcionais ─────────────────────────────────────────
    const nomeContato = nome && nome.trim() ? nome.trim() : telefoneNormalizado;
    const observacao = cpf && cpf.trim()
      ? `CPF: ${cpf.trim()}`
      : `Adicionado via API externa`;

    // ── Buscar configuração de retenção da lista ───────────────────────────
    const listTypeResult = await pool.query(
      `SELECT retention_days FROM restriction_list_types WHERE id = $1`,
      [listType]
    );

    const retentionDays = listTypeResult.rows[0]?.retention_days ?? null;
    let expiresAt = null;
    if (retentionDays !== null) {
      const agora = new Date();
      expiresAt = new Date(agora.getTime() + retentionDays * 24 * 60 * 60 * 1000);
    }

    // ── Inserir registros (versão principal + alternativa) ─────────────────
    const inseridos = [];

    const numerosParaInserir = [telefoneNormalizado];
    if (telefoneAlternativo && telefoneAlternativo !== telefoneNormalizado) {
      numerosParaInserir.push(telefoneAlternativo);
    }

    for (const numero of numerosParaInserir) {
      // Verificar se já existe (ativo)
      const existente = await pool.query(
        `SELECT id FROM restriction_list_entries
         WHERE tenant_id = $1
           AND list_type = $2
           AND phone_number = $3
           AND (expires_at IS NULL OR expires_at > NOW())`,
        [tenantId, listType, numero]
      );

      if (existente.rows.length > 0) {
        continue; // Já cadastrado, pular
      }

      const inserido = await pool.query(
        `INSERT INTO restriction_list_entries
           (tenant_id, list_type, whatsapp_account_id, phone_number, phone_number_alt,
            contact_name, added_method, notes, expires_at)
         VALUES ($1, $2, NULL, $3, NULL, $4, $5, $6, $7)
         RETURNING id`,
        [tenantId, listType, numero, nomeContato, 'api_externa', observacao, expiresAt]
      );

      inseridos.push(inserido.rows[0].id);
    }

    // ── Resposta ───────────────────────────────────────────────────────────
    if (inseridos.length === 0) {
      return res.status(409).json({
        sucesso: false,
        mensagem: `O telefone ${telefone} já está cadastrado na lista "${nomeListaExibicao}"`,
      });
    }

    return res.status(201).json({
      sucesso: true,
      mensagem: `Telefone adicionado com sucesso na lista "${nomeListaExibicao}"`,
      registros_criados: inseridos.length,
      lista: nomeListaExibicao,
      telefone: telefoneNormalizado,
    });

  } catch (erro) {
    console.error('❌ Erro na API pública de lista de restrição:', erro);
    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro interno do servidor. Tente novamente.',
    });
  }
});

/**
 * POST /api/public/restriction-list/consultar
 * Consulta se um ou mais telefones estão em alguma lista de restrição
 *
 * Body:
 *   email     (obrigatório) - Email de login
 *   senha     (obrigatório) - Senha de login
 *   telefone  (obrigatório) - Número único OU array de números
 *             Ex: "5511999999999" ou ["5511999999999", "5521888888888"]
 */
router.post('/consultar', async (req, res) => {
  try {
    const { email, senha, telefone } = req.body;

    // ── Validação ──────────────────────────────────────────────────────────
    if (!email || !senha) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Email e senha são obrigatórios',
      });
    }

    if (!telefone) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'O campo telefone é obrigatório (pode ser um número ou uma lista)',
      });
    }

    // ── Autenticação ───────────────────────────────────────────────────────
    const userResult = await pool.query(
      `SELECT u.id, u.tenant_id, u.senha_hash, u.ativo, t.ativo as tenant_ativo
       FROM tenant_users u
       INNER JOIN tenants t ON t.id = u.tenant_id
       WHERE LOWER(u.email) = LOWER($1)`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ sucesso: false, mensagem: 'Email ou senha inválidos' });
    }

    const usuario = userResult.rows[0];

    if (!usuario.ativo || !usuario.tenant_ativo) {
      return res.status(403).json({ sucesso: false, mensagem: 'Conta inativa ou suspensa' });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaValida) {
      return res.status(401).json({ sucesso: false, mensagem: 'Email ou senha inválidos' });
    }

    const tenantId = usuario.tenant_id;

    // ── Normalizar lista de telefones ──────────────────────────────────────
    const telefonesInput = Array.isArray(telefone) ? telefone : [telefone];

    // Para cada telefone, gerar versão principal + alternativa
    const todasVariacoes = [];
    const mapaVariacoes = {}; // variacao -> telefone original

    for (const tel of telefonesInput) {
      const principal = normalizarTelefone(tel);
      const alternativo = gerarNumeroAlternativo(principal);

      todasVariacoes.push(principal);
      mapaVariacoes[principal] = tel;

      if (alternativo && alternativo !== principal) {
        todasVariacoes.push(alternativo);
        mapaVariacoes[alternativo] = tel;
      }
    }

    // ── Buscar nas listas ──────────────────────────────────────────────────
    const resultado = await pool.query(
      `SELECT
         e.phone_number,
         e.list_type,
         e.contact_name,
         e.added_at,
         e.notes,
         t.name as nome_lista
       FROM restriction_list_entries e
       JOIN restriction_list_types t ON e.list_type = t.id
       WHERE e.tenant_id = $1
         AND e.phone_number = ANY($2::text[])
         AND (e.expires_at IS NULL OR e.expires_at > NOW())
       ORDER BY e.added_at DESC`,
      [tenantId, todasVariacoes]
    );

    // ── Mapeamento de list_type para portugues ─────────────────────────────
    const LIST_TYPE_PT = {
      do_not_disturb: 'nao_me_perturbe',
      blocked: 'bloqueado',
      not_interested: 'sem_interesse',
      no_whatsapp: 'sem_whatsapp',
    };

    const LIST_NOME_PT = {
      do_not_disturb: 'Não Me Perturbe',
      blocked: 'Bloqueado',
      not_interested: 'Sem Interesse',
      no_whatsapp: 'Sem WhatsApp',
    };

    // ── Montar resposta agrupada por telefone original ─────────────────────
    const agrupado = {};

    // Inicializar todos os telefones como "nao restrito"
    for (const tel of telefonesInput) {
      agrupado[tel] = {
        telefone: tel,
        restrito: false,
        listas: [],
      };
    }

    // Preencher com os encontrados
    for (const row of resultado.rows) {
      const telOriginal = mapaVariacoes[row.phone_number];
      if (!telOriginal) continue;

      agrupado[telOriginal].restrito = true;

      const listaJaAdicionada = agrupado[telOriginal].listas.find(
        l => l.codigo === LIST_TYPE_PT[row.list_type]
      );

      if (!listaJaAdicionada) {
        agrupado[telOriginal].listas.push({
          codigo: LIST_TYPE_PT[row.list_type] || row.list_type,
          nome: LIST_NOME_PT[row.list_type] || row.nome_lista,
          adicionado_em: row.added_at,
          nome_contato: row.contact_name || null,
          observacao: row.notes || null,
        });
      }
    }

    const resultados = Object.values(agrupado);
    const totalRestritos = resultados.filter(r => r.restrito).length;
    const totalLivres = resultados.filter(r => !r.restrito).length;

    return res.json({
      sucesso: true,
      total_consultados: resultados.length,
      total_restritos: totalRestritos,
      total_livres: totalLivres,
      resultados,
    });

  } catch (erro) {
    console.error('❌ Erro na consulta pública de lista de restrição:', erro);
    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro interno do servidor. Tente novamente.',
    });
  }
});

module.exports = router;
