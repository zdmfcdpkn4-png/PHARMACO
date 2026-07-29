import { Router } from 'express';
import { login, setPassword, changePassword } from '../controllers/auth.controller.js';
import { requireAdmin } from '../middleware/auth.js';
import { limiterTentatives } from '../middleware/rateLimit.js';

const router = Router();

// Seules routes où un mot de passe peut être deviné : elles sont limitées en
// débit. Seuls les échecs (401) sont comptés — une connexion réussie ne
// consomme rien, l'usage normal n'est donc jamais ralenti.
const limiteur = limiterTentatives();

router.post('/login', limiteur, login);
// Changement de son propre mot de passe : ouvert, mais authentifié par le
// mot de passe actuel (sert au changement forcé à la première connexion).
// Donc devinable, donc limité lui aussi.
router.post('/change-password', limiteur, changePassword);
// Réinitialisation d'un mot de passe par e-mail : réservée aux administrateurs
// (sinon n'importe qui pourrait réinitialiser le compte d'un tiers).
router.post('/set-password', requireAdmin, setPassword);

export default router;
