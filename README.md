# Fangleaf

Jeu coop façon *Wild Tamer*, jusqu'à 4 joueurs par village, directement dans le navigateur. On se réveille sur une
île inconnue : on chasse, on apprivoise des monstres, on éveille des Alphas, on bâtit le village avec les autres, et
on avance zone par zone jusqu'au bout de l'île, en affrontant les géants qui dorment au fond des grottes.

- **Comment on joue** : [docs/GUIDE.md](docs/GUIDE.md)
- **Comment c'est fait** (stack, arborescence, flux réseau) : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Stack

- **TypeScript partout** : les règles et l'équilibrage (`shared/`) sont communs au client et au serveur.
- **Client** : Vite, Canvas 2D (tout est dessiné, aucune image), HUD en HTML/CSS, son synthétisé (Web Audio).
- **Serveur** : Node 24 + `ws`, autoritaire, 20 ticks/s ; un seul process sert le site et le WebSocket.
- **Comptes et sauvegarde** : Supabase (Postgres, connexion Google).
- **Tests** : `node:test` pour les règles, bots WebSocket pour le test de fumée ; CI/CD GitHub Actions vers un VPS.

## Lancer en local

```bash
npm install
npm run dev
```

Ouvre http://localhost:5173, fonde un village, puis **Menu › Inviter des amis** pour copier le lien
(`?v=CODE`) à envoyer à tes amis. Pour tester seul la coop, ouvre le lien dans un 2e onglet.
En `npm run dev`, **F9** donne de l'or, du bois, de la pierre et des essences pour tester vite.

Pour que des amis te rejoignent hors de ton réseau, il faut héberger le serveur (voir plus bas)
ou exposer ton port (ex. `cloudflared tunnel --url http://localhost:5173`).

## Comptes Google et sauvegarde (Supabase, obligatoire)

