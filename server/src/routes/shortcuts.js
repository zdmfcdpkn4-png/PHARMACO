import { Router } from 'express';
import {
  listShortcuts,
  createShortcut,
  deleteShortcut,
} from '../controllers/shortcuts.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Raccourcis personnels : authentification requise, chaque utilisateur ne
// voit et ne modifie que les siens (contrôlé dans le contrôleur).
router.use(requireAuth);

router.get('/', listShortcuts);
router.post('/', createShortcut);
router.delete('/:id', deleteShortcut);

export default router;
