import crypto from 'crypto';
import { Request, Response } from 'express';
import { pool } from '../database/connection';
import { hashKey, ensureTable } from '../middleware/integration-auth.middleware';
import { WhatsAppAccountModel } from '../models/WhatsAppAccount';
import { whatsappService } from '../services/whatsapp.service';
import { MessageController } from './message.controller';
import { RestrictionListController } from './restriction-list.controller';

const { generateIntegrationToken } = require('../middleware/auth.middleware');
const { getInstanceWithCredentials } = require('../helpers/instance-credentials.helper');
const {
  listOficialAccounts,
  listQrInstances,
  userHasOficialAccount,
  userHasQrInstance,
} = require('../helpers/integration-user.helper');

function publicApiBase() {
  return (process.env.WEBHOOK_BASE_URL || process.env.FRONTEND_URL || 'https://api.sistemasnettsistemas.com.br')
    .replace(/\/$/, '');
}

function applyVars(text: string, variables: Record<string, any> = {}) {
  let out = String(text || '');
  const now = new Date();
  const auto: Record<string, string> = {
    data: now.toLocaleDateString('pt-BR'),
    hora: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    protocolo: `${now.getTime()}`.slice(-8),
    saudacao: now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite',
  };
  Object.entries({ ...auto, ...variables }).forEach(([key, value]) => {
    out = out.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi'), String(value ?? ''));
  });
  return out;
}

function absoluteMediaUrl(url?: string) {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  return `${publicApiBase()}${url.startsWith('/') ? '' : '/'}${url}`;
}

