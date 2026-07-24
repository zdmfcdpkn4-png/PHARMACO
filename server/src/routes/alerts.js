import { Router } from 'express';
import {
  listAlerts,
  markRead,
  markAllRead,
} from '../controllers/alerts.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Notifications personnelles : authentification requise, chaque utilisateur
// n'accède qu'aux siennes (contrôlé dans le contrôleur).
router.use(requireAuth);

router.get('/', listAlerts);
router.patch('/:id/read', markRead);
router.post('/read-all', markAllRead);

export default router;
