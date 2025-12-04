const express = require('express');
const router = express.Router();
const { pool } = require('../database/connection');
const { tenantQuery } = require('../database/tenant-query');
const NovaVidaService = require('../services/novaVidaService');
const UazService = require('../services/uazService');
const { checkNovaVidaLimit } = require('../middlewares/tenant-limits.middleware');
const { checkNovaVida } = require('../middlewares/check-feature.middleware');

const novaVidaService = new NovaVidaService();

// Aplicar verificação de funcionalidade em TODAS as rotas Nova Vida
router.use(checkNovaVida);
// NÃO aplicar checkNovaVidaLimit aqui! Será aplicado apenas nas rotas de consulta

// Importar helper de credenciais UAZAP
const { getTenantUazapCredentials } = require('../helpers/uaz-credentials.helper');

// ============================================
// VERIFICAR SE CPF ESTÁ NA LISTA DE RESTRIÇÃO
// ============================================
async function verificarListaRestricao(cpf, tenantId) {
  try {
    const cpfLimpo = String(cpf).replace(/\D/g, '');
    
    // 🔒 SEGURANÇA: FILTRAR POR TENANT_ID (FIX VAZAMENTO DE DADOS)
    const result = await pool.query(
      'SELECT id FROM lista_restricao WHERE cpf = $1 AND ativo = true AND tenant_id = $2',
      [cpfLimpo, tenantId]
    );
    
    return result.rows.length > 0;
  } catch (error) {
    console.error('❌ Erro ao verificar lista de restrição:', error);
    return false; // Em caso de erro, permite a consulta (fail-open)
  }
}

// Função helper para normalizar o sexo
function normalizarSexo(sexo) {
  if (!sexo) return null;
  
  const sexoUpper = String(sexo).toUpperCase().trim();
  
  // Se já está normalizado (M ou F)
  if (sexoUpper === 'M' || sexoUpper === 'F') {
    return sexoUpper;
  }
  
  // Normalizar valores completos
  if (sexoUpper.includes('MASC')) return 'M';
  if (sexoUpper.includes('FEM')) return 'F';
  
  // Retornar o valor original se não conseguir normalizar
  return sexoUpper.substring(0, 20); // Limitar a 20 caracteres
}

// Função helper para normalizar datas (DD/MM/YYYY -> YYYY-MM-DD)
function normalizarData(data) {
  if (!data) return null;
  
  const dataStr = String(data).trim();
  
  // Se já está no formato ISO (YYYY-MM-DD), retorna como está
  if (/^\d{4}-\d{2}-\d{2}/.test(dataStr)) {
    return dataStr.split('T')[0]; // Remove timezone se tiver
  }
  
  // Se está no formato brasileiro (DD/MM/YYYY)
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataStr)) {
    const [dia, mes, ano] = dataStr.split('/');
    return `${ano}-${mes}-${dia}`;
  }
  
  // Se está no formato DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(dataStr)) {
    const [dia, mes, ano] = dataStr.split('-');
    return `${ano}-${mes}-${dia}`;
  }
  
  // Tentar converter como Date
  try {
    const dateObj = new Date(dataStr);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split('T')[0];
    }
  } catch (e) {
    console.log(`⚠️ Não foi possível converter data: ${dataStr}`);
  }
  
  return null; // Se não conseguir converter, retorna null
}

// Função helper para salvar na base de dados completa
// Função helper para fazer merge inteligente de arrays (adiciona apenas novos)
function mergeArraysNovaVida(existentes, novos, campoChave) {
  if (!Array.isArray(existentes)) existentes = [];
  if (!Array.isArray(novos)) novos = [];
  
  const resultado = [...existentes];
  
  novos.forEach((novo) => {
    // Verificar se já existe baseado no campo chave
    const jaExiste = existentes.some((existente) => {
      if (campoChave === 'telefone') {
        // Para telefones, comparar DDD + Telefone
        return existente.ddd === novo.ddd && existente.telefone === novo.telefone;
      } else if (campoChave === 'email') {
        // Para emails, comparar o email
        return existente.email === novo.email;
      } else if (campoChave === 'logradouro') {
        // Para endereços, comparar logradouro + número
        return existente.logradouro === novo.logradouro && existente.numero === novo.numero;
      }
      return false;
    });
    
    // Se não existe, adiciona
    if (!jaExiste) {
      resultado.push(novo);
    }
  });
  
  return resultado;
}

