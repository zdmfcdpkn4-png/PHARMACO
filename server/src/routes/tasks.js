import { Router } from 'express';
import {
  createTask,
  updateTask,
  deleteTask,
  reorderTasks,
} from '../controllers/tasks.controller.js';

const router = Router();

router.post('/', createTask);
router.put('/reorder', reorderTasks); // avant /:id pour éviter le conflit de route
router.patch('/:id', updateTask);
router.delete('/:id', deleteTask);

export default router;
