/**
 * Restriction List Controller
 * Controller para gerenciar listas de restrição de envio
 */

import { Request, Response } from 'express';
import { tenantQuery } from '../database/tenant-query';
import { PhoneValidationService } from '../services/phone-validation.service';
import {
  CreateRestrictionEntryDTO,
  RestrictionListFilterDTO,
  BulkImportDTO,
  CreateKeywordDTO,
  PaginatedResponse,
  RestrictionListEntry,
  DashboardStatsDTO,
  AllListsOverview,
} from '../models/RestrictionList';
import ExcelJS from 'exceljs';

export class RestrictionListController {
  
  // ============================================================
  // CRUD DE ENTRADAS
  // ============================================================

  /**
   * DELETE /api/restriction-list/entries/:id
   * Deletar um clique específico de botão
   */
  async deleteEntry(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const result = await tenantQuery(req, 
        `DELETE FROM button_clicks WHERE id = $1 RETURNING *`,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Clique não encontrado' });
      }

      res.json({
        success: true,
        message: 'Clique excluído com sucesso',
      });
    } catch (error: any) {
      console.error('❌ Erro ao deletar clique:', error);
      res.status(500).json({ error: 'Erro ao deletar clique', details: error.message });
    }
  }

  /**
   * DELETE /api/restriction-list/entries/bulk
   * Deletar múltiplos cliques de uma vez
   */
  async deleteBulkEntries(req: Request, res: Response) {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'IDs inválidos ou vazios' });
      }

      const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
      const result = await tenantQuery(req, 
        `DELETE FROM button_clicks WHERE id IN (${placeholders}) RETURNING id`,
        ids
      );

      res.json({
        success: true,
        message: `${result.rowCount} clique(s) excluído(s) com sucesso`,
        deleted_count: result.rowCount,
      });
    } catch (error: any) {
      console.error('❌ Erro ao deletar cliques em massa:', error);
      res.status(500).json({ error: 'Erro ao deletar cliques', details: error.message });
    }
  }

  /**
   * GET /api/restriction-lists
   * Listar entradas com filtros e paginação
   */
  async list(req: Request, res: Response) {
    try {
      const {
        list_type,
        whatsapp_account_id,
        search,
        added_method,
        date_from,
        date_to,
        page = 1,
        limit = 50,
      } = req.query as any;

      // 🚨 CRÍTICO: Sempre filtrar por tenant
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({
          success: false,
          message: 'Tenant não identificado'
        });
      }

      // 🔒 SEGURANÇA: Filtrar por tenant_id direto na tabela
      let whereConditions = [
        '(e.expires_at IS NULL OR e.expires_at > NOW())',
        'e.tenant_id = $1' // ← FILTRO CRÍTICO DE TENANT!
      ];
      const params: any[] = [tenantId];
      let paramIndex = 2;

      if (list_type) {
        whereConditions.push(`e.list_type = $${paramIndex++}`);
        params.push(list_type);
      }

      if (whatsapp_account_id) {
        whereConditions.push(`e.whatsapp_account_id = $${paramIndex++}`);
        params.push(parseInt(whatsapp_account_id));
      }

      if (search) {
        whereConditions.push(`(
          e.phone_number LIKE $${paramIndex} OR 
          e.contact_name ILIKE $${paramIndex} OR 
          e.phone_number_alt LIKE $${paramIndex} OR
          e.keyword_matched ILIKE $${paramIndex} OR
          e.button_text ILIKE $${paramIndex} OR
          e.notes ILIKE $${paramIndex}
        )`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (added_method) {
        whereConditions.push(`e.added_method = $${paramIndex++}`);
        params.push(added_method);
      }

      if (date_from) {
        whereConditions.push(`e.added_at >= $${paramIndex++}`);
        params.push(date_from);
      }

      if (date_to) {
        whereConditions.push(`e.added_at <= $${paramIndex++}`);
        params.push(date_to);
      }

      const whereClause = whereConditions.length > 0 
        ? 'WHERE ' + whereConditions.join(' AND ')
        : '';

      // Contar total
      const countResult = await tenantQuery(req, 
        `SELECT COUNT(*) as total 
         FROM restriction_list_entries e 
         ${whereClause}`,
        params
      );

      const total = parseInt(countResult.rows[0].total);
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Buscar dados com busca ampliada
      const dataResult = await tenantQuery(req, 
        `SELECT 
          e.*,
          t.name as list_name,
          t.retention_days,
          COALESCE(wa.name, 'Global') as account_name,
          CASE 
            WHEN e.expires_at IS NULL THEN 'Permanente'
            WHEN e.expires_at > NOW() THEN 'Ativo'
            ELSE 'Expirado'
          END as status,
          CASE 
            WHEN e.expires_at IS NOT NULL AND e.expires_at > NOW()
            THEN EXTRACT(DAY FROM (e.expires_at - NOW()))::INTEGER
            ELSE NULL
          END as days_until_expiry
         FROM restriction_list_entries e
         JOIN restriction_list_types t ON e.list_type = t.id
         LEFT JOIN whatsapp_accounts wa ON e.whatsapp_account_id = wa.id
         ${whereClause}
         ORDER BY e.added_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, parseInt(limit), offset]
      );

      const response: PaginatedResponse<any> = {
        data: dataResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      };

      res.json(response);
    } catch (error: any) {
      console.error('❌ Erro ao listar entradas:', error);
      res.status(500).json({ error: 'Erro ao listar entradas', details: error.message });
    }
  }

  /**
   * POST /api/restriction-lists
   * Adicionar contato manualmente (cria as 2 versões automaticamente)
   */
  async create(req: Request, res: Response) {
    try {
      const data: CreateRestrictionEntryDTO = req.body;

      // Validar número de telefone
      const phoneValidation = PhoneValidationService.validate(data.phone_number);

      console.log(`═══════════════════════════════════════════════════════`);
      console.log(`📝 CRIANDO ENTRADA NA LISTA DE RESTRIÇÃO`);
      console.log(`═══════════════════════════════════════════════════════`);
      console.log(`   📞 Input: ${data.phone_number}`);
      console.log(`   ✅ Main (COM 9): ${phoneValidation.mainNumber}`);
      console.log(`   ✅ Alt (SEM 9): ${phoneValidation.alternativeNumber}`);
      console.log(`   📋 Tipo de Lista: ${data.list_type}`);
      console.log(`   📱 Conta WhatsApp ID: ${data.whatsapp_account_id || '🌍 GLOBAL (todas as contas)'}`);
      console.log(`   ✔️  Válido: ${phoneValidation.isValid}`);

      if (!phoneValidation.isValid) {
        console.log(`❌ Número inválido:`, phoneValidation.errors);
        return res.status(400).json({
          error: 'Número de telefone inválido',
          details: phoneValidation.errors,
        });
      }

      // Buscar configuração de dias de retenção da lista
      const listTypeResult = await tenantQuery(req, 
        `SELECT retention_days FROM restriction_list_types WHERE id = $1`,
        [data.list_type]
      );

      const retentionDays = listTypeResult.rows[0]?.retention_days;
      let expiresAt = null;

      if (retentionDays !== null && retentionDays !== undefined) {
        // Calcular data de expiração
        const now = new Date();
        expiresAt = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);
      }

      // 🚨 CRÍTICO: Obter tenant_id
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({
          success: false,
          message: 'Tenant não identificado'
        });
      }

      // NOVA LÓGICA: Verificar individualmente cada versão
      const entries = [];
      let skipped = 0;
      
      // Construir query dinâmica
      let checkQuery = `SELECT id FROM restriction_list_entries 
                        WHERE list_type = $1 
                        AND tenant_id = $2 
                        AND phone_number = $3
                        AND (expires_at IS NULL OR expires_at > NOW())`;
      let checkParams: any[] = [data.list_type, tenantId, phoneValidation.mainNumber];
      
      if (data.whatsapp_account_id) {
        checkQuery += ` AND whatsapp_account_id = $4`;
        checkParams.push(data.whatsapp_account_id);
      }

      // Verificar versão COM 9º dígito
      const checkWith9 = await tenantQuery(req, checkQuery, checkParams);

      // OPÇÃO 2: Auto-preencher campos vazios com telefone
      const finalName = data.contact_name && data.contact_name.trim() ? data.contact_name.trim() : phoneValidation.mainNumber;
      const finalNotes = data.notes && data.notes.trim() ? data.notes : `CPF: ${phoneValidation.mainNumber}`;

      if (checkWith9.rows.length === 0) {
        // NÃO existe COM 9 - CADASTRAR
        console.log(`✅ Versão COM 9 (${phoneValidation.mainNumber}) não existe, inserindo...`);
        const result1 = await tenantQuery(req, 
          `INSERT INTO restriction_list_entries 
           (tenant_id, list_type, whatsapp_account_id, phone_number, phone_number_alt, contact_name, 
            keyword_matched, button_payload, button_text, added_method, campaign_id, message_id, notes, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           RETURNING *`,
          [
            tenantId,
            data.list_type,
            data.whatsapp_account_id,
            phoneValidation.mainNumber,
            null,
            finalName,
            data.keyword_matched || null,
            data.button_payload || null,
            data.button_text || null,
            data.added_method || 'manual',
            data.campaign_id || null,
            data.message_id || null,
            finalNotes,
            expiresAt,
          ]
        );
        entries.push(result1.rows[0]);
      } else {
        console.log(`⏭️ Versão COM 9 (${phoneValidation.mainNumber}) já existe, pulando...`);
        skipped++;
      }

      // Verificar versão SEM 9º dígito (só se for diferente)
      if (phoneValidation.alternativeNumber && phoneValidation.mainNumber !== phoneValidation.alternativeNumber) {
        // Reconstruir query para versão alternativa
        let checkQuery2 = `SELECT id FROM restriction_list_entries 
                          WHERE list_type = $1 
                          AND tenant_id = $2 
                          AND phone_number = $3
                          AND (expires_at IS NULL OR expires_at > NOW())`;
        let checkParams2: any[] = [data.list_type, tenantId, phoneValidation.alternativeNumber];
        
        if (data.whatsapp_account_id) {
          checkQuery2 += ` AND whatsapp_account_id = $4`;
          checkParams2.push(data.whatsapp_account_id);
        }

        const checkWithout9 = await tenantQuery(req, checkQuery2, checkParams2);

        if (checkWithout9.rows.length === 0) {
          // NÃO existe SEM 9 - CADASTRAR
          console.log(`✅ Versão SEM 9 (${phoneValidation.alternativeNumber}) não existe, inserindo...`);
          const result2 = await tenantQuery(req, 
            `INSERT INTO restriction_list_entries 
             (tenant_id, list_type, whatsapp_account_id, phone_number, phone_number_alt, contact_name, 
              keyword_matched, button_payload, button_text, added_method, campaign_id, message_id, notes, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             RETURNING *`,
            [
              tenantId,
              data.list_type,
              data.whatsapp_account_id,
              phoneValidation.alternativeNumber,
              null,
              finalName,
              data.keyword_matched || null,
              data.button_payload || null,
              data.button_text || null,
              data.added_method || 'manual',
              data.campaign_id || null,
              data.message_id || null,
              finalNotes,
              expiresAt,
            ]
          );
          entries.push(result2.rows[0]);
        } else {
          console.log(`⏭️ Versão SEM 9 (${phoneValidation.alternativeNumber}) já existe, pulando...`);
          skipped++;
        }
      }

      // Se nenhuma foi inserida, retornar erro
      if (entries.length === 0) {
        return res.status(409).json({
          error: 'Todas as versões deste contato já existem nesta lista',
          skipped: skipped,
        });
      }

      const result = { rows: entries };

      // Atualizar estatísticas (se tiver conta específica)
      if (data.whatsapp_account_id) {
        await this.updateStats(req, data.list_type, data.whatsapp_account_id, 'added');
      }

      res.status(201).json({
        success: true,
        entries: result.rows,
        count: result.rows.length,
        message: `${result.rows.length} registro(s) adicionado(s) com sucesso (versões com e sem nono dígito)`,
      });
    } catch (error: any) {
      console.error('❌ Erro ao criar entrada:', error);
      res.status(500).json({ error: 'Erro ao criar entrada', details: error.message });
    }
  }

  /**
   * DELETE /api/restriction-lists/:id
   * Remover contato manualmente
   */
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      console.log('🗑️ Deletando entrada ID:', id);

      const result = await tenantQuery(req, 
        'DELETE FROM restriction_list_entries WHERE id = $1 RETURNING *',
        [parseInt(id)]
      );

      console.log('📊 Resultado DELETE:', result.rows);

      if (result.rows.length === 0) {
        console.log('❌ Entrada não encontrada');
        return res.status(404).json({ error: 'Entrada não encontrada' });
      }

      const deleted = result.rows[0];
      console.log('✅ Entrada deletada:', deleted);
      console.log('🔑 Account ID:', deleted.whatsapp_account_id);

      // Atualizar estatísticas (se tiver conta específica)
      if (deleted.whatsapp_account_id) {
        console.log('📊 Atualizando estatísticas...');
        await this.updateStats(req, deleted.list_type, deleted.whatsapp_account_id, 'removed');
      } else {
        console.log('⏭️ Pulando estatísticas (conta global)');
      }

      console.log('✅ Exclusão completa!');
      res.json({
        success: true,
        message: 'Contato removido com sucesso',
      });
    } catch (error: any) {
      console.error('❌ ERRO AO DELETAR ENTRADA:', error);
      console.error('❌ Stack:', error.stack);
      res.status(500).json({ error: 'Erro ao deletar entrada', details: error.message });
    }
  }

  /**
   * DELETE /api/restriction-lists/bulk
   * Remover múltiplos contatos
   */
  async bulkDelete(req: Request, res: Response) {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'IDs inválidos' });
      }

      const result = await tenantQuery(req, 
        `DELETE FROM restriction_list_entries 
         WHERE id = ANY($1::int[])
         RETURNING list_type, whatsapp_account_id`,
        [ids]
      );

      // Atualizar estatísticas (apenas para contas específicas)
      const statsUpdates = new Map<string, number>();
      result.rows.forEach((row) => {
        if (row.whatsapp_account_id) {
          const key = `${row.list_type}_${row.whatsapp_account_id}`;
          statsUpdates.set(key, (statsUpdates.get(key) || 0) + 1);
        }
      });

      for (const [key, count] of statsUpdates) {
        const [list_type, account_id] = key.split('_');
        await this.updateStats(req, list_type as any, parseInt(account_id), 'removed', count);
      }

      res.json({
        success: true,
        deleted_count: result.rows.length,
        message: `${result.rows.length} contato(s) removido(s) com sucesso`,
      });
    } catch (error: any) {
      console.error('❌ Erro ao deletar em massa:', error);
      res.status(500).json({ error: 'Erro ao deletar em massa', details: error.message });
    }
  }

  /**
   * DELETE /api/restriction-lists/delete-all/:list_type
   * Remover TODOS os contatos de uma lista específica
   */
  async deleteAll(req: Request, res: Response) {
    try {
      const { list_type } = req.params;

      console.log(`🗑️ ========================================`);
      console.log(`🗑️ EXCLUINDO TODOS OS CONTATOS DA LISTA: ${list_type}`);
      console.log(`🗑️ ========================================`);

      // Validar list_type
      const validTypes = ['do_not_disturb', 'blocked', 'not_interested'];
      if (!validTypes.includes(list_type)) {
        return res.status(400).json({ 
          error: 'Tipo de lista inválido',
          valid_types: validTypes 
        });
      }

      // 🚨 CRÍTICO: Obter tenant_id
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({
          success: false,
          message: 'Tenant não identificado'
        });
      }

      // Contar quantos registros serão deletados (apenas do tenant)
      const countResult = await tenantQuery(req, 
        `SELECT COUNT(*) as total FROM restriction_list_entries 
         WHERE list_type = $1 AND tenant_id = $2 AND (expires_at IS NULL OR expires_at > NOW())`,
        [list_type, tenantId]
      );

      const totalToDelete = parseInt(countResult.rows[0].total);

      if (totalToDelete === 0) {
        console.log(`⚠️ Nenhum contato encontrado na lista ${list_type}`);
        return res.json({
          success: true,
          deleted_count: 0,
          message: 'Nenhum contato encontrado para excluir',
        });
      }

      console.log(`📊 Total de contatos a excluir: ${totalToDelete}`);

      // Deletar TODOS os contatos da lista do tenant (incluindo expirados)
      const result = await tenantQuery(req, 
        `DELETE FROM restriction_list_entries 
         WHERE list_type = $1 AND tenant_id = $2
         RETURNING id, whatsapp_account_id`,
        [list_type, tenantId]
      );

      const deletedCount = result.rows.length;

      console.log(`✅ ${deletedCount} contato(s) excluído(s) com sucesso!`);

      // Atualizar estatísticas (apenas para contas específicas)
      const accountIds = new Set<number>();
      result.rows.forEach((row) => {
        if (row.whatsapp_account_id) {
          accountIds.add(row.whatsapp_account_id);
        }
      });

      for (const account_id of accountIds) {
        await this.updateStats(req, list_type as any, account_id, 'removed', deletedCount);
      }

      console.log(`🗑️ ========================================\n`);

      res.json({
        success: true,
        deleted_count: deletedCount,
        message: `Todos os ${deletedCount} contato(s) da lista "${list_type}" foram excluídos com sucesso!`,
      });
    } catch (error: any) {
      console.error('❌ Erro ao deletar todos os contatos:', error);
      res.status(500).json({ 
        error: 'Erro ao deletar todos os contatos', 
        details: error.message 
      });
    }
  }

  // ============================================================
  // IMPORTAÇÃO E EXPORTAÇÃO
  // ============================================================

  /**
   * POST /api/restriction-lists/import
   * Importar contatos em massa de arquivo Excel
   */
  async import(req: Request, res: Response) {
    try {
      console.log('📥 ═══════════════════════════════════════════════════');
      console.log('📥 INICIANDO IMPORTAÇÃO DE ARQUIVO');
      console.log('📥 ═══════════════════════════════════════════════════');
      console.log('📋 Headers:', req.headers['content-type']);
      console.log('📋 Body:', req.body);
      console.log('📋 File:', req.file ? {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        buffer_length: req.file.buffer?.length
      } : 'NENHUM ARQUIVO');
      
      if (!req.file) {
        console.error('❌ ERRO: Nenhum arquivo recebido no req.file');
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      const { list_type, whatsapp_account_id } = req.body;
      console.log('📋 Params:', { list_type, whatsapp_account_id, file: req.file.originalname, mimetype: req.file.mimetype });

      const isCSV = req.file.mimetype === 'text/csv' || req.file.mimetype === 'text/plain' || req.file.originalname.endsWith('.csv');
      
      let worksheet: any;
      
      if (isCSV) {
        console.log('📄 Lendo arquivo CSV...');
        // Ler CSV do buffer
        const csvContent = req.file.buffer.toString('utf-8');
        const lines = csvContent.split('\n').filter((line: string) => line.trim());
        
        console.log(`📊 Total de linhas no CSV: ${lines.length}`);
        if (lines.length > 0) {
          console.log(`🔍 Primeira linha (cabeçalho?): "${lines[0]}"`);
          if (lines.length > 1) {
            console.log(`🔍 Segunda linha (dados?): "${lines[1]}"`);
          }
        }
        
        // Detectar separador (vírgula ou ponto-e-vírgula)
        const firstLine = lines[0] || '';
        const separator = firstLine.includes(';') ? ';' : ',';
        console.log(`🔍 Separador detectado: "${separator}"`);
        
        // Criar workbook virtual a partir do CSV
        worksheet = {
          rowCount: lines.length,
          getRow: (rowNumber: number) => {
            if (rowNumber > lines.length) return null;
            const line = lines[rowNumber - 1];
            
            // Split por separador e limpar valores
            const cells = line.split(separator).map((cell: string) => {
              // Remover aspas e espaços
              let cleaned = cell.trim().replace(/^["']|["']$/g, '');
              
              // ✅ CORRIGIR: Converter notação científica do Excel de volta para número
              // Exemplo: 5.6298E+12 -> 5629800000000 -> 5562991785664 (aproximado)
              if (cleaned.match(/^\d+\.?\d*E\+\d+$/i)) {
                try {
                  // Converter de notação científica para string numérica
                  const num = parseFloat(cleaned);
                  cleaned = num.toFixed(0); // Sem casas decimais
                  console.log(`🔢 Convertido notação científica: ${cell.trim()} -> ${cleaned}`);
                } catch (e) {
                  console.warn(`⚠️ Falha ao converter: ${cleaned}`);
                }
              }
              
              return cleaned;
            });
            
            console.log(`🔍 Linha ${rowNumber} células:`, cells);
            
            return {
              getCell: (colNumber: number) => ({
                value: cells[colNumber - 1] || ''
              })
            };
          }
        };
      } else {
        console.log('📊 Lendo arquivo Excel...');
        // Ler Excel do buffer
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        worksheet = workbook.getWorksheet(1);
      }

      if (!worksheet) {
        return res.status(400).json({ error: 'Planilha vazia ou inválida' });
      }

      const results = {
        success: 0,
        skipped: 0,
        errors: [] as any[],
      };

      // ✅ CORRIGIDO: Contar linhas sem usar .eachRow() (não funciona no mock CSV)
      let totalLinhas = 0;
      for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        
        // Pular primeira linha se parecer cabeçalho
        if (rowNumber === 1) {
          const firstCell = row?.getCell(1)?.value?.toString().toLowerCase();
          if (firstCell === 'nome' || firstCell === 'name' || firstCell === 'telefone' || firstCell === 'phone') {
            continue;
          }
        }

        const phone_number = row?.getCell(2)?.value?.toString() || '';
        if (phone_number && phone_number.trim()) {
          totalLinhas++;
        }
      }

      console.log(`📊 Encontradas ${totalLinhas} linhas para processar`);

      // Buscar configuração de dias de retenção da lista
      const listTypeResult = await tenantQuery(req, 
        `SELECT retention_days FROM restriction_list_types WHERE id = $1`,
        [list_type]
      );

      const retentionDays = listTypeResult.rows[0]?.retention_days;
      let expiresAt = null;

      if (retentionDays !== null && retentionDays !== undefined) {
        // Calcular data de expiração
        const now = new Date();
        expiresAt = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);
      }

      console.log(`⏰ Dias de retenção: ${retentionDays === null ? 'Permanente' : retentionDays + ' dias'}`);
      console.log(`📅 Data de expiração: ${expiresAt ? expiresAt.toISOString() : 'Nunca'}`);

      // Processar contatos
      for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        
        // Pular cabeçalho
        if (rowNumber === 1) {
          const firstCell = row.getCell(1).value?.toString().toLowerCase();
          if (firstCell === 'nome' || firstCell === 'name') {
            continue;
          }
        }

        const contact_name = row.getCell(1).value?.toString() || '';
        const phone_number = row.getCell(2).value?.toString() || '';
        const cpf = row.getCell(3).value?.toString() || '';

        if (!phone_number) {
          continue;
        }

        try {
          console.log(`📝 Linha ${rowNumber}: Nome="${contact_name}", Tel="${phone_number}", CPF="${cpf}"`);
          
          // Validar número
          const phoneValidation = PhoneValidationService.validate(phone_number);

          if (!phoneValidation.isValid) {
            console.log(`❌ Linha ${rowNumber}: Número inválido -`, phoneValidation.errors);
            results.errors.push({
              row: rowNumber,
              phone: phone_number,
              error: 'Número inválido',
              details: phoneValidation.errors,
            });
            continue;
          }

          console.log(`✅ Linha ${rowNumber}: Número válido - Main: ${phoneValidation.mainNumber}, Alt: ${phoneValidation.alternativeNumber}`);

          // OPÇÃO 2: Auto-preencher campos vazios com telefone
          const finalName = contact_name && contact_name.trim() ? contact_name.trim() : phoneValidation.mainNumber;
          const finalCpf = cpf && cpf.trim() ? cpf.trim() : phoneValidation.mainNumber;

          console.log(`📝 Linha ${rowNumber}: Nome final="${finalName}", CPF final="${finalCpf}"`);

          let insertedCount = 0;
          const whereClause = whatsapp_account_id ? 'AND whatsapp_account_id = $2' : '';

          // Verificar e inserir versão COM 9º dígito
          const checkWith9 = await tenantQuery(req, 
            `SELECT id FROM restriction_list_entries 
             WHERE list_type = $1 ${whereClause}
             AND phone_number = $${whatsapp_account_id ? '3' : '2'}
             AND (expires_at IS NULL OR expires_at > NOW())`,
            whatsapp_account_id 
              ? [list_type, whatsapp_account_id, phoneValidation.mainNumber]
              : [list_type, phoneValidation.mainNumber]
          );

          if (checkWith9.rows.length === 0) {
            console.log(`💾 Linha ${rowNumber}: Inserindo versão COM 9 (${phoneValidation.mainNumber})...`);
            await tenantQuery(req, 
              `INSERT INTO restriction_list_entries 
               (list_type, whatsapp_account_id, phone_number, phone_number_alt, contact_name, added_method, notes, expires_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                list_type,
                whatsapp_account_id || null,
                phoneValidation.mainNumber,
                null,
                finalName,
                'import',
                `CPF: ${finalCpf}`,
                expiresAt,
              ]
            );
            insertedCount++;
          } else {
            console.log(`⏭️ Linha ${rowNumber}: Versão COM 9 (${phoneValidation.mainNumber}) já existe, pulando...`);
          }

          // Verificar e inserir versão SEM 9º dígito (só se for diferente)
          if (phoneValidation.alternativeNumber && phoneValidation.mainNumber !== phoneValidation.alternativeNumber) {
            const checkWithout9 = await tenantQuery(req, 
              `SELECT id FROM restriction_list_entries 
               WHERE list_type = $1 ${whereClause}
               AND phone_number = $${whatsapp_account_id ? '3' : '2'}
               AND (expires_at IS NULL OR expires_at > NOW())`,
              whatsapp_account_id 
                ? [list_type, whatsapp_account_id, phoneValidation.alternativeNumber]
                : [list_type, phoneValidation.alternativeNumber]
            );

            if (checkWithout9.rows.length === 0) {
              console.log(`💾 Linha ${rowNumber}: Inserindo versão SEM 9 (${phoneValidation.alternativeNumber})...`);
              await tenantQuery(req, 
                `INSERT INTO restriction_list_entries 
                 (list_type, whatsapp_account_id, phone_number, phone_number_alt, contact_name, added_method, notes, expires_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                  list_type,
                  whatsapp_account_id || null,
                  phoneValidation.alternativeNumber,
                  null,
                  finalName,
                  'import',
                  `CPF: ${finalCpf}`,
                  expiresAt,
                ]
              );
              insertedCount++;
            } else {
              console.log(`⏭️ Linha ${rowNumber}: Versão SEM 9 (${phoneValidation.alternativeNumber}) já existe, pulando...`);
            }
          }

          if (insertedCount > 0) {
            console.log(`✅ Linha ${rowNumber}: ${insertedCount} versão(ões) inserida(s)!`);
            results.success++;
          } else {
            console.log(`⏭️ Linha ${rowNumber}: Todas as versões já existem, ignorando...`);
            results.skipped++;
          }
        } catch (error: any) {
          results.errors.push({
            row: rowNumber,
            phone: phone_number,
            error: error.message,
          });
        }
      }

      // Atualizar estatísticas (se tiver conta específica)
      if (results.success > 0 && whatsapp_account_id) {
        await this.updateStats(req, list_type, parseInt(whatsapp_account_id), 'added', results.success);
      }

      console.log('✅ Importação concluída:', results);

      res.json({
        success: true,
        results,
        message: `Importação concluída: ${results.success} adicionados, ${results.skipped} ignorados, ${results.errors.length} erros`,
      });
    } catch (error: any) {
      console.error('❌ Erro ao importar:', error);
      res.status(500).json({ error: 'Erro ao importar', details: error.message });
    }
  }

  /**
   * GET /api/restriction-lists/export
   * Exportar contatos para Excel
   */
  async export(req: Request, res: Response) {
    try {
      const { list_type, whatsapp_account_id } = req.query;

      let whereConditions = ['(e.expires_at IS NULL OR e.expires_at > NOW())'];
      const params: any[] = [];
      let paramIndex = 1;

      if (list_type) {
        whereConditions.push(`e.list_type = $${paramIndex++}`);
        params.push(list_type);
      }

      if (whatsapp_account_id) {
        whereConditions.push(`e.whatsapp_account_id = $${paramIndex++}`);
        params.push(parseInt(whatsapp_account_id as string));
      }

      const whereClause = whereConditions.length > 0 
        ? 'WHERE ' + whereConditions.join(' AND ')
        : '';

      const result = await tenantQuery(req, 
        `SELECT 
          e.phone_number,
          e.phone_number_alt,
          e.contact_name,
          e.list_type,
          t.name as list_name,
          e.keyword_matched,
          e.button_text,
          e.button_payload,
          e.added_method,
          e.added_at,
          e.expires_at,
          e.notes,
          COALESCE(wa.name, 'Todas as contas') as account_name
         FROM restriction_list_entries e
         JOIN restriction_list_types t ON e.list_type = t.id
         LEFT JOIN whatsapp_accounts wa ON e.whatsapp_account_id = wa.id
         ${whereClause}
         ORDER BY e.added_at DESC`,
        params
      );

      // Criar Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Listas de Restrição');

      // Cabeçalhos
      worksheet.columns = [
        { header: 'Telefone', key: 'phone_number', width: 20 },
        { header: 'Telefone Alt.', key: 'phone_number_alt', width: 20 },
        { header: 'Nome', key: 'contact_name', width: 30 },
        { header: 'Lista', key: 'list_name', width: 25 },
        { header: 'Palavra-Chave', key: 'keyword_matched', width: 20 },
        { header: 'Botão Clicado', key: 'button_text', width: 20 },
        { header: 'Payload Botão', key: 'button_payload', width: 20 },
        { header: 'Método', key: 'added_method', width: 15 },
        { header: 'Observações', key: 'notes', width: 40 },
        { header: 'Adicionado Em', key: 'added_at', width: 20 },
        { header: 'Expira Em', key: 'expires_at', width: 20 },
        { header: 'Conta WhatsApp', key: 'account_name', width: 25 },
      ];

      // Estilo do cabeçalho
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4CAF50' },
      };

      // Adicionar dados
      result.rows.forEach((row) => {
        worksheet.addRow({
          phone_number: row.phone_number, // Apenas números, sem formatação
          phone_number_alt: row.phone_number_alt || '',
          contact_name: row.contact_name || '',
          list_name: row.list_name,
          keyword_matched: row.keyword_matched || '',
          button_text: row.button_text || '',
          button_payload: row.button_payload || '',
          added_method: row.added_method,
          notes: row.notes || '',
          added_at: new Date(row.added_at).toLocaleString('pt-BR'),
          expires_at: row.expires_at ? new Date(row.expires_at).toLocaleString('pt-BR') : 'Permanente',
          account_name: row.account_name,
        });
      });

      // Configurar resposta
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=lista_restricao_${list_type || 'todas'}_${Date.now()}.xlsx`
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (error: any) {
      console.error('❌ Erro ao exportar:', error);
      res.status(500).json({ error: 'Erro ao exportar', details: error.message });
    }
  }

  // ============================================================
  // CONFIGURAÇÕES DE PALAVRAS-CHAVE
  // ============================================================

  /**
   * GET /api/restriction-lists/keywords
   * Listar palavras-chave configuradas
   */
  async listKeywords(req: Request, res: Response) {
    try {
      const { list_type, whatsapp_account_id } = req.query;

      let whereConditions = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (list_type) {
        whereConditions.push(`k.list_type = $${paramIndex++}`);
        params.push(list_type);
      }

      if (whatsapp_account_id) {
        whereConditions.push(`k.whatsapp_account_id = $${paramIndex++}`);
        params.push(parseInt(whatsapp_account_id as string));
      }

      const whereClause = whereConditions.length > 0 
        ? 'WHERE ' + whereConditions.join(' AND ')
        : '';

      const result = await tenantQuery(req, 
        `SELECT 
          k.*,
          t.name as list_name,
          COALESCE(wa.name, 'Todas as contas') as account_name
         FROM restriction_list_keywords k
         JOIN restriction_list_types t ON k.list_type = t.id
         LEFT JOIN whatsapp_accounts wa ON k.whatsapp_account_id = wa.id
         ${whereClause}
         ORDER BY k.created_at DESC`,
        params
      );

      res.json(result.rows);
    } catch (error: any) {
      console.error('❌ Erro ao listar keywords:', error);
      res.status(500).json({ error: 'Erro ao listar keywords', details: error.message });
    }
  }

  /**
   * POST /api/restriction-lists/keywords
   * Adicionar palavra-chave
   */
  async createKeyword(req: Request, res: Response) {
    try {
      const data: CreateKeywordDTO = req.body;

      // Verificar duplicata (considerando null também)
      const existingCheck = await tenantQuery(req, 
        `SELECT id FROM restriction_list_keywords 
         WHERE list_type = $1 
         AND (whatsapp_account_id = $2 OR (whatsapp_account_id IS NULL AND $2 IS NULL))
         AND keyword = $3 
         AND keyword_type = $4`,
        [data.list_type, data.whatsapp_account_id || null, data.keyword, data.keyword_type]
      );

      if (existingCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Palavra-chave já existe' });
      }

      const result = await tenantQuery(req, 
        `INSERT INTO restriction_list_keywords 
         (list_type, whatsapp_account_id, keyword, keyword_type, case_sensitive, match_type)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          data.list_type,
          data.whatsapp_account_id || null,
          data.keyword,
          data.keyword_type,
          data.case_sensitive || false,
          data.match_type || 'exact',
        ]
      );

      res.status(201).json({
        success: true,
        keyword: result.rows[0],
      });
    } catch (error: any) {
      console.error('❌ Erro ao criar keyword:', error);
      res.status(500).json({ error: 'Erro ao criar keyword', details: error.message });
    }
  }

  /**
   * DELETE /api/restriction-lists/keywords/:id
   * Remover palavra-chave
   */
  async deleteKeyword(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const result = await tenantQuery(req, 
        'DELETE FROM restriction_list_keywords WHERE id = $1 RETURNING *',
        [parseInt(id)]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Palavra-chave não encontrada' });
      }

      res.json({
        success: true,
        message: 'Palavra-chave removida com sucesso',
      });
    } catch (error: any) {
      console.error('❌ Erro ao deletar keyword:', error);
      res.status(500).json({ error: 'Erro ao deletar keyword', details: error.message });
    }
  }

  /**
   * PATCH /api/restriction-lists/keywords/:id/toggle
   * Ativar/desativar palavra-chave
   */
  async toggleKeyword(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const result = await tenantQuery(req, 
        'UPDATE restriction_list_keywords SET is_active = NOT is_active WHERE id = $1 RETURNING *',
        [parseInt(id)]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Palavra-chave não encontrada' });
      }

      res.json({
        success: true,
        keyword: result.rows[0],
      });
    } catch (error: any) {
      console.error('❌ Erro ao alternar keyword:', error);
      res.status(500).json({ error: 'Erro ao alternar keyword', details: error.message });
    }
  }

  // ============================================================
  // VERIFICAÇÃO DE CONTATO (Para uso em disparos)
  // ============================================================

  /**
   * POST /api/restriction-lists/check
   * Verificar se um contato está em alguma lista
   */
  async checkContact(req: Request, res: Response) {
    try {
      const { phone_number, whatsapp_account_id } = req.body;

      // Validar número
      const phoneValidation = PhoneValidationService.validate(phone_number);

      if (!phoneValidation.isValid) {
        return res.status(400).json({
          error: 'Número inválido',
          details: phoneValidation.errors,
        });
      }

      // Buscar em todas as listas
      const result = await tenantQuery(req, 
        `SELECT 
          e.*,
          t.name as list_name
         FROM restriction_list_entries e
         JOIN restriction_list_types t ON e.list_type = t.id
         WHERE e.whatsapp_account_id = $1 
         AND (e.phone_number = $2 OR e.phone_number = $3 OR e.phone_number_alt = $2 OR e.phone_number_alt = $3)
         AND (e.expires_at IS NULL OR e.expires_at > NOW())`,
        [
          whatsapp_account_id,
          phoneValidation.mainNumber,
          phoneValidation.alternativeNumber,
        ]
      );

      if (result.rows.length > 0) {
        return res.json({
          restricted: true,
          lists: result.rows,
          message: 'Contato está em lista(s) de restrição',
        });
      }

      res.json({
        restricted: false,
        message: 'Contato não está em nenhuma lista de restrição',
      });
    } catch (error: any) {
      console.error('❌ Erro ao verificar contato:', error);
      res.status(500).json({ error: 'Erro ao verificar contato', details: error.message });
    }
  }

  /**
   * POST /api/restriction-lists/check-bulk-single
   * Verificar múltiplos contatos de uma vez (para campanhas)
   * Verifica AMBAS as versões do número (com/sem 9º dígito) nas 3 listas
   */
  async checkBulkSingle(req: Request, res: Response) {
    try {
      const { phone_numbers, whatsapp_account_id } = req.body;

      console.log('═══════════════════════════════════════════════════════');
      console.log('🔍 CHECK-BULK - INÍCIO DA VERIFICAÇÃO');
      console.log('═══════════════════════════════════════════════════════');
      console.log('📞 Phone numbers recebidos:', phone_numbers);
      console.log('🏢 WhatsApp Account ID:', whatsapp_account_id);
      console.log('───────────────────────────────────────────────────────');

      if (!Array.isArray(phone_numbers) || phone_numbers.length === 0) {
        console.log('❌ ERRO: phone_numbers não é array ou está vazio');
        return res.status(400).json({ error: 'phone_numbers deve ser um array não vazio' });
      }

      if (!whatsapp_account_id) {
        console.log('❌ ERRO: whatsapp_account_id não fornecido');
        return res.status(400).json({ error: 'whatsapp_account_id é obrigatório' });
      }

      console.log(`🔍 Verificando ${phone_numbers.length} contatos nas listas de restrição...`);

      // Validar e normalizar todos os números
      const validatedNumbers: Array<{
        original: string;
        main: string;
        alt: string | null;
      }> = [];

      const allMainNumbers: string[] = [];
      const allAltNumbers: string[] = [];

      phone_numbers.forEach((phone: any) => {
        const validation = PhoneValidationService.validate(phone);
        if (validation.isValid) {
          validatedNumbers.push({
            original: phone,
            main: validation.mainNumber,
            alt: validation.alternativeNumber
          });
          allMainNumbers.push(validation.mainNumber);
          if (validation.alternativeNumber) {
            allAltNumbers.push(validation.alternativeNumber);
          }
        }
      });

      console.log(`✅ ${validatedNumbers.length} números validados`);
      console.log(`   → ${allMainNumbers.length} números principais (COM 9)`);
      console.log(`   → ${allAltNumbers.length} números alternativos (SEM 9)`);

      // 🚨 REGRA: Se número está na lista, bloqueia em TODAS as contas!
      const allNumbers = [...allMainNumbers, ...allAltNumbers];
      
      console.log('───────────────────────────────────────────────────────');
      console.log('🔎 BUSCANDO NO BANCO DE DADOS:');
      console.log('   ⚠️  REGRA: Se número está na lista, bloqueia em TODAS as contas!');
      console.log('   Account ID (para referência):', whatsapp_account_id);
      console.log('   Números para buscar:', allNumbers.slice(0, 5), allNumbers.length > 5 ? `... (+${allNumbers.length - 5})` : '');
      console.log('───────────────────────────────────────────────────────');
      
      const result = await tenantQuery(req, 
        `SELECT DISTINCT
          e.phone_number,
          e.whatsapp_account_id,
          e.list_type,
          t.name as list_name,
          t.id as list_id,
          e.contact_name,
          e.added_at,
          e.notes
         FROM restriction_list_entries e
         JOIN restriction_list_types t ON e.list_type = t.id
         WHERE (e.expires_at IS NULL OR e.expires_at > NOW())
         AND e.phone_number = ANY($1::text[])
         ORDER BY e.phone_number, e.list_type`,
        [allNumbers]
      );

      console.log(`📋 RESULTADO DA QUERY: ${result.rows.length} entradas encontradas`);
      if (result.rows.length > 0) {
        console.log('   🚫 Números restritos encontrados:');
        result.rows.forEach((row) => {
          const accountLabel = row.whatsapp_account_id === null ? '🌍 GLOBAL' : `📱 Conta ${row.whatsapp_account_id}`;
          console.log(`   - ${row.phone_number} (${row.list_name}) [${accountLabel}]`);
        });
      } else {
        console.log('   ⚠️ NENHUM número restrito encontrado no banco!');
        console.log('   ℹ️ Verificando se há números cadastrados (de qualquer conta)...');
        
        // Debug: Mostrar o que TEM no banco (TODAS as contas)
        const debugResult = await tenantQuery(req, 
          `SELECT phone_number, list_type, contact_name, whatsapp_account_id
           FROM restriction_list_entries 
           WHERE (expires_at IS NULL OR expires_at > NOW())
           LIMIT 10`,
          []
        );
        
        if (debugResult.rows.length > 0) {
          console.log(`   📝 Encontradas ${debugResult.rows.length} entradas (de todas as contas):`);
          debugResult.rows.forEach((row) => {
            const accountLabel = row.whatsapp_account_id === null ? '🌍 GLOBAL' : `📱 Conta ${row.whatsapp_account_id}`;
            console.log(`      - ${row.phone_number} (${row.list_type}) - ${row.contact_name} [${accountLabel}]`);
          });
        } else {
          console.log(`   ❌ Nenhum número encontrado nas listas!`);
        }
      }
      console.log('───────────────────────────────────────────────────────');

      // Organizar resultados por número original
      const restrictedMap = new Map<string, {
        phone_number: string;
        matched_number: string;
        contact_name: string | null;
        lists: string[];
        list_names: string[];
        details: any[];
      }>();

      // Mapa reverso: número normalizado -> número original
      const numberToOriginal = new Map<string, string>();
      validatedNumbers.forEach((v: any) => {
        numberToOriginal.set(v.main, v.original);
        if (v.alt) {
          numberToOriginal.set(v.alt, v.original);
        }
      });

      result.rows.forEach((row) => {
        const originalNumber = numberToOriginal.get(row.phone_number);
        
        if (!originalNumber) return;

        if (!restrictedMap.has(originalNumber)) {
          restrictedMap.set(originalNumber, {
            phone_number: originalNumber,
            matched_number: row.phone_number,
            contact_name: row.contact_name,
            lists: [],
            list_names: [],
            details: []
          });
        }

        const entry = restrictedMap.get(originalNumber)!;
        if (!entry.lists.includes(row.list_type)) {
          entry.lists.push(row.list_type);
          entry.list_names.push(row.list_name);
          entry.details.push({
            list_type: row.list_type,
            list_name: row.list_name,
            added_at: row.added_at,
            notes: row.notes
          });
        }
      });

      // Contar por tipo de lista
      const countByType: Record<string, number> = {
        do_not_disturb: 0,
        blocked: 0,
        not_interested: 0
      };

      const uniqueByType = new Map<string, Set<string>>();
      uniqueByType.set('do_not_disturb', new Set());
      uniqueByType.set('blocked', new Set());
      uniqueByType.set('not_interested', new Set());

      restrictedMap.forEach((entry: any) => {
        entry.lists.forEach((list_type: any) => {
          uniqueByType.get(list_type)?.add(entry.phone_number);
        });
      });

      countByType.do_not_disturb = uniqueByType.get('do_not_disturb')!.size;
      countByType.blocked = uniqueByType.get('blocked')!.size;
      countByType.not_interested = uniqueByType.get('not_interested')!.size;

      const restrictedDetails = Array.from(restrictedMap.values());

      console.log('═══════════════════════════════════════════════════════');
      console.log('✅ VERIFICAÇÃO CONCLUÍDA:');
      console.log('═══════════════════════════════════════════════════════');
      console.log(`   → Total verificados: ${phone_numbers.length}`);
      console.log(`   → Restritos: ${restrictedDetails.length}`);
      console.log(`   → Livres: ${phone_numbers.length - restrictedDetails.length}`);
      console.log('───────────────────────────────────────────────────────');
      console.log('   Por tipo de lista:');
      console.log(`   → Não Perturbe: ${countByType.do_not_disturb}`);
      console.log(`   → Bloqueados: ${countByType.blocked}`);
      console.log(`   → Sem Interesse: ${countByType.not_interested}`);
      console.log('═══════════════════════════════════════════════════════');

      const responseData = {
        success: true,
        total_checked: phone_numbers.length,
        restricted_count: restrictedDetails.length,
        clean_count: phone_numbers.length - restrictedDetails.length,
        count_by_type: countByType,
        restricted_details: restrictedDetails
      };

      console.log('📤 RESPOSTA ENVIADA AO FRONTEND:');
      console.log(JSON.stringify(responseData, null, 2));
      console.log('═══════════════════════════════════════════════════════\n');

      res.json(responseData);

    } catch (error: any) {
      console.error('❌ Erro ao verificar contatos em massa:', error);
      res.status(500).json({ error: 'Erro ao verificar contatos', details: error.message });
    }
  }

  /**
   * POST /api/restriction-lists/check-bulk
   * Verificar múltiplos contatos de uma vez nas 3 listas de restrição
   * Verifica AMBAS as versões do número (com e sem 9º dígito)
   * 
   * Aceita:
   * - whatsapp_account_ids (campanha WhatsApp API)
   * - instance_ids (campanha QR Connect)
   */
  async checkBulk(req: Request, res: Response) {
    try {
      const { phone_numbers, whatsapp_account_ids, instance_ids } = req.body;

      if (!Array.isArray(phone_numbers) || phone_numbers.length === 0) {
        return res.status(400).json({ error: 'Lista de números inválida ou vazia' });
      }

      // ✅ Aceitar AMBOS: whatsapp_account_ids OU instance_ids
      const accountIds = whatsapp_account_ids || instance_ids;

      if (!Array.isArray(accountIds) || accountIds.length === 0) {
        return res.status(400).json({ error: 'Lista de contas/instâncias inválida ou vazia' });
      }

      console.log(`🔍 Verificando ${phone_numbers.length} contatos em ${accountIds.length} conta(s)/instância(s)...`);

      // Validar e normalizar TODOS os números (gera versões COM e SEM 9º dígito)
      const validatedNumbers = phone_numbers.map(phone => {
        const validation = PhoneValidationService.validate(phone);
        
        // 🐛 DEBUG: Mostrar o que está sendo gerado
        console.log(`🔍 DEBUG Validação:`);
        console.log(`   Input: ${phone}`);
        console.log(`   Main: ${validation.mainNumber}`);
        console.log(`   Alt: ${validation.alternativeNumber}`);
        console.log(`   Válido: ${validation.isValid}`);
        if (validation.errors.length > 0) {
          console.log(`   Erros: ${validation.errors.join(', ')}`);
        }
        
        return {
          original: phone,
          main: validation.mainNumber,
          alt: validation.alternativeNumber
        };
      });

      // Extrair todas as versões dos números (COM e SEM 9)
      const allMainNumbers = validatedNumbers.map((n: any) => n.main);
      const allAltNumbers = validatedNumbers.map((n: any) => n.alt).filter(Boolean);
      const allNumbersToCheck = [...allMainNumbers, ...allAltNumbers];

      console.log(`📞 Total de variações para verificar: ${allNumbersToCheck.length}`);
      console.log(`   Variações: [${allNumbersToCheck.join(', ')}]`);

      // 🚨 CRÍTICO: Filtrar por tenant para evitar vazamento de dados
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({
          success: false,
          message: 'Tenant não identificado'
        });
      }

      // 🚨 REGRA: Se número está na lista DO TENANT, bloqueia em TODAS as contas DO TENANT!
      console.log(`🔍 Buscando restrições no banco de dados:`);
      console.log(`   🏢 Tenant ID: ${tenantId}`);
      console.log(`   ⚠️  REGRA: Se número está na lista DO TENANT, bloqueia em TODAS as contas DO TENANT!`);
      console.log(`   Números para verificar: [${allNumbersToCheck.join(', ')}]`);
      
      const result = await tenantQuery(req, 
        `SELECT DISTINCT
          e.phone_number,
          e.whatsapp_account_id,
          e.list_type,
          t.name as list_name,
          t.id as list_id,
          e.contact_name,
          e.added_at,
          e.added_method
         FROM restriction_list_entries e
         JOIN restriction_list_types t ON e.list_type = t.id
         WHERE (e.expires_at IS NULL OR e.expires_at > NOW())
         AND e.tenant_id = $1
         AND e.phone_number = ANY($2::text[])
         ORDER BY e.phone_number, e.list_type`,
        [
          tenantId,
          allNumbersToCheck
        ]
      );

      console.log(`📊 Encontrados ${result.rows.length} registros restritos`);
      
      // 🐛 DEBUG: Mostrar o que foi encontrado no banco
      if (result.rows.length > 0) {
        console.log(`🚫 ═══════════════════════════════════════════════════`);
        console.log(`🚫 ${result.rows.length} REGISTRO(S) RESTRITO(S) ENCONTRADO(S):`);
        console.log(`🚫 ═══════════════════════════════════════════════════`);
        result.rows.forEach((row, i) => {
          const accountInfo = row.whatsapp_account_id ? `📱 Conta: ${row.whatsapp_account_id}` : '🌍 GLOBAL (todas as contas)';
          console.log(`   [${i+1}] Número: ${row.phone_number}`);
          console.log(`       Lista: ${row.list_name}`);
          console.log(`       ${accountInfo}`);
        });
        console.log(`═══════════════════════════════════════════════════\n`);
      } else {
        console.log(`✅ ═══════════════════════════════════════════════════`);
        console.log(`✅ NENHUM REGISTRO RESTRITO ENCONTRADO!`);
        console.log(`✅ ═══════════════════════════════════════════════════`);
        console.log(`   Números buscados: [${allNumbersToCheck.join(', ')}]`);
        console.log(`   ⚠️  Nota: Busca em TODAS as contas + listas globais`);
        console.log(`   `);
        console.log(`   💡 POSSÍVEIS CAUSAS:`);
        console.log(`      1. As entradas na lista EXPIRARAM`);
        console.log(`      2. O número na lista está com formato diferente`);
        console.log(`      3. Não há entradas na lista de restrição`);
        console.log(`═══════════════════════════════════════════════════\n`);
      }

      // Organizar resultados por número original
      const restrictedMap = new Map();
      
      result.rows.forEach((row) => {
        // Encontrar o número original correspondente
        const matchedContact = validatedNumbers.find(
          v => v.main === row.phone_number || v.alt === row.phone_number
        );
        
        if (matchedContact) {
          const originalPhone = matchedContact.original;
          
          if (!restrictedMap.has(originalPhone)) {
            restrictedMap.set(originalPhone, {
              phone_number: originalPhone,
              phone_number_found: row.phone_number, // Qual versão foi encontrada
              contact_name: row.contact_name || 'Sem nome',
              lists: [],
              list_names: [],
              list_ids: [],
              types: [], // ✅ ADICIONADO
              added_dates: []
            });
          }
          
          const entry = restrictedMap.get(originalPhone);
          if (!entry.lists.includes(row.list_type)) {
            entry.lists.push(row.list_type);
            entry.list_names.push(row.list_name);
            entry.list_ids.push(row.list_id);
            
            // ✅ Adicionar tipo como string legível
            const typeMap: Record<number, string> = {
              1: 'do_not_disturb',
              2: 'blocked',
              3: 'not_interested'
            };
            entry.types.push(typeMap[row.list_type] || `type_${row.list_type}`);
            entry.added_dates.push(row.added_at);
          }
        }
      });

      // Contar por tipo de lista
      const countByType = {
        do_not_disturb: 0,
        blocked: 0,
        not_interested: 0
      };

      restrictedMap.forEach((entry: any) => {
        entry.lists.forEach((listType) => {
          if (countByType[listType] !== undefined) {
            countByType[listType]++;
          }
        });
      });

      const restrictedDetails = Array.from(restrictedMap.values());
      
      console.log(`✅ Resumo: ${restrictedDetails.length} restritos de ${phone_numbers.length} contatos`);
      console.log(`   🔕 Não Perturbe: ${countByType.do_not_disturb}`);
      console.log(`   🚫 Bloqueados: ${countByType.blocked}`);
      console.log(`   ❌ Sem Interesse: ${countByType.not_interested}`);
      
      // 🐛 DEBUG: Mostrar detalhes completos do primeiro restrito
      if (restrictedDetails.length > 0) {
        console.log(`\n📋 Detalhes do primeiro restrito (para debug):`);
        console.log(JSON.stringify(restrictedDetails[0], null, 2));
      }

      res.json({
        success: true,
        total_checked: phone_numbers.length,
        restricted_count: restrictedDetails.length,
        clean_count: phone_numbers.length - restrictedDetails.length,
        count_by_type: countByType,
        restricted_details: restrictedDetails
      });

    } catch (error: any) {
      console.error('❌ Erro ao verificar contatos em massa:', error);
      res.status(500).json({ error: 'Erro ao verificar contatos', details: error.message });
    }
  }

  // ============================================================
  // DASHBOARD E ESTATÍSTICAS
  // ============================================================

  /**
   * GET /api/restriction-lists/stats/dashboard
   * Estatísticas para dashboard
   */
  async getDashboardStats(req: Request, res: Response) {
    try {
      const { list_type, whatsapp_account_id } = req.query;

      // 🚨 CRÍTICO: Obter tenant_id para filtrar
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({
          success: false,
          message: 'Tenant não identificado'
        });
      }

      // Estatísticas gerais (apenas do tenant)
      const statsResult = await tenantQuery(req, 
        `SELECT 
          COUNT(*) as total_entries,
          COUNT(CASE WHEN added_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as added_last_24h,
          COUNT(CASE WHEN added_at >= NOW() - INTERVAL '7 days' THEN 1 END) as added_last_7d,
          COUNT(CASE WHEN added_at >= NOW() - INTERVAL '30 days' THEN 1 END) as added_last_30d,
          COUNT(CASE WHEN expires_at IS NOT NULL AND expires_at <= NOW() + INTERVAL '7 days' AND expires_at > NOW() THEN 1 END) as expiring_soon,
          COUNT(CASE WHEN added_method = 'manual' THEN 1 END) as method_manual,
          COUNT(CASE WHEN added_method = 'webhook_button' THEN 1 END) as method_webhook_button,
          COUNT(CASE WHEN added_method = 'webhook_keyword' THEN 1 END) as method_webhook_keyword,
          COUNT(CASE WHEN added_method = 'import' THEN 1 END) as method_import
         FROM restriction_list_entries
         WHERE tenant_id = $1
         AND list_type = $2 
         AND whatsapp_account_id = $3
         AND (expires_at IS NULL OR expires_at > NOW())`,
        [tenantId, list_type, whatsapp_account_id]
      );

      // Timeline dos últimos 30 dias (apenas do tenant)
      const timelineResult = await tenantQuery(req, 
        `SELECT 
          DATE(added_at) as date,
          COUNT(*) as added
         FROM restriction_list_entries
         WHERE tenant_id = $1
         AND list_type = $2 
         AND whatsapp_account_id = $3
         AND added_at >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(added_at)
         ORDER BY date DESC`,
        [tenantId, list_type, whatsapp_account_id]
      );

      const stats = statsResult.rows[0];

      const response: DashboardStatsDTO = {
        list_type: list_type as any,
        whatsapp_account_id: parseInt(whatsapp_account_id as string),
        total_entries: parseInt(stats.total_entries),
        added_last_24h: parseInt(stats.added_last_24h),
        added_last_7d: parseInt(stats.added_last_7d),
        added_last_30d: parseInt(stats.added_last_30d),
        expiring_soon: parseInt(stats.expiring_soon),
        by_method: {
          manual: parseInt(stats.method_manual),
          webhook_button: parseInt(stats.method_webhook_button),
          webhook_keyword: parseInt(stats.method_webhook_keyword),
          import: parseInt(stats.method_import),
        },
        timeline: timelineResult.rows.map(row => ({
          date: row.date,
          added: parseInt(row.added),
          removed: 0, // TODO: implementar
          expired: 0, // TODO: implementar
        })),
      };

      res.json(response);
    } catch (error: any) {
      console.error('❌ Erro ao buscar estatísticas:', error);
      res.status(500).json({ error: 'Erro ao buscar estatísticas', details: error.message });
    }
  }

  /**
   * GET /api/restriction-lists/stats/overview
   * Visão geral de todas as listas
   */
  async getOverview(req: Request, res: Response) {
    try {
      // 🚨 CRÍTICO: Obter tenant_id para filtrar
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({
          success: false,
          message: 'Tenant não identificado'
        });
      }

      // Query direta ao invés de usar VIEW (para garantir filtro por tenant)
      const result = await tenantQuery(req, `
        SELECT 
          COALESCE(wa.id, 0) as account_id,
          COALESCE(wa.name, 'Global') as account_name,
          e.list_type,
          COUNT(*) as total_entries,
          COUNT(*) FILTER (WHERE e.added_at >= NOW() - INTERVAL '24 hours') as added_last_24h,
          COUNT(*) FILTER (WHERE e.expires_at IS NOT NULL AND e.expires_at <= NOW() + INTERVAL '7 days') as expiring_soon
        FROM restriction_list_entries e
        LEFT JOIN whatsapp_accounts wa ON e.whatsapp_account_id = wa.id
        WHERE e.tenant_id = $1
        AND (e.expires_at IS NULL OR e.expires_at > NOW())
        GROUP BY wa.id, wa.name, e.list_type
        ORDER BY account_name, list_type
      `, [tenantId]);

      // Agrupar por conta
      const accountsMap = new Map();

      result.rows.forEach((row) => {
        if (!accountsMap.has(row.account_id)) {
          accountsMap.set(row.account_id, {
            account_id: row.account_id,
            account_name: row.account_name,
            lists: {
              do_not_disturb: { total: 0, added_today: 0 },
              blocked: { total: 0, added_today: 0, expiring_soon: 0 },
              not_interested: { total: 0, added_today: 0, expiring_soon: 0 },
            },
          });
        }

        const account = accountsMap.get(row.account_id);
        account.lists[row.list_type] = {
          total: parseInt(row.total_entries),
          added_today: parseInt(row.added_last_24h),
          expiring_soon: parseInt(row.expiring_soon),
        };
      });

      // Calcular totais globais (apenas do tenant - reutilizando tenantId já declarado)
      const globalResult = await tenantQuery(req, `
        SELECT 
          list_type,
          COUNT(*) as total
        FROM restriction_list_entries
        WHERE tenant_id = $1
        AND (expires_at IS NULL OR expires_at > NOW())
        GROUP BY list_type
      `, [tenantId]);

      const global_totals: { [key: string]: number } = {
        do_not_disturb: 0,
        blocked: 0,
        not_interested: 0,
      };

      globalResult.rows.forEach((row) => {
        if (row.list_type in global_totals) {
          global_totals[row.list_type] = parseInt(row.total);
        }
      });

      const response: AllListsOverview = {
        accounts: Array.from(accountsMap.values()),
        global_totals: {
          do_not_disturb: global_totals.do_not_disturb || 0,
          blocked: global_totals.blocked || 0,
          not_interested: global_totals.not_interested || 0,
        },
      };

      res.json(response);
    } catch (error: any) {
      console.error('❌ Erro ao buscar overview:', error);
      res.status(500).json({ error: 'Erro ao buscar overview', details: error.message });
    }
  }

  // ============================================================
  // FUNÇÕES AUXILIARES
  // ============================================================

  /**
   * Atualizar estatísticas do dia
   */
  private async updateStats(
    req: Request,
    list_type: string,
    whatsapp_account_id: number,
    action: 'added' | 'removed' | 'expired',
    count: number = 1
  ) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Inserir ou atualizar estatísticas
      await tenantQuery(req, 
        `INSERT INTO restriction_list_stats 
         (list_type, whatsapp_account_id, date, ${action}_today)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (list_type, whatsapp_account_id, date)
         DO UPDATE SET ${action}_today = restriction_list_stats.${action}_today + $4`,
        [list_type, whatsapp_account_id, today, count]
      );

      // Atualizar total
      const totalResult = await tenantQuery(req, 
        `SELECT COUNT(*) as total 
         FROM restriction_list_entries 
         WHERE list_type = $1 
         AND whatsapp_account_id = $2
         AND (expires_at IS NULL OR expires_at > NOW())`,
        [list_type, whatsapp_account_id]
      );

      await tenantQuery(req, 
        `UPDATE restriction_list_stats 
         SET total_entries = $4
         WHERE list_type = $1 AND whatsapp_account_id = $2 AND date = $3`,
        [list_type, whatsapp_account_id, today, parseInt(totalResult.rows[0].total)]
      );
    } catch (error: any) {
      console.error('❌ Erro ao atualizar estatísticas:', error);
    }
  }

  // ============================================================
  // CONFIGURAÇÕES DE TIPOS DE LISTA
  // ============================================================

  /**
   * GET /api/restriction-lists/list-types
   * Obter configurações dos tipos de lista
   */
  async getListTypes(req: Request, res: Response) {
    try {
      const result = await tenantQuery(req, 
        `SELECT id, name, description, retention_days, auto_add_enabled, created_at
         FROM restriction_list_types
         ORDER BY 
           CASE id 
             WHEN 'do_not_disturb' THEN 1
             WHEN 'blocked' THEN 2
             WHEN 'not_interested' THEN 3
             ELSE 4
           END`
      );

      res.json(result.rows);
    } catch (error: any) {
      console.error('❌ Erro ao buscar tipos de lista:', error);
      res.status(500).json({ error: 'Erro ao buscar tipos de lista', details: error.message });
    }
  }

  /**
   * PATCH /api/restriction-lists/list-types/:id
   * Atualizar configurações de um tipo de lista
   */
  async updateListType(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { retention_days } = req.body;

      // Validação
      if (retention_days !== null && (retention_days < 1 || retention_days > 3650)) {
        return res.status(400).json({ error: 'Dias de retenção deve estar entre 1 e 3650, ou null para permanente' });
      }

      // Atualizar tipo de lista
      const result = await tenantQuery(req, 
        `UPDATE restriction_list_types
         SET retention_days = $1
         WHERE id = $2
         RETURNING *`,
        [retention_days, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Tipo de lista não encontrado' });
      }

      // Recalcular datas de expiração de TODOS os contatos existentes nesta lista
      if (retention_days === null) {
        // Se for permanente, remove a data de expiração
        await tenantQuery(req, 
          `UPDATE restriction_list_entries
           SET expires_at = NULL
           WHERE list_type = $1`,
          [id]
        );
      } else {
        // Recalcula a data de expiração baseado na data de adição + novos dias
        await tenantQuery(req, 
          `UPDATE restriction_list_entries
           SET expires_at = added_at + INTERVAL '1 day' * $1
           WHERE list_type = $2`,
          [retention_days, id]
        );
      }

      // Contar quantos contatos foram atualizados
      const countResult = await tenantQuery(req, 
        `SELECT COUNT(*) as total FROM restriction_list_entries WHERE list_type = $1`,
        [id]
      );

      res.json({
        success: true,
        listType: result.rows[0],
        updated_contacts: parseInt(countResult.rows[0].total),
        message: `Configuração atualizada! ${countResult.rows[0].total} contatos tiveram suas datas de expiração recalculadas.`
      });
    } catch (error: any) {
      console.error('❌ Erro ao atualizar tipo de lista:', error);
      res.status(500).json({ error: 'Erro ao atualizar tipo de lista', details: error.message });
    }
  }

  // ============================================================
  // RELATÓRIO DE CLIQUES EM BOTÕES
  // ============================================================

  /**
   * GET /api/button-clicks
   * Listar todos os cliques em botões de todas as contas
   */
  async getButtonClicks(req: Request, res: Response) {
    try {
      const {
        whatsapp_account_id,
        button_text,
        date_from,
        date_to,
        page = 1,
        limit = 50,
      } = req.query as any;

      let whereConditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Filtro por conta (via messages)
      if (whatsapp_account_id) {
        whereConditions.push(`m.whatsapp_account_id = $${paramIndex++}`);
        params.push(whatsapp_account_id);
      }

      // Filtro por botão
      if (button_text) {
        whereConditions.push(`bc.button_text ILIKE $${paramIndex++}`);
        params.push(`%${button_text}%`);
      }

      // Filtro por data - PADRÃO: DIA ATUAL (Horário de Brasília)
      if (date_from && date_to) {
        // Se ambos os filtros forem fornecidos
        // Ajustar para incluir o dia inteiro (de 00:00:00 até 23:59:59)
        whereConditions.push(`bc.clicked_at >= $${paramIndex++}::date`);
        params.push(date_from);
        whereConditions.push(`bc.clicked_at < ($${paramIndex++}::date + INTERVAL '1 day')`);
        params.push(date_to);
      } else if (date_from) {
        // Se só data inicial, a partir dela (início do dia)
        whereConditions.push(`bc.clicked_at >= $${paramIndex++}::date`);
        params.push(date_from);
      } else if (date_to) {
        // Se só data final, até o final do dia
        whereConditions.push(`bc.clicked_at < ($${paramIndex++}::date + INTERVAL '1 day')`);
        params.push(date_to);
      } else {
        // PADRÃO: Apenas cliques de HOJE (horário de Brasília)
        whereConditions.push(`bc.clicked_at >= CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo'`);
        whereConditions.push(`bc.clicked_at < (CURRENT_DATE + INTERVAL '1 day') AT TIME ZONE 'America/Sao_Paulo'`);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Contar total
      const countResult = await tenantQuery(req, 
        `SELECT COUNT(*) as total
         FROM button_clicks bc
         LEFT JOIN messages m ON bc.message_id = m.id
         ${whereClause}`,
        params
      );

      const total = parseInt(countResult.rows[0].total);

      // Buscar registros com paginação
      const offset = (parseInt(page) - 1) * parseInt(limit);
      params.push(limit, offset);

      const result = await tenantQuery(req, 
        `SELECT
           bc.id,
           bc.phone_number,
           bc.contact_name,
           bc.button_text,
           bc.button_payload,
           bc.clicked_at as added_at,
           bc.campaign_id,
           bc.message_id,
           c.name as campaign_name,
           COALESCE(wa.name, 'Conta não identificada') as account_name,
           wa.phone_number as account_phone,
           'N/A' as list_name,
           '' as notes
         FROM button_clicks bc
         LEFT JOIN messages m ON bc.message_id = m.id
         LEFT JOIN campaigns c ON bc.campaign_id = c.id
         LEFT JOIN whatsapp_accounts wa ON m.whatsapp_account_id = wa.id
         ${whereClause}
         ORDER BY bc.clicked_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        params
      );

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar cliques em botões:', error);
      res.status(500).json({ error: 'Erro ao buscar cliques em botões', details: error.message });
    }
  }

  /**
   * GET /api/button-clicks/ranking
   * Ranking dos 5 botões mais clicados
   */
  async getButtonClicksRanking(req: Request, res: Response) {
    try {
      const { date_from, date_to } = req.query as any;

      let whereConditions = ["button_text IS NOT NULL"];
      const params: any[] = [];
      let paramIndex = 1;

      // Filtro por data - PADRÃO: DIA ATUAL (Horário de Brasília)
      if (date_from && date_to) {
        // Se ambos os filtros forem fornecidos
        // Ajustar para incluir o dia inteiro (de 00:00:00 até 23:59:59)
        whereConditions.push(`clicked_at >= $${paramIndex++}::date`);
        params.push(date_from);
        whereConditions.push(`clicked_at < ($${paramIndex++}::date + INTERVAL '1 day')`);
        params.push(date_to);
      } else if (date_from) {
        // Se só data inicial, a partir dela (início do dia)
        whereConditions.push(`clicked_at >= $${paramIndex++}::date`);
        params.push(date_from);
      } else if (date_to) {
        // Se só data final, até o final do dia
        whereConditions.push(`clicked_at < ($${paramIndex++}::date + INTERVAL '1 day')`);
        params.push(date_to);
      } else {
        // PADRÃO: Apenas cliques de HOJE (horário de Brasília)
        whereConditions.push(`clicked_at >= CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo'`);
        whereConditions.push(`clicked_at < (CURRENT_DATE + INTERVAL '1 day') AT TIME ZONE 'America/Sao_Paulo'`);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const result = await tenantQuery(req, 
        `SELECT
           button_text,
           COUNT(*) as total_clicks,
           COUNT(DISTINCT phone_number) as unique_numbers,
           MAX(clicked_at) as last_click
         FROM button_clicks
         ${whereClause}
         GROUP BY button_text
         ORDER BY total_clicks DESC
         LIMIT 5`,
        params
      );

      res.json({
        success: true,
        ranking: result.rows,
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar ranking de botões:', error);
      res.status(500).json({ error: 'Erro ao buscar ranking de botões', details: error.message });
    }
  }

  /**
   * GET /api/button-clicks/export
   * Exportar cliques em botões para Excel
   */
  async exportButtonClicks(req: Request, res: Response) {
    try {
      const { whatsapp_account_id, button_text, date_from, date_to } = req.query as any;

      let whereConditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Filtros
      if (whatsapp_account_id) {
        whereConditions.push(`m.whatsapp_account_id = $${paramIndex++}`);
        params.push(whatsapp_account_id);
      }

      if (button_text) {
        whereConditions.push(`bc.button_text ILIKE $${paramIndex++}`);
        params.push(`%${button_text}%`);
      }

      // Filtro por data - PADRÃO: DIA ATUAL (Horário de Brasília)
      if (date_from && date_to) {
        // Se ambos os filtros forem fornecidos
        // Ajustar para incluir o dia inteiro (de 00:00:00 até 23:59:59)
        whereConditions.push(`bc.clicked_at >= $${paramIndex++}::date`);
        params.push(date_from);
        whereConditions.push(`bc.clicked_at < ($${paramIndex++}::date + INTERVAL '1 day')`);
        params.push(date_to);
      } else if (date_from) {
        // Se só data inicial, a partir dela (início do dia)
        whereConditions.push(`bc.clicked_at >= $${paramIndex++}::date`);
        params.push(date_from);
      } else if (date_to) {
        // Se só data final, até o final do dia
        whereConditions.push(`bc.clicked_at < ($${paramIndex++}::date + INTERVAL '1 day')`);
        params.push(date_to);
      } else {
        // PADRÃO: Apenas cliques de HOJE (horário de Brasília)
        whereConditions.push(`bc.clicked_at >= CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo'`);
        whereConditions.push(`bc.clicked_at < (CURRENT_DATE + INTERVAL '1 day') AT TIME ZONE 'America/Sao_Paulo'`);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const result = await tenantQuery(req, 
        `SELECT
           bc.phone_number,
           bc.contact_name,
           bc.button_text,
           bc.button_payload,
           'N/A' as list_name,
           bc.clicked_at as added_at,
           bc.campaign_id,
           bc.message_id,
           '' as notes,
           COALESCE(wa.name, 'Conta não identificada') as account_name,
           c.name as campaign_name
         FROM button_clicks bc
         LEFT JOIN messages m ON bc.message_id = m.id
         LEFT JOIN campaigns c ON bc.campaign_id = c.id
         LEFT JOIN whatsapp_accounts wa ON m.whatsapp_account_id = wa.id
         ${whereClause}
         ORDER BY bc.clicked_at DESC`,
        params
      );

      // Criar workbook Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Cliques em Botões');

      // Definir colunas
      worksheet.columns = [
        { header: 'Telefone', key: 'phone_number', width: 18 },
        { header: 'Nome', key: 'contact_name', width: 25 },
        { header: 'Botão Clicado', key: 'button_text', width: 25 },
        { header: 'Payload', key: 'button_payload', width: 20 },
        { header: 'Lista', key: 'list_name', width: 20 },
        { header: 'Data/Hora', key: 'added_at', width: 20 },
        { header: 'Conta WhatsApp', key: 'account_name', width: 20 },
        { header: 'Campanha ID', key: 'campaign_id', width: 15 },
        { header: 'Mensagem ID', key: 'message_id', width: 15 },
        { header: 'Observações', key: 'notes', width: 30 },
      ];

      // Estilizar cabeçalho
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF10B981' },
      };

      // Adicionar dados
      result.rows.forEach((row) => {
        worksheet.addRow({
          phone_number: row.phone_number,
          contact_name: row.contact_name,
          button_text: row.button_text,
          button_payload: row.button_payload,
          list_name: row.list_name,
          added_at: new Date(row.added_at).toLocaleString('pt-BR'),
          account_name: row.account_name,
          campaign_id: row.campaign_id,
          message_id: row.message_id,
          notes: row.notes,
        });
      });

      // Configurar resposta
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=cliques-botoes-${new Date().toISOString().split('T')[0]}.xlsx`
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (error: any) {
      console.error('❌ Erro ao exportar cliques em botões:', error);
      res.status(500).json({ error: 'Erro ao exportar cliques em botões', details: error.message });
    }
  }
}

export const restrictionListController = new RestrictionListController();

