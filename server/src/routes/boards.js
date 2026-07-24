import { Router } from 'express';
import {
  listBoards,
  getBoardFull,
  createBoard,
  updateBoard,
  deleteBoard,
  setBoardTeams,
} from '../controllers/boards.controller.js';
import {
  listCategories,
  createCategory,
  deleteCategory,
  setCategoryValue,
} from '../controllers/categories.controller.js';
import { listTags, createTag, deleteTag } from '../controllers/tags.controller.js';
import { requireAdmin, requireAuth, requireEditor } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', listBoards);
router.get('/:id', getBoardFull); // tableau complet (groupes + tâches)
router.post('/', requireEditor, createBoard);
router.patch('/:id', requireEditor, updateBoard); // archivage : admin (contrôlé dans le contrôleur)
router.put('/:id/teams', requireEditor, setBoardTeams); // propriétaire/admin (contrôlé dans le contrôleur)
router.delete('/:id', requireAdmin, deleteBoard); // suppression projet : admin uniquement

// Catégories / colonnes personnalisées
router.get('/:boardId/categories', listCategories);
router.post('/:boardId/categories', requireEditor, createCategory);
router.delete('/categories/:id', requireEditor, deleteCategory);
router.post('/categories/value', requireEditor, setCategoryValue);

// Étiquettes (Étape / Type d'intervention)
router.get('/:boardId/tags', listTags);
router.post('/:boardId/tags', requireEditor, createTag);
router.delete('/tags/:id', requireEditor, deleteTag);

export default router;