async function salvarNaBaseDados(tipo_origem, tipo_documento, documento, dados, tenantId) {
  try {
    console.log(`\n🔵 [salvarNaBaseDados] INICIANDO...`);
    console.log(`   📋 Documento: ${documento}`);
    console.log(`   🏢 Tenant ID: ${tenantId}`);
    console.log(`   📂 Tipo Origem: ${tipo_origem}`);
    console.log(`   📄 Tipo Documento: ${tipo_documento}`);
    
    if (!tenantId) {
      console.error('❌ tenant_id não fornecido para salvarNaBaseDados');
      return { success: false, error: 'tenant_id obrigatório' };
    }
    
    const telefones = [];
    const emails = [];
    const enderecos = [];

    // Processar telefones
    if (dados.TELEFONES && Array.isArray(dados.TELEFONES)) {
      dados.TELEFONES.forEach(tel => {
        telefones.push({
          ddd: tel.DDD,
          telefone: tel.TELEFONE,
          operadora: tel.OPERADORA,
          has_whatsapp: tel.HAS_WHATSAPP || false,
          verified_by: tel.VERIFIED_BY || null,
          procon: tel.PROCON || null
        });
      });
    }

    // Processar emails
    if (dados.EMAILS && Array.isArray(dados.EMAILS)) {
      dados.EMAILS.forEach(email => {
        emails.push({ email: email.EMAIL });
      });
    }

    // Processar endereços
    if (dados.ENDERECOS && Array.isArray(dados.ENDERECOS)) {
      dados.ENDERECOS.forEach(end => {
        enderecos.push({
          logradouro: end.LOGRADOURO,
          numero: end.NUMERO,
          complemento: end.COMPLEMENTO,
          bairro: end.BAIRRO,
          cidade: end.CIDADE,
          uf: end.UF,
          cep: end.CEP,
          area_risco: end.AREARISCO
        });
      });
    }

    // Extrair dados cadastrais
    const cad = dados.CADASTRAIS || dados;
    const nome = cad.NOME || cad.RAZAO_SOCIAL || cad.NOME_FANTASIA || '';

    console.log(`   📱 Telefones processados: ${telefones.length}`);
    console.log(`   📧 Emails processados: ${emails.length}`);
    console.log(`   📍 Endereços processados: ${enderecos.length}`);
    
    // Verificar se o documento já existe NESTE TENANT
    console.log(`   🔍 Verificando se documento já existe...`);
    const checkResult = await pool.query('SELECT * FROM base_dados_completa WHERE documento = $1 AND tenant_id = $2', [documento, tenantId]);
    console.log(`   📊 Resultado: ${checkResult.rows.length} registro(s) encontrado(s)`);
    
    if (checkResult.rows.length > 0) {
      // JÁ EXISTE - Fazer merge inteligente
      const existente = checkResult.rows[0];
      
      console.log(`🔄 CPF ${documento} já existe, fazendo merge inteligente...`);
      
      // MERGE: Adicionar apenas telefones novos
      const telefonesMerged = mergeArraysNovaVida(existente.telefones || [], telefones, 'telefone');
      console.log(`  📱 Telefones: ${existente.telefones?.length || 0} existentes + ${telefones.length} novos = ${telefonesMerged.length} total`);
      
      // MERGE: Adicionar apenas emails novos
      const emailsMerged = mergeArraysNovaVida(existente.emails || [], emails, 'email');
      console.log(`  📧 Emails: ${existente.emails?.length || 0} existentes + ${emails.length} novos = ${emailsMerged.length} total`);
      
      // MERGE: Adicionar apenas endereços novos
      const enderecosMerged = mergeArraysNovaVida(existente.enderecos || [], enderecos, 'logradouro');
      console.log(`  📍 Endereços: ${existente.enderecos?.length || 0} existentes + ${enderecos.length} novos = ${enderecosMerged.length} total`);
      
      // UPDATE mantendo nome original e fazendo merge dos arrays
      // IMPORTANTE: Marca consultado_nova_vida = true para receber a tag "NOVA VIDA"
      console.log(`   💾 Executando UPDATE...`);
      const updateResult = await pool.query(`
        UPDATE base_dados_completa 
        SET 
          telefones = $1,
          emails = $2,
          enderecos = $3,
          whatsapp_verificado = $4,
          data_verificacao_whatsapp = $5,
          consultado_nova_vida = true,
          data_atualizacao = NOW()
        WHERE documento = $6 AND tenant_id = $7
      `, [
        JSON.stringify(telefonesMerged),
        JSON.stringify(emailsMerged),
        JSON.stringify(enderecosMerged),
        telefonesMerged.some(t => t.has_whatsapp),
        telefonesMerged.some(t => t.has_whatsapp) ? new Date() : existente.data_verificacao_whatsapp,
        documento,
        tenantId
      ]);
      console.log(`   📊 Linhas afetadas: ${updateResult.rowCount}`);
      
      console.log(`💾 ✅ Atualizado (merge) na base de dados: ${documento}`);
      
    } else {
      // NÃO EXISTE - Inserir novo
      console.log(`➕ CPF ${documento} não existe, inserindo novo...`);
      console.log(`   👤 Nome: ${nome}`);
      
      console.log(`   💾 Executando INSERT...`);
      const insertResult = await pool.query(`
        INSERT INTO base_dados_completa (
          tenant_id, tipo_origem, tipo_documento, documento, nome, nome_mae,
          sexo, data_nascimento, renda, titulo,
          score_credito, score_digital, flag_obito, flag_fgts,
          razao_social, nome_fantasia, cnae, situacao_cnpj, capital_social, data_abertura,
          telefones, emails, enderecos,
          whatsapp_verificado, data_verificacao_whatsapp, consultado_nova_vida
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, true)
      `, [
        tenantId,
        tipo_origem,
        tipo_documento,
        documento,
        nome,
        cad.MAE || cad.NOME_MAE || null,
        normalizarSexo(cad.SEXO),
        normalizarData(cad.NASC), // Converter data de nascimento para formato ISO
        cad.RENDA || null,
        cad.TITULO || null,
        cad.SCORE_CREDITO || null,
        cad.SCORE_DIGITAL || null,
        cad.FLAG_DE_OBITO || cad.OBITO || false,
        cad.FLAG_FGTS || false,
        cad.RAZAO_SOCIAL || null,
        cad.NOME_FANTASIA || null,
        cad.CNAE || null,
        cad.SITUACAO || null,
        cad.CAPITAL_SOCIAL || null,
        normalizarData(cad.DATA_ABERTURA), // Converter data de abertura para formato ISO
        JSON.stringify(telefones),
        JSON.stringify(emails),
        JSON.stringify(enderecos),
        telefones.some(t => t.has_whatsapp),
        telefones.some(t => t.has_whatsapp) ? new Date() : null
      ]);
      console.log(`   📊 Linhas inseridas: ${insertResult.rowCount}`);
      
      console.log(`💾 ✅ Salvo na base de dados: ${documento}`);
    }

    console.log(`✅ [salvarNaBaseDados] SUCESSO!\n`);
    return { success: true };
  } catch (error) {
    console.error(`\n❌❌❌ [salvarNaBaseDados] ERRO CRÍTICO! ❌❌❌`);
    console.error(`   📋 Documento: ${documento}`);
    console.error(`   🏢 Tenant ID: ${tenantId}`);
    console.error(`   💥 Erro: ${error.message}`);
    console.error(`   📚 Stack:`, error.stack);
    console.error(`   💡 Execute: VERIFICAR-E-CRIAR-TABELA-BASE.bat\n`);
    // Não propagar o erro para não interromper o fluxo principal
    return { success: false, error: error.message };
  }
}

