import { Router } from 'express';
import {
  listTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  setTeamMembers,
  addTeamMembers,
  updateTeamMemberRole,
  removeTeamMember,
} from '../controllers/teams.controller.js';

const router = Router();

router.get('/', listTeams);
router.post('/', createTeam);
router.patch('/:id', updateTeam);
router.delete('/:id', deleteTeam);
router.put('/:id/members', setTeamMembers);
router.post('/:id/members', addTeamMembers);
router.patch('/:id/members/:userId', updateTeamMemberRole);
router.delete('/:id/members/:userId', removeTeamMember);

export default router;
