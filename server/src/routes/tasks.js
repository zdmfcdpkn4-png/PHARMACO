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
  highlightComments,
  markRead,
} from '../controllers/comments.controller.js';
import { listSubtasks, createSubtask } from '../controllers/subtasks.controller.js';
import { setTaskAssignees } from '../controllers/assignments.controller.js';
import { requireAdmin, requireAuth, requireEditor } from '../middleware/auth.js';

const router = Router();

// Toutes les routes exigent un utilisateur authentifié ; les mutations sont
// réservées aux membres/admins (requireEditor, les observateurs sont en
// lecture seule), la suppression aux admins — voir docs/ROLES.md.
router.use(requireAuth);

router.post('/', requireEditor, createTask);
router.put('/reorder', requireEditor, reorderTasks); // avant /:id pour éviter le conflit de route
router.get('/comments/unread', unreadCounts); // compteurs non-lus par tâche
router.get('/comments/highlights', highlightComments); // messages prioritaires / ciblés

// Discussion & historique d'une tâche
router.get('/:taskId/comments', listComments);
router.post('/:taskId/comments', requireEditor, createComment);
router.post('/:taskId/comments/read', markRead); // état de lecture personnel
router.get('/:taskId/activity', listActivity);

// Sous-items
router.get('/:taskId/subtasks', listSubtasks);
router.post('/:taskId/subtasks', requireEditor, createSubtask);
router.put('/:id/assignees', requireEditor, setTaskAssignees);

router.patch('/:id', requireEditor, updateTask);
router.delete('/:id', requireAdmin, deleteTask); // suppression : admin uniquement

export default router;
