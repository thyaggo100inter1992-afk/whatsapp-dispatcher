import { Router } from 'express';
import { TemplateController } from '../controllers/template.controller';
import { authenticate } from '../middleware/auth.middleware';
import { setTenantContext } from '../middleware/tenant.middleware';
const { checkTemplates } = require('../middlewares/check-feature.middleware');
const { checkTemplateLimit } = require('../middlewares/tenant-limits.middleware');

const router = Router();
const controller = new TemplateController();

// Aplicar autenticação e tenant context em todas as rotas
router.use(authenticate);
router.use(setTenantContext);
// TEMPORARIAMENTE DESABILITADO - Causando erro 403 na fila de templates
// router.use(checkTemplates);

/**
 * Rotas de Templates
 */

// Gerenciamento da fila
router.post('/queue/interval', (req, res) => controller.setQueueInterval(req, res));
router.get('/queue/status', (req, res) => controller.getQueueStatus(req, res));
router.get('/queue/failures', (req, res) => controller.getRecentFailures(req, res));
router.post('/queue/retry/:id', (req, res) => controller.retryFailedItem(req, res));
router.post('/queue/retry-all', (req, res) => controller.retryAllFailures(req, res));

// Criar template em múltiplas contas
router.post('/create-multiple', checkTemplateLimit, (req, res) => controller.createInMultipleAccounts(req, res));

// Sincronizar templates de todas as contas
router.post('/sync-all', (req, res) => controller.syncAllAccounts(req, res));

// Histórico de templates (DEVE VIR ANTES de /:accountId para não capturar "history" como ID)
router.get('/history', (req, res) => controller.getHistory(req, res));
router.post('/history/update-statuses', (req, res) => controller.updateTemplateStatuses(req, res));
router.delete('/history/:id', (req, res) => controller.deleteHistory(req, res));

// Listar templates de uma conta
router.get('/:accountId', (req, res) => controller.listByAccount(req, res));

// Deletar template
router.delete('/:accountId/:templateName', (req, res) => controller.deleteTemplate(req, res));

export default router;

