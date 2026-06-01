import { Router } from 'express';
import {
  createTask,
  updateTask,
  deleteTask,
  reorderTasks,
} from '../controllers/tasks.controller.js';
import {
  listComments,
  createComment,
  listActivity,
} from '../controllers/comments.controller.js';

const router = Router();

router.post('/', createTask);
router.put('/reorder', reorderTasks); // avant /:id pour éviter le conflit de route

// Discussion & historique d'une tâche
router.get('/:taskId/comments', listComments);
router.post('/:taskId/comments', createComment);
router.get('/:taskId/activity', listActivity);

router.patch('/:id', updateTask);
router.delete('/:id', deleteTask);

export default router;
