-- =====================================================================
--  PHARMACO — Données de démonstration
--  Reproduit l'état de la capture d'écran : board "Suivi",
--  groupes "To-do" et "Terminé".
-- =====================================================================
--  Exécution :  psql "$DATABASE_URL" -f server/db/seed.sql
--  (À lancer APRÈS schema.sql)
-- =====================================================================

-- On repart d'un état propre pour le seed (utile en dev).
TRUNCATE alerts, task_columns, tasks, groups, boards, workspaces, users
    RESTART IDENTITY CASCADE;

-- --- Utilisateurs --------------------------------------------------------
-- avatar_url laissé à NULL : le frontend génère des pastilles d'initiales.
-- password_hash : hash scrypt du mot de passe par défaut « pharmaco123 »
-- (format scrypt$<salt>$<hash>). À changer en production.
INSERT INTO users (name, email, avatar_url, role, password_hash) VALUES
    ('Erwin Raingeard', 'erwin.raingeard@gmail.com', NULL, 'admin',  'scrypt$f4100b77cf486dd553ac76da34d49ee0$6c382664f6ed0d2afb5a4f2f18f66bc6fc85a225d089900d2e0c4121df01dfc5144957887263393059a5e82d796f7665c572d4079607259ea16687d5a6a05524'),
    ('Alice Martin',    'alice.martin@example.com',  NULL, 'member', 'scrypt$f4100b77cf486dd553ac76da34d49ee0$6c382664f6ed0d2afb5a4f2f18f66bc6fc85a225d089900d2e0c4121df01dfc5144957887263393059a5e82d796f7665c572d4079607259ea16687d5a6a05524'),
    ('Bob Durand',      'bob.durand@example.com',    NULL, 'member', 'scrypt$f4100b77cf486dd553ac76da34d49ee0$6c382664f6ed0d2afb5a4f2f18f66bc6fc85a225d089900d2e0c4121df01dfc5144957887263393059a5e82d796f7665c572d4079607259ea16687d5a6a05524'),
    ('Chloé Petit',     'chloe.petit@example.com',   NULL, 'member', 'scrypt$f4100b77cf486dd553ac76da34d49ee0$6c382664f6ed0d2afb5a4f2f18f66bc6fc85a225d089900d2e0c4121df01dfc5144957887263393059a5e82d796f7665c572d4079607259ea16687d5a6a05524');

-- --- Workspace -----------------------------------------------------------
INSERT INTO workspaces (name, description, created_by) VALUES
    ('Espace de travail principal', 'Espace de travail de démonstration PHARMACO', 1);

-- --- Board ---------------------------------------------------------------
INSERT INTO boards (workspace_id, name, description) VALUES
    (1, 'Suivi', 'Tableau de bord de suivi du projet');

-- --- Groups --------------------------------------------------------------
INSERT INTO groups (board_id, name, color, position) VALUES
    (1, 'To-do',   '#579bfc', 0),   -- bleu
    (1, 'Terminé', '#00c875', 1);   -- vert

-- --- Tasks (groupe To-do = group_id 1) -----------------------------------
INSERT INTO tasks (group_id, name, position, priority) VALUES
    (1, 'Tâche 1', 0, 'P1 - Urgent'),
    (1, 'Tâche 2', 1, 'P3 - Normal'),
    (1, 'Tâche 3', 2, 'P2 - Élevé');

-- --- Task columns --------------------------------------------------------
-- Tâche 1 : En cours, échéance mai 28, assignée à Erwin
-- Tâche 2 : Fait,     échéance mai 29, assignée à Alice
-- Tâche 3 : Bloqué,   échéance mai 30, non assignée
INSERT INTO task_columns (task_id, admin_id, status, duedate) VALUES
    (1, 1,    'En cours', DATE '2026-05-28'),
    (2, 2,    'Fait',     DATE '2026-05-29'),
    (3, NULL, 'Bloqué',   DATE '2026-05-30');

-- --- Alertes (la tâche bloquée génère une alerte) ------------------------
INSERT INTO alerts (user_id, message, type) VALUES
    (1, 'La tâche « Tâche 3 » est passée au statut Bloqué.', 'blocked');
