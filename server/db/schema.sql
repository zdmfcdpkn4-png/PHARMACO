-- =====================================================================
--  PHARMACO — Schéma PostgreSQL pour l'outil de gestion de projet/équipe
--  (inspiré de Monday.com)
-- =====================================================================
--  Exécution :  psql "$DATABASE_URL" -f server/db/schema.sql
--  Idempotent : peut être ré-exécuté (DROP ... IF EXISTS + CREATE).
-- =====================================================================

-- Extension pour générer des UUID si besoin (on reste en SERIAL ici,
-- mais on l'active pour les avatars/tokens éventuels).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
--  Types ENUM
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
        CREATE TYPE task_status AS ENUM ('À faire', 'En cours', 'Fait', 'Bloqué');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'member', 'viewer');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_type') THEN
        CREATE TYPE alert_type AS ENUM ('blocked', 'assigned', 'due_soon', 'mention', 'info', 'critical');
    END IF;
    -- Ajoute 'critical' aux bases déjà créées
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'alert_type' AND e.enumlabel = 'critical'
    ) THEN
        ALTER TYPE alert_type ADD VALUE 'critical';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
        CREATE TYPE task_priority AS ENUM ('P1 - Urgent', 'P2 - Élevé', 'P3 - Normal');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tag_type') THEN
        CREATE TYPE tag_type AS ENUM ('etape', 'intervention');
    END IF;
END$$;

-- ---------------------------------------------------------------------
--  Table : users
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(120)  NOT NULL,
    email         VARCHAR(255)  NOT NULL UNIQUE,
    avatar_url    TEXT,
    role          user_role     NOT NULL DEFAULT 'member',
    password_hash TEXT,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Pour les bases déjà créées : ajoute les colonnes si absentes.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
