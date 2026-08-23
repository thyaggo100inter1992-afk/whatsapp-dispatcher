import { Router } from 'express';
import * as ctrl from '../../controllers/email-marketing.controller';

const router = Router();

router.get('/', ctrl.getNettEnviosCredential);
router.post('/', ctrl.saveNettEnviosCredential);

export default router;
