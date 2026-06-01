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

-- Pour les bases déjà créées : ajoute la colonne si absente.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

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
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_boards_workspace ON boards(workspace_id);

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
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_group ON tasks(group_id);

-- Pour les bases déjà créées : ajoute la colonne si absente.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority task_priority NOT NULL DEFAULT 'P3 - Normal';

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
