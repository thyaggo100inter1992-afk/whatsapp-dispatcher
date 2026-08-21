import { Router } from 'express';
import * as ctrl from '../../controllers/email-marketing.controller';

const router = Router();

router.get('/settings/active', ctrl.getEmailMarketingProviderSettings);
router.post('/settings/active', ctrl.saveEmailMarketingProviderSettings);

router.get('/', ctrl.getSendGridCredential);
router.post('/', ctrl.saveSendGridCredential);
router.delete('/:id', ctrl.deleteSendGridCredential);

export default router;
