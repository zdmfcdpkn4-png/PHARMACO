import { Router } from 'express';
import {
  listDependencies,
  createDependency,
  deleteDependency,
} from '../controllers/dependencies.controller.js';
import { requireAuth, requireEditor } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', listDependencies);
router.post('/', requireEditor, createDependency);
router.delete('/:id', requireEditor, deleteDependency);

export default router;
