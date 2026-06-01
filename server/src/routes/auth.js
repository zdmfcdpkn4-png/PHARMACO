import { Router } from 'express';
import { login, setPassword } from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', login);
router.post('/set-password', setPassword);

export default router;
