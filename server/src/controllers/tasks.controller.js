import { query, withTransaction } from '../db/pool.js';
import { asyncHandler } from '../middleware/error.js';

// Récupère une tâche mise en forme (avec admin joint) par son id.
const fetchTaskShaped = async (taskId, client = { query }) => {
  const { rows } = await client.query(
    `SELECT
        t.id, t.group_id, t.name, t.position, t.priority, t.start_date, t.created_at,
        t.etape_tag_id, t.intervention_tag_id, t.step_id, t.archived,
        tc.admin_id, tc.status, tc.duedate,
        u.id AS admin_user_id, u.name AS admin_name, u.avatar_url AS admin_avatar_url
     FROM tasks t
     LEFT JOIN task_columns tc ON tc.task_id = t.id
     LEFT JOIN users u ON u.id = tc.admin_id
     WHERE t.id = $1`,
    [taskId]
  );
  if (!rows.length) return null;
  const row = rows[0];
  return {
    id: row.id,
    group_id: row.group_id,
    name: row.name,
    position: row.position,
    priority: row.priority || 'P3 - Normal',
    start_date: row.start_date,
    etape_tag_id: row.etape_tag_id,
    intervention_tag_id: row.intervention_tag_id,
    step_id: row.step_id,
    created_at: row.created_at,
    archived: row.archived === true,
    status: row.status || 'À faire',
    duedate: row.duedate,
    admin: row.admin_user_id
      ? { id: row.admin_user_id, name: row.admin_name, avatar_url: row.admin_avatar_url }
      : null,
  };
};

// Crée une alerte quand une tâche passe "Bloqué".
// Une tâche P1 - Urgent bloquée génère une alerte CRITIQUE.
const createBlockedAlert = async (client, taskId) => {
  const { rows } = await client.query(
    `SELECT t.name, t.priority, tc.admin_id
     FROM tasks t JOIN task_columns tc ON tc.task_id = t.id
     WHERE t.id = $1`,
    [taskId]
  );
  if (!rows.length || !rows[0].admin_id) return null;
  const { name, priority, admin_id } = rows[0];
  const critical = priority === 'P1 - Urgent';
  const type = critical ? 'critical' : 'blocked';
  const message = critical
    ? `🚨 CRITIQUE : la tâche P1 « ${name} » est BLOQUÉE et nécessite une action immédiate.`
    : `La tâche « ${name} » est passée au statut Bloqué.`;
  const { rows: inserted } = await client.query(
    `INSERT INTO alerts (user_id, message, type)
     VALUES ($1, $2, $3::alert_type) RETURNING *`,
    [admin_id, message, type]
  );
  return inserted[0];
};

const addDaysIso = (iso, n) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const diffDays = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

// Contrainte Finish-to-Start : après changement des dates d'une tâche,
// repousse en cascade les successeurs qui démarreraient avant la fin du
// prédécesseur. Conserve la durée de chaque successeur. Renvoie les ids
// modifiés. Protégé contre les boucles par un compteur de profondeur.
const cascadeShiftSuccessors = async (client, taskId, depth = 0) => {
  if (depth > 200) return [];
  const shifted = [];
  const { rows: deps } = await client.query(
    'SELECT successor_id FROM task_dependencies WHERE predecessor_id = $1',
    [taskId]
  );
  if (!deps.length) return shifted;

  // start_date vit dans tasks ; duedate vit dans task_columns (relation 1-1).
  const datesSql = `SELECT t.start_date, tc.duedate
     FROM tasks t LEFT JOIN task_columns tc ON tc.task_id = t.id
     WHERE t.id = $1`;

  const predRes = await client.query(datesSql, [taskId]);
  const predEnd = predRes.rows[0]?.duedate || predRes.rows[0]?.start_date;
  if (!predEnd) return shifted;
  const predEndIso = new Date(predEnd).toISOString().slice(0, 10);

  for (const { successor_id } of deps) {
    const sRes = await client.query(datesSql, [successor_id]);
    const s = sRes.rows[0];
    if (!s) continue;
    const sStart = s.start_date || s.duedate;
    if (!sStart) continue;
    const sStartIso = new Date(sStart).toISOString().slice(0, 10);
    const minStart = addDaysIso(predEndIso, 1); // démarre le lendemain de la fin

    if (sStartIso < minStart) {
      const duration = s.duedate && s.start_date ? diffDays(s.start_date, s.duedate) : 0;
      const newStart = minStart;
      const newEnd = addDaysIso(newStart, duration);
      await client.query('UPDATE tasks SET start_date = $1 WHERE id = $2', [
        newStart,
        successor_id,
      ]);
      await client.query(
        `INSERT INTO task_columns (task_id, duedate) VALUES ($1, $2)
         ON CONFLICT (task_id) DO UPDATE SET duedate = EXCLUDED.duedate`,
        [successor_id, newEnd]
      );
      shifted.push(successor_id);
      const sub = await cascadeShiftSuccessors(client, successor_id, depth + 1);
      shifted.push(...sub);
    }
  }
  return shifted;
};

