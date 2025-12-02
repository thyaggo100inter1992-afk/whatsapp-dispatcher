/**
 * ============================================
 * QR TEMPLATE CONTROLLER
 * ============================================
 * Gerencia templates do WhatsApp QR Connect
 * CRUD completo + upload de mídias
 * ============================================
 */

import { pool } from '../database/connection';
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

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
  async list(req: Request, res: Response) {
    const client = await pool.connect();
    try {
      // 🔒 FILTRAR POR TENANT_ID
      const tenantId = (req as any).tenant?.id;
      console.log('📋 [LIST] Tenant ID do usuário logado:', tenantId);
      console.log('📋 [LIST] req.tenant completo:', (req as any).tenant);
      
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }

      // ✅ IMPORTANTE: Definir tenant na sessão PostgreSQL para RLS
      const setConfigResult = await client.query('SELECT set_config($1, $2, true) as config_set', ['app.current_tenant_id', tenantId.toString()]);
      console.log(`✅ [LIST] set_config result:`, setConfigResult.rows[0]);
      
      // Verificar se foi realmente definido
      const verifyConfigResult = await client.query('SELECT current_setting($1, true) as tenant_value', ['app.current_tenant_id']);
      console.log(`✅ [LIST] current_setting result:`, verifyConfigResult.rows[0]);

      // USAR CONSULTA DIRETA COM TENANT_ID (não depender de RLS)
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
                'carousel_card_index', m.carousel_card_index,
                'block_id', m.block_id,
                'block_order', m.block_order
              ) ORDER BY m.block_order NULLS FIRST, m.carousel_card_index NULLS FIRST, m.id
            ) FILTER (WHERE m.id IS NOT NULL),
            '[]'
          ) as media_files
        FROM qr_templates t
        LEFT JOIN qr_template_media m ON t.id = m.template_id
        WHERE t.tenant_id = $1
        GROUP BY t.id
        ORDER BY t.created_at DESC
      `, [tenantId]);

      console.log(`📋 [LIST] Encontrados ${result.rows.length} template(s) para tenant ${tenantId}`);
      console.log('📋 [LIST] Templates:', result.rows.map(t => ({ id: t.id, name: t.name, type: t.type })));

      res.json({
        success: true,
        data: result.rows,
        total: result.rows.length
      });
    } catch (error: any) {
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
  async getById(req: Request, res: Response) {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      
      // 🔒 FILTRAR POR TENANT_ID
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }

      // ✅ IMPORTANTE: Definir tenant na sessão PostgreSQL para RLS
      await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant_id', tenantId.toString()]);

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
                'carousel_card_index', m.carousel_card_index,
                'block_id', m.block_id,
                'block_order', m.block_order
              ) ORDER BY m.block_order NULLS FIRST, m.carousel_card_index NULLS FIRST, m.id
            ) FILTER (WHERE m.id IS NOT NULL),
            '[]'
          ) as media_files
        FROM qr_templates t
        LEFT JOIN qr_template_media m ON t.id = m.template_id
        WHERE t.id = $1 AND t.tenant_id = $2
        GROUP BY t.id
      `, [id, tenantId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Template não encontrado'
        });
      }

      const template = result.rows[0];
      console.log(`📋 Template #${id} encontrado: ${template.name}`);
      console.log(`   Tipo: ${template.type}`);
      console.log(`   Media files: ${template.media_files?.length || 0}`);
      if (template.media_files && template.media_files.length > 0) {
        template.media_files.forEach((m: any, idx: number) => {
          console.log(`   📎 Media ${idx + 1}: ${m.file_name} (block_id: ${m.block_id || 'N/A'}, card_index: ${m.carousel_card_index || 'N/A'})`);
        });
      }

      res.json({
        success: true,
        data: template
      });
    } catch (error: any) {
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
  async create(req: Request, res: Response) {
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
      // Verificar ambos os formatos possíveis de nome
      const carouselImagesData = req.body['carousel_images[]'] || req.body['carousel_images'];
      console.log('🚀 Carousel Images:', carouselImagesData ? 'SIM' : 'NÃO');
      if (carouselImagesData) {
        const carouselCount = Array.isArray(carouselImagesData) 
          ? carouselImagesData.length 
          : 1;
        console.log('🚀 Quantidade de imagens de carrossel:', carouselCount);
      }
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

      // 🔒 OBTER TENANT_ID
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        throw new Error('Tenant não identificado');
      }

      // Validar tipos permitidos
      const validTypes = ['text', 'image', 'video', 'audio', 'audio_recorded', 'document', 'list', 'buttons', 'carousel', 'poll', 'combined'];
      if (!validTypes.includes(type)) {
        throw new Error(`Tipo inválido. Use: ${validTypes.join(', ')}`);
      }

      // Processar configurações JSON (podem vir como string via FormData)
      const processList = list_config ? (typeof list_config === 'string' ? list_config : JSON.stringify(list_config)) : null;
      const processButtons = buttons_config ? (typeof buttons_config === 'string' ? buttons_config : JSON.stringify(buttons_config)) : null;
      const processCarousel = carousel_config ? (typeof carousel_config === 'string' ? carousel_config : JSON.stringify(carousel_config)) : null;
      const processPoll = poll_config ? (typeof poll_config === 'string' ? poll_config : JSON.stringify(poll_config)) : null;
      const processCombined = combined_blocks ? (typeof combined_blocks === 'string' ? combined_blocks : JSON.stringify(combined_blocks)) : null;
      const processVariables = variables_map ? (typeof variables_map === 'string' ? variables_map : JSON.stringify(variables_map)) : '{}';

      // ✅ IMPORTANTE: Definir tenant na sessão PostgreSQL para RLS
      await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant_id', tenantId.toString()]);
      console.log(`✅ Tenant ${tenantId} definido na sessão PostgreSQL`);

      // Inserir template COM TENANT_ID
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
        processList,
        processButtons,
        processCarousel,
        processPoll,
        processCombined,
        processVariables,
        tenantId
      ]);

      const template = result.rows[0];

      // Se tem arquivos, processar upload
      const uploadedFiles = [];
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
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
            (file as any).caption || null,
            (file as any).carousel_card_index || null
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
        
        // Tentar obter tamanho do arquivo
        try {
          const stats = fs.statSync(req.body.media_path);
          fileSize = stats.size;
          
          // Determinar mime type baseado no tipo
          if (req.body.media_type === 'image') mimeType = 'image/jpeg';
          else if (req.body.media_type === 'video') mimeType = 'video/mp4';
          else if (req.body.media_type === 'audio') mimeType = 'audio/mpeg';
          else if (req.body.media_type === 'document') mimeType = 'application/pdf';
        } catch (err: any) {
          console.warn('⚠️ Não foi possível obter informações do arquivo:', err.message);
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
      
      // Processar imagens de carrossel em blocos combinados
      // Verificar ambos os formatos possíveis: carousel_images[] ou carousel_images
      const carouselImagesField = req.body['carousel_images[]'] || req.body['carousel_images'];
      
      if (carouselImagesField) {
        console.log('🎠 ============================================');
        console.log('🎠 PROCESSANDO IMAGENS DE CARROSSEL DOS BLOCOS');
        console.log('🎠 ============================================');
        
        const carouselImages = Array.isArray(carouselImagesField) 
          ? carouselImagesField 
          : [carouselImagesField];
        
        for (const carouselImageStr of carouselImages) {
          try {
            const carouselImage = typeof carouselImageStr === 'string' 
              ? JSON.parse(carouselImageStr) 
              : carouselImageStr;
            
            console.log(`   📸 Processando imagem do card ${carouselImage.cardIndex}...`);
            console.log(`      Block ID: ${carouselImage.blockId}`);
            console.log(`      Block Order: ${carouselImage.blockOrder}`);
            console.log(`      Card Index: ${carouselImage.cardIndex}`);
            console.log(`      Path: ${carouselImage.path}`);
            
            // Extrair informações do arquivo
            const fileName = path.basename(carouselImage.path);
            let fileSize = 0;
            let mimeType = 'image/jpeg';
            
            // Tentar obter tamanho do arquivo
            try {
              const stats = fs.statSync(carouselImage.path);
              fileSize = stats.size;
            } catch (err: any) {
              console.warn('⚠️ Não foi possível obter informações do arquivo:', err.message);
            }
            
            // Salvar no banco com informações do bloco e card
            const mediaResult = await client.query(`
              INSERT INTO qr_template_media
              (template_id, media_type, file_name, file_path, file_size, mime_type, url, original_name, carousel_card_index, block_id, block_order)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              RETURNING *
            `, [
              template.id,
              'image',
              fileName,
              carouselImage.path,
              fileSize,
              mimeType,
              carouselImage.url,
              fileName,
              carouselImage.cardIndex,
              carouselImage.blockId,
              carouselImage.blockOrder
            ]);
            
            uploadedFiles.push(mediaResult.rows[0]);
            console.log(`      ✅ Imagem do card ${carouselImage.cardIndex} associada!`);
          } catch (err: any) {
            console.error('      ❌ Erro ao processar imagem do carrossel:', err.message);
          }
        }
        
        console.log('🎠 ============================================');
        console.log(`🎠 ${carouselImages.length} IMAGEM(NS) DE CARROSSEL PROCESSADAS!`);
        console.log('🎠 ============================================');
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

    } catch (error: any) {
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
  async update(req: Request, res: Response) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const { id } = req.params;
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

      // 🔒 OBTER TENANT_ID
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        throw new Error('Tenant não identificado');
      }

      // Verificar se existe E pertence ao tenant
      const checkResult = await client.query('SELECT id FROM qr_templates WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
      if (checkResult.rows.length === 0) {
        throw new Error('Template não encontrado');
      }

      // Processar configurações JSON (podem vir como string via FormData)
      const processList = list_config ? (typeof list_config === 'string' ? list_config : JSON.stringify(list_config)) : null;
      const processButtons = buttons_config ? (typeof buttons_config === 'string' ? buttons_config : JSON.stringify(buttons_config)) : null;
      const processCarousel = carousel_config ? (typeof carousel_config === 'string' ? carousel_config : JSON.stringify(carousel_config)) : null;
      const processPoll = poll_config ? (typeof poll_config === 'string' ? poll_config : JSON.stringify(poll_config)) : null;
      const processCombined = combined_blocks ? (typeof combined_blocks === 'string' ? combined_blocks : JSON.stringify(combined_blocks)) : null;
      const processVariables = variables_map ? (typeof variables_map === 'string' ? variables_map : JSON.stringify(variables_map)) : null;

      // Atualizar template (filtrando por tenant_id)
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
        WHERE id = $11 AND tenant_id = $12
        RETURNING *
      `, [
        name,
        description,
        type,
        text_content,
        processList,
        processButtons,
        processCarousel,
        processPoll,
        processCombined,
        processVariables,
        id,
        tenantId
      ]);

      const template = result.rows[0];

      console.log('🔄 ============================================');
      console.log('🔄 ATUALIZANDO TEMPLATE - Dados recebidos:');
      console.log('🔄 Body:', JSON.stringify(req.body, null, 2));
      console.log('🔄 Files:', req.files ? `${req.files.length} arquivo(s)` : 'Nenhum');
      console.log('🔄 Media URL:', req.body.media_url);
      console.log('🔄 Media Path:', req.body.media_path);
      console.log('🔄 Media Type:', req.body.media_type);
      console.log('🔄 ============================================');

      // Se tem novos arquivos, adicionar
      const uploadedFiles = [];
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
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
            (file as any).caption || null,
            (file as any).carousel_card_index || null
          ]);

          uploadedFiles.push(mediaResult.rows[0]);
        }
      }
      
      // Se não tem req.files mas tem media_url (frontend fez upload previamente)
      if ((!req.files || req.files.length === 0) && req.body.media_url && req.body.media_path) {
        console.log('📎 Associando mídia pré-uploaded ao template atualizado...');
        
        let fileName = path.basename(req.body.media_path);
        let fileSize = 0;
        let mimeType = 'application/octet-stream';
        
        try {
          const stats = fs.statSync(req.body.media_path);
          fileSize = stats.size;
          
          // Determinar mime type baseado no tipo
          if (req.body.media_type === 'image') mimeType = 'image/jpeg';
          else if (req.body.media_type === 'video') mimeType = 'video/mp4';
          else if (req.body.media_type === 'audio') mimeType = 'audio/mpeg';
          else if (req.body.media_type === 'document') mimeType = 'application/pdf';
        } catch (err: any) {
          console.warn('⚠️ Não foi possível obter informações do arquivo:', err.message);
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
        console.log('✅ MÍDIA ASSOCIADA AO TEMPLATE ATUALIZADO!');
        console.log('✅ Arquivo:', fileName);
        console.log('✅ Tipo:', req.body.media_type);
        console.log('✅ Tamanho:', fileSize, 'bytes');
        console.log('✅ ============================================');
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

    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('❌ Erro ao atualizar template:', error);
      
      res.status(500).json({
        success: false,
        error: 'Erro ao atualizar template',
        details: error.message
      });
    } finally {
      client.release();
    }
  }

  /**
   * Deletar template
   * DELETE /api/qr-templates/:id
   */
  async delete(req: Request, res: Response) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const { id } = req.params;
      
      // 🔒 OBTER TENANT_ID
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        throw new Error('Tenant não identificado');
      }

      // ⚠️ VERIFICAR SE O TEMPLATE ESTÁ SENDO USADO EM CAMPANHAS ATIVAS (do mesmo tenant)
      const activeCampaignsResult = await client.query(
        `SELECT c.id, c.name, c.status 
         FROM qr_campaigns c
         INNER JOIN qr_campaign_templates ct ON c.id = ct.campaign_id
         WHERE ct.qr_template_id = $1
         AND c.tenant_id = $2
         AND c.status NOT IN ('completed', 'cancelled')
         ORDER BY c.created_at DESC
         LIMIT 5`,
        [id, tenantId]
      );

      if (activeCampaignsResult.rows.length > 0) {
        await client.query('ROLLBACK');
        
        const campaignNames = activeCampaignsResult.rows
          .map((c: any) => `"${c.name}" (${c.status})`)
          .join(', ');
        
        console.log(`❌ Template ${id} não pode ser deletado - ${activeCampaignsResult.rows.length} campanha(s) ativa(s)`);
        
        return res.status(400).json({
          success: false,
          error: 'Campanha em andamento',
          message: `Este template não pode ser deletado pois está sendo usado em ${activeCampaignsResult.rows.length} campanha(s) ativa(s): ${campaignNames}`,
          activeCampaigns: activeCampaignsResult.rows
        });
      }

      // Buscar arquivos de mídia para deletar fisicamente (verificando tenant)
      const mediaResult = await client.query(
        `SELECT m.file_path FROM qr_template_media m
         INNER JOIN qr_templates t ON m.template_id = t.id
         WHERE m.template_id = $1 AND t.tenant_id = $2`,
        [id, tenantId]
      );

      // Deletar template (CASCADE deleta mídias no banco) - FILTRAR POR TENANT
      const result = await client.query(
        'DELETE FROM qr_templates WHERE id = $1 AND tenant_id = $2 RETURNING *',
        [id, tenantId]
      );

      if (result.rows.length === 0) {
        throw new Error('Template não encontrado ou não pertence ao seu tenant');
      }

      // Deletar arquivos físicos
      for (const media of mediaResult.rows) {
        try {
          if (fs.existsSync(media.file_path)) {
            fs.unlinkSync(media.file_path);
            console.log(`🗑️ Arquivo deletado: ${media.file_path}`);
          }
        } catch (err: any) {
          console.warn(`⚠️ Não foi possível deletar arquivo: ${media.file_path}`, err);
        }
      }

      await client.query('COMMIT');

      console.log(`✅ Template deletado: ${result.rows[0].name} (ID: ${id})`);

      res.json({
        success: true,
        message: 'Template deletado com sucesso!'
      });

    } catch (error: any) {
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
  async deleteMedia(req: Request, res: Response) {
    try {
      const { templateId, mediaId } = req.params;

      // Buscar arquivo
      const result = await pool.query(
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
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }
      
      await pool.query(`
        DELETE FROM qr_template_media 
        WHERE id = $1 
        AND template_id IN (SELECT id FROM qr_templates WHERE tenant_id = $2)
      `, [mediaId, tenantId]);

      // Deletar arquivo físico
      try {
        if (fs.existsSync(media.file_path)) {
          fs.unlinkSync(media.file_path);
          console.log(`🗑️ Arquivo deletado: ${media.file_path}`);
        }
      } catch (err: any) {
        console.warn(`⚠️ Não foi possível deletar arquivo: ${media.file_path}`, err);
      }

      res.json({
        success: true,
        message: 'Arquivo deletado com sucesso!'
      });

    } catch (error: any) {
      console.error('❌ Erro ao deletar mídia:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao deletar mídia',
        details: error.message
      });
    }
  }

  /**
   * Deletar TODOS os templates QR
   * DELETE /api/qr-templates/all
   */
  async deleteAll(req: Request, res: Response) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      console.log('🗑️ Verificando se pode deletar todos os templates QR...');

      // ⚠️ VERIFICAR SE EXISTEM CAMPANHAS ATIVAS
      const activeCampaignsResult = await client.query(
        `SELECT id, name, status 
         FROM qr_campaigns
         WHERE status NOT IN ('completed', 'cancelled')
         ORDER BY created_at DESC`
      );

      if (activeCampaignsResult.rows.length > 0) {
        await client.query('ROLLBACK');
        
        const campaignList = activeCampaignsResult.rows
          .slice(0, 5) // Mostrar no máximo 5
          .map((c: any) => `• "${c.name}" (${c.status})`)
          .join('\n');
        
        const totalActive = activeCampaignsResult.rows.length;
        const moreText = totalActive > 5 ? `\n... e mais ${totalActive - 5} campanha(s)` : '';
        
        console.log(`❌ Não é possível deletar - ${totalActive} campanha(s) ativa(s)`);
        
        return res.status(400).json({
          success: false,
          error: 'Campanhas em andamento',
          message: `Não é possível deletar os templates pois existem ${totalActive} campanha(s) ativa(s):\n\n${campaignList}${moreText}\n\nFinalize ou cancele todas as campanhas antes de deletar os templates.`,
          activeCampaigns: activeCampaignsResult.rows
        });
      }

      console.log('✅ Nenhuma campanha ativa encontrada. Prosseguindo com deleção...');

      // 1️⃣ Deletar TODAS as campanhas QR finalizadas/canceladas
      const campaignsResult = await client.query(
        'DELETE FROM qr_campaigns RETURNING id, name'
      );
      const deletedCampaigns = campaignsResult.rows.length;
      console.log(`🗑️ ${deletedCampaigns} campanha(s) QR deletada(s)`);

      // 2️⃣ Buscar TODOS os arquivos de mídia para deletar fisicamente
      const mediaResult = await client.query(
        'SELECT file_path FROM qr_template_media'
      );

      // 3️⃣ Deletar TODOS os templates (CASCADE deleta mídias no banco)
      const result = await client.query(
        'DELETE FROM qr_templates RETURNING id, name'
      );

      const deletedCount = result.rows.length;

      // Deletar arquivos físicos
      let deletedFiles = 0;
      for (const media of mediaResult.rows) {
        try {
          if (fs.existsSync(media.file_path)) {
            fs.unlinkSync(media.file_path);
            deletedFiles++;
          }
        } catch (err: any) {
          console.warn(`⚠️ Não foi possível deletar arquivo: ${media.file_path}`, err);
        }
      }

      await client.query('COMMIT');

      console.log(`✅ ${deletedCampaigns} campanha(s) QR deletada(s)`);
      console.log(`✅ ${deletedCount} template(s) deletado(s)`);
      console.log(`✅ ${deletedFiles} arquivo(s) de mídia deletado(s)`);

      res.json({
        success: true,
        message: `${deletedCampaigns} campanha(s) QR, ${deletedCount} template(s) e ${deletedFiles} arquivo(s) deletado(s) com sucesso!`,
        deletedCampaigns,
        deletedCount,
        deletedFiles
      });
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('❌ Erro ao deletar todos os templates:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao deletar todos os templates',
        details: error.message
      });
    } finally {
      client.release();
    }
  }
}

export default new QrTemplateController();

