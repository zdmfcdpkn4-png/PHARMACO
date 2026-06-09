# Redéploiement & migration de la base vers un Raspberry Pi

Ce guide couvre **deux choses** :

1. **Redéployer sur Render** (corriger la prise en compte couleur/vignette).
2. **Sortir la base de Render** et **auto-héberger PHARMACO sur un Raspberry Pi**
   (base + API + frontend), avec accès sécurisé depuis Internet.

Rappels techniques du projet :

- **API** : Node ≥ 18 (Express, ESM). Connexion DB via `DATABASE_URL` **ou**
  variables `PG*`. SSL piloté par `PGSSL` (`false` pour un Postgres local).
- **Migration** : le schéma est **idempotent** et appliqué au démarrage si
  `RUN_MIGRATIONS` n'est pas `false` (ajoute les colonnes manquantes, ex.
  `boards.color/icon/archived`).
- **Sécurité** : en production, `AUTH_SECRET` est **obligatoire** (sinon le
  serveur refuse de démarrer). Contournement : `ALLOW_INSECURE_AUTH=true`.
- **Frontend** : build Vite. `VITE_USE_MOCK=false` + `VITE_API_URL=<api>/api`
  sont injectés **au build** (rebuild nécessaire si on les change).
- **CORS** : `CLIENT_ORIGIN` (défaut `*`).
- **Postgres Render** : version **16** → garder PG 16 côté Pi pour éviter les
  incompatibilités `pg_dump`.

---

## Partie 1 — Redéployer sur Render

1. Service **`pharmaco-api`** → **Environment** :
   - Ajouter `AUTH_SECRET` = chaîne aléatoire ≥ 32 caractères
     (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).
   - Vérifier que `RUN_MIGRATIONS` n'est **pas** `false`.
2. **Settings → Build & Deploy** : `Branch` = la branche à jour (`main`),
   `Auto-Deploy` = **Yes**.
3. **Manual Deploy → Clear build cache & deploy**.
4. **Logs** attendus : `OK Schéma à jour.` puis `PHARMACO API en écoute…`.
5. Test : ouvrir un projet → titre → **Personnaliser** → couleur+emoji →
   *Enregistrer*. Vérifier dans **DevTools → Network** que la réponse du
   `PATCH /boards/…` contient bien `"color"`.

---

## Partie 2 — Migrer vers un Raspberry Pi

Trois voies, du plus simple au plus manuel :

- **Voie A — Docker Compose** (recommandée) : tout en conteneurs (Postgres +
  API + frontend). Voir ci-dessous « Voie A ».
- **Voie B — Script d'installation** : `scripts/install-pi.sh` automatise les
  étapes 1 à 7 (bare-metal). Voir « Voie B ».
- **Voie C — Manuelle** : les étapes 1 à 11 détaillées plus bas.

---

### Voie A — Docker Compose (recommandée)

Pré-requis : un Pi 64-bit avec **Docker** + **Docker Compose** :

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # puis se reconnecter
```

Démarrage de la stack (depuis le dépôt cloné) :

```bash
git clone https://github.com/zdmfcdpkn4-png/PHARMACO.git && cd PHARMACO
cp .env.example .env
# Éditer .env : POSTGRES_PASSWORD, AUTH_SECRET (obligatoires), WEB_PORT…
#   AUTH_SECRET: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
docker compose up -d --build
```

- Frontend : `http://IP_DU_PI:8080` (proxy `/api` interne → conteneur API).
- L'API applique les **migrations au démarrage** (colonnes `color/icon/archived`).
- Fichiers : `docker-compose.yml`, `server/Dockerfile`, `client/Dockerfile`,
  `client/nginx.conf`.

**Importer la base depuis Render** dans le conteneur `db` :