/**
 * Crée une tâche + sa ligne task_columns associée (transaction).
 * Body : { group_id, name, admin_id?, status?, duedate?, priority? }
 */
export const createTask = asyncHandler(async (req, res) => {
  const { group_id, name, admin_id, status, duedate, priority, start_date, actor_id } = req.body;
  if (!group_id || !name) {
    return res.status(400).json({ error: 'group_id et name sont requis' });
  }

  const task = await withTransaction(async (client) => {
    const posRes = await client.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM tasks WHERE group_id = $1',
      [group_id]
    );
    const position = posRes.rows[0].next;

    const taskRes = await client.query(
      `INSERT INTO tasks (group_id, name, position, priority, start_date)
       VALUES ($1, $2, $3, COALESCE($4::task_priority, 'P3 - Normal'), $5) RETURNING id`,
      [group_id, name, position, priority || null, start_date || null]
    );
    const taskId = taskRes.rows[0].id;

    await client.query(
      `INSERT INTO task_columns (task_id, admin_id, status, duedate)
       VALUES ($1, $2, COALESCE($3::task_status, 'À faire'), $4)`,
      [taskId, admin_id || null, status || null, duedate || null]
    );

    if (status === 'Bloqué') {
      await createBlockedAlert(client, taskId);
    }

    await client.query(
      `INSERT INTO activity_log (task_id, user_id, action_type, old_value, new_value)
       VALUES ($1, $2, 'created', NULL, $3)`,
      [taskId, actor_id || null, name]
    );

    return fetchTaskShaped(taskId, client);
  });

  res.status(201).json(task);
});

/**
 * Met à jour une tâche et/ou ses colonnes.
 * Body : { name?, position?, group_id?, admin_id?, status?, duedate?, priority? }
 * Si status passe à "Bloqué", une alerte est créée pour l'admin
 * (critique si la tâche est P1 - Urgent).
 */