// ============================================
// CONSULTA ÚNICA
// ============================================

router.post('/consultar', checkNovaVidaLimit, async (req, res) => {
  try {
    const { documento, verificarWhatsapp = true, whatsappColumn = 'first' } = req.body;
    
    // Identificar o usuário a partir do token de autenticação
    const userIdentifier = req.user?.id ? String(req.user.id) : req.user?.email || req.user?.nome || 'system';
    
    console.log('👤 Usuário identificado:', {
      id: req.user?.id,
      nome: req.user?.nome,
      email: req.user?.email,
      userIdentifier
    });

    if (!documento) {
      return res.status(400).json({ error: 'Documento é obrigatório' });
    }

    // 🔒 OBTER TENANT_ID PARA FILTRAR LISTA DE RESTRIÇÃO
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({ 
        error: 'Tenant não identificado',
        message: 'Não foi possível identificar o tenant para verificar lista de restrição'
      });
    }

    // 🚫 VERIFICAR LISTA DE RESTRIÇÃO (COM FILTRO DE TENANT)
    const estaBloqueado = await verificarListaRestricao(documento, tenantId);
    if (estaBloqueado) {
      console.log(`🚫 CPF ${documento} está na Lista de Restrição do Tenant ${tenantId} - consulta bloqueada`);
      return res.status(403).json({ 
        error: 'CPF Lista de Restrição',
        bloqueado: true
      });
    }

    console.log(`📋 Nova consulta: ${documento}`);

    const resultado = await novaVidaService.consultarDocumento(documento);

    // Se a consulta foi bem-sucedida E verificarWhatsapp está ativo
    if (resultado.success && verificarWhatsapp && resultado.dados?.TELEFONES) {
      console.log(`📱 Verificando WhatsApp dos telefones (coluna: ${whatsappColumn})...`);
      
      try {
        // 🔑 BUSCAR CREDENCIAIS DO TENANT
        const credentials = await getTenantUazapCredentials(req.tenant?.id);
        const uazService = new UazService(credentials.serverUrl, credentials.adminToken);
        
        // 🔍 BUSCAR INSTÂNCIAS CONECTADAS DO BANCO LOCAL (igual à Consulta Única)
        // Usando os mesmos critérios: is_active = true AND status = 'connected'
        const tenantId = req.tenant?.id;
        const instanceResult = await pool.query(
          `SELECT id, instance_token, name FROM uaz_instances 
           WHERE tenant_id = $1 AND is_active = true AND status = 'connected' 
           ORDER BY id`,
          [tenantId]
        );
        let instances = instanceResult.rows;
        console.log(`📊 ${instances.length} instância(s) conectada(s) no banco local (tenant: ${tenantId})`);
        
        // Se não encontrou no banco local, tentar também com is_connected = true (fallback)
        if (instances.length === 0) {
          const fallbackResult = await pool.query(
            `SELECT id, instance_token, name FROM uaz_instances 
             WHERE tenant_id = $1 AND is_connected = true 
             ORDER BY id`,
            [tenantId]
          );
          instances = fallbackResult.rows;
          console.log(`📊 Fallback: ${instances.length} instância(s) com is_connected=true`);
        }
        
        if (instances.length > 0) {
          console.log(`🔄 ${instances.length} instância(s) ativa(s) para rotação`);
          
          // Extrair telefones do resultado
          const telefones = resultado.dados.TELEFONES || [];
          
          // Determinar quais telefones verificar baseado na escolha
          let telefonesToVerify = [];
          if (whatsappColumn === 'first' && telefones[0]) {
            telefonesToVerify = [telefones[0]];
          } else if (whatsappColumn === 'second' && telefones[1]) {
            telefonesToVerify = [telefones[1]];
          } else if (whatsappColumn === 'third' && telefones[2]) {
            telefonesToVerify = [telefones[2]];
          } else if (whatsappColumn === 'all') {
            telefonesToVerify = telefones;
          }
          
          console.log(`📱 Verificando ${telefonesToVerify.length} telefone(s)...`);
          
          // Verificar cada telefone usando rotação de instâncias (round-robin)
          let instanceIndex = 0;
          
          for (let telefone of telefonesToVerify) {
            if (telefone.DDD && telefone.TELEFONE) {
              const numeroCompleto = `55${telefone.DDD}${telefone.TELEFONE}`;
              
              // Selecionar instância em rotação
              const instance = instances[instanceIndex % instances.length];
              instanceIndex++;
              
              try {
                console.log(`🔍 [${instance.name}] Verificando: ${numeroCompleto}`);
                const checkResult = await uazService.checkNumber(instance.instance_token, numeroCompleto);
                
                // Adicionar informação de WhatsApp ao telefone
                telefone.HAS_WHATSAPP = checkResult?.data?.isInWhatsapp || false;
                telefone.WHATSAPP_VERIFIED = true;
                telefone.VERIFIED_BY = instance.name;
                
                console.log(`   ${telefone.HAS_WHATSAPP ? '✅' : '❌'} ${numeroCompleto} (via ${instance.name})`);
              } catch (whatsappError) {
                console.error(`   ⚠️ Erro ao verificar ${numeroCompleto}:`, whatsappError.message);
                telefone.HAS_WHATSAPP = false;
                telefone.WHATSAPP_VERIFIED = false;
              }
            }
          }
          
          console.log('✅ Verificação de WhatsApp concluída!');
        } else {
          console.log('⚠️ Nenhuma instância QR Connect ativa. Pulando verificação WhatsApp.');
        }
      } catch (whatsappError) {
        console.error('⚠️ Erro ao verificar WhatsApp:', whatsappError.message);
        // Não bloqueia a consulta se a verificação WhatsApp falhar
      }
    }

    // Salvar no histórico COM tenant_id
    if (resultado.success) {
      const tenantId = req.tenant?.id;
      const isConsultaAvulsa = req.isConsultaAvulsa || false; // Verificar se é consulta avulsa
      await pool.query(
        `INSERT INTO novavida_consultas (tipo_documento, documento, resultado, user_identifier, tenant_id, is_consulta_avulsa, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [resultado.tipo, resultado.documento, JSON.stringify(resultado.dados), userIdentifier || 'system', tenantId, isConsultaAvulsa]
      );

      // Salvar na base de dados completa
      console.log('💾 Salvando na base de dados completa...');
      const salvoResult = await salvarNaBaseDados('consulta_unica', resultado.tipo, resultado.documento, resultado.dados, tenantId);
      if (salvoResult && !salvoResult.success) {
        console.error('⚠️ A consulta foi realizada mas NÃO foi salva na base de dados!');
        console.error('⚠️ Erro:', salvoResult.error);
      }
    }

    res.json(resultado);
  } catch (error) {
    console.error('❌ Erro na consulta:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// OBTER LIMITE E CONTAGEM ATUAL
// ============================================

const getLimiteHandler = async (req, res) => {
  try {
    const tenantId = req.tenant?.id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    // Buscar APENAS limite MENSAL e consultas avulsas
    // NOTA: Limite diário foi REMOVIDO - só vale limite mensal + avulsas
    const result = await pool.query(`
      SELECT 
        COALESCE(t.limite_novavida_mes_customizado, p.limite_consultas_mes, -1) as limite_mes,
        COALESCE(t.consultas_avulsas_saldo, 0) as consultas_avulsas_saldo,
        COALESCE(t.consultas_avulsas_usadas, 0) as consultas_avulsas_usadas,
        (
          SELECT COUNT(*) FROM novavida_consultas
          WHERE tenant_id = t.id
          AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
          AND is_consulta_avulsa = FALSE
        ) as consultas_mes
      FROM tenants t
      LEFT JOIN plans p ON t.plan_id = p.id
      WHERE t.id = $1
    `, [tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant não encontrado'
      });
    }

    const { limite_mes, consultas_mes, consultas_avulsas_saldo, consultas_avulsas_usadas } = result.rows[0];

    res.json({
      success: true,
      // Limite diário REMOVIDO - sempre retorna -1 (ilimitado) para compatibilidade
      limite_dia: -1,
      consultas_hoje: 0,
      limite_dia_atingido: false,
      // Limite MENSAL é o único que vale agora
      limite_mes: parseInt(limite_mes),
      consultas_mes: parseInt(consultas_mes),
      limite_mes_atingido: parseInt(limite_mes) > 0 && parseInt(consultas_mes) >= parseInt(limite_mes),
      // Consultas avulsas (usadas quando acabar o mensal)
      consultas_avulsas_saldo: parseInt(consultas_avulsas_saldo),
      consultas_avulsas_usadas: parseInt(consultas_avulsas_usadas)
    });
  } catch (error) {
    console.error('❌ Erro ao buscar limite:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Rotas (singular e plural para compatibilidade)
router.get('/limite', getLimiteHandler);
router.get('/limites', getLimiteHandler);

// ============================================
// HISTÓRICO DE CONSULTAS
// ============================================

router.get('/historico', async (req, res) => {
  try {
    const { page = 1, limit = 50, userIdentifier } = req.query;
    const offset = (page - 1) * limit;

    // 🔒 SEGURANÇA: SEMPRE filtrar por tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }
    
    let query = `
      SELECT id, tipo_documento, documento, resultado, created_at
      FROM novavida_consultas
      WHERE tenant_id = $1
    `;
    const params = [tenantId];

    if (userIdentifier) {
      query += ` WHERE user_identifier = $1`;
      params.push(userIdentifier);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      consultas: result.rows,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('❌ Erro ao buscar histórico:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DETALHES DE UMA CONSULTA DO HISTÓRICO
// ============================================

router.get('/historico/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 🔒 SEGURANÇA: SEMPRE filtrar por tenant_id
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    const result = await pool.query(
      `SELECT * FROM novavida_consultas WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Consulta não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Erro ao buscar detalhes:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CRIAR JOB DE CONSULTA EM MASSA
// ============================================

router.post('/jobs', checkNovaVidaLimit, async (req, res) => {
  console.log(`\n🔥 ========================================`);
  console.log(`🔥 POST /novavida/jobs CHAMADO!`);
  console.log(`🔥 ========================================`);
  try {
    const { 
      documentos, 
      delaySeconds = 0,
      verifyWhatsapp = true,      // Nova opção
      whatsappDelay = 3            // Nova opção (3 segundos por padrão)
    } = req.body;
    
    console.log(`📦 Body recebido:`, {
      documentos: documentos?.length,
      delaySeconds,
      verifyWhatsapp,
      whatsappDelay
    });
    
    // Identificar o usuário a partir do token de autenticação
    const userIdentifier = req.user?.id ? String(req.user.id) : req.user?.email || req.user?.nome || 'system';
    
    console.log('👤 Job criado por usuário:', {
      id: req.user?.id,
      nome: req.user?.nome,
      email: req.user?.email,
      userIdentifier
    });

    if (!documentos || !Array.isArray(documentos) || documentos.length === 0) {
      return res.status(400).json({ error: 'Lista de documentos é obrigatória' });
    }

    // 🔧 SANITIZAR E CORRIGIR DOCUMENTOS (adicionar zeros à esquerda se necessário)
    const documentosSanitizados = documentos.map(doc => {
      // Remove espaços, pontos, traços, barras
      let limpo = String(doc).replace(/[\s.\-/]/g, '').trim();
      
      // Se tiver 10 dígitos, é CPF sem zero à esquerda → adiciona
      if (limpo.length === 10 && /^\d{10}$/.test(limpo)) {
        limpo = '0' + limpo;
        console.log(`🔧 CPF corrigido: ${doc} → ${limpo}`);
      }
      
      // Se tiver 13 dígitos, é CNPJ sem zero à esquerda → adiciona
      if (limpo.length === 13 && /^\d{13}$/.test(limpo)) {
        limpo = '0' + limpo;
        console.log(`🔧 CNPJ corrigido: ${doc} → ${limpo}`);
      }
      
      return limpo;
    });

    // 🔒 OBTER TENANT_ID PARA FILTRAR LISTA DE RESTRIÇÃO
    const tenantIdForRestriction = req.tenant?.id;
    if (!tenantIdForRestriction) {
      return res.status(401).json({ 
        error: 'Tenant não identificado',
        message: 'Não foi possível identificar o tenant para verificar lista de restrição'
      });
    }

    // 🚫 VERIFICAR LISTA DE RESTRIÇÃO (COM FILTRO DE TENANT)
    console.log(`🔍 Verificando lista de restrição para ${documentosSanitizados.length} documentos (Tenant ${tenantIdForRestriction})...`);
    const documentosBloqueados = [];
    const documentosPermitidos = [];
    
    for (const doc of documentosSanitizados) {
      const estaBloqueado = await verificarListaRestricao(doc, tenantIdForRestriction);
      if (estaBloqueado) {
        documentosBloqueados.push(doc);
      } else {
        documentosPermitidos.push(doc);
      }
    }
    
    if (documentosBloqueados.length > 0) {
      console.log(`🚫 ${documentosBloqueados.length} documento(s) bloqueado(s) removido(s) da lista`);
      console.log(`   CPFs bloqueados:`, documentosBloqueados);
    }
    
    if (documentosPermitidos.length === 0) {
      return res.status(403).json({ 
        error: 'Todos os CPFs estão na Lista de Restrição',
        bloqueados: documentosBloqueados,
        totalBloqueados: documentosBloqueados.length
      });
    }

    console.log(`📦 Criando job de consulta em massa: ${documentosPermitidos.length} documentos (${documentosBloqueados.length} bloqueados)`);
    console.log(`📱 Verificar WhatsApp: ${verifyWhatsapp ? 'SIM' : 'NÃO'}`);
    if (verifyWhatsapp) {
      console.log(`⏱️ Delay entre verificações: ${whatsappDelay}s`);
    }

    // VERIFICAR SE HÁ CONSULTAS SUFICIENTES PARA TODOS OS DOCUMENTOS
    const qtdDocumentos = documentosPermitidos.length;
    const isConsultaAvulsa = req.isConsultaAvulsa || false; // Se usou consultas avulsas
    
    if (qtdDocumentos > 1) {
      // O middleware já descontou 1, precisa verificar se há créditos para o resto
      const consultasAdicionaisNecessarias = qtdDocumentos - 1;
      
      console.log(`🔍 Verificando se há créditos suficientes para ${qtdDocumentos} documentos...`);
      
      if (isConsultaAvulsa) {
        // Verificar se há consultas avulsas suficientes
        const saldoResult = await pool.query(`
          SELECT consultas_avulsas_saldo 
          FROM tenants 
          WHERE id = $1
        `, [req.tenant.id]);
        
        const saldoAtual = parseInt(saldoResult.rows[0]?.consultas_avulsas_saldo || 0);
        
        if (saldoAtual < consultasAdicionaisNecessarias) {
          console.log(`❌ Créditos insuficientes! Necessário: ${consultasAdicionaisNecessarias}, Disponível: ${saldoAtual}`);
          
          // Devolver a 1 consulta que o middleware descontou
          await pool.query(`
            UPDATE tenants 
            SET consultas_avulsas_saldo = consultas_avulsas_saldo + 1,
                consultas_avulsas_usadas = GREATEST(0, consultas_avulsas_usadas - 1)
            WHERE id = $1
          `, [req.tenant.id]);
          
          return res.status(403).json({
            success: false,
            error: 'Créditos avulsos insuficientes',
            message: `❌ Você possui apenas ${saldoAtual + 1} consulta(s) avulsa(s), mas está tentando consultar ${qtdDocumentos} CPFs. Adicione mais créditos ou reduza a quantidade de CPFs.`,
            saldo_disponivel: saldoAtual + 1,
            cpfs_solicitados: qtdDocumentos,
            creditos_necessarios: qtdDocumentos
          });
        }
        
        // Descontar as consultas adicionais
        console.log(`💰 Descontando ${consultasAdicionaisNecessarias} consultas avulsas adicionais (total: ${qtdDocumentos})`);
        await pool.query(`
          UPDATE tenants 
          SET consultas_avulsas_saldo = consultas_avulsas_saldo - $1,
              consultas_avulsas_usadas = consultas_avulsas_usadas + $1
          WHERE id = $2
        `, [consultasAdicionaisNecessarias, req.tenant.id]);
      }
      // Se não é consulta avulsa, o limite do plano é por dia/mês, não por consulta individual
    }

    const tenantId = req.tenant?.id;
    const result = await pool.query(
      `INSERT INTO novavida_jobs (user_identifier, documentos, delay_seconds, progress_total, status, verify_whatsapp, whatsapp_delay, tenant_id, is_consulta_avulsa)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8)
       RETURNING id`,
      [userIdentifier, documentosPermitidos, delaySeconds, documentosPermitidos.length, verifyWhatsapp, whatsappDelay, tenantId, isConsultaAvulsa]
    );

    const jobId = result.rows[0].id;

    // Iniciar processamento em background
    console.log(`🚀 Chamando processJob para Job #${jobId}...`);
    processJob(jobId).catch(error => {
      console.error(`❌ Erro fatal ao processar job ${jobId}:`, error);
    });

    res.json({
      success: true,
      jobId,
      message: 'Job criado e iniciado com sucesso',
      bloqueados: documentosBloqueados,
      totalBloqueados: documentosBloqueados.length,
      totalPermitidos: documentosPermitidos.length
    });
  } catch (error) {
    console.error('❌ Erro ao criar job:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// BUSCAR STATUS DE UM JOB
// ============================================

router.get('/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM novavida_jobs WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Erro ao buscar job:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// LISTAR TODOS OS JOBS
// ============================================

router.get('/jobs', async (req, res) => {
  try {
    const { userIdentifier, status } = req.query;

    let query = `SELECT * FROM novavida_jobs WHERE 1=1`;
    const params = [];

    if (userIdentifier) {
      params.push(userIdentifier);
      query += ` AND user_identifier = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    query += ` ORDER BY created_at DESC LIMIT 50`;

    const result = await pool.query(query, params);

    res.json({ jobs: result.rows });
  } catch (error) {
    console.error('❌ Erro ao listar jobs:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PAUSAR JOB
// ============================================

router.post('/jobs/:id/pause', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `UPDATE novavida_jobs SET status = 'paused', updated_at = NOW() WHERE id = $1 AND status = 'running'`,
      [id]
    );

    console.log(`⏸️ Job ${id} pausado`);

    res.json({ success: true, message: 'Job pausado' });
  } catch (error) {
    console.error('❌ Erro ao pausar job:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RETOMAR JOB
// ============================================

router.post('/jobs/:id/resume', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `UPDATE novavida_jobs SET status = 'running', updated_at = NOW() WHERE id = $1 AND status = 'paused'`,
      [id]
    );

    console.log(`▶️ Job ${id} retomado`);

    // Retomar processamento
    processJob(parseInt(id));

    res.json({ success: true, message: 'Job retomado' });
  } catch (error) {
    console.error('❌ Erro ao retomar job:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CANCELAR JOB
// ============================================

router.post('/jobs/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `UPDATE novavida_jobs SET status = 'cancelled', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );

    console.log(`❌ Job ${id} cancelado`);

    res.json({ success: true, message: 'Job cancelado' });
  } catch (error) {
    console.error('❌ Erro ao cancelar job:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PROCESSAMENTO DE JOB EM BACKGROUND
// ============================================

async function processJob(jobId) {
  console.log(`\n========================================`);
  console.log(`🚀 PROCESSANDO JOB #${jobId}`);
  console.log(`========================================`);
  try {
    console.log(`🔍 Buscando dados do job ${jobId}...`);

    // Buscar dados do job
    const jobResult = await pool.query(
      `SELECT * FROM novavida_jobs WHERE id = $1`,
      [jobId]
    );

    if (jobResult.rows.length === 0) {
      console.error(`❌ Job ${jobId} não encontrado`);
      return;
    }

    const job = jobResult.rows[0];

    // Verificar se já foi cancelado
    if (job.status === 'cancelled') {
      console.log(`⚠️ Job ${jobId} foi cancelado`);
      return;
    }

    // Marcar como em execução
    await pool.query(
      `UPDATE novavida_jobs SET status = 'running', started_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [jobId]
    );

    const documentos = job.documentos;
    const delaySeconds = job.delay_seconds || 0;
    const startIndex = job.progress_current || 0;
    let results = job.results || [];

    // 🔄 BUSCAR INSTÂNCIAS UMA VEZ SÓ (antes do loop de documentos)
    let instances = [];
    let globalInstanceIndex = 0; // Índice global para rotação entre TODOS os telefones
    let uazService = null;
    
    if (job.verify_whatsapp) {
      try {
        const credentials = await getTenantUazapCredentials(job.tenant_id);
        uazService = new UazService(credentials.serverUrl, credentials.adminToken);
        
        const instanceResult = await pool.query(
          `SELECT id, instance_token, name FROM uaz_instances 
           WHERE tenant_id = $1 AND is_active = true AND status = 'connected' 
           ORDER BY id`,
          [job.tenant_id]
        );
        instances = instanceResult.rows;
        
        // Fallback: tentar com is_connected = true
        if (instances.length === 0) {
          const fallbackResult = await pool.query(
            `SELECT id, instance_token, name FROM uaz_instances 
             WHERE tenant_id = $1 AND is_connected = true 
             ORDER BY id`,
            [job.tenant_id]
          );
          instances = fallbackResult.rows;
        }
        
        console.log(`🔄 ${instances.length} instância(s) ativa(s) para rotação GLOBAL (tenant: ${job.tenant_id})`);
      } catch (error) {
        console.error(`❌ Erro ao buscar instâncias para verificação WhatsApp:`, error.message);
      }
    }

    // Processar documentos a partir do índice atual
    for (let i = startIndex; i < documentos.length; i++) {
      // Verificar se foi pausado ou cancelado
      const statusCheck = await pool.query(
        `SELECT status FROM novavida_jobs WHERE id = $1`,
        [jobId]
      );

      if (statusCheck.rows[0].status === 'paused') {
        console.log(`⏸️ Job ${jobId} pausado no documento ${i + 1}/${documentos.length}`);
        return;
      }

      if (statusCheck.rows[0].status === 'cancelled') {
        console.log(`❌ Job ${jobId} cancelado no documento ${i + 1}/${documentos.length}`);
        return;
      }

      const documento = documentos[i];
      console.log(`📄 Processando documento ${i + 1}/${documentos.length}: ${documento}`);

      // Consultar documento
      const resultado = await novaVidaService.consultarDocumento(documento);

      // 📱 VERIFICAR WHATSAPP DOS TELEFONES (se ativado)
      if (resultado.success && job.verify_whatsapp && resultado.dados?.TELEFONES && instances.length > 0 && uazService) {
        console.log(`\n✅ VERIFICANDO WHATSAPP - Documento ${documento}`);
        
        try {
          const telefones = resultado.dados.TELEFONES || [];
          const whatsappDelay = job.whatsapp_delay || 3;
          
          for (let telIdx = 0; telIdx < telefones.length; telIdx++) {
            const telefone = telefones[telIdx];
            
            // 🔄 Selecionar próxima instância (round-robin GLOBAL)
            const selectedInstance = instances[globalInstanceIndex % instances.length];
            globalInstanceIndex++;
            
            // Construir número completo
            const ddd = telefone.DDD || '';
            const numero = telefone.TELEFONE || '';
            const numeroCompleto = `55${ddd}${numero}`;
            
            console.log(`🔍 [${selectedInstance.name}] Verificando: ${numeroCompleto} (índice global: ${globalInstanceIndex})`);
            
            try {
              const whatsappCheck = await uazService.checkNumber(selectedInstance.instance_token, numeroCompleto);
              
              telefone.WHATSAPP_VERIFIED = true;
              telefone.HAS_WHATSAPP = whatsappCheck.exists;
              telefone.VERIFIED_BY = selectedInstance.name;
              
              console.log(`   ${whatsappCheck.exists ? '✅' : '❌'} ${numeroCompleto} (via ${selectedInstance.name})`);
            } catch (error) {
              console.error(`   ❌ Erro ao verificar ${numeroCompleto}:`, error.message);
              telefone.WHATSAPP_VERIFIED = false;
            }
            
            // Delay entre verificações (proteção anti-ban)
            if (telIdx < telefones.length - 1 && whatsappDelay > 0) {
              console.log(`   ⏳ Aguardando ${whatsappDelay}s antes da próxima verificação...`);
              await new Promise(resolve => setTimeout(resolve, whatsappDelay * 1000));
            }
          }
          
          console.log(`✅ Verificação de WhatsApp concluída para documento ${documento}!`);
        } catch (error) {
          console.error(`❌ Erro ao verificar WhatsApp para documento ${documento}:`, error.message);
        }
      } else if (resultado.success && job.verify_whatsapp && instances.length === 0) {
        console.log(`⚠️ Sem instâncias ativas - pulando verificação WhatsApp para ${documento}`);
      }

      // Salvar no histórico se sucesso COM tenant_id
      if (resultado.success) {
        const isConsultaAvulsa = job.is_consulta_avulsa || false;
        await pool.query(
          `INSERT INTO novavida_consultas (tipo_documento, documento, resultado, user_identifier, tenant_id, is_consulta_avulsa, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [resultado.tipo, resultado.documento, JSON.stringify(resultado.dados), job.user_identifier, job.tenant_id, isConsultaAvulsa]
        );

        // Salvar na base de dados completa
        console.log('💾 Salvando na base de dados completa...');
        const salvoResult = await salvarNaBaseDados('consulta_massa', resultado.tipo, resultado.documento, resultado.dados, job.tenant_id);
        if (salvoResult && !salvoResult.success) {
          console.error('⚠️ A consulta foi realizada mas NÃO foi salva na base de dados!');
          console.error('⚠️ Erro:', salvoResult.error);
        }
      }

      // Adicionar resultado
      results.push({
        documento: resultado.documento,
        tipo: resultado.tipo,
        success: resultado.success,
        erro: resultado.erro || null,
        dados: resultado.dados
      });

      // Atualizar progresso no banco
      await pool.query(
        `UPDATE novavida_jobs 
         SET progress_current = $1, results = $2, updated_at = NOW() 
         WHERE id = $3`,
        [i + 1, JSON.stringify(results), jobId]
      );

      // Delay entre consultas (exceto na última)
      if (i < documentos.length - 1 && delaySeconds > 0) {
        console.log(`⏳ Aguardando ${delaySeconds}s...`);
        await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
      }
    }

    // Marcar como completo
    await pool.query(
      `UPDATE novavida_jobs 
       SET status = 'completed', completed_at = NOW(), updated_at = NOW() 
       WHERE id = $1`,
      [jobId]
    );

    console.log(`✅ Job ${jobId} concluído com sucesso!`);
  } catch (error) {
    console.error(`❌ Erro ao processar job ${jobId}:`, error);

    // Marcar como erro
    await pool.query(
      `UPDATE novavida_jobs 
       SET status = 'error', error_message = $1, updated_at = NOW() 
       WHERE id = $2`,
      [error.message, jobId]
    );
  }
}

// ============================================
// VERIFICAR LISTA DE CPFs NA BASE DE DADOS
// ============================================

router.post('/verificar-lista', async (req, res) => {
  try {
    const { cpfs } = req.body;

    if (!cpfs || !Array.isArray(cpfs) || cpfs.length === 0) {
      return res.status(400).json({ error: 'Lista de CPFs é obrigatória' });
    }

    console.log('\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔍 BACKEND - VERIFICAR LISTA DE CPFs');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📥 Total de CPFs recebidos: ${cpfs.length}`);
    console.log('📋 CPFs recebidos:', cpfs);

    // Formatar CPFs (remover caracteres especiais)
    const cpfsFormatados = cpfs.map((cpf, index) => {
      const formatado = String(cpf).replace(/\D/g, '');
      console.log(`  [${index + 1}] "${cpf}" → "${formatado}" (${formatado.length} dígitos)`);
      return formatado;
    });

    console.log('\n🔎 Buscando na base de dados...');

    // Buscar na base de dados
    const placeholders = cpfsFormatados.map((_, i) => `$${i + 1}`).join(',');
    
    const result = await pool.query(
      `SELECT 
        id,
        tipo_documento,
        documento,
        nome,
        nome_mae,
        sexo,
        data_nascimento,
        telefones,
        emails,
        enderecos,
        whatsapp_verificado,
        data_adicao,
        tipo_origem,
        observacoes,
        tags
      FROM base_dados_completa
      WHERE documento IN (${placeholders})`,
      cpfsFormatados
    );

    const encontrados = result.rows;
    const cpfsEncontrados = encontrados.map(reg => reg.documento);
    const naoEncontrados = cpfsFormatados.filter(cpf => !cpfsEncontrados.includes(cpf));

    console.log('\n📊 RESULTADO DA VERIFICAÇÃO:');
    console.log(`✅ Encontrados na base: ${encontrados.length}`);
    if (encontrados.length > 0) {
      encontrados.forEach((reg, i) => {
        console.log(`  [${i + 1}] CPF: ${reg.documento} - ${reg.nome}`);
      });
    }
    
    console.log(`\n❌ Não encontrados na base: ${naoEncontrados.length}`);
    if (naoEncontrados.length > 0) {
      naoEncontrados.forEach((cpf, i) => {
        console.log(`  [${i + 1}] CPF: ${cpf}`);
      });
    }
    console.log('═══════════════════════════════════════════════════════\n');

    res.json({
      encontrados,
      naoEncontrados,
      estatisticas: {
        total: cpfs.length,
        encontrados: encontrados.length,
        naoEncontrados: naoEncontrados.length
      }
    });
  } catch (error) {
    console.error('❌ Erro ao verificar CPFs:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RE-VERIFICAR WHATSAPP DE CPFs CADASTRADOS
// ============================================
router.post('/reverificar-whatsapp', async (req, res) => {
  try {
    const { documentos, whatsappColumn = 'first' } = req.body;
    const tenantId = req.tenant?.id;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant não identificado' });
    }
    
    if (!documentos || !Array.isArray(documentos) || documentos.length === 0) {
      return res.status(400).json({ error: 'Lista de documentos é obrigatória' });
    }
    
    console.log('\n📱 ═══════════════════════════════════════════════════════');
    console.log('📱 RE-VERIFICAÇÃO DE WHATSAPP');
    console.log('📱 ═══════════════════════════════════════════════════════');
    console.log(`📊 Total de documentos: ${documentos.length}`);
    console.log(`📱 Coluna a verificar: ${whatsappColumn}`);
    
    // Buscar instâncias conectadas (usando tenantQuery para respeitar RLS)
    const instanceResult = await tenantQuery(req,
      `SELECT id, instance_token, name FROM uaz_instances 
       WHERE tenant_id = $1 AND is_active = true AND status = 'connected' 
       ORDER BY id`,
      [tenantId]
    );
    
    if (instanceResult.rows.length === 0) {
      // Fallback
      const fallbackResult = await tenantQuery(req,
        `SELECT id, instance_token, name FROM uaz_instances 
         WHERE tenant_id = $1 AND is_connected = true 
         ORDER BY id`,
        [tenantId]
      );
      if (fallbackResult.rows.length === 0) {
        return res.status(400).json({ 
          error: 'Nenhuma instância QR Connect ativa. Conecte uma instância primeiro.' 
        });
      }
      instanceResult.rows = fallbackResult.rows;
    }
    
    const instances = instanceResult.rows;
    console.log(`✅ ${instances.length} instância(s) conectada(s) disponível(eis)`);
    
    // Buscar credenciais e criar serviço
    const credentials = await getTenantUazapCredentials(tenantId);
    const uazService = new UazService(credentials.serverUrl, credentials.adminToken);
    
    // Buscar dados dos documentos no banco (usando tenantQuery)
    const placeholders = documentos.map((_, i) => `$${i + 1}`).join(',');
    const docsResult = await tenantQuery(req,
      `SELECT id, documento, telefones FROM base_dados_completa 
       WHERE documento IN (${placeholders}) AND tenant_id = $${documentos.length + 1}`,
      [...documentos, tenantId]
    );
    
    console.log(`📊 ${docsResult.rows.length} documento(s) encontrado(s) no banco`);
    
    let verificados = 0;
    let erros = 0;
    let instanceIndex = 0;
    
    for (const doc of docsResult.rows) {
      const telefones = doc.telefones || [];
      
      if (telefones.length === 0) {
        console.log(`⚠️ ${doc.documento}: Sem telefones`);
        continue;
      }
      
      // Determinar quais telefones verificar
      let telefonesToVerify = [];
      if (whatsappColumn === 'first' && telefones[0]) {
        telefonesToVerify = [{ tel: telefones[0], idx: 0 }];
      } else if (whatsappColumn === 'second' && telefones[1]) {
        telefonesToVerify = [{ tel: telefones[1], idx: 1 }];
      } else if (whatsappColumn === 'third' && telefones[2]) {
        telefonesToVerify = [{ tel: telefones[2], idx: 2 }];
      } else if (whatsappColumn === 'all') {
        telefonesToVerify = telefones.map((tel, idx) => ({ tel, idx }));
      }
      
      let algumVerificado = false;
      
      for (const { tel, idx } of telefonesToVerify) {
        if (tel.ddd && tel.telefone) {
          const numeroCompleto = `55${tel.ddd}${tel.telefone}`;
          const instance = instances[instanceIndex % instances.length];
          instanceIndex++;
          
          try {
            console.log(`🔍 [${instance.name}] ${doc.documento} - ${numeroCompleto}`);
            const checkResult = await uazService.checkNumber(instance.instance_token, numeroCompleto);
            
            // Atualizar o telefone no array
            telefones[idx].has_whatsapp = checkResult?.data?.isInWhatsapp || false;
            telefones[idx].whatsapp_verified = true;
            telefones[idx].verified_by = instance.name;
            
            console.log(`   ${telefones[idx].has_whatsapp ? '✅ TEM' : '❌ NÃO TEM'} WhatsApp`);
            algumVerificado = true;
            
            // Delay entre verificações (500ms)
            await new Promise(r => setTimeout(r, 500));
          } catch (err) {
            console.error(`   ⚠️ Erro: ${err.message}`);
            telefones[idx].has_whatsapp = false;
            telefones[idx].whatsapp_verified = false;
          }
        }
      }
      
      if (algumVerificado) {
        // Atualizar no banco (usando tenantQuery)
        const temWhatsApp = telefones.some(t => t.has_whatsapp);
        await tenantQuery(req,
          `UPDATE base_dados_completa 
           SET telefones = $1, whatsapp_verificado = $2, data_verificacao_whatsapp = NOW()
           WHERE id = $3 AND tenant_id = $4`,
          [JSON.stringify(telefones), temWhatsApp, doc.id, tenantId]
        );
        verificados++;
      }
    }
    
    console.log('\n📊 RESULTADO:');
    console.log(`✅ Verificados: ${verificados}`);
    console.log(`❌ Erros: ${erros}`);
    console.log('═══════════════════════════════════════════════════════\n');
    
    res.json({
      success: true,
      verificados,
      erros,
      message: `WhatsApp re-verificado para ${verificados} documento(s)`
    });
    
  } catch (error) {
    console.error('❌ Erro ao re-verificar WhatsApp:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

