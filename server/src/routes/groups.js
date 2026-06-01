import { Router } from 'express';
import {
  createGroup,
  updateGroup,
  deleteGroup,
  reorderGroups,
} from '../controllers/groups.controller.js';

const router = Router();

router.post('/', createGroup);
router.put('/reorder', reorderGroups); // avant /:id pour éviter le conflit
router.patch('/:id', updateGroup);
router.delete('/:id', deleteGroup);

export default router;
