import { Router } from 'express';
import {
  listDependencies,
  createDependency,
  deleteDependency,
} from '../controllers/dependencies.controller.js';

const router = Router();

router.get('/', listDependencies);
router.post('/', createDependency);
router.delete('/:id', deleteDependency);

export default router;
