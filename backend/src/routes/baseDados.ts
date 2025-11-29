import { Router, Request, Response } from 'express';
import { pool } from '../database/connection';
// import XLSX from 'xlsx'; // Não utilizado no momento
const { checkDatabase } = require('../middlewares/check-feature.middleware');
const { checkContactLimit } = require('../middlewares/tenant-limits.middleware');

const router = Router();

// Aplicar verificação de funcionalidade em TODAS as rotas
router.use(checkDatabase);

// ========== ENDPOINT DE TESTE - REMOVER DEPOIS ==========
router.get('/teste-busca-telefone/:telefone', async (req: Request, res: Response) => {
  try {
    const { telefone } = req.params;
    const telefoneNumeros = telefone.replace(/\D/g, '');
    
    console.log('\n🧪 ===== TESTE DE BUSCA POR TELEFONE =====');
    console.log('📱 Telefone digitado:', telefone);
    console.log('📱 Telefone (só números):', telefoneNumeros);
    console.log('📱 Tamanho:', telefoneNumeros.length);
    
    if (telefoneNumeros.length === 11) {
      const ddd = telefoneNumeros.substring(0, 2);
      const numero = telefoneNumeros.substring(2);
      const numeroSem9 = numero.substring(1);
      
      console.log('\n🔍 SEPARAÇÃO:');
      console.log('   DDD:', ddd);
      console.log('   Número (com 9):', numero);
      console.log('   Número (sem 9):', numeroSem9);
      
      console.log('\n🔍 BUSCAS QUE SERÃO FEITAS (7 variações):');
      console.log('   1. DDD:', ddd);
      console.log('   2. Tel com 9:', numero);
      console.log('   3. Tel sem 9:', numeroSem9);
      console.log('   4. Número original:', telefoneNumeros);
      console.log('   5. Com 55:', `55${telefoneNumeros}`);
      console.log('   6. Sem 9 (10 dígitos):', `${ddd}${numeroSem9}`);
      console.log('   7. Com 55 e sem 9:', `55${ddd}${numeroSem9}`);
      
      // Teste 1: Buscar por DDD E Telefone separados COM/SEM 9 (JSONB nativo)
      const query1 = `
        SELECT id, nome, documento, telefones 
        FROM base_dados_completa 
        WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements(telefones) AS t
          WHERE t->>'ddd' = $1 AND (t->>'telefone' = $2 OR t->>'telefone' = $3)
        )
        LIMIT 5
      `;
      const result1 = await pool.query(query1, [ddd, numero, numeroSem9]);
      
      console.log('\n✅ RESULTADO 1 (DDD E Tel separados):');
      console.log('   Encontrados:', result1.rows.length);
      result1.rows.forEach((r: any) => console.log('   -', r.nome, '|', r.documento));
      
      // Teste 2: Buscar por número junto
      const query2 = `
        SELECT id, nome, documento, telefones 
        FROM base_dados_completa 
        WHERE telefones::text ILIKE $1
        LIMIT 5
      `;
      const result2 = await pool.query(query2, [`%${telefoneNumeros}%`]);
      
      console.log('\n✅ RESULTADO 2 (Número junto):');
      console.log('   Encontrados:', result2.rows.length);
      result2.rows.forEach((r: any) => console.log('   -', r.nome, '|', r.documento));
      
      // Teste 3: Buscar com OR (como está na busca real - TODAS AS VARIAÇÕES)
      const query3 = `
        SELECT id, nome, documento, telefones 
        FROM base_dados_completa 
        WHERE (
          EXISTS (
            SELECT 1 FROM jsonb_array_elements(telefones) AS t
            WHERE t->>'ddd' = $1 AND (t->>'telefone' = $2 OR t->>'telefone' = $3)
          ) OR
          telefones::text ~ $4 OR
          telefones::text ~ $5 OR
          telefones::text ~ $6 OR
          telefones::text ~ $7
        )
        LIMIT 5
      `;
      const result3 = await pool.query(query3, [
        ddd,
        numero,
        numeroSem9,
        telefoneNumeros,
        `55${telefoneNumeros}`,
        `${ddd}${numeroSem9}`,
        `55${ddd}${numeroSem9}`
      ]);
      
      console.log('\n✅ RESULTADO 3 (Query completa com OR):');
      console.log('   Encontrados:', result3.rows.length);
      result3.rows.forEach((r: any) => console.log('   -', r.nome, '|', r.documento));
      console.log('🧪 ===== FIM DO TESTE =====\n');
      
      res.json({
        sucesso: true,
        telefone_digitado: telefone,
        telefone_numeros: telefoneNumeros,
        ddd,
        numero,
        resultados: {
          ddd_e_tel_separados: result1.rows.length,
          numero_junto: result2.rows.length,
          query_completa: result3.rows.length
        },
        registros: result3.rows
      });
    } else {
      res.json({
        sucesso: false,
        mensagem: 'Este teste é só para números de 11 dígitos'
      });
    }
    
  } catch (error: any) {
    console.error('❌ Erro no teste:', error);
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});
// ========== FIM DO ENDPOINT DE TESTE ==========

// Buscar registros com filtros avançados
router.get('/buscar', async (req: Request, res: Response) => {
  try {
    const {
      cpf_cnpj,
      nome,
      telefone,
      email,
      cidade,
      uf,
      whatsapp, // 'todos', 'sim', 'nao'
      tipo_documento, // 'todos', 'CPF', 'CNPJ'
      tipo_origem, // 'todos', 'consulta_unica', 'consulta_massa', 'manual', 'importacao'
      data_inicio,
      data_fim,
      limit = '50',
      offset = '0'
    } = req.query;

    console.log('🔍 Filtros recebidos:', { cpf_cnpj, nome, telefone, email, cidade, uf, whatsapp, tipo_documento, tipo_origem });

    // SEMPRE filtrar por tenant_id
    const tenantId = (req as any).tenant?.id;
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    let whereConditions: string[] = [`tenant_id = $1`];
    let params: any[] = [tenantId];
    let paramIndex = 2; // Começa em 2 pois $1 é o tenant_id

    // Filtro por documento (remove caracteres especiais)
    if (cpf_cnpj) {
      const documentoNumeros = String(cpf_cnpj).replace(/\D/g, '');
      whereConditions.push(`documento LIKE $${paramIndex}`);
      params.push(`%${documentoNumeros}%`);
      paramIndex++;
    }

    // Filtro por nome
    if (nome) {
      whereConditions.push(`nome ILIKE $${paramIndex}`);
      params.push(`%${nome}%`);
      paramIndex++;
    }

    // Filtro por telefone (busca inteligente considerando DDD separado)
    if (telefone) {
      const telefoneNumeros = String(telefone).replace(/\D/g, '');
      
      console.log('🔍 [BUSCA TELEFONE] Número digitado:', telefoneNumeros, '| Tamanho:', telefoneNumeros.length);
      
      if (telefoneNumeros.length === 11) {
        // 11 dígitos: DDD (2) + Telefone (9)
        // Ex: 62994396869 = DDD:62 + Tel:994396869
        const ddd = telefoneNumeros.substring(0, 2);
        const numero = telefoneNumeros.substring(2);
        const numeroSem9 = numero.substring(1); // Remove o primeiro 9 (8 dígitos)
        
        console.log('🔍 [BUSCA TELEFONE] Separando DDD:', ddd, '| Número:', numero, '| Sem 9:', numeroSem9);
        
        // Busca TODAS as variações: com/sem 55, com/sem 9º dígito
        whereConditions.push(`(
          EXISTS (
            SELECT 1 FROM jsonb_array_elements(telefones) AS t
            WHERE t->>'ddd' = $${paramIndex} AND (
              t->>'telefone' = $${paramIndex + 1} OR
              t->>'telefone' = $${paramIndex + 2}
            )
          ) OR
          telefones::text ~ $${paramIndex + 3} OR
          telefones::text ~ $${paramIndex + 4} OR
          telefones::text ~ $${paramIndex + 5} OR
          telefones::text ~ $${paramIndex + 6}
        )`);
        params.push(ddd);                                    // DDD
        params.push(numero);                                 // Tel com 9 (994396869)
        params.push(numeroSem9);                             // Tel sem 9 (94396869)
        params.push(`${telefoneNumeros}`);                   // 62994396869
        params.push(`55${telefoneNumeros}`);                 // 5562994396869
        params.push(`${ddd}${numeroSem9}`);                  // 6294396869 (sem o 9)
        params.push(`55${ddd}${numeroSem9}`);                // 556294396869 (com 55 e sem o 9)
        paramIndex += 7;
        
        console.log('🔍 [BUSCA TELEFONE] Buscando por:', {
          ddd,
          numero_com_9: numero,
          numero_sem_9: numeroSem9,
          variacao_1: telefoneNumeros,
          variacao_2: `55${telefoneNumeros}`,
          variacao_3: `${ddd}${numeroSem9}`,
          variacao_4: `55${ddd}${numeroSem9}`
        });
      } else if (telefoneNumeros.length === 10) {
        // 10 dígitos: DDD (2) + Telefone (8)
        // Ex: 6294396869 = DDD:62 + Tel:94396869 (sem o 9 inicial)
        const ddd = telefoneNumeros.substring(0, 2);
        const numero = telefoneNumeros.substring(2);
        const numeroCom9 = '9' + numero; // Adiciona 9 no início (9 dígitos)
        
        console.log('🔍 [BUSCA TELEFONE] Separando DDD:', ddd, '| Número:', numero, '| Com 9:', numeroCom9);
        
        // Busca TODAS as variações: com/sem 55, com/sem 9º dígito
        whereConditions.push(`(
          EXISTS (
            SELECT 1 FROM jsonb_array_elements(telefones) AS t
            WHERE t->>'ddd' = $${paramIndex} AND (
              t->>'telefone' = $${paramIndex + 1} OR
              t->>'telefone' = $${paramIndex + 2}
            )
          ) OR
          telefones::text ~ $${paramIndex + 3} OR
          telefones::text ~ $${paramIndex + 4} OR
          telefones::text ~ $${paramIndex + 5} OR
          telefones::text ~ $${paramIndex + 6}
        )`);
        params.push(ddd);                                    // DDD
        params.push(numero);                                 // Tel sem 9 (94396869)
        params.push(numeroCom9);                             // Tel com 9 (994396869)
        params.push(`${telefoneNumeros}`);                   // 6294396869
        params.push(`55${telefoneNumeros}`);                 // 556294396869
        params.push(`${ddd}${numeroCom9}`);                  // 62994396869 (com o 9)
        params.push(`55${ddd}${numeroCom9}`);                // 5562994396869 (com 55 e com o 9)
        paramIndex += 7;
        
        console.log('🔍 [BUSCA TELEFONE] Buscando por:', {
          ddd,
          numero_sem_9: numero,
          numero_com_9: numeroCom9,
          variacao_1: telefoneNumeros,
          variacao_2: `55${telefoneNumeros}`,
          variacao_3: `${ddd}${numeroCom9}`,
          variacao_4: `55${ddd}${numeroCom9}`
        });
      } else if (telefoneNumeros.length < 10) {
        // Busca parcial (menos de 10 dígitos)
        console.log('🔍 [BUSCA TELEFONE] Busca parcial');
        whereConditions.push(`telefones::text ILIKE $${paramIndex}`);
        params.push(`%${telefoneNumeros}%`);
        paramIndex++;
      } else {
        // 12+ dígitos: Número completo com 55 ou internacional
        console.log('🔍 [BUSCA TELEFONE] Busca número longo');
        whereConditions.push(`telefones::text ILIKE $${paramIndex}`);
        params.push(`%${telefoneNumeros}%`);
        paramIndex++;
      }
    }

    // Filtro por email
    if (email) {
      whereConditions.push(`emails::text ILIKE $${paramIndex}`);
      params.push(`%${email}%`);
      paramIndex++;
    }

    // Filtro por cidade
    if (cidade) {
      whereConditions.push(`enderecos::text ILIKE $${paramIndex}`);
      params.push(`%${cidade}%`);
      paramIndex++;
    }

    // Filtro por UF
    if (uf) {
      whereConditions.push(`enderecos::text ILIKE $${paramIndex}`);
      params.push(`%"uf":"${uf}"%`);
      paramIndex++;
    }

    // Filtro por WhatsApp
    if (whatsapp && whatsapp !== 'todos') {
      if (whatsapp === 'sim') {
        whereConditions.push(`whatsapp_verificado = true`);
      } else if (whatsapp === 'nao') {
        whereConditions.push(`whatsapp_verificado = false`);
      }
    }

    // Filtro por tipo de documento
    if (tipo_documento && tipo_documento !== 'todos') {
      whereConditions.push(`tipo_documento = $${paramIndex}`);
      params.push(tipo_documento);
      paramIndex++;
    }

    // Filtro por tipo de origem
    if (tipo_origem && tipo_origem !== 'todos') {
      whereConditions.push(`tipo_origem = $${paramIndex}`);
      params.push(tipo_origem);
      paramIndex++;
    }

    // Filtro por período
    if (data_inicio) {
      whereConditions.push(`data_adicao >= $${paramIndex}`);
      params.push(data_inicio);
      paramIndex++;
    }

    if (data_fim) {
      whereConditions.push(`data_adicao <= $${paramIndex}`);
      params.push(data_fim + ' 23:59:59');
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 WHERE Clause:', whereClause);
    console.log('📊 Params:', params);
    
    // Mostrar a query completa interpolada (para debug)
    let queryDebug = `SELECT COUNT(*) FROM base_dados_completa ${whereClause}`;
    params.forEach((param, index) => {
      queryDebug = queryDebug.replace(`$${index + 1}`, `'${param}'`);
    });
    console.log('📊 Query completa (debug):', queryDebug);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Contar total de registros
    const countQuery = `SELECT COUNT(*) FROM base_dados_completa ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    console.log('✅ Total encontrado:', total);

    // Buscar registros
    params.push(limit, offset);
    const query = `
      SELECT 
        *,
        (SELECT COUNT(*) FROM jsonb_array_elements(telefones) WHERE (value->>'has_whatsapp')::boolean = true) as telefones_com_whatsapp
      FROM base_dados_completa
      ${whereClause}
      ORDER BY data_adicao DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await pool.query(query, params);

    console.log('✅ Registros retornados:', result.rows.length);
    
    // 🔍 DEBUG: Mostrar telefones armazenados
    if (telefone) {
      const telefoneStr = String(telefone);
      console.log('\n🔍 [DEBUG TELEFONES] Buscando por:', telefoneStr);
      console.log('🔍 [DEBUG TELEFONES] Apenas números:', telefoneStr.replace(/\D/g, ''));
      
      // Buscar TODOS os registros para comparação
      const todosQuery = 'SELECT id, nome, documento, telefones FROM base_dados_completa LIMIT 10';
      const todosResult = await pool.query(todosQuery);
      
      console.log('\n📋 TODOS OS TELEFONES NO BANCO (primeiros 10):');
      todosResult.rows.forEach((row, index) => {
        console.log(`\n📱 Registro ${index + 1}:`, row.nome);
        console.log('   ID:', row.id);
        console.log('   CPF/CNPJ:', row.documento);
        console.log('   Telefones (JSONB):', JSON.stringify(row.telefones));
        
        // Extrair números de dentro do JSONB
        if (Array.isArray(row.telefones)) {
          const numeros = row.telefones.map((t: any) => t.numero || t);
          console.log('   Números extraídos:', numeros);
        }
      });
      
      console.log('\n📋 RESULTADOS DA BUSCA FILTRADA:');
      result.rows.forEach((row, index) => {
        console.log(`\n📱 Registro ${index + 1}:`, row.nome);
        console.log('   CPF/CNPJ:', row.documento);
        console.log('   Telefones (JSONB):', JSON.stringify(row.telefones));
      });
    }

    res.json({
      success: true,
      registros: result.rows,
      total,
      limit: parseInt(String(limit)),
      offset: parseInt(String(offset))
    });

  } catch (error: any) {
    console.error('Erro ao buscar registros:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar registros',
      error: error.message 
    });
  }
});

// Adicionar registro manualmente COM verificação automática de WhatsApp
router.post('/adicionar', async (req: Request, res: Response) => {
  try {
    const {
      tipo_documento,
      documento,
      nome,
      nome_mae,
      sexo,
      data_nascimento,
      telefones = [],
      emails = [],
      enderecos = [],
      observacoes,
      tags = []
    } = req.body;

    // Validar campos obrigatórios
    if (!tipo_documento || !documento || !nome) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: tipo_documento, documento, nome'
      });
    }

    // Verificar WhatsApp automaticamente se houver telefones E instâncias disponíveis
    let telefonesComWhatsapp = telefones;
    let whatsappVerificado = false;
    
    if (telefones && telefones.length > 0) {
      try {
        // Buscar instâncias UAZ ativas
        // 🔒 SEGURANÇA: Buscar instância do tenant atual
        const tenantId = (req as any).tenant?.id;
        if (!tenantId) {
          return res.status(401).json({
            success: false,
            message: 'Tenant não identificado'
          });
        }
        
        const instanceResult = await pool.query(
          `SELECT id, instance_token, name FROM uaz_instances WHERE is_connected = true AND tenant_id = $1 ORDER BY id LIMIT 1`,
          [tenantId]
        );
        
        if (instanceResult.rows.length > 0) {
          console.log('📱 Verificando WhatsApp automaticamente...');
          
          const instance = instanceResult.rows[0];
          const UazService = require('../services/uazService');
          const { getTenantUazapCredentials } = require('../helpers/uaz-credentials.helper');
          
          // 🔑 BUSCAR CREDENCIAIS DO TENANT
          const tenantId = req.tenant?.id;
          const credentials = await getTenantUazapCredentials(tenantId);
          const uazService = new UazService(credentials.serverUrl, credentials.adminToken);
          
          // Verificar cada telefone
          for (let i = 0; i < telefones.length; i++) {
            const tel = telefones[i];
            const numeroCompleto = `55${tel.ddd || ''}${tel.telefone || ''}`.replace(/\D/g, '');
            
            if (numeroCompleto.length >= 12) {
              try {
                console.log(`🔍 Verificando: ${numeroCompleto}`);
                const whatsappCheck = await uazService.checkNumber(instance.instance_token, numeroCompleto);
                
                telefonesComWhatsapp[i] = {
                  ...tel,
                  has_whatsapp: whatsappCheck.exists,
                  verified_by: instance.name
                };
                
                if (whatsappCheck.exists) {
                  whatsappVerificado = true;
                }
                
                console.log(`   ${whatsappCheck.exists ? '✅' : '❌'} ${numeroCompleto}`);
              } catch (error: any) {
                console.error(`   ❌ Erro ao verificar ${numeroCompleto}:`, error.message);
                telefonesComWhatsapp[i] = { ...tel, has_whatsapp: false };
              }
            }
          }
          
          console.log('✅ Verificação de WhatsApp concluída!');
        } else {
          console.log('⚠️ Nenhuma instância disponível para verificar WhatsApp');
        }
      } catch (whatsappError: any) {
        console.error('⚠️ Erro ao verificar WhatsApp:', whatsappError.message);
        // Não bloqueia o cadastro se a verificação falhar
      }
    }

    const query = `
      INSERT INTO base_dados_completa (
        tipo_origem, tipo_documento, documento, nome, nome_mae, sexo, data_nascimento,
        telefones, emails, enderecos, observacoes, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (documento) DO UPDATE SET
        nome = EXCLUDED.nome,
        nome_mae = EXCLUDED.nome_mae,
        sexo = EXCLUDED.sexo,
        data_nascimento = EXCLUDED.data_nascimento,
        telefones = EXCLUDED.telefones,
        emails = EXCLUDED.emails,
        enderecos = EXCLUDED.enderecos,
        observacoes = EXCLUDED.observacoes,
        tags = EXCLUDED.tags,
        data_atualizacao = NOW()
      RETURNING *
    `;

    const result = await pool.query(query, [
      'manual',
      tipo_documento,
      documento,
      nome,
      nome_mae || null,
      sexo || null,
      data_nascimento || null,
      JSON.stringify(telefonesComWhatsapp),
      JSON.stringify(emails),
      JSON.stringify(enderecos),
      observacoes || null,
      tags
    ]);

    res.json({
      success: true,
      message: 'Registro adicionado com sucesso!',
      whatsapp_verificado: whatsappVerificado,
      total_telefones: telefones.length,
      telefones_com_whatsapp: telefonesComWhatsapp.filter((t: any) => t.has_whatsapp).length,
      registro: result.rows[0]
    });

  } catch (error: any) {
    console.error('Erro ao adicionar registro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao adicionar registro',
      error: error.message
    });
  }
});

