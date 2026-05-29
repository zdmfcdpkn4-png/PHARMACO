import { Router } from 'express';
import {
  createGroup,
  updateGroup,
  deleteGroup,
} from '../controllers/groups.controller.js';

const router = Router();

router.post('/', createGroup);
router.patch('/:id', updateGroup);
router.delete('/:id', deleteGroup);

export default router;
