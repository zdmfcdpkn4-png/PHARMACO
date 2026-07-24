import { Router } from 'express';
import { login, setPassword, changePassword } from '../controllers/auth.controller.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);
// Changement de son propre mot de passe : ouvert, mais authentifié par le
// mot de passe actuel (sert au changement forcé à la première connexion).
router.post('/change-password', changePassword);
// Réinitialisation d'un mot de passe par e-mail : réservée aux administrateurs
// (sinon n'importe qui pourrait réinitialiser le compte d'un tiers).
router.post('/set-password', requireAdmin, setPassword);

export default router;
