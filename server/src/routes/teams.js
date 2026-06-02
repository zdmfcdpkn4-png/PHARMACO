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
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', listTeams);
// Gestion des équipes et de leur composition : réservée aux administrateurs.
router.post('/', requireAdmin, createTeam);
router.patch('/:id', requireAdmin, updateTeam);
router.delete('/:id', requireAdmin, deleteTeam);
router.put('/:id/members', requireAdmin, setTeamMembers);
router.post('/:id/members', requireAdmin, addTeamMembers);
router.patch('/:id/members/:userId', requireAdmin, updateTeamMemberRole);
router.delete('/:id/members/:userId', requireAdmin, removeTeamMember);

export default router;
