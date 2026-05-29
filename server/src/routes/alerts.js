import { Router } from 'express';
import {
  listAlerts,
  markRead,
  markAllRead,
} from '../controllers/alerts.controller.js';

const router = Router();

router.get('/', listAlerts);
router.patch('/:id/read', markRead);
router.post('/read-all', markAllRead);

export default router;
