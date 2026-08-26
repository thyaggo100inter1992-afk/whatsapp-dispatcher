/**
 * API Pública - Lista de Restrição
 * Autenticação: token do tenant (nsk_...) OU email + senha (compatibilidade).
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../../database/connection');
const { autenticarApiPublica } = require('../../helpers/public-api-auth.helper');

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
 *   token    (recomendado) - Token do tenant (nsk_...). Também aceita header X-Api-Key
 *   email    (alternativo) - Email de login, se não enviar token
 *   senha    (alternativo) - Senha de login, se não enviar token
 *   telefone (obrigatório) - Número do telefone (ex: 5511999999999)
 *   lista    (obrigatório) - nao_me_perturbe | bloqueado | sem_interesse | sem_whatsapp
 *   nome     (opcional)    - Nome do contato
 *   cpf      (opcional)    - CPF do contato
 */
router.post('/add', async (req, res) => {
  try {
    const { telefone, lista, nome, cpf } = req.body;

    const auth = await autenticarApiPublica(req);
    if (auth.erro) {
      return res.status(auth.erro.status).json({
        sucesso: false,
        mensagem: auth.erro.mensagem,
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

    const tenantId = auth.tenantId;
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
 * POST /api/public/restriction-list/remover
 * Remove um telefone de uma lista de restrição específica (ou de todas as listas)
 *
 * Body:
 *   token    (recomendado) - Token do tenant
 *   email    (alternativo)
 *   senha    (alternativo)
 *   telefone (obrigatório) - Número do telefone
 *   lista    (opcional)    - Lista específica para remover. Se omitido, remove de TODAS as listas
 */
router.post('/remover', async (req, res) => {
  try {
    const { telefone, lista } = req.body;

    const auth = await autenticarApiPublica(req);
    if (auth.erro) {
      return res.status(auth.erro.status).json({ sucesso: false, mensagem: auth.erro.mensagem });
    }

    if (!telefone) {
      return res.status(400).json({ sucesso: false, mensagem: 'O campo telefone é obrigatório' });
    }
    if (lista && !LISTAS_VALIDAS[lista]) {
      return res.status(400).json({
        sucesso: false,
        mensagem: `Lista inválida: "${lista}". Use: nao_me_perturbe, bloqueado, sem_interesse ou sem_whatsapp`,
      });
    }

    const tenantId = auth.tenantId;

    // ── Normalizar telefone e gerar variações ──────────────────────────────
    const telefoneNormalizado = normalizarTelefone(telefone);
    const telefoneAlternativo = gerarNumeroAlternativo(telefoneNormalizado);

    const numerosParaRemover = [telefoneNormalizado];
    if (telefoneAlternativo && telefoneAlternativo !== telefoneNormalizado) {
      numerosParaRemover.push(telefoneAlternativo);
    }

    // ── Remover registros ──────────────────────────────────────────────────
    let resultado;

    if (lista) {
      // Remover de uma lista específica
      const listType = LISTAS_VALIDAS[lista];
      resultado = await pool.query(
        `DELETE FROM restriction_list_entries
         WHERE tenant_id = $1
           AND list_type = $2
           AND phone_number = ANY($3::text[])
         RETURNING id, phone_number, list_type`,
        [tenantId, listType, numerosParaRemover]
      );
    } else {
      // Remover de TODAS as listas
      resultado = await pool.query(
        `DELETE FROM restriction_list_entries
         WHERE tenant_id = $1
           AND phone_number = ANY($2::text[])
         RETURNING id, phone_number, list_type`,
        [tenantId, numerosParaRemover]
      );
    }

    if (resultado.rowCount === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: lista
          ? `Telefone não encontrado na lista "${NOMES_LISTAS[lista]}"`
          : 'Telefone não encontrado em nenhuma lista de restrição',
      });
    }

    // Montar resumo das listas onde foi removido
    const LIST_NOME_PT = {
      do_not_disturb: 'Não Me Perturbe',
      blocked: 'Bloqueado',
      not_interested: 'Sem Interesse',
      no_whatsapp: 'Sem WhatsApp',
    };

    const listasRemovidas = [...new Set(resultado.rows.map(r => LIST_NOME_PT[r.list_type] || r.list_type))];

    return res.json({
      sucesso: true,
      mensagem: `Telefone removido com sucesso`,
      registros_removidos: resultado.rowCount,
      listas_removidas: listasRemovidas,
      telefone: telefoneNormalizado,
    });

  } catch (erro) {
    console.error('❌ Erro na remoção pública de lista de restrição:', erro);
    return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor.' });
  }
});

/**
 * POST /api/public/restriction-list/consultar
 * Consulta se um ou mais telefones estão em alguma lista de restrição
 *
 * Body:
 *   token     (recomendado) - Token do tenant
 *   email     (alternativo)
 *   senha     (alternativo)
 *   telefone  (obrigatório) - Número único OU array de números
 *             Ex: "5511999999999" ou ["5511999999999", "5521888888888"]
 */
router.post('/consultar', async (req, res) => {
  try {
    const { telefone } = req.body;

    const auth = await autenticarApiPublica(req);
    if (auth.erro) {
      return res.status(auth.erro.status).json({
        sucesso: false,
        mensagem: auth.erro.mensagem,
      });
    }

    if (!telefone) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'O campo telefone é obrigatório (pode ser um número ou uma lista)',
      });
    }

    const tenantId = auth.tenantId;

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
