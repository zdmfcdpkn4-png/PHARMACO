import { Router } from 'express';
import {
  listWorkspaces,
  getWorkspace,
  createWorkspace,
} from '../controllers/workspaces.controller.js';
import { requireAuth, requireEditor } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', listWorkspaces);
router.get('/:id', getWorkspace);
router.post('/', requireEditor, createWorkspace);

export default router;
