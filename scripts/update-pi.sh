#!/usr/bin/env bash
# =============================================================================
#  Met à jour PHARMACO sur le Raspberry Pi en une commande :
#  git pull -> dépendances -> rebuild frontend -> redémarrage de l'API.
#
#  Usage :   bash scripts/update-pi.sh
#  (WEB_ROOT surchargable : WEB_ROOT=/var/www/pharmaco bash scripts/update-pi.sh)
# =============================================================================
set -euo pipefail

WEB_ROOT="${WEB_ROOT:-/var/www/pharmaco}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

echo "==> Récupération des dernières modifications (git pull)…"
git pull --ff-only

echo "==> API : dépendances + redémarrage…"
( cd server && npm install )
sudo systemctl restart pharmaco-api

echo "==> Frontend : build + publication…"
( cd client && npm install && VITE_USE_MOCK=false VITE_API_URL=/api npm run build )
sudo mkdir -p "$WEB_ROOT"
sudo rm -rf "${WEB_ROOT:?}/"*
sudo cp -r client/dist/* "$WEB_ROOT/"

echo "==> Terminé."
sudo systemctl --no-pager status pharmaco-api | head -n 5
echo "Vérif API :"; curl -s http://localhost:4000/api/health; echo
