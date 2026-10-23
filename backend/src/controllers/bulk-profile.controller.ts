import { Request, Response } from 'express';
import { tenantQuery } from '../database/tenant-query';
import { profileQueueService, ProfileQueueService } from '../services/profile-queue.service';

export class BulkProfileController {
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

      profileQueueService.setInterval(seconds);

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
      const status = profileQueueService.getQueueStatus();
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
      const failures = await profileQueueService.getRecentFailures(limit);

      res.json({
        success: true,
        failures,
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

      const queueId = await profileQueueService.retryFailedItem(parseInt(historyId));

      res.json({
        success: true,
        queueId,
        message: 'Item adicionado à fila novamente',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Atualizar perfil em múltiplas contas
   */
  async updateBulkProfiles(req: Request, res: Response) {
    try {
      const { account_ids, profile_data } = req.body;
      let fields_to_update: string[] = Array.isArray(req.body?.fields_to_update)
        ? [...req.body.fields_to_update]
        : [];

      console.log('\n📋 ========================================');
      console.log('📋 ATUALIZAÇÃO EM MASSA DE PERFIS');
      console.log('📋 ========================================');
      console.log(`📊 Total de contas: ${account_ids?.length || 0}`);
      console.log(`📝 Campos a atualizar: ${fields_to_update?.join(', ')}`);
      console.log(`📦 Dados do perfil:`, profile_data);
      console.log(`🖼️ Logo:`, (req as any).file?.originalname || 'não');

      // Validações
      if (!account_ids || !Array.isArray(account_ids) || account_ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Lista de contas é obrigatória',
        });
      }

      if (!profile_data || typeof profile_data !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Dados do perfil são obrigatórios',
        });
      }

      if (!fields_to_update || !Array.isArray(fields_to_update) || fields_to_update.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Campos a atualizar são obrigatórios',
        });
      }

      // Validar campos permitidos
      const allowedFields = [
        'about',
        'description',
        'email',
        'address',
        'vertical',
        'websites',
        'profile_picture',
        'username',
      ];
      const invalidFields = fields_to_update.filter((field: string) => !allowedFields.includes(field));

