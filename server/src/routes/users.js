import { Router } from 'express';
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/users.controller.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', listUsers);
router.get('/:id', getUser);
// Gestion des agents : réservée aux administrateurs.
router.post('/', requireAdmin, createUser);
router.patch('/:id', requireAdmin, updateUser);
router.delete('/:id', requireAdmin, deleteUser);

export default router;