// Importar registros de arquivo
// Função helper para fazer merge inteligente de arrays (adiciona apenas novos)
function mergeArrays(existentes: any[], novos: any[], campoChave: string): any[] {
  if (!Array.isArray(existentes)) existentes = [];
  if (!Array.isArray(novos)) novos = [];
  
  const resultado = [...existentes];
  
  novos.forEach((novo: any) => {
    // Verificar se já existe baseado no campo chave
    const jaExiste = existentes.some((existente: any) => {
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

router.post('/importar', checkContactLimit, async (req: Request, res: Response) => {
  try {
    const { dados, verificar_whatsapp = false } = req.body;

    if (!Array.isArray(dados) || dados.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos'
      });
    }

    let importados = 0;
    let atualizados = 0;
    let erros: any[] = [];

    for (const registro of dados) {
      try {
        const { 
          tipo_documento, 
          documento, 
          nome,
          telefones = [],
          emails = [],
          enderecos = [],
          observacoes 
        } = registro;

        if (!documento || !nome) {
          erros.push({ documento, erro: 'Documento e nome são obrigatórios' });
          continue;
        }

        // Verificar se o documento já existe NESTE TENANT
        const tenantId = (req as any).tenant?.id;
        const checkQuery = 'SELECT * FROM base_dados_completa WHERE documento = $1 AND tenant_id = $2';
        const checkResult = await pool.query(checkQuery, [documento, tenantId]);
        
        if (checkResult.rows.length > 0) {
          // JÁ EXISTE - Fazer merge inteligente
          const existente = checkResult.rows[0];
          
          // MERGE: Adicionar apenas telefones novos
          const telefonesMerged = mergeArrays(existente.telefones || [], telefones, 'telefone');
          
          // MERGE: Adicionar apenas emails novos
          const emailsMerged = mergeArrays(existente.emails || [], emails, 'email');
          
          // MERGE: Adicionar apenas endereços novos
          const enderecosMerged = mergeArrays(existente.enderecos || [], enderecos, 'logradouro');
          
          // UPDATE mantendo nome original e fazendo merge dos arrays
          const updateQuery = `
            UPDATE base_dados_completa 
            SET 
              telefones = $1,
              emails = $2,
              enderecos = $3,
              observacoes = COALESCE(observacoes, '') || ' | ' || $4,
              data_atualizacao = NOW()
            WHERE documento = $5
          `;
          
          await pool.query(updateQuery, [
            JSON.stringify(telefonesMerged),
            JSON.stringify(emailsMerged),
            JSON.stringify(enderecosMerged),
            observacoes || 'Atualizado via importação',
            documento
          ]);
          
          atualizados++;
          
        } else {
          // NÃO EXISTE - Inserir novo
          const insertQuery = `
            INSERT INTO base_dados_completa (
              tipo_origem, tipo_documento, documento, nome,
              telefones, emails, enderecos, observacoes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `;
          
          await pool.query(insertQuery, [
            'importacao',
            tipo_documento || 'CPF',
            documento,
            nome,
            JSON.stringify(telefones),
            JSON.stringify(emails),
            JSON.stringify(enderecos),
            observacoes || 'Importado via arquivo'
          ]);
          
          importados++;
        }

      } catch (error: any) {
        erros.push({ documento: registro.documento, erro: error.message });
      }
    }

    res.json({
      success: true,
      message: 'Importação concluída!',
      importados,
      atualizados,
      erros: erros.length > 0 ? erros : undefined
    });

  } catch (error: any) {
    console.error('Erro ao importar registros:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao importar registros',
      error: error.message
    });
  }
});

// Exportar registros filtrados
router.post('/exportar', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body; // Array de IDs para exportar
    const tenantId = (req as any).tenant?.id;

    let query = 'SELECT * FROM base_dados_completa WHERE tenant_id = $1';
    let params: any[] = [tenantId];

    if (ids && ids.length > 0) {
      query += ' AND id = ANY($2)';
      params.push(ids);
    }

    query += ' ORDER BY data_adicao DESC';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      registros: result.rows,
      total: result.rows.length
    });

  } catch (error: any) {
    console.error('Erro ao exportar registros:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao exportar registros',
      error: error.message
    });
  }
});

