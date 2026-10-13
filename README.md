# Fangleaf

MVP d'un jeu coop façon *Wild Tamer* : chasse des monstres, apprivoise-les, fais apparaître des Alphas
qui ressuscitent, améliore ton armure à la forge du village. Jusqu'à 3 joueurs par village.

Plan, périmètre et choix techniques : [docs/PLAN.md](docs/PLAN.md).

## Lancer en local

```bash
npm install
npm run dev
```

Ouvre http://localhost:5173, fonde un village, puis clique **Inviter** pour copier le lien
(`?v=CODE`) à envoyer à tes amis. Pour tester seul la coop, ouvre le lien dans un 2e onglet.

Pour que des amis te rejoignent hors de ton réseau, il faut héberger le serveur (voir plus bas)
ou exposer ton port (ex. `cloudflared tunnel --url http://localhost:5173`).

## Comptes Google et sauvegarde (Supabase, obligatoire)

Un compte Google est requis pour jouer : le serveur refuse toute connexion sans session valide.
La progression est rattachée au **compte dans un village** : en revenant dans son village, on retrouve
or, niveaux d'arme et d'armure, essences et **Alphas** (la meute ordinaire n'est pas sauvegardée). Rejoindre un autre village, c'est repartir de zéro là-bas. Les villages gardent leur code et leur carte.

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
| `npm run smoke` | Test bot (autorise les invités via `ALLOW_GUESTS=1`, réservé aux tests) : création, 3 joueurs max, combat, or, forge, anti-téléportation |
| `npm run test:rules` | Règles : dispersion de la meute, rappel, régénération, forge, éveil et renforcement des Alphas, profil |

## Contrôles

- **ZQSD / WASD / flèches** ou **glisser** (souris / doigt) : se déplacer
- Attaque automatique, la meute suit et combat seule
- **Bâtiments du village** : ce ne sont au départ que des chantiers. **E** devant l'un d'eux pour le construire avec ton or, une fois pour tout le village : Forge (10 or), Tanière (20 or), Marché (50 or), Pierre de passage (200 or)
- **E** près d'un bâtiment construit : Forge (classe, arme, armure), Tanière (Alphas des espèces déjà rencontrées, bestiaire), Marché (vendre les monstres de sa meute, acheter ceux des espèces déjà croisées) · **Échap** : fermer
- **Clic sur la minicarte** (ou **M**) : grande carte, avec le brouillard des zones pas encore explorées · **Échap** ou **M** pour la fermer
- **F** : monter sur son Alpha Loup, Sanglier ou Ours (ou en descendre)
- **R maintenu** (ou le bouton, au doigt) près d'un coéquipier à terre : le relever sur place avec la moitié de ses PV, après 5 s. Avec un autre dompteur dans le village, on reste à terre 10 s avant de repartir au camp ; seul, 5 s. Un Alpha tombé ne ressuscite qu'une fois son dompteur debout
- **Filons d'or** : reste à côté, ton personnage les pioche tout seul quand aucun monstre n'est à portée
- **Le monde est un long chemin** : du camp de départ (au bord de la carte) au village, puis une piste à travers 5 zones de plus en plus dangereuses ; la dernière, les Lacs brumeux, s'atteint depuis le Camp avancé
- **Tireurs** (Guetteur runique, Crapaud-mortier, Serpent des brumes) : ils s'immobilisent pour charger leur tir — écarte-toi de la trajectoire, ou sors du cercle annoncé au sol
- **E** sur l'emplacement de camp au bout de la zone 4 : l'établir pour tout le village (2000 or) — feu qui soigne, réapparition sur place, Pierre de passage
- **E** devant une Pierre de passage (village, une fois construite, ou camp établi) : voyager d'un camp à l'autre avec ta meute
- **Tanière › Bestiaire** : chaque espèce croisée s'y ajoute (sprite, stats, comment la combattre) ; les autres restent en silhouette
- **E** devant une grotte : la débloquer pour tout le village (150 or × niveau de sa zone), puis entrer affronter le géant de l'espèce (E à la sortie pour ressortir). Ses attaques spéciales s'annoncent par une zone au sol : sors-en avant l'impact. Son âme rend légendaire ton Alpha de cette espèce (Tanière).
- **Échap** : menu — retour au lobby, ou supprimer le village pour repartir de zéro (fondateur ; les autres membres effacent seulement leur progression), avec confirmation
- **F9** (dev uniquement) : +300 or et +30 essences de chaque espèce pour tester la forge et la Tanière

Bestiaire animé de toutes les espèces (outil de dev) : http://localhost:5173/bestiary.html

## Structure

```
shared/   règles et équilibrage (config.ts), protocole réseau, maths
server/   HTTP + WebSocket + salons (index.ts), simulation d'un village (room.ts), sauvegarde Supabase (persist.ts)
supabase/ schéma SQL des profils
client/   lobby, boucle de jeu, rendu Canvas procédural, HUD HTML, minicarte
scripts/  test de fumée multi-clients
```

Tout l'équilibrage (PV, dégâts, zones, chance d'apprivoisement, coût de la forge…) est dans
`shared/config.ts`.
