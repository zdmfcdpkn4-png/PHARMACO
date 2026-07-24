import { Router } from 'express';
import { updateSubtask, deleteSubtask } from '../controllers/subtasks.controller.js';
import { setSubtaskAssignees } from '../controllers/assignments.controller.js';
import { requireAdmin, requireAuth, requireEditor } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.put('/:id/assignees', requireEditor, setSubtaskAssignees);
router.put('/:id', requireEditor, updateSubtask);
router.patch('/:id', requireEditor, updateSubtask);
router.delete('/:id', requireAdmin, deleteSubtask); // suppression : admin uniquement

export default router;
