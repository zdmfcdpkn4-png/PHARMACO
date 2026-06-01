import { Router } from 'express';
import { updateSubtask, deleteSubtask } from '../controllers/subtasks.controller.js';
import { setSubtaskAssignees } from '../controllers/assignments.controller.js';

const router = Router();

router.put('/:id/assignees', setSubtaskAssignees);
router.put('/:id', updateSubtask);
router.patch('/:id', updateSubtask);
router.delete('/:id', deleteSubtask);

export default router;
