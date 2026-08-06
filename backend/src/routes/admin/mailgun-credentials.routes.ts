import { Router } from 'express';
import * as ctrl from '../../controllers/email-marketing.controller';

const router = Router();

router.get('/', ctrl.getMailgunCredential);
router.post('/', ctrl.saveMailgunCredential);
router.delete('/:id', ctrl.deleteMailgunCredential);

export default router;