// Atualizar registro
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'nome', 'nome_mae', 'sexo', 'data_nascimento',
      'telefones', 'emails', 'enderecos', 'observacoes', 'tags'
    ];

    const setClause: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClause.push(`${field} = $${paramIndex}`);
        
        if (['telefones', 'emails', 'enderecos'].includes(field)) {
          // JSON arrays
          params.push(JSON.stringify(updates[field]));
        } else if (field === 'tags') {
          // Tags array
          params.push(updates[field]);
        } else if (field === 'data_nascimento') {
          // Data: converte string vazia em NULL
          const dataValue = updates[field];
          params.push(dataValue === '' || dataValue === null ? null : dataValue);
        } else if (field === 'sexo') {
          // Sexo: converte string vazia em NULL
          const sexoValue = updates[field];
          params.push(sexoValue === '' || sexoValue === null ? null : sexoValue);
        } else {
          // Outros campos de texto: converte string vazia em NULL se for campo opcional
          const value = updates[field];
          if (['nome_mae', 'observacoes'].includes(field)) {
            // Campos opcionais: aceita string vazia
            params.push(value === null ? null : value);
          } else {
            // Campo obrigatório (nome): mantém como está
            params.push(value);
          }
        }
        
        paramIndex++;
      }
    }

    if (setClause.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum campo para atualizar'
      });
    }

    params.push(id);
    
    // Tentar com data_atualizacao primeiro, se falhar, tenta sem
    let query = `
      UPDATE base_dados_completa
      SET ${setClause.join(', ')}, data_atualizacao = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    let result;
    try {
      result = await pool.query(query, params);
    } catch (error: any) {
      // Se erro for relacionado à coluna data_atualizacao, tenta sem ela
      if (error.message?.includes('data_atualizacao') || error.message?.includes('column')) {
        console.warn('⚠️ Coluna data_atualizacao não existe, atualizando sem ela...');
        query = `
          UPDATE base_dados_completa
          SET ${setClause.join(', ')}
          WHERE id = $${paramIndex}
          RETURNING *
        `;
        result = await pool.query(query, params);
      } else {
        throw error;
      }
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Registro não encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Registro atualizado com sucesso!',
      registro: result.rows[0]
    });

  } catch (error: any) {
    console.error('Erro ao atualizar registro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar registro',
      error: error.message
    });
  }
});

// IMPORTANTE: Rota /excluir-tudo DEVE vir ANTES de /:id
// Excluir TODA a base de dados
router.delete('/excluir-tudo', async (req: Request, res: Response) => {
  try {
    console.log('🗑️ Recebida requisição para excluir TODA a base');
    console.log('📋 Body recebido:', req.body);
    
    const { confirmacao } = req.body;

    if (confirmacao !== 'EXCLUIR_TUDO') {
      console.log('❌ Confirmação inválida:', confirmacao);
      return res.status(400).json({
        success: false,
        message: 'Confirmação necessária para excluir toda a base'
      });
    }

    console.log('✅ Confirmação válida, iniciando exclusão...');

    // Contar registros antes DESTE TENANT
    const tenantId = (req as any).tenant?.id;
    const countBefore = await pool.query('SELECT COUNT(*) FROM base_dados_completa WHERE tenant_id = $1', [tenantId]);
    const totalRegistros = parseInt(countBefore.rows[0].count);
    console.log(`📊 Total de registros a serem excluídos: ${totalRegistros}`);

    // Tentar excluir APENAS DESTE TENANT
    try {
      await pool.query('DELETE FROM base_dados_completa WHERE tenant_id = $1', [tenantId]);
      console.log(`✅ Base de dados completa excluída! ${totalRegistros} registro(s) removido(s)`);
    } catch (deleteError: any) {
      console.error('❌ Erro ao executar DELETE:', deleteError.message);
      throw deleteError;
    }

    res.json({
      success: true,
      message: `Base de dados excluída com sucesso! ${totalRegistros} registro(s) removido(s)`,
      total_excluidos: totalRegistros
    });

  } catch (error: any) {
    console.error('❌ ERRO AO EXCLUIR BASE:', error);
    console.error('Detalhes:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir base de dados: ' + error.message,
      error: error.message,
      code: error.code
    });
  }
});

// Deletar registro individual (DEVE vir DEPOIS de /excluir-tudo)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 🔒 SEGURANÇA: Deletar COM filtro de tenant_id
    const tenantId = (req as any).tenant?.id;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }
    
    const result = await pool.query(
      'DELETE FROM base_dados_completa WHERE id = $1 AND tenant_id = $2 RETURNING *',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Registro não encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Registro deletado com sucesso!'
    });

  } catch (error: any) {
    console.error('Erro ao deletar registro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar registro',
      error: error.message
    });
  }
});

// Obter estatísticas
router.get('/estatisticas', async (req: Request, res: Response) => {
  try {
    // 🚨 CRÍTICO: SEMPRE filtrar por tenant_id para evitar vazamento de dados
    const tenantId = (req as any).tenant?.id;
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant não identificado'
      });
    }

    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_registros,
        COUNT(CASE WHEN tipo_documento = 'CPF' THEN 1 END) as total_cpf,
        COUNT(CASE WHEN tipo_documento = 'CNPJ' THEN 1 END) as total_cnpj,
        COUNT(CASE WHEN whatsapp_verificado = true THEN 1 END) as total_com_whatsapp,
        COUNT(CASE WHEN tipo_origem = 'consulta_unica' THEN 1 END) as consultas_unicas,
        COUNT(CASE WHEN tipo_origem = 'consulta_massa' THEN 1 END) as consultas_massa,
        COUNT(CASE WHEN tipo_origem = 'manual' THEN 1 END) as cadastros_manuais,
        COUNT(CASE WHEN tipo_origem = 'importacao' THEN 1 END) as importacoes
      FROM base_dados_completa
      WHERE tenant_id = $1
    `, [tenantId]);

    res.json({
      success: true,
      estatisticas: stats.rows[0]
    });

  } catch (error: any) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estatísticas',
      error: error.message
    });
  }
});

