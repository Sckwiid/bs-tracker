# BrawStar Tracker

Site Next.js + TypeScript pour stats Brawl Stars en live et historique via snapshots Supabase.

## Fonctionnalités

- Home SEO: recherche par tag + top 10 joueurs globaux.
- `/player/[tag]`: live stats, section ranked (grade proxy + winrate 25), historique Supabase, brawlers dynamiques.
- `/esport`: hub pro avec earnings Matcherino + comparaison face-à-face.
- `/coach`: analyse JSON joueur et 3 points d'amélioration.
- Bouton `Sauvegarder mon profil` via `localStorage`.

## Setup

1. Installer les dépendances:

```bash
npm install
```

2. Configurer les variables:

```bash
cp .env.example .env.local
```

3. Appliquer le schéma Supabase:

- Ouvrir SQL editor Supabase.
- Exécuter `supabase/schema.sql`.

4. Lancer l'app:

```bash
npm run dev
```

## Variables d'environnement

- `BRAWL_API_TOKEN`: token officiel Brawl Stars API.
- `BRAWL_API_BASE_URL`: optionnel, défaut `https://api.brawlstars.com/v1`.
- `NEXT_PUBLIC_SUPABASE_URL`: URL du projet Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: clé service role pour snapshots côté serveur.

## Notes techniques

- Les snapshots sont créés à chaque consultation de `/player/[tag]` si le hash des données live a changé.
- Les assets images utilisent `cdn.brawlify.com`.
- Les brawlers sont rendus dynamiquement (catalogue API + liste joueur), sans hard-coding.
- Le champ "Grade Ranked" est un proxy basé sur les trophées (l'API publique ne donne pas directement le grade ranked global).
