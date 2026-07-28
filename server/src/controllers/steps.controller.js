import { query, withTransaction } from '../db/pool.js';
import { asyncHandler } from '../middleware/error.js';

const SELECT_STEP = `
  SELECT id, board_id, parent_id, name, color, position, is_terminal
    FROM intervention_steps`;

// Profondeur maximale du circuit, en index :
//   0 = étape, 1 = sous-étape, 2 = sous-sous-étape.
const PROFONDEUR_MAX = 2;
const TROP_PROFOND = 'Le circuit est limité à trois niveaux (étape, sous-étape, sous-sous-étape)';

// Garde-fou commun aux parcours récursifs : borne le nombre d'itérations pour
// qu'une donnée cyclique fasse échouer la requête au lieu de la faire tourner
// indéfiniment.
const BORNE_RECURSION = 16;

// Profondeur d'une étape : nombre d'ancêtres (0 pour une étape de 1er niveau).
const profondeurDe = async (client, id) => {
  const { rows } = await client.query(
    `WITH RECURSIVE chaine AS (
         SELECT id, parent_id, 0 AS niveau
           FROM intervention_steps WHERE id = $1
       UNION ALL
         SELECT p.id, p.parent_id, c.niveau + 1
           FROM intervention_steps p
           JOIN chaine c ON p.id = c.parent_id
          WHERE c.niveau < $2
     )
     SELECT COALESCE(MAX(niveau), 0) AS profondeur FROM chaine`,
    [id, BORNE_RECURSION]
  );
  const profondeur = Number(rows[0].profondeur);
  if (profondeur >= BORNE_RECURSION) {
    const err = new Error('Circuit incohérent : chaîne de parenté cyclique');
    err.status = 409;
    throw err;
  }
  return profondeur;
};

// Descendants d'une étape (elle-même incluse) et hauteur du sous-arbre.
// Sert à deux contrôles lors d'un re-parentage : interdire de placer une étape
// sous l'un de ses propres descendants (cycle), et vérifier que le sous-arbre
// déplacé tient encore dans la profondeur maximale.
const sousArbreDe = async (client, id) => {
  const { rows } = await client.query(
    `WITH RECURSIVE sous AS (
         SELECT id, 0 AS niveau
           FROM intervention_steps WHERE id = $1
       UNION ALL
         SELECT e.id, s.niveau + 1
           FROM intervention_steps e
           JOIN sous s ON e.parent_id = s.id
          WHERE s.niveau < $2
     )
     SELECT id, niveau FROM sous`,
    [id, BORNE_RECURSION]
  );
  return {
    ids: new Set(rows.map((r) => Number(r.id))),
    hauteur: rows.reduce((m, r) => Math.max(m, Number(r.niveau)), 0),
  };
};

const assertParentValide = async (client, boardId, parentId, selfId = null) => {
  if (parentId == null) return null;
  const id = Number(parentId);
  if (!Number.isInteger(id)) {
    const err = new Error('parent_id invalide');
    err.status = 400;
    throw err;
  }
  if (selfId != null && id === Number(selfId)) {
    const err = new Error('Une étape ne peut pas être sa propre parente');
    err.status = 400;
    throw err;
  }
  const { rows } = await client.query(
    'SELECT id, board_id, parent_id FROM intervention_steps WHERE id = $1',
    [id]
  );
  const parent = rows[0];
  if (!parent) {
    const err = new Error('Étape parente introuvable');
    err.status = 404;
    throw err;
  }
  if (Number(parent.board_id) !== Number(boardId)) {
    const err = new Error("L'étape parente doit appartenir au même projet");
    err.status = 400;
    throw err;
  }

  // Le sous-arbre déplacé descend avec l'étape : c'est sa feuille la plus
  // basse qui doit rester dans la limite, pas seulement l'étape elle-même.
  let hauteur = 0;
  if (selfId != null) {
    const sousArbre = await sousArbreDe(client, Number(selfId));
    if (sousArbre.ids.has(id)) {
      const err = new Error("Une étape ne peut pas être placée sous l'une de ses sous-étapes");
      err.status = 400;
      throw err;
    }
    hauteur = sousArbre.hauteur;
  }

  if ((await profondeurDe(client, id)) + 1 + hauteur > PROFONDEUR_MAX) {
    const err = new Error(TROP_PROFOND);
    err.status = 400;
    throw err;
  }
  return id;
};