function parseJson(value: any, fallback: any = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function checkRestriction(tenantId: number, phone: string, accountIds: number[]) {
  const restrictionController = new RestrictionListController();
  const fakeReq: any = {
    body: { phone_numbers: [phone], whatsapp_account_ids: accountIds },
    tenant: { id: tenantId },
  };
  let restrictionResult: any = null;
  const fakeRes: any = {
    json: (data: any) => { restrictionResult = data; },
    status: () => fakeRes,
  };
  await restrictionController.checkBulk(fakeReq, fakeRes);
  return restrictionResult;
}

function formatButtons(buttons: any[] = []) {
  return buttons.map((btn) => {
    let choice = btn.text || '';
    switch (btn.type) {
      case 'URL': choice += `|${btn.url || ''}`; break;
      case 'CALL': choice += `|call:${btn.phone_number || ''}`; break;
      case 'COPY': choice += `|copy:${btn.copy_code || ''}`; break;
      default: choice += `|${btn.id || btn.text || ''}`; break;
    }
    return choice;
  });
}

export class IntegrationController {
  async cors(req: Request, res: Response, next: any) {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key, X-Dispatcher-User-Id, X-User-Id');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  }

  async auth(req: Request, res: Response) {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const key = (req as any).integrationKey;
    const token = generateIntegrationToken(user.id, tenant.id, key?.id || 0);
    return res.json({
      success: true,
      data: {
        tokens: { accessToken: token, expiresIn: '12h' },
        user: {
          id: user.id,
          nome: user.nome,
          email: user.email,
          role: user.role,
          emailVerificado: user.emailVerificado,
          tenantId: tenant.id,
        },
        tenant,
      },
    });
  }

  async listKeys(req: Request, res: Response) {
    try {
      await ensureTable();
      const tenantId = (req as any).tenant?.id;
      const result = await pool.query(
        `SELECT id, name, key_prefix, last_used_at, is_active, created_at
         FROM tenant_integration_keys
         WHERE tenant_id = $1
         ORDER BY created_at DESC`,
        [tenantId]
      );
      res.json({ success: true, data: result.rows });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Erro ao listar chaves' });
    }
  }

  async createKey(req: Request, res: Response) {
    try {
      await ensureTable();
      const tenantId = (req as any).tenant?.id;
      const name = String(req.body?.name || 'Sistema de Vendas').slice(0, 120);
      const raw = `nsk_${crypto.randomBytes(24).toString('hex')}`;
      const prefix = raw.slice(0, 12);
      await pool.query(
        `INSERT INTO tenant_integration_keys (tenant_id, name, key_prefix, key_hash)
         VALUES ($1, $2, $3, $4)`,
        [tenantId, name, prefix, hashKey(raw)]
      );
      const frontend = (process.env.FRONTEND_URL || 'https://sistemasnettsistemas.com.br').replace(/\/$/, '');
      res.status(201).json({
        success: true,
        data: {
          api_key: raw,
          name,
          key_prefix: prefix,
          warning: 'Guarde esta chave agora. Ela não será mostrada de novo.',
          embed: {
            oficial: `${frontend}/embed/oficial?key=${encodeURIComponent(raw)}&user_id=ID_DO_USUARIO`,
            qr: `${frontend}/embed/qr?key=${encodeURIComponent(raw)}&user_id=ID_DO_USUARIO`,
            qr_livre: `${frontend}/embed/qr-livre?key=${encodeURIComponent(raw)}&user_id=ID_DO_USUARIO`,
            verificar: `${frontend}/embed/verificar?key=${encodeURIComponent(raw)}&user_id=ID_DO_USUARIO`,
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Erro ao criar chave' });
    }
  }

  async revokeKey(req: Request, res: Response) {
    const tenantId = (req as any).tenant?.id;
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE tenant_integration_keys
       SET is_active = false
       WHERE id = $1 AND tenant_id = $2
       RETURNING id`,
      [id, tenantId]
    );
    if (!result.rowCount) {
      return res.status(404).json({ success: false, error: 'Chave não encontrada' });
    }
    res.json({ success: true, message: 'Chave desativada' });
  }

  async users(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant?.id;
      const result = await pool.query(
        `SELECT id, nome, email, role
         FROM tenant_users
         WHERE tenant_id = $1 AND ativo = true
           AND role IS DISTINCT FROM 'super_admin'
         ORDER BY nome ASC NULLS LAST, id ASC`,
        [tenantId]
      );
      res.json({
        success: true,
        data: result.rows.map((u: any) => ({
          id: u.id,
          nome: u.nome,
          email: u.email,
          role: u.role,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Erro ao listar usuários' });
    }
  }

  async connections(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant?.id;
      const user = (req as any).user;
      const channel = String(req.query.channel || 'all');
      const data: any = { oficial: [], qr: [] };

      if (channel === 'oficial' || channel === 'all') {
        const accounts = await listOficialAccounts(tenantId, user);
        data.oficial = (accounts || []).map((a: any) => ({
          id: a.id,
          channel: 'oficial',
          name: a.name,
          phone_number: a.phone_number,
          is_active: a.is_active,
        }));
      }

      if (channel === 'qr' || channel === 'all') {
        const qr = await listQrInstances(tenantId, user);
        data.qr = (qr || []).map((a: any) => ({
          id: a.id,
          channel: 'qr',
          name: a.name || a.profile_name || a.session_name,
          phone_number: a.phone_number,
          status: a.status,
          connected: a.status === 'connected' || a.status === 'open' || a.is_connected === true,
        }));
      }

      res.json({
        success: true,
        acting_user: user ? { id: user.id, nome: user.nome, email: user.email, role: user.role } : null,
        data,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Erro ao listar conexões' });
    }
  }

  async oficialTemplates(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant?.id;
      const user = (req as any).user;
      const accountId = parseInt(req.params.id, 10);
      const allowed = await userHasOficialAccount(tenantId, user, accountId);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          error: 'Este usuário não tem permissão para usar esta conta da API Oficial',
        });
      }
      const account = await WhatsAppAccountModel.findById(accountId, tenantId);
      if (!account) {
        return res.status(404).json({ success: false, error: 'Conta oficial não encontrada' });
      }
      if (!account.business_account_id) {
        return res.status(400).json({ success: false, error: 'Business Account ID não configurado' });
      }
      const result = await whatsappService.getTemplates(
        account.access_token,
        account.business_account_id,
        account.id,
        account.name,
        tenantId
      );
      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error || 'Erro ao buscar templates na Meta' });
      }
      const templates = (result.templates || []).filter((t: any) => t.status === 'APPROVED');
      res.json({ success: true, templates, total: templates.length });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Erro ao buscar templates' });
    }
  }

  async oficialSend(req: Request, res: Response) {
    const tenantId = (req as any).tenant?.id;
    const user = (req as any).user;
    const accountId = parseInt(req.body.connection_id || req.body.whatsapp_account_id, 10);
    const allowed = await userHasOficialAccount(tenantId, user, accountId);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        error: 'Este usuário não tem permissão para usar esta conta da API Oficial',
      });
    }
    const controller = new MessageController();
    req.body = {
      whatsapp_account_id: req.body.connection_id || req.body.whatsapp_account_id,
      phone_number: req.body.number || req.body.phone_number,
      template_name: req.body.template_name,
      variables: req.body.variables || {},
      media_url: req.body.media_url,
      media_type: req.body.media_type,
    };
    return controller.sendImmediate(req, res);
  }

  async qrTemplates(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant?.id;
    const result = await pool.query(
      `SELECT t.*,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', m.id,
                    'media_type', m.media_type,
                    'file_name', m.file_name,
                    'file_path', m.file_path,
                    'url', m.url,
                    'original_name', m.original_name
                  ) ORDER BY m.id
                ) FILTER (WHERE m.id IS NOT NULL),
                '[]'
              ) as media_files
       FROM qr_templates t
       LEFT JOIN qr_template_media m ON t.id = m.template_id
       WHERE t.tenant_id = $1
       GROUP BY t.id
       ORDER BY t.created_at DESC`,
      [tenantId]
    );
    res.json({ success: true, data: result.rows, total: result.rows.length });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Erro ao listar templates QR' });
    }
  }

  async qrTemplateById(req: Request, res: Response) {
    const tenantId = (req as any).tenant?.id;
    const result = await pool.query(
      `SELECT t.*,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', m.id,
                    'media_type', m.media_type,
                    'file_name', m.file_name,
                    'file_path', m.file_path,
                    'url', m.url,
                    'original_name', m.original_name
                  ) ORDER BY m.id
                ) FILTER (WHERE m.id IS NOT NULL),
                '[]'
              ) as media_files
       FROM qr_templates t
       LEFT JOIN qr_template_media m ON t.id = m.template_id
       WHERE t.tenant_id = $1 AND t.id = $2
       GROUP BY t.id`,
      [tenantId, req.params.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Template não encontrado' });
    }
    res.json({ success: true, data: result.rows[0] });
  }

  async qrSend(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenant?.id;
      const instanceId = parseInt(req.body.connection_id || req.body.instance_id, 10);
      const templateId = parseInt(req.body.template_id, 10);
      const number = String(req.body.number || req.body.phone_number || '').replace(/\D/g, '');
      const variables = req.body.variables || {};

      if (!instanceId || !templateId || !number) {
        return res.status(400).json({
          success: false,
          error: 'connection_id, template_id e number são obrigatórios',
        });
      }

      const user = (req as any).user;
      const allowed = await userHasQrInstance(tenantId, user, instanceId);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          error: 'Este usuário não tem permissão para usar esta conexão QR',
        });
      }

      const restriction = await checkRestriction(tenantId, number, [instanceId]);
      if (restriction?.restricted_count > 0) {
        const detail = restriction.restricted_details?.[0];
        return res.status(403).json({
          success: false,
          restricted: true,
          error: `Número bloqueado na lista: ${detail?.list_names?.join(', ') || 'restrição'}`,
        });
      }

      const tplRes = await pool.query(
        `SELECT t.*,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'id', m.id,
                      'file_name', m.file_name,
                      'file_path', m.file_path,
                      'url', m.url,
                      'original_name', m.original_name
                    ) ORDER BY m.id
                  ) FILTER (WHERE m.id IS NOT NULL),
                  '[]'
                ) as media_files
         FROM qr_templates t
         LEFT JOIN qr_template_media m ON t.id = m.template_id
         WHERE t.tenant_id = $1 AND t.id = $2
         GROUP BY t.id`,
        [tenantId, templateId]
      );
      if (!tplRes.rows.length) {
        return res.status(404).json({ success: false, error: 'Template não encontrado' });
      }
      const template = tplRes.rows[0];
      const creds = await getInstanceWithCredentials(instanceId, tenantId);
      const filledText = applyVars(template.text_content || '', variables);
      const results: any[] = [];
      const token = creds.instance.instance_token;

      if (template.type === 'combined') {
        const parsedBlocks = parseJson(template.combined_blocks, { blocks: [] });
        const blocks = Array.isArray(parsedBlocks) ? parsedBlocks : (parsedBlocks.blocks || []);
        for (let i = 0; i < blocks.length; i++) {
          if (i > 0) await new Promise((r) => setTimeout(r, 2000));
          const block = blocks[i];
          const blockText = applyVars(block.text || '', variables);
          const r = await this.sendQrBlock(creds.uazService, creds.proxyConfig, token, number, block, blockText, variables);
          results.push({ block: i + 1, type: block.type, result: r });
        }
      } else {
        const r = await this.sendQrTemplate(creds.uazService, creds.proxyConfig, token, number, template, filledText, variables);
        results.push(r);
      }

      await pool.query(
        `INSERT INTO uaz_messages (instance_id, phone_number, message_type, message_content, status, user_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [instanceId, number, 'template', filledText || JSON.stringify(results), 'sent', user?.id || null]
      );

      res.json({ success: true, data: results });
    } catch (error: any) {
      console.error('Erro no envio QR via integração:', error);
      const raw = String(error.message || '');
      if (/463|temporary restriction/i.test(raw)) {
        return res.status(422).json({
          success: false,
          code: 'WHATSAPP_463',
          error: 'Este WhatsApp está temporariamente bloqueado para iniciar conversas novas. Troque o número de origem.',
        });
      }
      res.status(500).json({ success: false, error: raw });
    }
  }

  private async sendQrBlock(uazService: any, proxyConfig: any, token: string, number: string, block: any, text: string, variables: any) {
    switch (block.type) {
      case 'image':
      case 'video':
      case 'document':
        return uazService.sendMedia(token, {
          number,
          type: block.type,
          file: absoluteMediaUrl(block.media?.url),
          text,
          docname: block.media?.originalname || 'arquivo',
        }, proxyConfig);
      case 'audio':
        return uazService.sendMedia(token, {
          number,
          type: 'audio',
          file: absoluteMediaUrl(block.media?.url),
        }, proxyConfig);
      case 'button':
        return uazService.sendMenu(token, {
          number,
          type: 'button',
          text: text || 'Mensagem com botões',
          choices: formatButtons(block.buttons || []),
          footerText: block.footerText || undefined,
        }, proxyConfig);
      case 'list':
        return uazService.sendMenu(token, {
          number,
          type: 'list',
          text,
          choices: block.choices || [],
          listButton: block.listButton || 'Ver Opções',
        }, proxyConfig);
      case 'poll':
        return uazService.sendMenu(token, {
          number,
          type: 'poll',
          text,
          choices: block.choices || [],
          selectableCount: block.selectableCount || 1,
        }, proxyConfig);
      case 'carousel':
        return uazService.sendCarousel(token, number, text, (block.cards || []).map((card: any) => ({
          ...card,
          text: applyVars(card.text || '', variables),
          image: absoluteMediaUrl(card.image),
        })), proxyConfig);
      default:
        return uazService.sendText(token, { number, text }, proxyConfig);
    }
  }

  private async sendQrTemplate(uazService: any, proxyConfig: any, token: string, number: string, template: any, filledText: string, variables: any) {
    const media = (template.media_files || [])[0];
    const mediaUrl = media ? absoluteMediaUrl(media.url || `/uploads/qr-templates/${media.file_name}`) : '';

    if (['image', 'video', 'audio', 'audio_recorded', 'document'].includes(template.type)) {
      const type = template.type === 'audio_recorded' ? 'audio' : template.type;
      return uazService.sendMedia(token, {
        number,
        type,
        file: mediaUrl,
        text: type === 'audio' ? undefined : filledText,
        docname: media?.original_name || media?.file_name,
      }, proxyConfig);
    }

    if (template.type === 'buttons') {
      const config = parseJson(template.buttons_config);
      return uazService.sendMenu(token, {
        number,
        type: 'button',
        text: filledText || 'Mensagem com botões',
        choices: formatButtons(config.buttons || []),
        footerText: config.footerText || undefined,
      }, proxyConfig);
    }

    if (template.type === 'list') {
      const config = parseJson(template.list_config);
      const choices: string[] = [];
      (config.sections || []).forEach((section: any) => {
        choices.push(`[${section.title}]`);
        (section.rows || []).forEach((row: any) => {
          choices.push(`${row.title}|${row.id}|${row.description || ''}`);
        });
      });
      return uazService.sendMenu(token, {
        number,
        type: 'list',
        text: filledText,
        choices,
        listButton: config.buttonText || 'Ver Opções',
      }, proxyConfig);
    }

    if (template.type === 'poll') {
      const config = parseJson(template.poll_config);
      return uazService.sendMenu(token, {
        number,
        type: 'poll',
        text: filledText,
        choices: config.options || [],
        selectableCount: config.selectableCount || 1,
      }, proxyConfig);
    }

    if (template.type === 'carousel') {
      const config = parseJson(template.carousel_config);
      const cards = (config.cards || []).map((card: any) => ({
        ...card,
        text: applyVars(card.text || '', variables),
        image: absoluteMediaUrl(card.image),
      }));
      return uazService.sendCarousel(token, number, filledText, cards, proxyConfig);
    }

    return uazService.sendText(token, { number, text: filledText }, proxyConfig);
  }
}
