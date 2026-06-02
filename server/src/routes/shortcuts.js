import { Router } from 'express';
import {
  listShortcuts,
  createShortcut,
  deleteShortcut,
} from '../controllers/shortcuts.controller.js';

const router = Router();

router.get('/', listShortcuts);
router.post('/', createShortcut);
router.delete('/:id', deleteShortcut);

export default router;