// Excluir registros em lote (selecionados)
router.post('/excluir-lote', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Lista de IDs é obrigatória'
      });
    }

    const result = await pool.query(
      'DELETE FROM base_dados_completa WHERE id = ANY($1) RETURNING id',
      [ids]
    );

    res.json({
      success: true,
      message: `${result.rows.length} registro(s) excluído(s) com sucesso!`,
      excluidos: result.rows.length
    });

  } catch (error: any) {
    console.error('Erro ao excluir registros:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir registros',
      error: error.message
    });
  }
});

// Verificar WhatsApp de um cliente específico
router.post('/:id/verificar-whatsapp', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).tenant?.id;
    
    // Buscar cliente DESTE TENANT
    const clienteResult = await pool.query('SELECT * FROM base_dados_completa WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    
    if (clienteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cliente não encontrado'
      });
    }
    
    const cliente = clienteResult.rows[0];
    let telefones = cliente.telefones || [];
    
    if (!Array.isArray(telefones) || telefones.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cliente não possui telefones cadastrados'
      });
    }
    
    // Buscar instância UAZ ativa
    const instanceResult = await pool.query(
      `SELECT id, instance_token, name FROM uaz_instances WHERE is_connected = true ORDER BY id LIMIT 1`
    );
    
    if (instanceResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nenhuma instância UAZ ativa encontrada'
      });
    }
    
    const instance = instanceResult.rows[0];
    const UazService = require('../services/uazService');
    const { getTenantUazapCredentials } = require('../helpers/uaz-credentials.helper');
    
    // 🔑 BUSCAR CREDENCIAIS DO TENANT (tenantId já declarado acima)
    const credentials = await getTenantUazapCredentials(tenantId);
    const uazService = new UazService(credentials.serverUrl, credentials.adminToken);
    
    console.log(`📱 Verificando WhatsApp para cliente ${cliente.nome} (ID: ${id})`);
    
    let verificados = 0;
    let comWhatsapp = 0;
    
    // Verificar cada telefone
    for (let i = 0; i < telefones.length; i++) {
      const tel = telefones[i];
      const numeroCompleto = `55${tel.ddd || ''}${tel.telefone || ''}`.replace(/\D/g, '');
      
      if (numeroCompleto.length >= 12) {
        try {
          console.log(`🔍 Verificando: ${numeroCompleto}`);
          const whatsappCheck = await uazService.checkNumber(instance.instance_token, numeroCompleto);
          
          telefones[i] = {
            ...tel,
            has_whatsapp: whatsappCheck.exists,
            verified_by: instance.name
          };
          
          if (whatsappCheck.exists) {
            comWhatsapp++;
          }
          
          verificados++;
          console.log(`   ${whatsappCheck.exists ? '✅' : '❌'} ${numeroCompleto}`);
        } catch (error: any) {
          console.error(`   ❌ Erro ao verificar ${numeroCompleto}:`, error.message);
          telefones[i] = { ...tel, has_whatsapp: false };
        }
      }
    }
    
    // Atualizar registro
    await pool.query(`
      UPDATE base_dados_completa 
      SET 
        telefones = $1,
        whatsapp_verificado = $2,
        data_verificacao_whatsapp = $3,
        data_atualizacao = NOW()
      WHERE id = $4
    `, [
      JSON.stringify(telefones),
      comWhatsapp > 0,
      comWhatsapp > 0 ? new Date() : cliente.data_verificacao_whatsapp,
      id
    ]);
    
    console.log(`✅ Verificação concluída: ${comWhatsapp}/${verificados} com WhatsApp`);
    
    res.json({
      success: true,
      message: `Verificação concluída! ${comWhatsapp} de ${verificados} com WhatsApp`,
      verificados,
      comWhatsapp,
      telefones
    });
    
  } catch (error: any) {
    console.error('Erro ao verificar WhatsApp:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar WhatsApp',
      error: error.message
    });
  }
});

export default router;

