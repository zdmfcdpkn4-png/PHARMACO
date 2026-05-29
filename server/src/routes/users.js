import { Router } from 'express';
import { listUsers, getUser, createUser } from '../controllers/users.controller.js';

const router = Router();

router.get('/', listUsers);
router.get('/:id', getUser);
router.post('/', createUser);

export default router;