export const updateTask = asyncHandler(async (req, res) => {
  const taskId = req.params.id;
  const {
    name, position, group_id, admin_id, status, duedate, priority, start_date,
    etape_tag_id, intervention_tag_id, step_id, archived, actor_id,
  } = req.body;

  const task = await withTransaction(async (client) => {
    // État précédent complet (pour journaliser les changements)
    const before = await fetchTaskShaped(taskId, client);
    if (!before) {
      const err = new Error('Tâche introuvable');
      err.status = 404;
      throw err;
    }
    const prevStatus = before.status;

    // Mise à jour des champs propres à la tâche (dont la priorité, AVANT
    // le calcul d'alerte pour qu'un passage P1+Bloqué déclenche le critique).
    // $6 indique si l'on doit toucher start_date (pour pouvoir le mettre à NULL).
    if (
      name !== undefined ||
      position !== undefined ||
      group_id !== undefined ||
      priority !== undefined ||
      start_date !== undefined ||
      etape_tag_id !== undefined ||
      intervention_tag_id !== undefined ||
      step_id !== undefined ||
      archived !== undefined
    ) {
      await client.query(
        `UPDATE tasks
         SET name = COALESCE($1, name),
             position = COALESCE($2, position),
             group_id = COALESCE($3, group_id),
             priority = COALESCE($4::task_priority, priority),
             start_date = CASE WHEN $6 THEN $5 ELSE start_date END,
             etape_tag_id = CASE WHEN $8 THEN $9 ELSE etape_tag_id END,
             intervention_tag_id = CASE WHEN $10 THEN $11 ELSE intervention_tag_id END,
             step_id = CASE WHEN $12 THEN $13 ELSE step_id END,
             archived = CASE WHEN $14 THEN $15 ELSE archived END,
             archived_at = CASE WHEN $14 THEN (CASE WHEN $15 THEN now() ELSE NULL END)
                                ELSE archived_at END
         WHERE id = $7`,
        [
          name ?? null,
          position ?? null,
          group_id ?? null,
          priority ?? null,
          start_date ?? null,
          start_date !== undefined,
          taskId,
          etape_tag_id !== undefined,
          etape_tag_id ?? null,
          intervention_tag_id !== undefined,
          intervention_tag_id ?? null,
          step_id !== undefined,
          step_id ?? null,
          typeof archived === 'boolean',
          archived === true,
        ]
      );
    }

    // Mise à jour des colonnes (admin/status/duedate)
    // $5 / $6 indiquent si l'on doit toucher admin_id / duedate (pour
    // pouvoir les remettre à NULL explicitement sans les écraser sinon).
    if (admin_id !== undefined || status !== undefined || duedate !== undefined) {
      await client.query(
        `INSERT INTO task_columns (task_id, admin_id, status, duedate)
         VALUES ($1, $2, COALESCE($3::task_status, 'À faire'), $4)
         ON CONFLICT (task_id) DO UPDATE SET
           admin_id = CASE WHEN $5 THEN EXCLUDED.admin_id ELSE task_columns.admin_id END,
           status   = COALESCE($3::task_status, task_columns.status),
           duedate  = CASE WHEN $6 THEN EXCLUDED.duedate ELSE task_columns.duedate END`,
        [
          taskId,
          admin_id ?? null,
          status ?? null,
          duedate ?? null,
          admin_id !== undefined,
          duedate !== undefined,
        ]
      );
    }

    // Alerte si on vient de passer à "Bloqué"
    if (status === 'Bloqué' && prevStatus !== 'Bloqué') {
      await createBlockedAlert(client, taskId);
    }

    const after = await fetchTaskShaped(taskId, client);

    // Journalisation des changements significatifs
    const logs = [];
    if (status !== undefined && before.status !== after.status)
      logs.push(['status', before.status, after.status]);
    if (priority !== undefined && before.priority !== after.priority)
      logs.push(['priority', before.priority, after.priority]);
    if (name !== undefined && before.name !== after.name)
      logs.push(['name', before.name, after.name]);
    if (duedate !== undefined && (before.duedate || null) !== (after.duedate || null))
      logs.push(['duedate', before.duedate || '—', after.duedate || '—']);
    if (admin_id !== undefined && (before.admin?.id || null) !== (after.admin?.id || null))
      logs.push(['admin', before.admin?.name || 'Personne', after.admin?.name || 'Personne']);
    if (archived !== undefined && before.archived !== after.archived)
      logs.push([
        'archived',
        before.archived ? 'archivée' : 'active',
        after.archived ? 'archivée' : 'active',
      ]);

    for (const [action, oldV, newV] of logs) {
      await client.query(
        `INSERT INTO activity_log (task_id, user_id, action_type, old_value, new_value)
         VALUES ($1, $2, $3, $4, $5)`,
        [taskId, actor_id || null, action, String(oldV), String(newV)]
      );
    }

    // Contrainte de planning : si les dates ont changé, repousse les successeurs.
    let shiftedIds = [];
    const datesChanged =
      (start_date !== undefined && (before.start_date || null) !== (after.start_date || null)) ||
      (duedate !== undefined && (before.duedate || null) !== (after.duedate || null));
    if (datesChanged) {
      shiftedIds = await cascadeShiftSuccessors(client, taskId);
    }

    const shifted = [];
    for (const id of [...new Set(shiftedIds)]) {
      shifted.push(await fetchTaskShaped(id, client));
    }

    return { ...after, _shifted: shifted };
  });

  // _shifted : tâches successeurs repoussées par la contrainte de planning
  const { _shifted, ...clean } = task;
  res.json({ ...clean, shifted: _shifted });
});

export const deleteTask = asyncHandler(async (req, res) => {
  const { rowCount } = await query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Tâche introuvable' });
  res.status(204).end();
});

/**
 * Réordonne / déplace des tâches en une seule transaction.
 * Body : { items: [{ id, group_id, position }, ...] }
 * Met à jour group_id et position pour chaque tâche fournie via un
 * UPDATE ... FROM (unnest) unique, donc une seule requête en base.
 */
export const reorderTasks = asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items (tableau non vide) est requis' });
  }

  // Validation + extraction en colonnes parallèles pour unnest()
  const ids = [];
  const groupIds = [];
  const positions = [];
  for (const it of items) {
    if (it == null || it.id == null || it.group_id == null || it.position == null) {
      return res
        .status(400)
        .json({ error: 'chaque item doit avoir id, group_id et position' });
    }
    ids.push(Number(it.id));
    groupIds.push(Number(it.group_id));
    positions.push(Number(it.position));
  }

  await withTransaction(async (client) => {
    // Un seul UPDATE pour toutes les lignes : on déballe les 3 tableaux
    // en une table virtuelle (id, group_id, position) puis on joint.
    await client.query(
      `UPDATE tasks AS t
         SET group_id = v.group_id,
             position = v.position
       FROM (
         SELECT * FROM unnest(
           $1::int[], $2::int[], $3::int[]
         ) AS u(id, group_id, position)
       ) AS v
       WHERE t.id = v.id`,
      [ids, groupIds, positions]
    );
  });

  res.json({ ok: true, updated: ids.length });
});
