import { Router } from 'express';
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/users.controller.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();

// Annuaire (noms, e-mails, rôles) : réservé aux utilisateurs authentifiés.
router.get('/', requireAuth, listUsers);
router.get('/:id', requireAuth, getUser);
// Gestion des agents : réservée aux administrateurs.
router.post('/', requireAdmin, createUser);
router.patch('/:id', requireAdmin, updateUser);
router.delete('/:id', requireAdmin, deleteUser);

export default router;