      if (invalidFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Campos inválidos: ${invalidFields.join(', ')}. Campos permitidos: ${allowedFields.join(', ')}`,
        });
      }

      if (fields_to_update.includes('username')) {
        const baseUser = String(profile_data?.username || '')
          .trim()
          .replace(/^@+/, '');
        if (!baseUser) {
          return res.status(400).json({
            success: false,
            error: 'Informe o nome de usuário (@) para atualizar.',
          });
        }
        // Em massa o @ é único: com append/{last4} valida um exemplo; senão o valor literal
        const sampleForValidation =
          profile_data?.username_append_last4 || baseUser.includes('{last4}')
            ? `${baseUser.replace(/\{last4\}/g, '').replace(/_+$/, '').slice(0, 30)}_1234`
            : baseUser;
        const validated = ProfileQueueService.validateBusinessUsername(sampleForValidation);
        if (validated.ok === false) {
          return res.status(400).json({ success: false, error: validated.error });
        }
      }

      const logoFile = (req as any).file as
        | { path: string; mimetype: string; originalname: string }
        | undefined;
      if (fields_to_update.includes('profile_picture') && !logoFile) {
        return res.status(400).json({
          success: false,
          error: 'Selecione a imagem da logo para atualizar a foto de perfil.',
        });
      }
      if (logoFile && !fields_to_update.includes('profile_picture')) {
        fields_to_update.push('profile_picture');
      }

      // Buscar contas selecionadas
      const accountsResult = await tenantQuery(
        req,
        `SELECT id, name, phone_number, access_token, phone_number_id, is_active, app_id
         FROM whatsapp_accounts 
         WHERE id = ANY($1::int[])
         ORDER BY name`,
        [account_ids]
      );

      if (accountsResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Nenhuma conta encontrada',
        });
      }

      console.log(`\n✅ ${accountsResult.rows.length} contas encontradas`);

      // Filtrar apenas contas ativas
      const activeAccounts = accountsResult.rows.filter((acc: any) => acc.is_active);
      const inactiveCount = accountsResult.rows.length - activeAccounts.length;

      if (activeAccounts.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Nenhuma conta ativa selecionada',
        });
      }

      if (inactiveCount > 0) {
        console.log(`⚠️  ${inactiveCount} conta(s) inativa(s) serão ignorada(s)`);
      }

      if (fields_to_update.includes('profile_picture')) {
        const withoutAppId = activeAccounts.filter((acc: any) => !String(acc.app_id || '').trim());
        if (withoutAppId.length > 0) {
          return res.status(400).json({
            success: false,
            error: `Para enviar a logo, todas as contas precisam de App ID. Sem App ID: ${withoutAppId
              .map((a: any) => a.name)
              .slice(0, 5)
              .join(', ')}${withoutAppId.length > 5 ? '...' : ''}`,
          });
        }
      }

      const profilePayload = {
        ...profile_data,
        ...(logoFile
          ? {
              logoPath: logoFile.path,
              logoMimeType: logoFile.mimetype,
              logoFileName: logoFile.originalname,
            }
          : {}),
      };

      // Adicionar todas à fila
      const queueIds: string[] = [];
      const results: any[] = [];

      for (const account of activeAccounts) {
        const queueId = profileQueueService.addUpdateProfile({
          accountId: account.id,
          accountPhone: account.phone_number,
          accountName: account.name,
          profileData: profilePayload,
          fieldsToUpdate: fields_to_update,
        });

        queueIds.push(queueId);

        results.push({
          accountId: account.id,
          accountName: account.name,
          phoneNumber: account.phone_number,
          success: true,
          queueId: queueId,
          message: 'Adicionado à fila de processamento',
        });
      }

      const queueStatus = profileQueueService.getQueueStatus();

      console.log(`\n✅ ${results.length} perfis adicionados à fila`);
      console.log(`⏱️  Intervalo: ${queueStatus.interval}s`);
      console.log(`⏱️  Tempo estimado: ${results.length * queueStatus.interval}s`);
      console.log('📋 ========================================\n');

      return res.json({
        success: true,
        results,
        summary: {
          total: account_ids.length,
          queued: results.length,
          skipped: inactiveCount,
          fieldsToUpdate: fields_to_update,
        },
        queue: {
          total: queueStatus.total,
          interval: queueStatus.interval,
          estimatedTime: results.length * queueStatus.interval,
          message: `${results.length} perfil(s) adicionado(s) à fila. Processamento iniciado com intervalo de ${queueStatus.interval}s`,
        },
      });
    } catch (error: any) {
      console.error('❌ Erro ao processar atualização em massa:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Preview: simular atualização sem aplicar
   */
  async previewBulkUpdate(req: Request, res: Response) {
    try {
      const { account_ids, profile_data, fields_to_update } = req.body;

      // Validações (mesmas do updateBulkProfiles)
      if (!account_ids || !Array.isArray(account_ids) || account_ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Lista de contas é obrigatória',
        });
      }

      // Buscar contas
      const accountsResult = await tenantQuery(
        req,
        `SELECT id, name, phone_number, is_active 
         FROM whatsapp_accounts 
         WHERE id = ANY($1::int[])
         ORDER BY name`,
        [account_ids]
      );

      const activeAccounts = accountsResult.rows.filter((acc: any) => acc.is_active);
      const inactiveAccounts = accountsResult.rows.filter((acc: any) => !acc.is_active);

      // Preparar preview dos dados
      const dataToSend: any = {
        messaging_product: 'whatsapp',
      };

      fields_to_update.forEach((field: string) => {
        if (field === 'profile_picture') {
          dataToSend.profile_picture = profile_data?.profile_picture_name || 'logo selecionada';
          return;
        }
        if (field === 'username') {
          dataToSend.username = profile_data?.username;
          if (profile_data?.username_append_last4) {
            dataToSend.username_append_last4 = true;
            dataToSend.username_note =
              'Em várias contas, cada @ recebe o sufixo _XXXX (4 últimos dígitos do número)';
          }
          return;
        }
        if (profile_data[field] !== undefined && profile_data[field] !== null) {
          dataToSend[field] = profile_data[field];
        }
      });

      const queueInterval = profileQueueService.getInterval();
      const estimatedTime = activeAccounts.length * queueInterval;

      res.json({
        success: true,
        preview: {
          totalAccounts: account_ids.length,
          activeAccounts: activeAccounts.length,
          inactiveAccounts: inactiveAccounts.length,
          dataToSend,
          fieldsToUpdate: fields_to_update,
          includesLogo: fields_to_update.includes('profile_picture'),
          queueInterval,
          estimatedTime,
          estimatedTimeFormatted: `${Math.floor(estimatedTime / 60)}m ${estimatedTime % 60}s`,
          accounts: activeAccounts.map((acc: any) => ({
            id: acc.id,
            name: acc.name,
            phone: acc.phone_number,
          })),
          inactiveAccountsList: inactiveAccounts.map((acc: any) => ({
            id: acc.id,
            name: acc.name,
            phone: acc.phone_number,
          })),
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export const bulkProfileController = new BulkProfileController();

