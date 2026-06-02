import { query } from '../db/pool.js';
import { asyncHandler } from '../middleware/error.js';

// Liste les équipes avec leurs membres et les projets associés.
export const listTeams = asyncHandler(async (_req, res) => {
  const teams = await query('SELECT id, name, description FROM teams ORDER BY id');
  const members = await query(
    `SELECT m.team_id, m.role, u.id, u.name, u.avatar_url
     FROM team_members m JOIN users u ON u.id = m.user_id
     ORDER BY m.id`
  );
  const projects = await query(
    `SELECT pt.team_id, b.id, b.name
     FROM project_teams pt JOIN boards b ON b.id = pt.board_id
     ORDER BY b.name`
  );
  const membersByTeam = new Map();
  for (const r of members.rows) {
    if (!membersByTeam.has(r.team_id)) membersByTeam.set(r.team_id, []);
    membersByTeam.get(r.team_id).push({ id: r.id, name: r.name, avatar_url: r.avatar_url, role: r.role });
  }
  const projectsByTeam = new Map();
  for (const r of projects.rows) {
    if (!projectsByTeam.has(r.team_id)) projectsByTeam.set(r.team_id, []);
    projectsByTeam.get(r.team_id).push({ id: r.id, name: r.name });
  }
  res.json(
    teams.rows.map((t) => ({
      ...t,
      members: membersByTeam.get(t.id) || [],
      projects: projectsByTeam.get(t.id) || [],
    }))
  );
});

export const createTeam = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name est requis' });
  const { rows } = await query(
    'INSERT INTO teams (name, description) VALUES ($1, $2) RETURNING id, name, description',
    [name.trim(), description || null]
  );
  res.status(201).json({ ...rows[0], members: [] });
});

// Renomme / met à jour la description d'une équipe.
export const updateTeam = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const { rows } = await query(
    `UPDATE teams
       SET name = COALESCE($1, name),
           description = COALESCE($2, description)
     WHERE id = $3
     RETURNING id, name, description`,
    [name?.trim() ?? null, description ?? null, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Équipe introuvable' });
  res.json(rows[0]);
});

export const deleteTeam = asyncHandler(async (req, res) => {
  const { rowCount } = await query('DELETE FROM teams WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Équipe introuvable' });
  res.status(204).end();
});

export const setTeamMembers = asyncHandler(async (req, res) => {
  const teamId = req.params.id;
  const members = Array.isArray(req.body.members) ? req.body.members : [];
  await query('DELETE FROM team_members WHERE team_id = $1', [teamId]);
  for (const m of members) {
    await query(
      'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [teamId, m.user_id, m.role || 'membre']
    );
  }
  res.json({ ok: true });
});

// Helper : renvoie les membres mis en forme d'une équipe.
const fetchTeamMembers = async (teamId) => {
  const { rows } = await query(
    `SELECT m.role, u.id, u.name, u.avatar_url, u.email
     FROM team_members m JOIN users u ON u.id = m.user_id
     WHERE m.team_id = $1 ORDER BY u.name`,
    [teamId]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    avatar_url: r.avatar_url,
    email: r.email,
    role: r.role,
  }));
};

// Ajoute un ou plusieurs membres à une équipe (sans retirer les existants).
// Body : { user_ids: [...] } ou { members: [{ user_id, role }] }
export const addTeamMembers = asyncHandler(async (req, res) => {
  const teamId = req.params.id;
  let entries = [];
  if (Array.isArray(req.body.members)) {
    entries = req.body.members.map((m) => ({ user_id: m.user_id, role: m.role || 'membre' }));
  } else if (Array.isArray(req.body.user_ids)) {
    entries = req.body.user_ids.map((id) => ({ user_id: id, role: 'membre' }));
  }
  if (!entries.length) return res.status(400).json({ error: 'user_ids ou members requis' });

  for (const e of entries) {
    await query(
      'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (team_id, user_id) DO NOTHING',
      [teamId, e.user_id, e.role]
    );
  }
  res.status(201).json({ members: await fetchTeamMembers(teamId) });
});

// Modifie le rôle d'un membre dans l'équipe.
export const updateTeamMemberRole = asyncHandler(async (req, res) => {
  const { id: teamId, userId } = req.params;
  const { role } = req.body;
  const { rowCount } = await query(
    'UPDATE team_members SET role = $1 WHERE team_id = $2 AND user_id = $3',
    [role || 'membre', teamId, userId]
  );
  if (!rowCount) return res.status(404).json({ error: 'Membre introuvable dans cette équipe' });
  res.json({ members: await fetchTeamMembers(teamId) });
});

// Retire un membre de l'équipe (ne supprime pas l'utilisateur).
export const removeTeamMember = asyncHandler(async (req, res) => {
  const { id: teamId, userId } = req.params;
  await query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId]);
  res.json({ members: await fetchTeamMembers(teamId) });
});
