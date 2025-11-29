import { Router } from 'express';
import { bulkProfileController } from '../controllers/bulk-profile.controller';

const router = Router();

// Configurar intervalo da fila
router.post('/queue/interval', (req, res) => bulkProfileController.setQueueInterval(req, res));

// Obter status da fila
router.get('/queue/status', (req, res) => bulkProfileController.getQueueStatus(req, res));

// Obter falhas recentes
router.get('/queue/failures', (req, res) => bulkProfileController.getRecentFailures(req, res));

// Re-tentar item que falhou
router.post('/queue/retry/:historyId', (req, res) => bulkProfileController.retryFailedItem(req, res));

// Preview de atualização em massa
router.post('/preview', (req, res) => bulkProfileController.previewBulkUpdate(req, res));

// Atualizar perfis em massa
router.post('/update', (req, res) => bulkProfileController.updateBulkProfiles(req, res));

export default router;

