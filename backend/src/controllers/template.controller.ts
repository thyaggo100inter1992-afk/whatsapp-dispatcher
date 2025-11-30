import { Request, Response } from 'express';
import { whatsappService } from '../services/whatsapp.service';
import { templateQueueService } from '../services/template-queue.service';
import { tenantQuery } from '../database/tenant-query';

export class TemplateController {
  /**
   * Configurar intervalo da fila
   */
  async setQueueInterval(req: Request, res: Response) {
    try {
      const { seconds } = req.body;

      if (!seconds || seconds < 1 || seconds > 60) {
        return res.status(400).json({
          success: false,
          error: 'Intervalo deve ser entre 1 e 60 segundos',
        });
      }

      templateQueueService.setInterval(seconds);

      res.json({
        success: true,
        interval: seconds,
        message: `Intervalo configurado para ${seconds} segundos`,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Obter status da fila
   */
  async getQueueStatus(req: Request, res: Response) {
    try {
      const status = templateQueueService.getQueueStatus();
      res.json({
        success: true,
        queue: status,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Obter falhas recentes
   */
  async getRecentFailures(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const failures = await templateQueueService.getRecentFailures(limit);

      res.json({
        success: true,
        failures,
        total: failures.length,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Re-tentar item que falhou
   */
  async retryFailedItem(req: Request, res: Response) {
    try {
      const { historyId } = req.params;
      const { newTemplateName, newTemplateData } = req.body;

      console.log(`\n🔄 Re-tentando item do histórico: ${historyId}`);
      if (newTemplateName) {
        console.log(`   Novo nome: ${newTemplateName}`);
      }

      const queueId = await templateQueueService.retryFailedItem(
        parseInt(historyId),
        newTemplateName,
        newTemplateData
      );

      const queueStatus = templateQueueService.getQueueStatus();

      res.json({
        success: true,
        queueId,
        message: 'Item adicionado novamente à fila',
        queue: {
          total: queueStatus.total,
          interval: queueStatus.interval,
        },
      });
    } catch (error: any) {
      console.error('❌ Erro ao re-tentar item:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Re-tentar todas as falhas
   */
  async retryAllFailures(req: Request, res: Response) {
    try {
      console.log('\n🔄 Re-tentando todas as falhas...');

      const result = await templateQueueService.retryAllFailures();

      console.log(`✅ ${result.total} item(s) adicionado(s) novamente à fila`);

      const queueStatus = templateQueueService.getQueueStatus();

      res.json({
        success: true,
        total: result.total,
        message: `${result.total} item(s) adicionado(s) novamente à fila`,
        queue: {
          total: queueStatus.total,
          interval: queueStatus.interval,
        },
      });
    } catch (error: any) {
      console.error('❌ Erro ao re-tentar todas as falhas:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Criar template em múltiplas contas (COM FILA)
   */
  async createInMultipleAccounts(req: Request, res: Response) {
    try {
      const { accountIds, templateData, useQueue = true, mediaHandles } = req.body;

      if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Nenhuma conta selecionada',
        });
      }

      if (!templateData || !templateData.name || !templateData.category || !templateData.language) {
        return res.status(400).json({
          success: false,
          error: 'Dados do template incompletos',
        });
      }

      console.log('\n');
      console.log('='.repeat(100));
      console.log('📥 BACKEND - RECEBEU REQUISIÇÃO PARA CRIAR TEMPLATE EM MÚLTIPLAS CONTAS');
      console.log('='.repeat(100));
      console.log('');
      console.log('📊 INFORMAÇÕES DA REQUISIÇÃO:');
      console.log('   Template:', templateData.name);
      console.log('   Categoria:', templateData.category);
      console.log('   Idioma:', templateData.language);
      console.log('   Número de Contas:', accountIds.length);
      console.log('   IDs das Contas:', accountIds);
      console.log('   Usar Fila:', useQueue ? 'SIM' : 'NÃO');
      console.log('');
      
      // DEBUG: Verificar components
      console.log('📦 TEMPLATE DATA COMPLETO (recebido do frontend):');
      console.log(JSON.stringify(templateData, null, 2));
      console.log('');
      
      // Verificar se há example dentro do componente HEADER
      const headerComponent = templateData.components?.find((c: any) => c.type === 'HEADER');
      if (headerComponent && headerComponent.example) {
        console.log('✅ EXAMPLE DENTRO DO COMPONENTE HEADER:');
        console.log(JSON.stringify(headerComponent.example, null, 2));
        if (headerComponent.example.header_handle) {
          console.log('   🔗 header_handle:', headerComponent.example.header_handle);
        }
      } else {
        console.log('⚠️  Nenhum example no componente HEADER (pode ser template sem mídia)');
      }
      console.log('');
      
      if (mediaHandles && Object.keys(mediaHandles).length > 0) {
        console.log('✅ MEDIA HANDLES (recebidos do frontend):');
        Object.entries(mediaHandles).forEach(([accountId, handle]) => {
          console.log(`   Conta ${accountId}: ${handle}`);
        });
        console.log('');
      } else {
        console.log('⚠️  MEDIA HANDLES NÃO RECEBIDOS DO FRONTEND!');
        console.log(`   mediaHandles = ${JSON.stringify(mediaHandles)}`);
        console.log('');
      }

      // Buscar dados das contas (incluindo app_id para Resumable Upload)
      const accountsResult = await tenantQuery(
        req,
        'SELECT id, name, phone_number, access_token, business_account_id, app_id FROM whatsapp_accounts WHERE id = ANY($1)',
        [accountIds]
      );

      if (accountsResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Nenhuma conta encontrada',
        });
      }

      const results: any[] = [];

      // Se usar fila, adicionar à fila e retornar imediatamente
      if (useQueue) {
        const queueIds: string[] = [];

        for (const account of accountsResult.rows) {
          // Copiar components mantendo o example
          const accountComponents = JSON.parse(JSON.stringify(templateData.components));
          
          console.log(`\n🔍 [DEBUG] Processando conta ${account.id} (${account.name}):`);
          
          // ✅ CONVERTER URL PARA HANDLE 4::xxx SE NECESSÁRIO
          const headerComponent = accountComponents.find((c: any) => c.type === 'HEADER');
          if (headerComponent && headerComponent.format !== 'TEXT') {
            if (headerComponent.example && headerComponent.example.header_handle) {
              const currentHandle = headerComponent.example.header_handle[0];
              console.log(`   📎 Header handle atual: ${currentHandle.substring(0, 50)}...`);
              
              // Se é URL (não começa com 4::) e a conta tem app_id
              if (!currentHandle.startsWith('4::') && currentHandle.startsWith('http')) {
                if (account.app_id) {
                  console.log(`   🔄 Convertendo URL para handle 4::xxx via Resumable API...`);
                  console.log(`   📱 App ID: ${account.app_id}`);
                  
                  try {
                    const uploadResult = await whatsappService.downloadAndUploadFromUrl({
                      accessToken: account.access_token,
                      appId: account.app_id,
                      imageUrl: currentHandle,
                      accountId: account.id,
                      accountName: account.name,
                    });
                    
                    if (uploadResult.success && uploadResult.mediaHandle) {
                      console.log(`   ✅ Upload bem-sucedido! Handle: ${uploadResult.mediaHandle}`);
                      headerComponent.example.header_handle[0] = uploadResult.mediaHandle;
                    } else {
                      console.error(`   ❌ Erro no upload: ${uploadResult.error}`);
                      console.error(`   ⚠️  Mantendo URL original (template pode falhar)`);
                    }
                  } catch (error: any) {
                    console.error(`   ❌ Exceção no upload: ${error.message}`);
                    console.error(`   ⚠️  Mantendo URL original (template pode falhar)`);
                  }
                } else {
                  console.warn(`   ⚠️  URL fornecida mas App ID não configurado!`);
                  console.warn(`   ⚠️  Configure o App ID nas configurações da conta para usar Resumable Upload API`);
                }
              } else if (currentHandle.startsWith('4::')) {
                console.log(`   ✅ Handle já está no formato correto (4::xxx)`);
              }
            }
          }

          // Construir templateData para a fila
          // O example está DENTRO do componente HEADER, conforme documentação WhatsApp
          const queueTemplateData: any = {
            name: templateData.name,
            category: templateData.category,
            language: templateData.language,
            components: accountComponents,
          };

          const queueId = templateQueueService.addCreateTemplate({
            accountId: account.id,
            accountPhone: account.phone_number,
            templateName: templateData.name,
            templateData: queueTemplateData,
            tenantId: (req as any).tenantId,
          });

          queueIds.push(queueId);

          results.push({
            accountId: account.id,
            accountName: account.name,
            phoneNumber: account.phone_number,
            success: true,
            queueId: queueId,
            message: 'Adicionado à fila de processamento',
            status: 'PENDING',
            category: templateData.category,
          });
        }

        const queueStatus = templateQueueService.getQueueStatus();

        return res.json({
          success: true,
          results,
          summary: {
            total: results.length,
            queued: results.length,
          },
          queue: {
            total: queueStatus.total,
            interval: queueStatus.interval,
            message: `${results.length} template(s) adicionado(s) à fila. Processamento iniciado com intervalo de ${queueStatus.interval}s`,
          },
        });
      }

      // Processamento direto (sem fila) - modo antigo
      for (const account of accountsResult.rows) {
        console.log(`\n📞 Processando conta: ${account.phone_number} (ID: ${account.id})`);

        try {
          // Copiar components mantendo o example
          const accountComponents = JSON.parse(JSON.stringify(templateData.components));
          
          console.log(`\n🔍 [DEBUG] Processando conta ${account.id} (${account.name}):`);
          
          // ✅ CONVERTER URL PARA HANDLE 4::xxx SE NECESSÁRIO
          const headerComponent = accountComponents.find((c: any) => c.type === 'HEADER');
          if (headerComponent && headerComponent.format !== 'TEXT') {
            if (headerComponent.example && headerComponent.example.header_handle) {
              const currentHandle = headerComponent.example.header_handle[0];
              console.log(`   📎 Header handle atual: ${currentHandle.substring(0, 50)}...`);
              
              // Se é URL (não começa com 4::) e a conta tem app_id
              if (!currentHandle.startsWith('4::') && currentHandle.startsWith('http')) {
                if (account.app_id) {
                  console.log(`   🔄 Convertendo URL para handle 4::xxx via Resumable API...`);
                  console.log(`   📱 App ID: ${account.app_id}`);
                  
                  try {
                    const uploadResult = await whatsappService.downloadAndUploadFromUrl({
                      accessToken: account.access_token,
                      appId: account.app_id,
                      imageUrl: currentHandle,
                      accountId: account.id,
                      accountName: account.name,
                    });
                    
                    if (uploadResult.success && uploadResult.mediaHandle) {
                      console.log(`   ✅ Upload bem-sucedido! Handle: ${uploadResult.mediaHandle}`);
                      headerComponent.example.header_handle[0] = uploadResult.mediaHandle;
                    } else {
                      console.error(`   ❌ Erro no upload: ${uploadResult.error}`);
                      console.error(`   ⚠️  Mantendo URL original (template pode falhar)`);
                    }
                  } catch (error: any) {
                    console.error(`   ❌ Exceção no upload: ${error.message}`);
                    console.error(`   ⚠️  Mantendo URL original (template pode falhar)`);
                  }
                } else {
                  console.warn(`   ⚠️  URL fornecida mas App ID não configurado!`);
                  console.warn(`   ⚠️  Configure o App ID nas configurações da conta para usar Resumable Upload API`);
                }
              } else if (currentHandle.startsWith('4::')) {
                console.log(`   ✅ Handle já está no formato correto (4::xxx)`);
              }
            }
          }

          // Construir templateData COM example
          // O example está DENTRO do componente HEADER, conforme documentação WhatsApp
          const apiTemplateData: any = {
            name: templateData.name,
            category: templateData.category,
            language: templateData.language,
            components: accountComponents,
          };

          const result = await whatsappService.createTemplate({
            accessToken: account.access_token,
            businessAccountId: account.business_account_id,
            templateData: apiTemplateData,
            accountId: account.id,
            accountName: account.name,
            tenantId: (req as any).tenant?.id,
          });

          if (result.success) {
            // Salvar template no banco de dados local
            try {
              await tenantQuery(
                req,
                `INSERT INTO templates 
                 (whatsapp_account_id, template_name, status, category, language, components, has_media, media_type, tenant_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (whatsapp_account_id, template_name) 
                 DO UPDATE SET 
                   status = EXCLUDED.status,
                   category = EXCLUDED.category,
                   language = EXCLUDED.language,
                   components = EXCLUDED.components,
                   updated_at = NOW()`,
                [
                  account.id,
                  templateData.name,
                  result.data.status || 'PENDING',
                  result.data.category || templateData.category,
                  templateData.language,
                  JSON.stringify(templateData.components),
                  false, // has_media - será atualizado depois se necessário
                  null,  // media_type
                  (req as any).tenantId
                ]
              );
              console.log('   ✅ Template salvo no banco de dados local');
            } catch (dbError: any) {
              console.error('   ⚠️ Erro ao salvar no banco (mas template foi criado):', dbError.message);
            }

            results.push({
              accountId: account.id,
              phoneNumber: account.phone_number,
              success: true,
              message: result.message,
              templateId: result.data.id,
              status: result.data.status,
              category: result.data.category,
            });

            console.log(`   ✅ Template criado com sucesso!`);
          } else {
            results.push({
              accountId: account.id,
              phoneNumber: account.phone_number,
              success: false,
              error: result.error,
            });

            console.log(`   ❌ Erro: ${result.error}`);
          }
        } catch (error: any) {
          results.push({
            accountId: account.id,
            phoneNumber: account.phone_number,
            success: false,
            error: error.message,
          });

          console.error(`   ❌ Erro ao processar conta:`, error.message);
        }
      }

      // Contar sucessos e erros
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;

      console.log(`\n📊 ===== RESULTADO FINAL =====`);
      console.log(`   ✅ Sucesso: ${successCount}`);
      console.log(`   ❌ Erro: ${errorCount}`);
      console.log(`   📋 Total: ${results.length}`);
      console.log(`==============================\n`);

      res.json({
        success: true,
        results,
        summary: {
          total: results.length,
          success: successCount,
          errors: errorCount,
        },
      });
    } catch (error: any) {
      console.error('❌ Erro ao criar templates:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Listar templates de uma conta
   */
  async listByAccount(req: Request, res: Response) {
    try {
      const { accountId } = req.params;

      const result = await tenantQuery(
        req,
        'SELECT * FROM templates WHERE whatsapp_account_id = $1 ORDER BY created_at DESC',
        [accountId]
      );

      res.json({
        success: true,
        templates: result.rows,
      });
    } catch (error: any) {
      console.error('Error listing templates:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Deletar template de uma conta (COM FILA)
   */
  async deleteTemplate(req: Request, res: Response) {
    try {
      const { accountId, templateName } = req.params;
      const { useQueue = true } = req.body;
      const tenantId = (req as any).tenant?.id || (req as any).tenantId;

      console.log(`\n🗑️ ===== DELETANDO TEMPLATE =====`);
      console.log('   Conta ID:', accountId);
      console.log('   Template:', templateName);
      console.log('   Usar fila:', useQueue);

      // Buscar dados da conta
      const accountResult = await tenantQuery(
        req,
        'SELECT id, phone_number, access_token, business_account_id FROM whatsapp_accounts WHERE id = $1',
        [accountId]
      );

      if (accountResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Conta não encontrada',
        });
      }

      const account = accountResult.rows[0];

      // Se usar fila, adicionar à fila e retornar
      if (useQueue) {
        const queueId = templateQueueService.addDeleteTemplate({
          accountId: account.id,
          accountPhone: account.phone_number,
          templateName: templateName,
          tenantId,
        });

        const queueStatus = templateQueueService.getQueueStatus();

        return res.json({
          success: true,
          queueId: queueId,
          message: 'Template adicionado à fila de exclusão',
          queue: {
            total: queueStatus.total,
            interval: queueStatus.interval,
          },
        });
      }

      // Processamento direto (sem fila) - modo antigo
      const result = await whatsappService.deleteTemplate({
        accessToken: account.access_token,
        businessAccountId: account.business_account_id,
        templateName: templateName,
        accountId: account.id,
        accountName: account.name,
        tenantId,
      });

      if (result.success) {
        // Deletar do banco de dados local
        try {
          await tenantQuery(
            req,
            'DELETE FROM templates WHERE whatsapp_account_id = $1 AND template_name = $2',
            [accountId, templateName]
          );
          console.log('   ✅ Template removido do banco de dados local');
        } catch (dbError: any) {
          console.error('   ⚠️ Erro ao remover do banco (mas template foi deletado):', dbError.message);
        }

        console.log(`✅ Template "${templateName}" deletado com sucesso!`);
        console.log(`==============================\n`);

        res.json({
          success: true,
          message: 'Template deletado com sucesso',
        });
      } else {
        console.log(`❌ Erro ao deletar: ${result.error}`);
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error: any) {
      console.error('❌ Erro ao deletar template:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Sincronizar templates de todas as contas
   */
  async syncAllAccounts(req: Request, res: Response) {
    try {
      const accountsResult = await tenantQuery(
        req,
        'SELECT id, phone_number, access_token, business_account_id FROM whatsapp_accounts WHERE is_active = true'
      );

      let totalSynced = 0;

      for (const account of accountsResult.rows) {
        console.log(`\n🔄 Sincronizando templates da conta: ${account.phone_number}`);

        const templatesResult = await whatsappService.getTemplates(
          account.access_token,
          account.business_account_id,
          account.id,
          account.phone_number
        );

        if (templatesResult.success && templatesResult.templates) {
          for (const template of templatesResult.templates) {
            // Detectar se tem mídia
            const hasMedia = template.components?.some((c: any) =>
              c.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'].includes(c.format)
            );

            const mediaType = hasMedia
              ? template.components.find((c: any) => c.type === 'HEADER')?.format?.toLowerCase()
              : null;

            await tenantQuery(
              req,
              `INSERT INTO templates 
               (whatsapp_account_id, template_name, status, category, language, components, has_media, media_type, tenant_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (whatsapp_account_id, template_name) 
               DO UPDATE SET 
                 status = EXCLUDED.status,
                 category = EXCLUDED.category,
                 language = EXCLUDED.language,
                 components = EXCLUDED.components,
                 has_media = EXCLUDED.has_media,
                 media_type = EXCLUDED.media_type,
                 updated_at = NOW()`,
              [
                account.id,
                template.name,
                template.status,
                template.category,
                template.language,
                JSON.stringify(template.components),
                hasMedia,
                mediaType,
                (req as any).tenantId
              ]
            );

            totalSynced++;
          }

          console.log(`   ✅ ${templatesResult.templates.length} templates sincronizados`);
        } else {
          console.log(`   ⚠️ Erro ao buscar templates: ${templatesResult.error}`);
        }
      }

      res.json({
        success: true,
        message: `${totalSynced} templates sincronizados`,
        totalSynced,
      });
    } catch (error: any) {
      console.error('Error syncing templates:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Buscar histórico de templates
   */
  async getHistory(req: Request, res: Response) {
    try {
      console.log('\n📋 ===== BUSCANDO HISTÓRICO DE TEMPLATES =====');
      console.log('   Tenant ID:', (req as any).tenantId || 1);
      
      // Usar query direta ao invés de tenantQuery
      const { query } = await import('../database/connection');
      const result = await query(
        `SELECT 
          tqh.id,
          tqh.queue_id,
          tqh.type,
          tqh.status,
          tqh.whatsapp_account_id as account_id,
          tqh.template_name,
          tqh.error_message,
          tqh.created_at,
          tqh.processed_at,
          tqh.template_data,
          wa.name as account_name,
          wa.phone_number,
          wa.proxy_id
        FROM template_queue_history tqh
        LEFT JOIN whatsapp_accounts wa ON tqh.whatsapp_account_id = wa.id
        WHERE tqh.tenant_id = $1 OR tqh.tenant_id IS NULL
        ORDER BY tqh.created_at DESC
        LIMIT 500`,
        [(req as any).tenantId || 1]
      );

      // Processar dados para adicionar informações de proxy
      const historyWithProxy = await Promise.all(
        result.rows.map(async (row) => {
          let proxyUsed = false;
          let proxyHost = null;
          let proxyType = null;

          // Buscar informações do proxy se existir
          if (row.proxy_id) {
            const proxyResult = await query(
              `SELECT host, type FROM proxies WHERE id = $1 AND tenant_id = $2`,
              [row.proxy_id, (req as any).tenantId || 1]
            );
            
            if (proxyResult.rows.length > 0) {
              proxyUsed = true;
              proxyHost = proxyResult.rows[0].host;
              proxyType = proxyResult.rows[0].type;
            }
          }

          // Extrair categoria do template_data se disponível
          let category = 'UTILITY';
          if (row.template_data && row.template_data.category) {
            category = row.template_data.category;
          }

          return {
            id: row.id,
            template_name: row.template_name,
            account_id: row.account_id,
            account_name: row.account_name || 'Conta desconhecida',
            phone_number: row.phone_number || '',
            status: row.status,
            type: row.type || 'create', // CREATE, DELETE, EDIT, CLONE
            category: category,
            created_at: row.created_at,
            error_message: row.error_message,
            proxy_used: proxyUsed,
            proxy_host: proxyHost,
            proxy_type: proxyType,
          };
        })
      );

      console.log(`   ✅ ${historyWithProxy.length} registros encontrados`);

      res.json(historyWithProxy);
    } catch (error: any) {
      console.error('❌ Erro ao buscar histórico:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Atualizar status dos templates buscando da API do WhatsApp
   */
  async updateTemplateStatuses(req: Request, res: Response) {
    try {
      console.log('\n🔄 ===== ATUALIZANDO STATUS DOS TEMPLATES =====');
      
      const { query } = await import('../database/connection');
      
      // Buscar templates PENDING do histórico
      const pendingTemplates = await query(
        `SELECT DISTINCT
          tqh.id,
          tqh.template_name,
          tqh.whatsapp_account_id,
          tqh.status,
          wa.access_token,
          wa.business_account_id,
          wa.name as account_name
        FROM template_queue_history tqh
        LEFT JOIN whatsapp_accounts wa ON tqh.whatsapp_account_id = wa.id
        WHERE tqh.status = 'PENDING'
          AND (tqh.tenant_id = $1 OR tqh.tenant_id IS NULL)
          AND wa.access_token IS NOT NULL
        LIMIT 50`,
        [(req as any).tenantId || 1]
      );

      console.log(`📊 Encontrados ${pendingTemplates.rows.length} templates pendentes para atualizar`);

      let updated = 0;
      let unchanged = 0;

      // Agrupar por conta para fazer menos requisições
      const accountsMap = new Map();
      for (const row of pendingTemplates.rows) {
        if (!accountsMap.has(row.whatsapp_account_id)) {
          accountsMap.set(row.whatsapp_account_id, {
            access_token: row.access_token,
            business_account_id: row.business_account_id,
            account_name: row.account_name,
            templates: []
          });
        }
        accountsMap.get(row.whatsapp_account_id).templates.push(row);
      }

      // Buscar templates reais da API para cada conta
      for (const [accountId, accountData] of accountsMap.entries()) {
        console.log(`\n🔍 Buscando templates da conta ${accountData.account_name}...`);
        
        const apiTemplates = await whatsappService.getTemplates(
          accountData.access_token,
          accountData.business_account_id,
          accountId,
          accountData.account_name
        );

        if (!apiTemplates.success) {
          console.error(`❌ Erro ao buscar templates da conta ${accountId}:`, apiTemplates.error);
          continue;
        }

        // Atualizar status e categoria de cada template
        for (const historyTemplate of accountData.templates) {
          const apiTemplate = apiTemplates.templates.find(
            (t: any) => t.name === historyTemplate.template_name
          );

          if (!apiTemplate) {
            continue; // Template não encontrado na API
          }

          // Verificar se houve mudança no status ou categoria
          const statusChanged = apiTemplate.status !== historyTemplate.status;
          const categoryChanged = apiTemplate.category && apiTemplate.category !== historyTemplate.template_data?.category;
          
          if (statusChanged || categoryChanged) {
            const changes = [];
            if (statusChanged) {
              changes.push(`status: ${historyTemplate.status} → ${apiTemplate.status}`);
            }
            if (categoryChanged) {
              changes.push(`categoria: ${historyTemplate.template_data?.category || 'N/A'} → ${apiTemplate.category}`);
            }
            
            console.log(`   ✅ Atualizando "${historyTemplate.template_name}":`);
            console.log(`      ${changes.join(', ')}`);
            
            // Atualizar template_data com nova categoria
            let updatedTemplateData = historyTemplate.template_data || {};
            if (categoryChanged) {
              updatedTemplateData.category = apiTemplate.category;
            }
            
            // Atualizar no histórico (status E categoria)
            await query(
              `UPDATE template_queue_history 
               SET status = $1, template_data = $2
               WHERE id = $3`,
              [apiTemplate.status, JSON.stringify(updatedTemplateData), historyTemplate.id]
            );

            // Atualizar também na tabela templates (status E categoria)
            await query(
              `UPDATE templates 
               SET status = $1, category = $2, updated_at = NOW()
               WHERE whatsapp_account_id = $3 AND template_name = $4`,
              [apiTemplate.status, apiTemplate.category || 'UTILITY', historyTemplate.whatsapp_account_id, historyTemplate.template_name]
            );

            updated++;
          } else {
            unchanged++;
          }
        }
      }

      console.log(`\n✅ Atualização concluída:`);
      console.log(`   📝 Atualizados: ${updated}`);
      console.log(`   ⏸️  Sem mudança: ${unchanged}`);

      res.json({
        success: true,
        updated,
        unchanged,
        message: `${updated} template(s) atualizado(s)`
      });
    } catch (error: any) {
      console.error('❌ Erro ao atualizar status:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Excluir registro do histórico
   */
  async deleteHistory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      console.log(`\n🗑️ ===== EXCLUINDO REGISTRO DO HISTÓRICO =====`);
      console.log(`   ID: ${id}`);

      const { query } = await import('../database/connection');
      const result = await query(
        `DELETE FROM template_queue_history 
         WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
         RETURNING *`,
        [parseInt(id), (req as any).tenantId || 1]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Registro não encontrado',
        });
      }

      console.log(`   ✅ Registro excluído com sucesso`);

      res.json({
        success: true,
        message: 'Registro excluído com sucesso',
      });
    } catch (error: any) {
      console.error('❌ Erro ao excluir registro:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export const templateController = new TemplateController();

