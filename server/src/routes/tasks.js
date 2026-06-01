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
  unreadCounts,
  markRead,
} from '../controllers/comments.controller.js';

const router = Router();

router.post('/', createTask);
router.put('/reorder', reorderTasks); // avant /:id pour éviter le conflit de route
router.get('/comments/unread', unreadCounts); // compteurs non-lus par tâche

// Discussion & historique d'une tâche
router.get('/:taskId/comments', listComments);
router.post('/:taskId/comments', createComment);
router.post('/:taskId/comments/read', markRead);
router.get('/:taskId/activity', listActivity);

router.patch('/:id', updateTask);
router.delete('/:id', deleteTask);

export default router;
