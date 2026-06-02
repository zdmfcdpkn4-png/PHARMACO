import { Router } from 'express';
import {
  listTeams,
  createTeam,
  deleteTeam,
  setTeamMembers,
} from '../controllers/teams.controller.js';

const router = Router();

router.get('/', listTeams);
router.post('/', createTeam);
router.delete('/:id', deleteTeam);
router.put('/:id/members', setTeamMembers);

export default router;
