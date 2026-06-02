import { Router } from 'express';
import { login, setPassword } from '../controllers/auth.controller.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);
// Réinitialisation d'un mot de passe par e-mail : réservée aux administrateurs
// (sinon n'importe qui pourrait réinitialiser le compte d'un tiers).
router.post('/set-password', requireAdmin, setPassword);

export default router;
