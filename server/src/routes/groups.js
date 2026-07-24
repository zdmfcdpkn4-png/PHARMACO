import { Router } from 'express';
import {
  createGroup,
  updateGroup,
  deleteGroup,
  reorderGroups,
} from '../controllers/groups.controller.js';
import { requireAdmin, requireAuth, requireEditor } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.post('/', requireEditor, createGroup);
router.put('/reorder', requireEditor, reorderGroups); // avant /:id pour éviter le conflit
router.patch('/:id', requireEditor, updateGroup);
router.delete('/:id', requireAdmin, deleteGroup); // suppression : admin uniquement

export default router;
