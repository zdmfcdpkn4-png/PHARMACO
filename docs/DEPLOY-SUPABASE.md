# Déployer PHARMACO : Render (app) + Supabase (base de données)

Architecture de production retenue :

```
Navigateur ──> pharmaco-web (Render, statique Vite)
                  │  VITE_API_URL
                  ▼
              pharmaco-api (Render, Express)
                  │  SUPABASE_URL (session pooler, SSL)
                  ▼
              PostgreSQL managé (Supabase)
```

## 1. Créer le projet Supabase

1. Sur [supabase.com](https://supabase.com), créer un projet (région Europe
   conseillée, ex. `eu-west-3`). Noter le **mot de passe de la base** choisi
   à la création (il ne sera plus affiché ensuite).
2. Aucune table à créer à la main : l'API applique elle-même le schéma
   (`server/db/schema.sql`, idempotent) à chaque démarrage
   (`RUN_MIGRATIONS` actif par défaut).

## 2. Récupérer l'URL de connexion (session pooler)

Dans Supabase : **Project → bouton « Connect » → Session pooler**. L'URL a la
forme :

```
postgresql://postgres.<ref_projet>:<MOT_DE_PASSE>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

> **Pourquoi le session pooler et pas la connexion directe ?**
> La connexion directe (`db.<ref>.supabase.co:5432`) n'est accessible qu'en
> IPv6 ; Render ne fait pas d'IPv6 sortant. Le **session pooler** (port 5432,
> hôte `*.pooler.supabase.com`) est compatible IPv4 et se comporte comme une
> connexion PostgreSQL classique (transactions, prepared statements OK).
> Ne pas utiliser le *transaction pooler* (port 6543), inutile ici.

Cette URL est la valeur de la variable d'environnement **`SUPABASE_URL`**.
Le serveur active SSL automatiquement quand elle est définie.

## 3. Déployer sur Render

1. Render Dashboard → **New → Blueprint** → sélectionner ce dépôt :
   `render.yaml` crée les deux services (`pharmaco-api`, `pharmaco-web`).
   `AUTH_SECRET` est auto-généré.

   > **Service API créé à la main ?** Vérifier dans le dashboard :
   > *Root Directory* = `server`, *Build Command* = `npm install` (SANS
   > `db:init` : les migrations s'appliquent au démarrage, pas au build),
   > *Start Command* = `npm start`, et la **branche suivie** = celle qui
   > contient ce guide. La version de Node est fixée par
   > `server/.node-version` (LTS 22).
2. Sur **pharmaco-api**, renseigner `SUPABASE_URL` (l'URL du § 2) dans
   *Environment*, puis déployer. Au premier démarrage, l'API applique le
   schéma sur la base Supabase (log : `OK Schéma à jour.`). Le log
   `[db] Connexion via …` indique quelle variable est utilisée et si le
   SSL est actif — premier réflexe en cas de problème.
3. Sur **pharmaco-web**, renseigner `VITE_API_URL`
   (ex. `https://pharmaco-api.onrender.com/api`) puis **relancer un déploiement**
   (variable figée au build).
4. Optionnel mais conseillé : sur **pharmaco-api**, renseigner `CLIENT_ORIGIN`
   avec l'URL du frontend (ex. `https://pharmaco-web.onrender.com`) pour
   restreindre le CORS.

## 4. Insérer les données de démonstration (optionnel)

La base neuve est vide (aucun compte). Pour créer les comptes et le tableau
de démo, lancer **une fois**, depuis un poste local :

```bash
cd server && npm install
SUPABASE_URL='postgresql://postgres.<ref>:<mdp>@aws-0-<region>.pooler.supabase.com:5432/postgres' npm run db:seed
```

Comptes créés : `erwin.raingeard@gmail.com` (admin), `alice.martin@example.com`,
`bob.durand@example.com`, `chloe.petit@example.com` — mot de passe commun
`pharmaco123`, à changer ensuite (`POST /api/auth/set-password`, réservé admin).

> ⚠️ `npm run db:seed` **vide les tables** (TRUNCATE) avant d'insérer : ne
> jamais le lancer sur une base contenant des données réelles. Pour appliquer
> seulement le schéma sans toucher aux données : `npm run db:init` (ou laisser
> l'API le faire au démarrage).

## 5. Vérifier

- `https://pharmaco-api.onrender.com/api/health` → `{ "status": "ok" }`
- Connexion sur le frontend avec un compte de démo (ou créer les comptes via
  l'interface si le seed n'a pas été lancé).

## Dépannage

L'API journalise une ligne `PISTE : …` sous la plupart de ces erreurs, avec
l'action corrective correspondante.

| Symptôme | Cause probable |
|---|---|
| `Connection terminated unexpectedly` | SSL non activé (le serveur Supabase coupe les connexions en clair) → utiliser `SUPABASE_URL` (SSL auto) ou `PGSSL=true` ; ou build lancé depuis une **branche sans le support SUPABASE_URL** — vérifier la branche suivie par le service |
| `ENETUNREACH` / timeout au démarrage | URL de **connexion directe** utilisée (IPv6-only) → prendre l'URL *Session pooler* |
| `ECONNREFUSED 127.0.0.1:5432` | Aucune variable de connexion définie sur le service → renseigner `SUPABASE_URL` |
| `self-signed certificate` | SSL mal configuré — ne pas mettre `PGSSL=false` avec Supabase |
| `password authentication failed` | Mot de passe erroné dans l'URL (attention aux caractères spéciaux : les encoder en %xx) |
| Le front affiche les données de démo alors que la base est vide | Build du client avec `VITE_USE_MOCK=true` ou `VITE_API_URL` absent → corriger puis **rebuilder** |
| `Tenant or user not found` | Utilisateur mal formé : avec le pooler, l'utilisateur est `postgres.<ref_projet>`, pas `postgres` |
