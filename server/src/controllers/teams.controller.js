import { query } from '../db/pool.js';
import { asyncHandler } from '../middleware/error.js';

// Liste les équipes avec leurs membres.
export const listTeams = asyncHandler(async (_req, res) => {
  const teams = await query('SELECT id, name, description FROM teams ORDER BY id');
  const members = await query(
    `SELECT m.team_id, m.role, u.id, u.name, u.avatar_url
     FROM team_members m JOIN users u ON u.id = m.user_id
     ORDER BY m.id`
  );
  const byTeam = new Map();
  for (const r of members.rows) {
    if (!byTeam.has(r.team_id)) byTeam.set(r.team_id, []);
    byTeam.get(r.team_id).push({ id: r.id, name: r.name, avatar_url: r.avatar_url, role: r.role });
  }
  res.json(teams.rows.map((t) => ({ ...t, members: byTeam.get(t.id) || [] })));
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