export const listSteps = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `${SELECT_STEP} WHERE board_id = $1 ORDER BY position, id`,
    [req.params.boardId]
  );
  res.json(rows);
});

export const createStep = asyncHandler(async (req, res) => {
  const { name, color, parent_id, is_terminal } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name est requis' });
  }
  const boardId = Number(req.params.boardId);
  if (!Number.isInteger(boardId)) {
    return res.status(400).json({ error: 'boardId invalide' });
  }

  const created = await withTransaction(async (client) => {
    const parentId = await assertParentValide(client, boardId, parent_id);
    // Position suivante parmi les frères et sœurs (même parent).
    const { rows: posRows } = await client.query(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next
         FROM intervention_steps
        WHERE board_id = $1 AND parent_id IS NOT DISTINCT FROM $2`,
      [boardId, parentId]
    );
    const { rows } = await client.query(
      `INSERT INTO intervention_steps (board_id, parent_id, name, color, position, is_terminal)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, board_id, parent_id, name, color, position, is_terminal`,
      [
        boardId,
        parentId,
        name.trim(),
        color || '#005586',
        posRows[0].next,
        is_terminal === true,
      ]
    );
    return rows[0];
  });

  res.status(201).json(created);
});

export const updateStep = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'id invalide' });
  }
  const { name, color, parent_id, position, is_terminal } = req.body;

  const updated = await withTransaction(async (client) => {
    const { rows: current } = await client.query(
      'SELECT id, board_id, parent_id FROM intervention_steps WHERE id = $1',
      [id]
    );
    if (!current.length) {
      const err = new Error('Étape introuvable');
      err.status = 404;
      throw err;
    }
    const boardId = current[0].board_id;

    // Re-parenter : profondeur, appartenance au projet et absence de cycle.
    // `assertParentValide` tient compte du sous-arbre emporté par l'étape.
    let parentId = current[0].parent_id;
    if (parent_id !== undefined) {
      parentId = await assertParentValide(client, boardId, parent_id, id);
    }

    const { rows } = await client.query(
      `UPDATE intervention_steps
          SET name        = COALESCE($2, name),
              color       = COALESCE($3, color),
              parent_id   = $4,
              position    = COALESCE($5, position),
              is_terminal = COALESCE($6, is_terminal)
        WHERE id = $1
        RETURNING id, board_id, parent_id, name, color, position, is_terminal`,
      [
        id,
        name != null && String(name).trim() ? String(name).trim() : null,
        color || null,
        parentId,
        position != null && Number.isInteger(Number(position)) ? Number(position) : null,
        typeof is_terminal === 'boolean' ? is_terminal : null,
      ]
    );
    return rows[0];
  });

  res.json(updated);
});

export const deleteStep = asyncHandler(async (req, res) => {
  // ON DELETE CASCADE retire les sous-étapes et les franchissements ;
  // tasks.step_id / sub_tasks.step_id repassent à NULL (ON DELETE SET NULL).
  const { rowCount } = await query('DELETE FROM intervention_steps WHERE id = $1', [
    req.params.id,
  ]);
  if (!rowCount) return res.status(404).json({ error: 'Étape introuvable' });
  res.status(204).end();
});

export const reorderSteps = asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items doit être un tableau' });
  }
  const ids = [];
  const parents = [];
  const positions = [];
  for (const it of items) {
    if (!it || it.id == null || it.position == null) {
      return res.status(400).json({ error: 'chaque item doit avoir id et position' });
    }
    const id = Number(it.id);
    const position = Number(it.position);
    const parent = it.parent_id == null ? null : Number(it.parent_id);
    if (!Number.isInteger(id) || !Number.isInteger(position)) {
      return res.status(400).json({ error: 'id et position doivent être des entiers' });
    }
    if (parent !== null && !Number.isInteger(parent)) {
      return res.status(400).json({ error: 'parent_id doit être un entier ou nul' });
    }
    if (parent !== null && parent === id) {
      return res.status(400).json({ error: 'Une étape ne peut pas être sa propre parente' });
    }
    ids.push(id);
    parents.push(parent);
    positions.push(position);
  }

  await withTransaction(async (client) => {
    // Un seul UPDATE pour toutes les lignes (même idiome que reorderTasks).
    await client.query(
      `UPDATE intervention_steps AS s
          SET parent_id = v.parent_id,
              position  = v.position
         FROM (
           SELECT * FROM unnest(
             $1::int[], $2::int[], $3::int[]
           ) AS u(id, parent_id, position)
         ) AS v
        WHERE s.id = v.id`,
      [ids, parents, positions]
    );
    // Garde-fou : après réordonnancement, le circuit doit rester un arbre de
    // trois niveaux au plus. On descend depuis les racines : toute étape non
    // atteinte appartient à un cycle, toute étape trop basse casse la limite.
    const { rows } = await client.query(
      `WITH RECURSIVE arbre AS (
           SELECT id, 0 AS niveau
             FROM intervention_steps WHERE parent_id IS NULL
         UNION ALL
           SELECT e.id, a.niveau + 1
             FROM intervention_steps e
             JOIN arbre a ON e.parent_id = a.id
            WHERE a.niveau < $1
       )
       SELECT (SELECT COALESCE(MAX(niveau), 0) FROM arbre)        AS profondeur,
              (SELECT count(*) FROM arbre)                        AS atteignables,
              (SELECT count(*) FROM intervention_steps)           AS total`,
      [BORNE_RECURSION]
    );
    const { profondeur, atteignables, total } = rows[0];
    if (Number(atteignables) !== Number(total)) {
      const err = new Error('Circuit incohérent : chaîne de parenté cyclique');
      err.status = 409;
      throw err; // la transaction est annulée
    }
    if (Number(profondeur) > PROFONDEUR_MAX) {
      const err = new Error(TROP_PROFOND);
      err.status = 400;
      throw err; // la transaction est annulée
    }
  });

  res.json({ ok: true, updated: ids.length });
});

/**
 * Marque une étape franchie pour une tâche, ou annule ce franchissement.
 * Body : { task_id, step_id, completed = true, note }
 */
export const setStepProgress = asyncHandler(async (req, res) => {
  const { task_id, step_id, completed = true, actor_id, note } = req.body;
  const taskId = Number(task_id);
  const stepId = Number(step_id);
  if (!Number.isInteger(taskId) || !Number.isInteger(stepId)) {
    return res.status(400).json({ error: 'task_id et step_id sont requis' });
  }

  if (!completed) {
    await query('DELETE FROM task_step_progress WHERE task_id = $1 AND step_id = $2', [
      taskId,
      stepId,
    ]);
    return res.status(204).end();
  }

  const { rows } = await query(
    `INSERT INTO task_step_progress (task_id, step_id, completed_at, completed_by, note)
     VALUES ($1, $2, now(), $3, $4)
     ON CONFLICT (task_id, step_id) DO UPDATE
        SET completed_at = now(),
            completed_by = EXCLUDED.completed_by,
            note         = COALESCE(EXCLUDED.note, task_step_progress.note)
     RETURNING task_id, step_id, completed_at, completed_by, note`,
    // L'identité vient du jeton ; actor_id n'est qu'un repli (parité mock).
    [taskId, stepId, req.user?.id ?? actor_id ?? null, note ?? null]
  );
  res.status(201).json(rows[0]);
});