Un compte Google est requis pour jouer : le serveur refuse toute connexion sans session valide.
La progression est rattachée au **compte dans un village** : en revenant dans son village, on retrouve
or, bois, pierre, niveaux d'arme et d'armure, essences et **Alphas** (la meute ordinaire n'est pas sauvegardée). Rejoindre un autre village, c'est repartir de zéro là-bas. Un compte a au plus **3 villages** : le lobby les liste (« Mes villages ») pour choisir où jouer, à côté de « Créer » et « Rejoindre ». Les villages gardent leur code et leur carte. « Quitter ce village » (bouton sous « Entrer ») efface sa progression dans le village choisi ; le village continue pour les autres (son fondateur passe la main au membre le plus récemment actif) et disparaît s'il n'y reste personne.

1. Crée un projet sur [supabase.com](https://supabase.com).
2. Tables : ajoute `DATABASE_URL` dans `.env` (*Project Settings › Database › Connection string › URI*) puis lance `npm run db:migrate`, qui applique les fichiers de [supabase/migrations/](supabase/migrations/) pas encore passés. À défaut, colle-les dans le *SQL Editor*, dans l'ordre.
3. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) : crée un *ID client OAuth* de type
   « Application Web », avec comme URI de redirection autorisée
   `https://<ton-projet>.supabase.co/auth/v1/callback`.
4. Supabase › *Authentication › Sign In / Providers › Google* : active-le et colle l'ID client et le secret.
5. Supabase › *Authentication › URL Configuration* : *Site URL* = `http://localhost:5173`, et ajoute dans
   *Redirect URLs* `http://localhost:5173/**` (plus ton domaine de prod plus tard).
6. Copie `.env.example` en `.env` et remplis les 4 valeurs (*Project Settings › API*).
   La clé `service_role` reste côté serveur : c'est lui seul qui écrit les profils.
7. Relance `npm run dev` : le bouton « Se connecter avec Google » apparaît dans le lobby.

## Mise en production (VPS, fangleaf.anathos.me)

1. DNS : un enregistrement A (et AAAA) `fangleaf.anathos.me` vers le VPS.
2. Sur le VPS, dans le dossier du clone (ici `/root/eanathos/Fangleaf`) : `.env` rempli, `npm ci`, `npm run db:migrate`, puis `npm run build`
   (les variables `VITE_*` sont figées au build : le `.env` doit être là avant).
3. Serveur Node (port 4310) : `pm2 start ecosystem.config.cjs` ([ecosystem.config.cjs](ecosystem.config.cjs)), ou [deploy/fangleaf.service](deploy/fangleaf.service) avec systemd.
4. nginx : [deploy/nginx/fangleaf.anathos.me.conf](deploy/nginx/fangleaf.anathos.me.conf) (HTTPS Let's Encrypt, relais du WebSocket `/ws`), étapes en tête du fichier.
5. Supabase › *Authentication › URL Configuration* : ajoute `https://fangleaf.anathos.me/**` aux *Redirect URLs*
   (et mets-la en *Site URL* une fois en prod).

Mise à jour : `git pull && npm ci && npm run db:migrate && npm run build && pm2 reload ecosystem.config.cjs` (ou `sudo systemctl restart fangleaf`). À l'arrêt, le serveur sauvegarde les progressions en cours.

### CI / CD (GitHub Actions)

- [ci.yml](.github/workflows/ci.yml) : à chaque push et PR, typecheck, règles, test de fumée et build.
- [cd.yml](.github/workflows/cd.yml) : quand la CI passe sur `main`, se connecte en SSH au VPS, avance le clone sur le commit testé
  et lance [deploy/deploy.sh](deploy/deploy.sh) (`npm ci`, migrations, build, `pm2 startOrReload`, vérification du port).
  Aussi lançable à la main depuis l'onglet *Actions*.
- Secrets du dépôt à créer : `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (clé privée dédiée au déploiement), `VPS_PORT` (facultatif).

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de jeu (port 3001, rechargement auto) + client Vite (5173) |
| `npm run build` | Build du client dans `dist/` |
| `npm start` | Prod : un seul process sert `dist/` et le WebSocket (`PORT`, défaut 3001) |
| `npm run typecheck` | Vérification TypeScript |
| `npm run db:migrate` | Applique les migrations Supabase manquantes (`DATABASE_URL` requis) |
| `npm run smoke` | Test bot (autorise les invités via `ALLOW_GUESTS=1`, réservé aux tests) : création, 4 joueurs max, combat, or, forge, anti-téléportation |
| `npm run test:rules` | Règles de la simulation, sans réseau (`node:test`) : un fichier par thème dans `tests/rules/` (monde, combat, meute, Alphas, géants, faune, village, réseau). Un seul fichier : `npx tsx --test tests/rules/geants.test.ts` ; un seul test : `--test-name-pattern="Marché"` ; autre graine ou autre heure : `TEST_SEED=…`, `TEST_NOW=…` |

## Structure

```
shared/   règles et équilibrage (config.ts), protocole réseau, maths
server/   HTTP + WebSocket + salons (index.ts), simulation d'un village (room.ts), sauvegarde Supabase (persist.ts)
supabase/ migrations SQL (npm run db:migrate)
client/   lobby, boucle de jeu, rendu Canvas procédural, HUD HTML, minicarte
scripts/  test de fumée multi-clients, migrations
tests/    tests de règles par thème (tests/rules/*.test.ts) et leurs outils communs (helpers.ts)
docs/     guide du jeu (GUIDE.md), architecture (ARCHITECTURE.md)
```

Le détail fichier par fichier est dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Tout l'équilibrage (PV, dégâts, zones, chance d'apprivoisement, coût de la forge…) est dans
`shared/config.ts`.

## Licence

© 2026 EAnathos, tous droits réservés. Le code est visible mais **ni libre ni open source** : aucune copie,
modification, redistribution ou mise en ligne sans autorisation écrite. Détails dans [LICENSE](LICENSE).