-- Force le changement de mot de passe à la prochaine connexion (comptes
-- amorcés en production, mots de passe réinitialisés par un admin…).
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------
--  Table : workspaces
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workspaces (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(160)  NOT NULL,
    description TEXT,
    created_by  INTEGER       REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
--  Table : boards (tableaux)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS boards (
    id           SERIAL PRIMARY KEY,
    workspace_id INTEGER      NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name         VARCHAR(160) NOT NULL,
    description  TEXT,
    created_by   INTEGER      REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_boards_workspace ON boards(workspace_id);
-- Personnalisation & cycle de vie des projets.
ALTER TABLE boards ADD COLUMN IF NOT EXISTS color VARCHAR(9);
ALTER TABLE boards ADD COLUMN IF NOT EXISTS icon VARCHAR(16);
ALTER TABLE boards ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

-- Pour les bases déjà créées : ajoute la colonne propriétaire si absente.
ALTER TABLE boards ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
--  Table : groups (sections pliables : "To-do", "Terminé", ...)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS groups (
    id        SERIAL PRIMARY KEY,
    board_id  INTEGER      NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name      VARCHAR(160) NOT NULL,
    color     VARCHAR(20)  NOT NULL DEFAULT '#579bfc', -- couleur d'accent de la section
    position  INTEGER      NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_groups_board ON groups(board_id);

-- ---------------------------------------------------------------------
--  Table : tasks
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    id        SERIAL PRIMARY KEY,
    group_id  INTEGER      NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    name      VARCHAR(255) NOT NULL,
    position  INTEGER      NOT NULL DEFAULT 0,
    priority  task_priority NOT NULL DEFAULT 'P3 - Normal',
    start_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_group ON tasks(group_id);

-- Pour les bases déjà créées : ajoute les colonnes si absentes.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority task_priority NOT NULL DEFAULT 'P3 - Normal';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date DATE;

-- ---------------------------------------------------------------------
--  Table : task_columns (les valeurs des colonnes d'une tâche)
--  Relation 1-1 avec tasks (une ligne de colonnes par tâche).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_columns (
    id        SERIAL PRIMARY KEY,
    task_id   INTEGER     NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
    admin_id  INTEGER     REFERENCES users(id) ON DELETE SET NULL,
    status    task_status NOT NULL DEFAULT 'À faire',
    duedate   DATE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_columns_admin  ON task_columns(admin_id);
CREATE INDEX IF NOT EXISTS idx_task_columns_status ON task_columns(status);

-- ---------------------------------------------------------------------
--  Table : sub_tasks (sous-items d'une tâche)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sub_tasks (
    id             SERIAL PRIMARY KEY,
    parent_task_id INTEGER      NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    name           VARCHAR(255) NOT NULL,
    position       INTEGER      NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sub_tasks_parent ON sub_tasks(parent_task_id);

-- ---------------------------------------------------------------------
--  Table : sub_task_columns (attributs propres à chaque sous-item)
--  Relation 1-1 avec sub_tasks. Chaque sous-item a son admin/statut/date.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sub_task_columns (
    id          SERIAL PRIMARY KEY,
    sub_task_id INTEGER     NOT NULL UNIQUE REFERENCES sub_tasks(id) ON DELETE CASCADE,
    admin_id    INTEGER     REFERENCES users(id) ON DELETE SET NULL,
    status      task_status NOT NULL DEFAULT 'À faire',
    duedate     DATE,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sub_task_columns_admin ON sub_task_columns(admin_id);

-- ---------------------------------------------------------------------
--  Table : custom_categories (colonnes personnalisées d'un board)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_categories (
    id         SERIAL PRIMARY KEY,
    board_id   INTEGER      NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name       VARCHAR(120) NOT NULL,
    type       VARCHAR(20)  NOT NULL DEFAULT 'text', -- text | status | person | date
    position   INTEGER      NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_custom_categories_board ON custom_categories(board_id);

-- Valeurs des catégories personnalisées par tâche (clé/valeur souple).
CREATE TABLE IF NOT EXISTS custom_values (
    category_id INTEGER NOT NULL REFERENCES custom_categories(id) ON DELETE CASCADE,
    task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    value       TEXT,
    PRIMARY KEY (category_id, task_id)
);

-- ---------------------------------------------------------------------
--  Table : project_tags (étiquettes : Étape / Type d'intervention)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_tags (
    id        SERIAL PRIMARY KEY,
    board_id  INTEGER     NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name      VARCHAR(120) NOT NULL,
    color     VARCHAR(20)  NOT NULL DEFAULT '#579bfc',
    tag_type  tag_type     NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_tags_board ON project_tags(board_id);

-- Clés étrangères d'étiquetage sur tâches et sous-items
ALTER TABLE tasks      ADD COLUMN IF NOT EXISTS etape_tag_id        INTEGER REFERENCES project_tags(id) ON DELETE SET NULL;
ALTER TABLE tasks      ADD COLUMN IF NOT EXISTS intervention_tag_id INTEGER REFERENCES project_tags(id) ON DELETE SET NULL;
ALTER TABLE sub_tasks  ADD COLUMN IF NOT EXISTS etape_tag_id        INTEGER REFERENCES project_tags(id) ON DELETE SET NULL;
ALTER TABLE sub_tasks  ADD COLUMN IF NOT EXISTS intervention_tag_id INTEGER REFERENCES project_tags(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
--  Table : intervention_steps (circuit d'intervention ordonné du projet)
--
--  Remplace à terme les étiquettes plates project_tags, qui n'ont ni ordre
--  ni lien de parenté. parent_id porte la hiérarchie Étape -> Sous-étape
--  (deux niveaux maximum, comme tasks -> sub_tasks).
--
--  legacy_tag_id fait le pont avec l'ancienne étiquette d'origine : il rend
--  la reprise de données rejouable (un projet déjà repris ne crée pas de
--  doublon) et permet de retrouver la correspondance après coup.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intervention_steps (
    id            SERIAL PRIMARY KEY,
    board_id      INTEGER      NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    parent_id     INTEGER,     -- FK composite posée plus bas (voir DO $$)
    name          VARCHAR(160) NOT NULL,
    color         VARCHAR(20)  NOT NULL DEFAULT '#005586',
    position      INTEGER      NOT NULL DEFAULT 0,
    is_terminal   BOOLEAN      NOT NULL DEFAULT false, -- marque la fin de parcours
    legacy_tag_id INTEGER      REFERENCES project_tags(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Assainissement préalable : ADD CONSTRAINT échoue si une seule ligne viole
-- la règle, et l'API refuserait alors de démarrer. On neutralise donc les cas
-- aberrants héritables avant de poser les contraintes (sans effet sur une
-- base saine, donc rejouable).
UPDATE intervention_steps SET parent_id = NULL WHERE parent_id = id;
UPDATE intervention_steps s SET parent_id = NULL
  WHERE s.parent_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM intervention_steps p
       WHERE p.id = s.parent_id AND p.board_id = s.board_id
    );

-- Contraintes posées séparément et gardées par pg_constraint : une base déjà
-- créée par une version antérieure ignorerait des contraintes déclarées dans
-- le CREATE TABLE (que « IF NOT EXISTS » saute intégralement).
--
-- La clé étrangère est COMPOSITE : (parent_id, board_id) -> (id, board_id).
-- Elle garantit EN BASE qu'une sous-étape appartient au même projet que son
-- étape parente — c'est précisément la garantie qui manque aux quatre clés
-- d'étiquetage historiques (tasks/sub_tasks -> project_tags).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_intervention_steps_no_self') THEN
        ALTER TABLE intervention_steps
            ADD CONSTRAINT ck_intervention_steps_no_self
            CHECK (parent_id IS DISTINCT FROM id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_intervention_steps_id_board') THEN
        ALTER TABLE intervention_steps
            ADD CONSTRAINT uq_intervention_steps_id_board UNIQUE (id, board_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_intervention_steps_parent') THEN
        ALTER TABLE intervention_steps
            ADD CONSTRAINT fk_intervention_steps_parent
            FOREIGN KEY (parent_id, board_id)
            REFERENCES intervention_steps (id, board_id) ON DELETE CASCADE;
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_intervention_steps_board  ON intervention_steps(board_id, position);
CREATE INDEX IF NOT EXISTS idx_intervention_steps_parent ON intervention_steps(parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_intervention_steps_legacy
    ON intervention_steps(legacy_tag_id) WHERE legacy_tag_id IS NOT NULL;

-- Étape courante d'une tâche / d'un sous-item (la plus fine du circuit).
ALTER TABLE tasks     ADD COLUMN IF NOT EXISTS step_id INTEGER REFERENCES intervention_steps(id) ON DELETE SET NULL;
ALTER TABLE sub_tasks ADD COLUMN IF NOT EXISTS step_id INTEGER REFERENCES intervention_steps(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_step     ON tasks(step_id);
CREATE INDEX IF NOT EXISTS idx_sub_tasks_step ON sub_tasks(step_id);

-- ---------------------------------------------------------------------
--  Table : task_step_progress (franchissement d'une étape : qui, quand)
--  Une ligne par couple (tâche, étape) franchi. L'absence de ligne — ou
--  une ligne à completed_at NULL — vaut « non franchi ».
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_step_progress (
    id           SERIAL PRIMARY KEY,
    task_id      INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    step_id      INTEGER NOT NULL REFERENCES intervention_steps(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ,
    completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    note         TEXT,
    UNIQUE (task_id, step_id)
);
CREATE INDEX IF NOT EXISTS idx_task_step_progress_task ON task_step_progress(task_id);

-- ---------------------------------------------------------------------
--  Reprise des étiquettes existantes en étapes — UNE SEULE FOIS par projet.
--
--  Le marqueur boards.steps_seeded_at garantit qu'un projet déjà repris
--  n'est jamais retouché : les re-parentages et affectations faits par le
--  responsable de projet ne peuvent donc pas être écrasés au redémarrage.
--
--  Limite assumée : rien, dans le modèle d'origine, n'indique quelle
--  « intervention » appartient à quelle « étape ». Les deux familles sont
--  donc reprises à plat au niveau 1, à charge pour le responsable de
--  projet de les re-rattacher dans l'éditeur de circuit.
-- ---------------------------------------------------------------------
ALTER TABLE boards ADD COLUMN IF NOT EXISTS steps_seeded_at TIMESTAMPTZ;

DO $$
DECLARE
    b RECORD;
BEGIN
    FOR b IN SELECT id FROM boards WHERE steps_seeded_at IS NULL LOOP
        -- 1) Une étape de niveau 1 par étiquette, dans l'ordre étape puis type.
        INSERT INTO intervention_steps (board_id, parent_id, name, color, position, legacy_tag_id)
        SELECT t.board_id,
               NULL,
               t.name,
               t.color,
               (ROW_NUMBER() OVER (ORDER BY t.tag_type, t.id))::int - 1,
               t.id
        FROM project_tags t
        WHERE t.board_id = b.id
        ON CONFLICT DO NOTHING;

        -- 2) Étape courante des tâches : le type d'intervention est plus fin
        --    que l'étape, il prime donc quand les deux sont renseignés.
        UPDATE tasks tk
           SET step_id = s.id
          FROM intervention_steps s, groups g
         WHERE g.id = tk.group_id
           AND g.board_id = b.id
           AND s.legacy_tag_id = tk.intervention_tag_id
           AND tk.step_id IS NULL;

        UPDATE tasks tk
           SET step_id = s.id
          FROM intervention_steps s, groups g
         WHERE g.id = tk.group_id
           AND g.board_id = b.id
           AND s.legacy_tag_id = tk.etape_tag_id
           AND tk.step_id IS NULL;

        -- 3) Idem pour les sous-items.
        UPDATE sub_tasks st
           SET step_id = s.id
          FROM intervention_steps s, tasks tk, groups g
         WHERE tk.id = st.parent_task_id
           AND g.id = tk.group_id
           AND g.board_id = b.id
           AND s.legacy_tag_id = st.intervention_tag_id
           AND st.step_id IS NULL;

        UPDATE sub_tasks st
           SET step_id = s.id
          FROM intervention_steps s, tasks tk, groups g
         WHERE tk.id = st.parent_task_id
           AND g.id = tk.group_id
           AND g.board_id = b.id
           AND s.legacy_tag_id = st.etape_tag_id
           AND st.step_id IS NULL;

        UPDATE boards SET steps_seeded_at = now() WHERE id = b.id;
    END LOOP;
END$$;

-- ---------------------------------------------------------------------
--  Tables de jointure : multi-assignation (tâches & sous-items)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_assignments (
    id      SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (task_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_task_assignments_task ON task_assignments(task_id);

CREATE TABLE IF NOT EXISTS sub_task_assignments (
    id          SERIAL PRIMARY KEY,
    sub_task_id INTEGER NOT NULL REFERENCES sub_tasks(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (sub_task_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_sub_task_assignments_sub ON sub_task_assignments(sub_task_id);

-- Migration douce : recopie l'admin_id existant vers les tables de jointure.
INSERT INTO task_assignments (task_id, user_id)
  SELECT task_id, admin_id FROM task_columns WHERE admin_id IS NOT NULL
  ON CONFLICT DO NOTHING;
INSERT INTO sub_task_assignments (sub_task_id, user_id)
  SELECT sub_task_id, admin_id FROM sub_task_columns WHERE admin_id IS NOT NULL
  ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
--  Table : alerts (notifications)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message    TEXT        NOT NULL,
    type       alert_type  NOT NULL DEFAULT 'info',
    is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alerts_user_unread ON alerts(user_id, is_read);

-- ---------------------------------------------------------------------
--  Tables : équipes & raccourcis de barre latérale
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(160) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_members (
    id      SERIAL PRIMARY KEY,
    team_id INTEGER     NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role    VARCHAR(40) NOT NULL DEFAULT 'membre',
    UNIQUE (team_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);

CREATE TABLE IF NOT EXISTS sidebar_shortcuts (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(160) NOT NULL,
    target_url TEXT        NOT NULL,
    icon_name  VARCHAR(40) NOT NULL DEFAULT 'Link',
    position   INTEGER     NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sidebar_shortcuts_user ON sidebar_shortcuts(user_id);

-- Liaison équipes <-> projets (un projet implique plusieurs équipes).
CREATE TABLE IF NOT EXISTS project_teams (
    board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    team_id  INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    PRIMARY KEY (board_id, team_id)
);
CREATE INDEX IF NOT EXISTS idx_project_teams_board ON project_teams(board_id);

-- ---------------------------------------------------------------------
--  Table : task_comments (discussion contextuelle d'une tâche)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_comments (
    id         SERIAL PRIMARY KEY,
    task_id    INTEGER     NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id    INTEGER     REFERENCES users(id) ON DELETE SET NULL,
    content    TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);
-- Destinataire ciblé + message prioritaire (visibles sur la vue d'ensemble).
ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS recipient_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS priority BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_task_comments_recipient ON task_comments(recipient_id);

-- ---------------------------------------------------------------------
--  Table : comment_reads (suivi lu / non-lu par utilisateur)
--  Mémorise le dernier commentaire lu par un utilisateur sur une tâche.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comment_reads (
    user_id      INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id      INTEGER     NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, task_id)
);

-- ---------------------------------------------------------------------
--  Table : task_dependencies (dépendances Gantt)
--  predecessor doit se terminer avant que successor ne commence
--  (relation Finish-to-Start).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_dependencies (
    id             SERIAL PRIMARY KEY,
    predecessor_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    successor_id   INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (predecessor_id, successor_id),
    CHECK (predecessor_id <> successor_id)
);
CREATE INDEX IF NOT EXISTS idx_task_dep_pred ON task_dependencies(predecessor_id);
CREATE INDEX IF NOT EXISTS idx_task_dep_succ ON task_dependencies(successor_id);

-- ---------------------------------------------------------------------
--  Table : activity_log (journal d'activité d'une tâche)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_log (
    id          SERIAL PRIMARY KEY,
    task_id     INTEGER     NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id     INTEGER     REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(40) NOT NULL,         -- ex: 'status', 'priority', 'admin', 'duedate', 'name', 'created'
    old_value   TEXT,
    new_value   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_log_task ON activity_log(task_id);

-- ---------------------------------------------------------------------
--  Trigger : maintenir task_columns.updated_at
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_columns_updated_at ON task_columns;
CREATE TRIGGER trg_task_columns_updated_at
    BEFORE UPDATE ON task_columns
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
