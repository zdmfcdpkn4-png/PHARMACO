import { query, withTransaction } from '../db/pool.js';
import { asyncHandler } from '../middleware/error.js';

// Détecte les @mentions dans un texte et renvoie les users correspondants.
// Une mention vise le nom complet (insensible à la casse) : "@Alice Martin".
const resolveMentions = async (client, content, users) => {
  const mentioned = [];
  const lower = content.toLowerCase();
  for (const u of users) {
    if (lower.includes(`@${u.name.toLowerCase()}`)) mentioned.push(u);
  }
  return mentioned;
};

// Liste les commentaires d'une tâche (avec l'auteur joint).
// Si ?user_id=, marque aussi la discussion comme lue pour cet utilisateur.
export const listComments = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT c.id, c.task_id, c.content, c.created_at,
            u.id AS user_id, u.name AS user_name, u.avatar_url AS user_avatar_url
     FROM task_comments c
     LEFT JOIN users u ON u.id = c.user_id
     WHERE c.task_id = $1
     ORDER BY c.created_at ASC`,
    [req.params.taskId]
  );

  // Marque comme lu (upsert) si un user_id est fourni
  const userId = req.query.user_id;
  if (userId) {
    await query(
      `INSERT INTO comment_reads (user_id, task_id, last_read_at)
       VALUES ($1, $2, now())
       ON CONFLICT (user_id, task_id) DO UPDATE SET last_read_at = now()`,
      [userId, req.params.taskId]
    );
  }

  res.json(
    rows.map((r) => ({
      id: r.id,
      task_id: r.task_id,
      content: r.content,
      created_at: r.created_at,
      user: r.user_id
        ? { id: r.user_id, name: r.user_name, avatar_url: r.user_avatar_url }
        : null,
    }))
  );
});

// Nombre de commentaires non lus par tâche, pour un utilisateur.
// Renvoie { [taskId]: count }. Un commentaire écrit par l'utilisateur
// lui-même n'est jamais "non lu".
export const unreadCounts = asyncHandler(async (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.json({});
  const { rows } = await query(
    `SELECT c.task_id, COUNT(*)::int AS unread
     FROM task_comments c
     LEFT JOIN comment_reads r ON r.task_id = c.task_id AND r.user_id = $1
     WHERE c.user_id IS DISTINCT FROM $1
       AND (r.last_read_at IS NULL OR c.created_at > r.last_read_at)
     GROUP BY c.task_id`,
    [userId]
  );
  res.json(Object.fromEntries(rows.map((r) => [r.task_id, r.unread])));
});

// Marque explicitement une discussion comme lue.
export const markRead = asyncHandler(async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id requis' });
  await query(
    `INSERT INTO comment_reads (user_id, task_id, last_read_at)
     VALUES ($1, $2, now())
     ON CONFLICT (user_id, task_id) DO UPDATE SET last_read_at = now()`,
    [user_id, req.params.taskId]
  );
  res.json({ ok: true });
});

// Ajoute un commentaire. Gère les @mentions (notifications) et marque
// la discussion comme lue pour l'auteur.
export const createComment = asyncHandler(async (req, res) => {
  const { user_id, content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'content est requis' });
  }
  const taskId = req.params.taskId;
  const text = content.trim();

  const result = await withTransaction(async (client) => {
    const ins = await client.query(
      `INSERT INTO task_comments (task_id, user_id, content)
       VALUES ($1, $2, $3) RETURNING id, task_id, content, created_at`,
      [taskId, user_id || null, text]
    );
    const c = ins.rows[0];

    // Auteur
    let user = null;
    if (user_id) {
      const u = await client.query('SELECT id, name, avatar_url FROM users WHERE id = $1', [
        user_id,
      ]);
      if (u.rows.length) user = u.rows[0];
    }

    // L'auteur a "lu" sa propre discussion
    if (user_id) {
      await client.query(
        `INSERT INTO comment_reads (user_id, task_id, last_read_at)
         VALUES ($1, $2, now())
         ON CONFLICT (user_id, task_id) DO UPDATE SET last_read_at = now()`,
        [user_id, taskId]
      );
    }

    // @mentions -> alertes pour chaque utilisateur mentionné (hors auteur)
    const allUsers = (await client.query('SELECT id, name FROM users')).rows;
    const mentioned = await resolveMentions(client, text, allUsers);
    const taskRow = await client.query('SELECT name FROM tasks WHERE id = $1', [taskId]);
    const taskName = taskRow.rows[0]?.name || 'une tâche';
    const authorName = user?.name || 'Quelqu’un';

    for (const m of mentioned) {
      if (m.id === user_id) continue;
      await client.query(
        `INSERT INTO alerts (user_id, message, type)
         VALUES ($1, $2, 'mention')`,
        [m.id, `💬 ${authorName} vous a mentionné sur « ${taskName} » : ${text.slice(0, 80)}`]
      );
    }

    return { ...c, user, mentioned: mentioned.map((m) => m.id) };
  });

  res.status(201).json(result);
});

// Journal d'activité d'une tâche (avec l'auteur joint).
export const listActivity = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT a.id, a.task_id, a.action_type, a.old_value, a.new_value, a.created_at,
            u.id AS user_id, u.name AS user_name, u.avatar_url AS user_avatar_url
     FROM activity_log a
     LEFT JOIN users u ON u.id = a.user_id
     WHERE a.task_id = $1
     ORDER BY a.created_at DESC`,
    [req.params.taskId]
  );
  res.json(
    rows.map((r) => ({
      id: r.id,
      task_id: r.task_id,
      action_type: r.action_type,
      old_value: r.old_value,
      new_value: r.new_value,
      created_at: r.created_at,
      user: r.user_id
        ? { id: r.user_id, name: r.user_name, avatar_url: r.user_avatar_url }
        : null,
    }))
  );
});
