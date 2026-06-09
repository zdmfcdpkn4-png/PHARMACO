#!/usr/bin/env bash
# =============================================================================
#  Installation bare-metal de PHARMACO sur un Raspberry Pi (Debian/Raspberry Pi
#  OS 64-bit, Bookworm). Automatise les étapes 1 à 7 du guide
#  docs/DEPLOY-RASPBERRYPI.md : PostgreSQL 16 + Node 20 + base + API + frontend
#  + services systemd. NE configure PAS le reverse proxy/HTTPS (voir le guide).
#
#  Usage :
#    sudo DOMAIN=pharmaco.mondomaine.fr DB_PASS='motdepasse' bash scripts/install-pi.sh
#
#  Variables (surchargables) :
#    APP_DIR     Répertoire du dépôt cloné        (défaut : dossier courant)
#    APP_USER    Utilisateur système              (défaut : utilisateur sudo)
#    DOMAIN      Domaine public (pour VITE_API_URL/CORS) (défaut : http://<IP>:8080 via /api)
#    DB_PASS     Mot de passe PostgreSQL          (obligatoire)
#    AUTH_SECRET Secret jetons (généré si absent)
#    WEB_PORT    Port du frontend statique        (défaut : 8080)
# =============================================================================
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "Lancez avec sudo."; exit 1; }

APP_DIR="${APP_DIR:-$(pwd)}"
APP_USER="${APP_USER:-${SUDO_USER:-pi}}"
WEB_PORT="${WEB_PORT:-8080}"
DB_PASS="${DB_PASS:?Definir DB_PASS=...}"
AUTH_SECRET="${AUTH_SECRET:-$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))" 2>/dev/null || openssl rand -hex 48)}"
# API en relatif si pas de domaine (le proxy gère /api) ; sinon https://DOMAIN/api
VITE_API_URL="${DOMAIN:+https://$DOMAIN}/api"
CLIENT_ORIGIN="${DOMAIN:+https://$DOMAIN}"; CLIENT_ORIGIN="${CLIENT_ORIGIN:-*}"

echo "==> Dépôt        : $APP_DIR"
echo "==> Utilisateur  : $APP_USER"
echo "==> Frontend port: $WEB_PORT"
echo "==> VITE_API_URL : $VITE_API_URL"

echo "==> [1/6] Paquets système (PostgreSQL 16, Node 20, git)..."
apt-get update -y
apt-get install -y curl ca-certificates gnupg lsb-release git
# Dépôt PGDG (PostgreSQL 16, comme Render)
if [[ ! -f /etc/apt/sources.list.d/pgdg.list ]]; then
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    | gpg --dearmor -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
fi
# Dépôt NodeSource (Node 20)
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
fi
apt-get update -y
apt-get install -y postgresql-16 postgresql-client-16 nodejs
npm install -g serve >/dev/null 2>&1 || true
systemctl enable --now postgresql

echo "==> [2/6] Base et utilisateur PostgreSQL (idempotent)..."
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='pharmaco') THEN
    CREATE ROLE pharmaco LOGIN PASSWORD '${DB_PASS}';
  ELSE
    ALTER ROLE pharmaco PASSWORD '${DB_PASS}';
  END IF;
END \$\$;
SELECT 'CREATE DATABASE pharmaco OWNER pharmaco'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname='pharmaco')\gexec
SQL

echo "==> [3/6] Dépendances API + fichier .env..."
cd "$APP_DIR/server"
sudo -u "$APP_USER" npm install
cat > "$APP_DIR/server/.env" <<ENV
DATABASE_URL=postgres://pharmaco:${DB_PASS}@localhost:5432/pharmaco
PGSSL=false
AUTH_SECRET=${AUTH_SECRET}
CLIENT_ORIGIN=${CLIENT_ORIGIN}
PORT=4000
RUN_MIGRATIONS=true
ENV
chown "$APP_USER":"$APP_USER" "$APP_DIR/server/.env"
echo "    (Applique le schéma au 1er démarrage du service. Pour des données de"
echo "     démo : sudo -u $APP_USER npm run db:seed ; pour restaurer un dump"
echo "     Render : voir docs/DEPLOY-RASPBERRYPI.md étape 4.)"

echo "==> [4/6] Build du frontend..."
cd "$APP_DIR/client"
sudo -u "$APP_USER" npm install
sudo -u "$APP_USER" env VITE_USE_MOCK=false VITE_API_URL="$VITE_API_URL" npm run build

echo "==> [5/6] Services systemd..."
cat > /etc/systemd/system/pharmaco-api.service <<UNIT
[Unit]
Description=PHARMACO API
After=network.target postgresql.service
Wants=postgresql.service
[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}/server
EnvironmentFile=${APP_DIR}/server/.env
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/systemd/system/pharmaco-web.service <<UNIT
[Unit]
Description=PHARMACO Web (static)
After=network.target
[Service]
Type=simple
User=${APP_USER}
ExecStart=/usr/bin/serve -s ${APP_DIR}/client/dist -l ${WEB_PORT}
Restart=always
[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now pharmaco-api pharmaco-web

echo "==> [6/6] Terminé."
IP=$(hostname -I | awk '{print $1}')
echo "    API   : http://${IP}:4000/api/health"
echo "    Front : http://${IP}:${WEB_PORT}"
echo "    Logs  : journalctl -u pharmaco-api -f"
echo
echo "    Étapes restantes (voir docs/DEPLOY-RASPBERRYPI.md) :"
echo "      - reverse proxy + HTTPS (Cloudflare Tunnel ou Caddy/DuckDNS)"
echo "      - restauration du dump Render (étape 4) si migration de données"
echo "      - sauvegardes cron (étape 10)"
