import { Router } from 'express';
import {
  listBoards,
  getBoardFull,
  createBoard,
  updateBoard,
  deleteBoard,
} from '../controllers/boards.controller.js';
import {
  listCategories,
  createCategory,
  deleteCategory,
  setCategoryValue,
} from '../controllers/categories.controller.js';

const router = Router();

router.get('/', listBoards);
router.get('/:id', getBoardFull); // tableau complet (groupes + tâches)
router.post('/', createBoard);
router.patch('/:id', updateBoard);
router.delete('/:id', deleteBoard);

// Catégories / colonnes personnalisées
router.get('/:boardId/categories', listCategories);
router.post('/:boardId/categories', createCategory);
router.delete('/categories/:id', deleteCategory);
router.post('/categories/value', setCategoryValue);

export default router;
