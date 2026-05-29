import { Router } from 'express';
import {
  listBoards,
  getBoardFull,
  createBoard,
  updateBoard,
  deleteBoard,
} from '../controllers/boards.controller.js';

const router = Router();

router.get('/', listBoards);
router.get('/:id', getBoardFull); // tableau complet (groupes + tâches)
router.post('/', createBoard);
router.patch('/:id', updateBoard);
router.delete('/:id', deleteBoard);

export default router;
