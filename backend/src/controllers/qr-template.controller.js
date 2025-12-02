/**
 * ============================================
 * QR TEMPLATE CONTROLLER
 * ============================================
 * Gerencia templates do WhatsApp QR Connect
 * CRUD completo + upload de mídias
 * ============================================
 */

import { pool } from '../database/connection';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Diretório para salvar mídias dos templates
const MEDIA_DIR = path.join(__dirname, '../../uploads/qr-templates');

// Criar diretório se não existir
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  console.log('✅ Diretório criado:', MEDIA_DIR);
}

class QrTemplateController {
  /**
   * Listar todos os templates
   * GET /api/qr-templates
   */
  async list(req, res) {
    const client = await pool.connect();
    try {
      // Validar tenant
      if (!req.tenant || !req.tenant.id) {
        throw new Error('Tenant não identificado');
      }

      // ✅ IMPORTANTE: Definir tenant na sessão PostgreSQL para RLS
      await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant_id', req.tenant.id.toString()]);
      
      const result = await client.query(`
        SELECT 
          t.*,
          COALESCE(
            json_agg(
              json_build_object(
                'id', m.id,
                'media_type', m.media_type,
                'file_name', m.file_name,
                'file_path', m.file_path,
                'file_size', m.file_size,
                'mime_type', m.mime_type,
                'url', m.url,
                'original_name', m.original_name,
                'caption', m.caption,
                'duration', m.duration,
                'carousel_card_index', m.carousel_card_index
              ) ORDER BY m.id
            ) FILTER (WHERE m.id IS NOT NULL),
            '[]'
          ) as media_files
        FROM qr_templates t
        LEFT JOIN qr_template_media m ON t.id = m.template_id
        GROUP BY t.id
        ORDER BY t.created_at DESC
      `);

      res.json({
        success: true,
        data: result.rows,
        total: result.rows.length
      });
    } catch (error) {
      console.error('❌ Erro ao listar templates:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao listar templates',
        details: error.message
      });
    } finally {
      client.release();
    }
  }

  /**
   * Buscar template por ID
   * GET /api/qr-templates/:id
   */
  async getById(req, res) {
    const client = await pool.connect();
    try {
      const { id } = req.params;

      // Validar tenant
      if (!req.tenant || !req.tenant.id) {
        throw new Error('Tenant não identificado');
      }

      // ✅ IMPORTANTE: Definir tenant na sessão PostgreSQL para RLS
      await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant_id', req.tenant.id.toString()]);

      const result = await client.query(`
        SELECT 
          t.*,
          COALESCE(
            json_agg(
              json_build_object(
                'id', m.id,
                'media_type', m.media_type,
                'file_name', m.file_name,
                'file_path', m.file_path,
                'file_size', m.file_size,
                'mime_type', m.mime_type,
                'url', m.url,
                'original_name', m.original_name,
                'caption', m.caption,
                'duration', m.duration,
                'carousel_card_index', m.carousel_card_index
              ) ORDER BY m.carousel_card_index NULLS FIRST, m.id
            ) FILTER (WHERE m.id IS NOT NULL),
            '[]'
          ) as media_files
        FROM qr_templates t
        LEFT JOIN qr_template_media m ON t.id = m.template_id
        WHERE t.id = $1
        GROUP BY t.id
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Template não encontrado'
        });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('❌ Erro ao buscar template:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar template',
        details: error.message
      });
    } finally {
      client.release();
    }
  }

  /**
   * Criar novo template
   * POST /api/qr-templates
   */
  async create(req, res) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      console.log('🚀 ============================================');
      console.log('🚀 CRIANDO TEMPLATE - Dados recebidos:');
      console.log('🚀 Body:', JSON.stringify(req.body, null, 2));
      console.log('🚀 Files:', req.files ? `${req.files.length} arquivo(s)` : 'Nenhum');
      console.log('🚀 Media URL:', req.body.media_url);
      console.log('🚀 Media Path:', req.body.media_path);
      console.log('🚀 Media Type:', req.body.media_type);
      console.log('🚀 ============================================');

      const {
        name,
        description,
        type,
        text_content,
        list_config,
        buttons_config,
        carousel_config,
        poll_config,
        combined_blocks,
        variables_map
      } = req.body;

      // Validação
      if (!name || !type) {
        throw new Error('Nome e tipo são obrigatórios');
      }

      // Validar tenant
      if (!req.tenant || !req.tenant.id) {
        throw new Error('Tenant não identificado');
      }

      // Validar tipos permitidos
      const validTypes = ['text', 'image', 'video', 'audio', 'audio_recorded', 'document', 'list', 'buttons', 'carousel'];
      if (!validTypes.includes(type)) {
        throw new Error(`Tipo inválido. Use: ${validTypes.join(', ')}`);
      }

      // ✅ IMPORTANTE: Definir tenant na sessão PostgreSQL para RLS
      await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant_id', req.tenant.id.toString()]);
      console.log(`✅ Tenant ${req.tenant.id} definido na sessão PostgreSQL`);

      // Inserir template
      const result = await client.query(`
        INSERT INTO qr_templates 
        (name, description, type, text_content, list_config, buttons_config, carousel_config, poll_config, combined_blocks, variables_map, tenant_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        name,
        description || null,
        type,
        text_content || null,
        list_config ? JSON.stringify(list_config) : null,
        buttons_config ? JSON.stringify(buttons_config) : null,
        carousel_config ? JSON.stringify(carousel_config) : null,
        poll_config ? JSON.stringify(poll_config) : null,
        combined_blocks ? JSON.stringify(combined_blocks) : null,
        variables_map ? JSON.stringify(variables_map) : null,
        req.tenant.id
      ]);

      const template = result.rows[0];

      // Se tem arquivos, processar upload
      const uploadedFiles = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          // Gerar nome único
          const timestamp = Date.now();
          const uniqueName = `${timestamp}_${file.originalname}`;
          const filePath = path.join(MEDIA_DIR, uniqueName);

          // Mover arquivo
          fs.renameSync(file.path, filePath);

          // Salvar no banco
          const mediaResult = await client.query(`
            INSERT INTO qr_template_media
            (template_id, media_type, file_name, file_path, file_size, mime_type, caption, carousel_card_index)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
          `, [
            template.id,
            file.fieldname.replace('media_', ''), // Remove prefixo
            uniqueName,
            filePath,
            file.size,
            file.mimetype,
            file.caption || null,
            file.carousel_card_index || null
          ]);

          uploadedFiles.push(mediaResult.rows[0]);
        }
      }
      
      // Se tem mídia já uploadada (media_url e media_path), associar ao template
      else if (req.body.media_url && req.body.media_path && req.body.media_type) {
        console.log('📎 Associando mídia já uploadada ao template...');
        console.log('   URL:', req.body.media_url);
        console.log('   Path:', req.body.media_path);
        console.log('   Type:', req.body.media_type);
        
        // Extrair informações do arquivo
        const fileName = path.basename(req.body.media_path);
        let fileSize = 0;
        let mimeType = 'application/octet-stream';
        
        // Detectar mime type baseado na extensão do arquivo
        const ext = path.extname(fileName).toLowerCase();
        const mimeTypes = {
          // Imagens
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml',
          // Vídeos
          '.mp4': 'video/mp4',
          '.avi': 'video/x-msvideo',
          '.mov': 'video/quicktime',
          '.wmv': 'video/x-ms-wmv',
          '.webm': 'video/webm',
          // Áudios
          '.mp3': 'audio/mpeg',
          '.wav': 'audio/wav',
          '.ogg': 'audio/ogg',
          '.m4a': 'audio/mp4',
          // Documentos
          '.pdf': 'application/pdf',
          '.doc': 'application/msword',
          '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.xls': 'application/vnd.ms-excel',
          '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '.txt': 'text/plain'
        };
        
        mimeType = mimeTypes[ext] || 'application/octet-stream';
        console.log(`📎 Detectando mime type da extensão "${ext}": ${mimeType}`);
        
        // Construir path real do filesystem
        // media_path vem como "/uploads/media/xxx.png", precisa converter para path absoluto
        const fullPath = path.join(process.cwd(), req.body.media_path);
        console.log(`📁 Path completo do arquivo: ${fullPath}`);
        
        // Tentar obter tamanho do arquivo
        try {
          const stats = fs.statSync(fullPath);
          fileSize = stats.size;
          console.log(`✅ Arquivo encontrado! Tamanho: ${fileSize} bytes`);
        } catch (err) {
          console.warn('⚠️ Não foi possível obter informações do arquivo:', err.message);
          console.warn('   Tentando path alternativo...');
          
          // Tentar path alternativo: uploads/media/xxx.png (sem barra inicial)
          try {
            const altPath = path.join(process.cwd(), req.body.media_path.substring(1));
            const altStats = fs.statSync(altPath);
            fileSize = altStats.size;
            console.log(`✅ Arquivo encontrado no path alternativo! Tamanho: ${fileSize} bytes`);
          } catch (altErr) {
            console.error('❌ Não foi possível encontrar o arquivo em nenhum path');
          }
        }
        
        // Salvar no banco
        const mediaResult = await client.query(`
          INSERT INTO qr_template_media
          (template_id, media_type, file_name, file_path, file_size, mime_type, url, original_name)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `, [
          template.id,
          req.body.media_type,
          fileName,
          req.body.media_path,
          fileSize,
          mimeType,
          req.body.media_url,
          fileName
        ]);

        uploadedFiles.push(mediaResult.rows[0]);
        console.log('✅ ============================================');
        console.log('✅ MÍDIA ASSOCIADA AO TEMPLATE!');
        console.log('✅ Arquivo:', fileName);
        console.log('✅ Tipo:', req.body.media_type);
        console.log('✅ Tamanho:', fileSize, 'bytes');
        console.log('✅ ============================================');
      }

      await client.query('COMMIT');

      console.log(`✅ Template criado: ${template.name} (ID: ${template.id})`);

      res.status(201).json({
        success: true,
        message: 'Template criado com sucesso!',
        data: {
          ...template,
          media_files: uploadedFiles
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Erro ao criar template:', error);
      
      res.status(500).json({
        success: false,
        error: 'Erro ao criar template',
        details: error.message
      });
    } finally {
      client.release();
    }
  }

  /**
   * Atualizar template
   * PUT /api/qr-templates/:id
   */
  async update(req, res) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const { id } = req.params;
      
      // Parse de FormData - strings JSON precisam ser parseadas
      let list_config, buttons_config, carousel_config, poll_config, combined_blocks, variables_map;
      
      try {
        list_config = req.body.list_config ? (typeof req.body.list_config === 'string' ? JSON.parse(req.body.list_config) : req.body.list_config) : null;
        buttons_config = req.body.buttons_config ? (typeof req.body.buttons_config === 'string' ? JSON.parse(req.body.buttons_config) : req.body.buttons_config) : null;
        carousel_config = req.body.carousel_config ? (typeof req.body.carousel_config === 'string' ? JSON.parse(req.body.carousel_config) : req.body.carousel_config) : null;
        poll_config = req.body.poll_config ? (typeof req.body.poll_config === 'string' ? JSON.parse(req.body.poll_config) : req.body.poll_config) : null;
        combined_blocks = req.body.combined_blocks ? (typeof req.body.combined_blocks === 'string' ? JSON.parse(req.body.combined_blocks) : req.body.combined_blocks) : null;
        variables_map = req.body.variables_map ? (typeof req.body.variables_map === 'string' ? JSON.parse(req.body.variables_map) : req.body.variables_map) : null;
      } catch (parseError) {
        console.error('❌ Erro ao fazer parse de JSON do FormData:', parseError);
        throw new Error(`Erro ao processar dados JSON: ${parseError.message}`);
      }
      
      const {
        name,
        description,
        type,
        text_content
      } = req.body;

      console.log('📝 [UPDATE] Atualizando template:', {
        id,
        name,
        type,
        text_content: text_content ? text_content.substring(0, 50) + '...' : 'null',
        hasListConfig: !!list_config,
        hasButtonsConfig: !!buttons_config,
        hasCarouselConfig: !!carousel_config,
        hasPollConfig: !!poll_config,
        hasCombinedBlocks: !!combined_blocks,
        hasVariablesMap: !!variables_map,
        bodyKeys: Object.keys(req.body)
      });

      // Verificar se existe
      console.log('🔍 [UPDATE] Verificando se template existe:', id);
      const checkResult = await client.query('SELECT id, tenant_id FROM qr_templates WHERE id = $1', [id]);
      if (checkResult.rows.length === 0) {
        throw new Error('Template não encontrado');
      }
      
      const existingTemplate = checkResult.rows[0];
      console.log('✅ [UPDATE] Template encontrado:', {
        id: existingTemplate.id,
        tenant_id: existingTemplate.tenant_id
      });

      // Preparar dados para JSON.stringify (evitar erros)
      let listConfigJson = null;
      let buttonsConfigJson = null;
      let carouselConfigJson = null;
      let pollConfigJson = null;
      let combinedBlocksJson = null;
      let variablesMapJson = null;

      try {
        console.log('🔄 [UPDATE] Serializando configs...');
        
        if (list_config) {
          console.log('   - list_config:', typeof list_config);
          listConfigJson = typeof list_config === 'string' ? list_config : JSON.stringify(list_config);
        }
        if (buttons_config) {
          console.log('   - buttons_config:', typeof buttons_config);
          buttonsConfigJson = typeof buttons_config === 'string' ? buttons_config : JSON.stringify(buttons_config);
        }
        if (carousel_config) {
          console.log('   - carousel_config:', typeof carousel_config);
          carouselConfigJson = typeof carousel_config === 'string' ? carousel_config : JSON.stringify(carousel_config);
        }
        if (poll_config) {
          console.log('   - poll_config:', typeof poll_config);
          pollConfigJson = typeof poll_config === 'string' ? poll_config : JSON.stringify(poll_config);
        }
        if (combined_blocks) {
          console.log('   - combined_blocks:', typeof combined_blocks);
          combinedBlocksJson = typeof combined_blocks === 'string' ? combined_blocks : JSON.stringify(combined_blocks);
        }
        if (variables_map) {
          console.log('   - variables_map:', typeof variables_map);
          variablesMapJson = typeof variables_map === 'string' ? variables_map : JSON.stringify(variables_map);
        }
        
        console.log('✅ [UPDATE] Serialização concluída');
      } catch (jsonError) {
        console.error('❌ Erro ao serializar JSON:', jsonError);
        console.error('   Stack:', jsonError.stack);
        throw new Error(`Erro ao processar configurações: ${jsonError.message}`);
      }

      // Validar tenant
      if (!req.tenant || !req.tenant.id) {
        throw new Error('Tenant não identificado');
      }

      // ✅ IMPORTANTE: Definir tenant na sessão PostgreSQL para RLS
      await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant_id', req.tenant.id.toString()]);
      console.log(`✅ Tenant ${req.tenant.id} definido na sessão PostgreSQL para UPDATE`);

      // Atualizar template
      console.log('💾 [UPDATE] Executando UPDATE com parâmetros:', {
        name,
        description,
        type,
        text_content: text_content ? text_content.substring(0, 50) : null,
        hasListConfigJson: !!listConfigJson,
        hasButtonsConfigJson: !!buttonsConfigJson,
        hasCarouselConfigJson: !!carouselConfigJson,
        hasPollConfigJson: !!pollConfigJson,
        hasCombinedBlocksJson: !!combinedBlocksJson,
        hasVariablesMapJson: !!variablesMapJson,
        id
      });
      
      const result = await client.query(`
        UPDATE qr_templates 
        SET 
          name = COALESCE($1, name),
          description = COALESCE($2, description),
          type = COALESCE($3, type),
          text_content = COALESCE($4, text_content),
          list_config = COALESCE($5, list_config),
          buttons_config = COALESCE($6, buttons_config),
          carousel_config = COALESCE($7, carousel_config),
          poll_config = COALESCE($8, poll_config),
          combined_blocks = COALESCE($9, combined_blocks),
          variables_map = COALESCE($10, variables_map),
          updated_at = NOW()
        WHERE id = $11
        RETURNING *
      `, [
        name,
        description,
        type,
        text_content,
        listConfigJson,
        buttonsConfigJson,
        carouselConfigJson,
        pollConfigJson,
        combinedBlocksJson,
        variablesMapJson,
        id
      ]);
      
      console.log('✅ [UPDATE] Query executada com sucesso');

      const template = result.rows[0];

      // Se tem novos arquivos, adicionar
      const uploadedFiles = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const timestamp = Date.now();
          const uniqueName = `${timestamp}_${file.originalname}`;
          const filePath = path.join(MEDIA_DIR, uniqueName);

          fs.renameSync(file.path, filePath);

          const mediaResult = await client.query(`
            INSERT INTO qr_template_media
            (template_id, media_type, file_name, file_path, file_size, mime_type, caption, carousel_card_index)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
          `, [
            template.id,
            file.fieldname.replace('media_', ''),
            uniqueName,
            filePath,
            file.size,
            file.mimetype,
            file.caption || null,
            file.carousel_card_index || null
          ]);

          uploadedFiles.push(mediaResult.rows[0]);
        }
      }
      // Se tem mídia já uploadada (media_url e media_path), associar ao template
      else if (req.body.media_url && req.body.media_path && req.body.media_type) {
        console.log('📎 [UPDATE] Associando mídia já uploadada ao template...');
        console.log('   URL:', req.body.media_url);
        console.log('   Path:', req.body.media_path);
        console.log('   Type:', req.body.media_type);
        
        // Extrair informações do arquivo
        const fileName = path.basename(req.body.media_path);
        let fileSize = 0;
        let mimeType = 'application/octet-stream';
        
        // Detectar mime type baseado na extensão do arquivo
        const ext = path.extname(fileName).toLowerCase();
        const mimeTypes = {
          // Imagens
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml',
          // Vídeos
          '.mp4': 'video/mp4',
          '.avi': 'video/x-msvideo',
          '.mov': 'video/quicktime',
          '.wmv': 'video/x-ms-wmv',
          '.webm': 'video/webm',
          // Áudios
          '.mp3': 'audio/mpeg',
          '.wav': 'audio/wav',
          '.ogg': 'audio/ogg',
          '.m4a': 'audio/mp4',
          // Documentos
          '.pdf': 'application/pdf',
          '.doc': 'application/msword',
          '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.xls': 'application/vnd.ms-excel',
          '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '.txt': 'text/plain'
        };
        
        mimeType = mimeTypes[ext] || 'application/octet-stream';
        console.log(`📎 [UPDATE] Detectando mime type da extensão "${ext}": ${mimeType}`);
        
        // Construir path real do filesystem
        const fullPath = path.join(process.cwd(), req.body.media_path);
        console.log(`📁 [UPDATE] Path completo do arquivo: ${fullPath}`);
        
        // Tentar obter tamanho do arquivo
        try {
          const stats = fs.statSync(fullPath);
          fileSize = stats.size;
          console.log(`✅ [UPDATE] Arquivo encontrado! Tamanho: ${fileSize} bytes`);
        } catch (err) {
          console.warn('⚠️ [UPDATE] Não foi possível obter informações do arquivo:', err.message);
          console.warn('   Tentando path alternativo...');
          
          // Tentar path alternativo: uploads/media/xxx.png (sem barra inicial)
          try {
            const altPath = path.join(process.cwd(), req.body.media_path.substring(1));
            const altStats = fs.statSync(altPath);
            fileSize = altStats.size;
            console.log(`✅ [UPDATE] Arquivo encontrado no path alternativo! Tamanho: ${fileSize} bytes`);
          } catch (altErr) {
            console.error('❌ [UPDATE] Não foi possível encontrar o arquivo em nenhum path');
          }
        }
        
        // Deletar mídia antiga se existir
        await client.query('DELETE FROM qr_template_media WHERE template_id = $1', [template.id]);
        console.log('🗑️ [UPDATE] Mídia antiga removida (se existia)');
        
        // Salvar nova mídia no banco
        const mediaResult = await client.query(`
          INSERT INTO qr_template_media
          (template_id, media_type, file_name, file_path, file_size, mime_type, url, original_name)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `, [
          template.id,
          req.body.media_type,
          fileName,
          req.body.media_path,
          fileSize,
          mimeType,
          req.body.media_url,
          fileName
        ]);

        uploadedFiles.push(mediaResult.rows[0]);
        console.log('✅ [UPDATE] MÍDIA ATUALIZADA!');
        console.log('   Arquivo:', fileName);
        console.log('   Tipo:', req.body.media_type);
        console.log('   MIME:', mimeType);
        console.log('   Tamanho:', fileSize, 'bytes');
      }

      await client.query('COMMIT');

      console.log(`✅ Template atualizado: ${template.name} (ID: ${template.id})`);

      res.json({
        success: true,
        message: 'Template atualizado com sucesso!',
        data: {
          ...template,
          new_media_files: uploadedFiles
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ ============ ERRO AO ATUALIZAR TEMPLATE ============');
      console.error('   Template ID:', req.params.id);
      console.error('   Erro:', error.message);
      console.error('   Tipo:', error.constructor.name);
      console.error('   Stack:', error.stack);
      console.error('   Body keys:', Object.keys(req.body));
      console.error('   Files:', req.files?.length || 0);
      console.error('====================================================');
      
      res.status(500).json({
        success: false,
        error: 'Erro ao atualizar template',
        details: error.message,
        errorType: error.constructor.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    } finally {
      client.release();
    }
  }

  /**
   * Deletar template
   * DELETE /api/qr-templates/:id
   */
  async delete(req, res) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const { id } = req.params;

      // Validar tenant
      if (!req.tenant || !req.tenant.id) {
        throw new Error('Tenant não identificado');
      }

      // ✅ IMPORTANTE: Definir tenant na sessão PostgreSQL para RLS
      await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant_id', req.tenant.id.toString()]);
      console.log(`✅ Tenant ${req.tenant.id} definido na sessão PostgreSQL para DELETE`);

      // 🔑 PASSO 1: Verificar se o template está sendo usado em campanhas
      const campaignsCheck = await client.query(
        'SELECT COUNT(*) FROM qr_campaign_templates WHERE qr_template_id = $1',
        [id]
      );
      
      const messagesCheck = await client.query(
        'SELECT COUNT(*) FROM qr_campaign_messages WHERE qr_template_id = $1',
        [id]
      );

      console.log(`📊 Template ${id} usado em:`, {
        campanhas: campaignsCheck.rows[0].count,
        mensagens: messagesCheck.rows[0].count
      });

      // 🗑️ PASSO 2: Remover referências de campanhas e mensagens
      if (parseInt(campaignsCheck.rows[0].count) > 0) {
        console.log(`🔗 Removendo template ${id} de ${campaignsCheck.rows[0].count} campanha(s)...`);
        await client.query(
          'DELETE FROM qr_campaign_templates WHERE qr_template_id = $1',
          [id]
        );
      }

      if (parseInt(messagesCheck.rows[0].count) > 0) {
        console.log(`🔗 Atualizando ${messagesCheck.rows[0].count} mensagem(ns) enviada(s)...`);
        // Para mensagens já enviadas, não deletar, apenas setar qr_template_id para NULL
        await client.query(
          'UPDATE qr_campaign_messages SET qr_template_id = NULL WHERE qr_template_id = $1',
          [id]
        );
      }

      // 🗂️ PASSO 3: Buscar arquivos de mídia para deletar fisicamente
      const mediaResult = await client.query(
        'SELECT file_path FROM qr_template_media WHERE template_id = $1',
        [id]
      );

      // 🗑️ PASSO 4: Deletar template (CASCADE deleta mídias no banco)
      const result = await client.query(
        'DELETE FROM qr_templates WHERE id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        throw new Error('Template não encontrado');
      }

      // Deletar arquivos físicos
      for (const media of mediaResult.rows) {
        try {
          if (fs.existsSync(media.file_path)) {
            fs.unlinkSync(media.file_path);
            console.log(`🗑️ Arquivo deletado: ${media.file_path}`);
          }
        } catch (err) {
          console.warn(`⚠️ Não foi possível deletar arquivo: ${media.file_path}`, err);
        }
      }

      await client.query('COMMIT');

      console.log(`✅ Template deletado: ${result.rows[0].name} (ID: ${id})`);

      res.json({
        success: true,
        message: 'Template deletado com sucesso!'
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Erro ao deletar template:', error);
      
      res.status(500).json({
        success: false,
        error: 'Erro ao deletar template',
        details: error.message
      });
    } finally {
      client.release();
    }
  }

  /**
   * Deletar arquivo de mídia específico
   * DELETE /api/qr-templates/:templateId/media/:mediaId
   */
  async deleteMedia(req, res) {
    const client = await pool.connect();
    try {
      const { templateId, mediaId } = req.params;

      // Validar tenant
      if (!req.tenant || !req.tenant.id) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }

      // ✅ IMPORTANTE: Definir tenant na sessão PostgreSQL para RLS
      await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant_id', req.tenant.id.toString()]);

      // Buscar arquivo
      const result = await client.query(
        'SELECT * FROM qr_template_media WHERE id = $1 AND template_id = $2',
        [mediaId, templateId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Arquivo não encontrado'
        });
      }

      const media = result.rows[0];

      // 🔒 SEGURANÇA: Deletar do banco COM filtro de tenant (via JOIN com qr_templates)
      await client.query(`
        DELETE FROM qr_template_media 
        WHERE id = $1 
        AND template_id IN (SELECT id FROM qr_templates WHERE tenant_id = $2)
      `, [mediaId, req.tenant.id]);

      // Deletar arquivo físico
      try {
        if (fs.existsSync(media.file_path)) {
          fs.unlinkSync(media.file_path);
          console.log(`🗑️ Arquivo deletado: ${media.file_path}`);
        }
      } catch (err) {
        console.warn(`⚠️ Não foi possível deletar arquivo: ${media.file_path}`, err);
      }

      res.json({
        success: true,
        message: 'Arquivo deletado com sucesso!'
      });

    } catch (error) {
      console.error('❌ Erro ao deletar mídia:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao deletar mídia',
        details: error.message
      });
    } finally {
      client.release();
    }
  }
}

export default new QrTemplateController();

