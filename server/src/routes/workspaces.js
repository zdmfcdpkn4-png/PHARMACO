import { Router } from 'express';
import {
  listWorkspaces,
  getWorkspace,
  createWorkspace,
} from '../controllers/workspaces.controller.js';

const router = Router();

router.get('/', listWorkspaces);
router.get('/:id', getWorkspace);
router.post('/', createWorkspace);

export default router;