```bash
docker compose up -d db                       # démarre la base seule
# dump custom-format (-Fc) -> restauration via stdin
pg_restore --no-owner --no-privileges --clean --if-exists \
  -d "postgres://pharmaco:MOTDEPASSE@localhost:5432/pharmaco" pharmaco.dump
# (ou) docker compose exec -T db pg_restore --no-owner -U pharmaco -d pharmaco < pharmaco.dump
docker compose up -d                          # démarre API + web
```

Commandes utiles : `docker compose logs -f api` · `docker compose ps` ·
`docker compose down` (stop) · `docker compose pull && docker compose up -d --build`
(mise à jour). Le volume `pgdata` conserve la base.

**Reverse proxy / HTTPS** : ajouter un Cloudflare Tunnel ou Caddy devant le port
`WEB_PORT` (voir étape 8). Avec un domaine, mets `CLIENT_ORIGIN=https://ton-domaine`
dans `.env` et `docker compose up -d` (l'API relit la variable).

**Sauvegarde** :
`docker compose exec -T db pg_dump -U pharmaco -Fc pharmaco > backup-$(date +%F).dump`.

---

### Voie B — Script d'installation (bare-metal)

```bash
git clone https://github.com/zdmfcdpkn4-png/PHARMACO.git && cd PHARMACO
sudo DOMAIN=pharmaco.mondomaine.fr DB_PASS='motdepasse_solide' bash scripts/install-pi.sh
```

Le script installe PostgreSQL 16 + Node 20, crée la base, écrit `server/.env`,
build le frontend et installe les services systemd `pharmaco-api` /
`pharmaco-web`. Il reste à configurer le reverse proxy/HTTPS (étape 8) et, pour
migrer les données, à restaurer le dump Render (étape 4).

---

### Voie C — Installation manuelle

### 0. Matériel & système recommandés

- Raspberry Pi **4 (4–8 Go)** ou **Pi 5**, **Raspberry Pi OS 64-bit (Bookworm)**.
- **SSD USB** plutôt que carte SD (Postgres écrit beaucoup → fiabilité/perf).
- Accès **SSH** activé.

Deux options d'accès externe :

- **Cloudflare Tunnel** (recommandé) : pas d'ouverture de ports, HTTPS gratuit.
- **Port-forwarding + DuckDNS + Caddy** : ouvre 80/443 sur ta box.

---

### 1. Préparer le Raspberry Pi

```bash
sudo apt update && sudo apt full-upgrade -y

# --- PostgreSQL 16 (même version que Render) via le dépôt PGDG ---
sudo apt install -y curl ca-certificates gnupg
sudo install -d /usr/share/postgresql-common/pgdg
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  | sudo gpg --dearmor -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg] \
http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt update
sudo apt install -y postgresql-16 postgresql-client-16

# --- Node.js 20 LTS (arm64) ---
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

node -v   # doit afficher v20.x
psql --version  # 16.x
```

---

### 2. Exporter la base depuis Render (`pg_dump`)

Sur le Pi (ou ta machine), récupère l'**External Database URL** :
Render → **`pharmaco-db`** → **Connect** → *External Connection String*
(format : `postgres://user:pass@host.oregon-postgres.render.com/dbname`).

```bash
# Connexion externe Render = SSL obligatoire -> on ajoute sslmode=require
export RENDER_URL='postgres://USER:PASS@HOST.render.com/DBNAME?sslmode=require'

# Dump au format "custom" (compressé, restaurable finement)
pg_dump "$RENDER_URL" -Fc --no-owner --no-privileges -f pharmaco.dump

ls -lh pharmaco.dump   # vérifie la taille
```

> Le client `pg_dump` doit être **≥** la version du serveur (16). C'est pourquoi
> on a installé `postgresql-client-16`.

---

### 3. Créer la base et l'utilisateur sur le Pi

```bash
sudo -u postgres psql <<'SQL'
CREATE USER pharmaco WITH PASSWORD 'un_mot_de_passe_solide';
CREATE DATABASE pharmaco OWNER pharmaco;
GRANT ALL PRIVILEGES ON DATABASE pharmaco TO pharmaco;
SQL
```

---

### 4. Restaurer le dump

```bash
# --no-owner : ignore le propriétaire d'origine (Render) ; on devient owner local
pg_restore --no-owner --no-privileges \
  -U pharmaco -h localhost -d pharmaco pharmaco.dump
# (saisir le mot de passe ; si "peer auth", ajouter -W ou configurer pg_hba)

# Vérif rapide
psql -U pharmaco -h localhost -d pharmaco -c "\dt"
psql -U pharmaco -h localhost -d pharmaco -c "SELECT id,name,color,icon,archived FROM boards;"
```

> Si tu repars d'une base **vide** (sans dump), tu peux à la place initialiser :
> `cd server && npm run db:seed` (schéma + données de démo).

---

### 5. Déployer l'API sur le Pi

```bash
cd ~
git clone https://github.com/zdmfcdpkn4-png/PHARMACO.git
cd PHARMACO/server
npm install

# Fichier d'environnement
cat > .env <<'ENV'
DATABASE_URL=postgres://pharmaco:un_mot_de_passe_solide@localhost:5432/pharmaco
PGSSL=false
AUTH_SECRET=colle_ici_un_secret_aleatoire_de_48_octets
CLIENT_ORIGIN=https://pharmaco.mondomaine.fr
PORT=4000
RUN_MIGRATIONS=true
ENV

# Premier démarrage (applique les migrations idempotentes : color/icon/archived…)
npm start
# -> "OK Schéma à jour." puis "PHARMACO API en écoute sur http://localhost:4000"
# Ctrl+C une fois vérifié, on passera en service systemd (étape 7).
```

Génère le secret : `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

---

### 6. Construire et servir le frontend

`VITE_API_URL` est figé **au build** → il doit pointer vers l'URL **publique**
de l'API (ici on proxifiera `/api` derrière le même domaine, voir étape 8).

```bash
cd ~/PHARMACO/client
npm install
VITE_USE_MOCK=false VITE_API_URL=https://pharmaco.mondomaine.fr/api npm run build
# -> génère client/dist (fichiers statiques à servir)
```

On servira `client/dist` via le reverse proxy (étape 8), plus robuste que
`vite preview`.

---

### 7. Lancer l'API au démarrage (systemd)

```bash
sudo tee /etc/systemd/system/pharmaco-api.service >/dev/null <<'UNIT'
[Unit]
Description=PHARMACO API
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/PHARMACO/server
EnvironmentFile=/home/pi/PHARMACO/server/.env
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now pharmaco-api
systemctl status pharmaco-api --no-pager
journalctl -u pharmaco-api -f      # logs en direct
```

> Adapte `User=` et les chemins si ton utilisateur n'est pas `pi`.

---

### 8. Reverse proxy + HTTPS

#### Option A (recommandée) — Cloudflare Tunnel (sans ouvrir de ports)

```bash
# Installer cloudflared (arm64)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 \
  -o cloudflared && chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/

cloudflared tunnel login                 # ouvre un lien à valider sur ton compte Cloudflare
cloudflared tunnel create pharmaco
```

Crée `~/.cloudflared/config.yml` (un seul domaine, le frontend statique +
le proxy `/api`) :

```yaml
tunnel: <ID_DU_TUNNEL>
credentials-file: /home/pi/.cloudflared/<ID_DU_TUNNEL>.json
ingress:
  - hostname: pharmaco.mondomaine.fr
    path: ^/api/.*
    service: http://localhost:4000
  - hostname: pharmaco.mondomaine.fr
    service: http://localhost:8080      # serveur statique du frontend (ci-dessous)
  - service: http_status:404
```

Sert les fichiers statiques du frontend (port 8080) :

```bash
sudo npm install -g serve
# en service systemd, comme l'API :
sudo tee /etc/systemd/system/pharmaco-web.service >/dev/null <<'UNIT'
[Unit]
Description=PHARMACO Web (static)
After=network.target
[Service]
ExecStart=/usr/bin/serve -s /home/pi/PHARMACO/client/dist -l 8080
Restart=always
User=pi
[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload && sudo systemctl enable --now pharmaco-web

# Router le DNS + lancer le tunnel comme service
cloudflared tunnel route dns pharmaco pharmaco.mondomaine.fr
sudo cloudflared service install
```

Cloudflare fournit le **HTTPS** automatiquement ; aucun port à ouvrir sur ta box.

#### Option B — Caddy + DuckDNS (port-forwarding)

```bash
sudo apt install -y caddy
```

`/etc/caddy/Caddyfile` :

```
pharmaco.duckdns.org {
    handle /api/* {
        reverse_proxy localhost:4000
    }
    handle {
        root * /home/pi/PHARMACO/client/dist
        try_files {path} /index.html
        file_server
    }
}
```

```bash
sudo systemctl reload caddy
```

Puis : crée un sous-domaine **DuckDNS** gratuit, fais pointer ton IP, et
**redirige les ports 80 et 443** de ta box vers le Pi. Caddy obtient le
certificat Let's Encrypt tout seul.

> ⚠️ Avec l'option B, `VITE_API_URL` et `CLIENT_ORIGIN` doivent utiliser
> `https://pharmaco.duckdns.org`. Si tu changes le domaine, **rebuild** le
> frontend (étape 6) et mets à jour `.env` (`CLIENT_ORIGIN`).

---

### 9. Sécuriser Postgres (rester en local)

Postgres ne doit **pas** être exposé à Internet. Par défaut il n'écoute que sur
`localhost` — garde‑le ainsi (`listen_addresses = 'localhost'` dans
`/etc/postgresql/16/main/postgresql.conf`). L'API et la base étant sur le même
Pi, aucune ouverture réseau n'est nécessaire pour la base.

---

### 10. Sauvegardes automatiques

```bash
mkdir -p ~/backups
crontab -e
# Ajouter (sauvegarde quotidienne à 3h, rétention 14 jours) :
0 3 * * * pg_dump -U pharmaco -h localhost -Fc pharmaco -f ~/backups/pharmaco-$(date +\%F).dump && find ~/backups -name '*.dump' -mtime +14 -delete
```

Restauration d'une sauvegarde : `pg_restore --no-owner -U pharmaco -h localhost -d pharmaco ~/backups/pharmaco-AAAA-MM-JJ.dump`.

---

### 11. Bascule (cutover) & mise hors service de Render

1. Mets l'app Render **en lecture seule** le temps de la migration (préviens les
   utilisateurs), refais un `pg_dump` **frais** (étape 2) pour ne rien perdre,
   puis restaure (étape 4).
2. Fais pointer ton **domaine** vers le Pi (Cloudflare/Caddy).
3. Vérifie : connexion, création/perso d'un projet (couleur/vignette), tâches,
   messages, rôles.
4. Une fois validé, **suspends** puis supprime les services Render
   (`pharmaco-web`, `pharmaco-api`, `pharmaco-db`) pour arrêter la facturation.

---

## Dépannage rapide

| Symptôme | Cause probable | Solution |
|---|---|---|
| `pg_dump: server version 16, pg_dump 15` | Client trop ancien | Installer `postgresql-client-16` (étape 1) |
| `self-signed certificate` au dump | SSL Render | Ajouter `?sslmode=require` à l'URL |
| API : `Démarrage refusé` | `AUTH_SECRET` absent | Le définir dans `.env` |
| `column "color" does not exist` | Migration non exécutée | `RUN_MIGRATIONS` ≠ `false`, redémarrer l'API |
| Front OK mais perso projet sans effet | API ancienne / mauvais `VITE_API_URL` | Rebuild front + redéployer l'API à jour |
| CORS bloqué | `CLIENT_ORIGIN` ≠ domaine front | Aligner `CLIENT_ORIGIN` sur l'URL publique |
