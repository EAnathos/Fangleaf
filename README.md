# Fangleaf

MVP d'un jeu coop façon *Wild Tamer* : chasse des monstres, apprivoise-les, fais apparaître des Alphas
qui ressuscitent, améliore ton armure à la forge du village. Jusqu'à 4 joueurs par village.

Choix techniques, arborescence et flux réseau : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Lancer en local

```bash
npm install
npm run dev
```

Ouvre http://localhost:5173, fonde un village, puis **Menu › Inviter des amis** pour copier le lien
(`?v=CODE`) à envoyer à tes amis. Pour tester seul la coop, ouvre le lien dans un 2e onglet.

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

## Contrôles

- **ZQSD / WASD / flèches** ou **glisser** (souris / doigt) : se déplacer. Sur PC, toutes les touches se règlent (Échap › Paramètres), et l'attaque peut passer d'automatique (par défaut) au **clic gauche** vers le pointeur ; au doigt, rien ne change
- Attaque automatique, la meute suit et combat seule
- **Premier réveil** : on ouvre les yeux sur une plage inconnue, sans arme. L'épée est plantée dans le sable tout près : **E** (ou le bouton) trois fois pour la déterrer ; avant, on ne peut pas se battre
- **Le vieil homme**, près du feu du village : **E** pour lui parler (il ne se souvient plus de rien, mais il est content de voir quelqu'un)
- **Parchemins** : chaque géant vaincu pour la première fois par le village laisse un parchemin au fond de sa grotte (chacun ramasse le sien). Rapporté au vieil homme, il lui rend un souvenir de l'histoire de l'île. Tous ses souvenirs retrouvés, il reconstruit le bateau échoué au bout de l'île : 4 étapes de 30 minutes, payées en or et avec la réserve du village ; une fois fini, une Pierre de passage y mène
- **Bâtiments du village** : ce ne sont au départ que des chantiers. **E** devant l'un d'eux pour le construire, une fois pour tout le village, avec ton or et le bois et la pierre de la réserve du village : Forge (10 or, 5 bois), Marché (50 or, 25 bois, 10 pierre), Tanière (20 or, 20 bois, 15 pierre), Pierre de passage (200 or, 10 bois, 40 pierre)
- **Hôtel de ville** (E devant lui) : en ruine au départ. En le construisant, on donne son nom au village (affiché dans « Mes villages »), et on peut le renommer ensuite. Chaque niveau (or, bois, pierre, pour tout le village) débloque la suite : niv. 1 porte du village et Marché, niv. 2 porte des Bois profonds et Pierre de passage, puis une porte de zone par niveau jusqu'au niv. 6 (Mer de sable) (les derniers niveaux demandent beaucoup plus de bois et de pierre)
- **Brume des zones** : un banc de nuages couvre le couloir au-delà de la sortie du village puis de chaque zone fermée (aucun monstre n'y apparaît). Pour passer en zone suivante, il faut l'Hôtel de ville au bon niveau **et** avoir vaincu tous les géants de la zone (une fois suffit, pour tout le village). On peut toujours revenir en arrière
- **E** près d'un bâtiment construit : Forge (classe, arme, armure), Tanière (Alphas des espèces déjà rencontrées, bestiaire), Marché (vendre les monstres de sa meute, acheter ceux des espèces déjà croisées) · **Échap** : fermer
- **Clic sur la minicarte** (ou **M**) : grande carte, avec le brouillard des zones pas encore explorées · **Échap** ou **M** pour la fermer
- **F** (au doigt : le bouton selle, sous le bouton à baies) : monter sur son Alpha Loup, Sanglier, Ours ou Escargot (ou en descendre). L'Alpha **Serpent des brumes** se monte aussi, mais ne va qu'en eau : F près de l'eau pour embarquer (on est posé sur l'eau), F au bord d'une rive pour descendre ; s'il tombe en pleine eau, on se noie
- **Mort** : tu perds 10 % de ton or ; ta meute ordinaire se disperse, tes Alphas restent
- Au village ou dans un camp établi, ta meute et tes Alphas se promènent librement autour de toi
- **R maintenu** (ou le bouton, au doigt) près d'un coéquipier à terre : le relever sur place avec la moitié de ses PV, après 5 s. Avec un autre dompteur dans le village, on reste à terre 10 s avant de repartir au camp ; seul, 5 s. Un Alpha tombé ne ressuscite qu'une fois son dompteur debout
- **Récolte** : reste à côté d'un filon d'or (or et un peu de pierre), d'un rocher (pierre) ou de bois mort (bois) : ton personnage sort sa pioche ou sa hache tout seul quand aucun monstre n'est à portée. Bois et pierre vont dans ton sac : **E à l'entrepôt** du village pour les verser dans la réserve commune, qui paie les constructions
- **Baies et gibier** : **E** près d'un buisson garni pour cueillir ses baies. **T** (au doigt : le bouton rond à baies, qui apparaît près d'un gibier) : tendre un fruit. L'Escargot des mousses (zone 1) et le Lièvre des ronces (zone 3), gibier passif qui n'attaque jamais, s'approchent peu à peu ; chaque fruit mangé a une chance de l'apprivoiser (bien plus faible pour un monstre hostile). Fruit en main, on ne se bat plus
- **Le monde est un long chemin** : du camp de départ (au bord de la carte) au village, puis une piste à travers 5 zones de plus en plus dangereuses ; la dernière, les Lacs brumeux, s'atteint depuis le Camp avancé
- **Tireurs** (Guetteur runique, Crapaud-mortier, Serpent des brumes) : ils s'immobilisent pour charger leur tir — écarte-toi de la trajectoire, ou sors du cercle annoncé au sol
- **E** sur l'emplacement de camp au bout de la zone 4 : l'établir pour tout le village (2000 or) — feu qui soigne, réapparition sur place, Pierre de passage
- **E** devant une Pierre de passage (village, une fois construite, ou camp établi) : voyager d'un camp à l'autre avec ta meute
- **Tanière › Bestiaire** : chaque espèce croisée s'y ajoute (sprite, stats, comment la combattre) ; les autres restent en silhouette. On y choisit la forme montrée : sauvage, Alpha, légendaire, ou géant (dévoilé une fois vaincu par le village)
- **Alphas à pouvoir** : l'Alpha Escargot protège son dompteur (−8 % de dégâts reçus, +1 % par niveau) ; l'Alpha Lièvre le soigne un peu, ainsi que sa meute proche (3 % des PV toutes les 3 s, +0,3 % par niveau)
- **E** devant une grotte : la débloquer pour tout le village (150, 300, 450 or dans les zones 1 à 3 ; 1500 et 3000 or dans les zones 4 et 5), puis entrer (E à la sortie pour ressortir). Le géant dort au fond : **E** près de lui pour lui parler, puis « Lancer le combat ! ». Ses PV sont multipliés par le nombre de dompteurs en ligne ; ses coups ordinaires ne touchent qu'une cible (deux pour la reine des Gluants et l'ours), mais ses attaques spéciales frappent en zone et s'annoncent au sol : sors-en avant l'impact. Pendant le combat, les Alphas tombés ne reviennent qu'une fois le géant vaincu ou rendormi. Endormi, il ne bouge pas du centre de sa grotte : on ne peut ni le pousser ni le traverser. Vaincu, il laisse un **coffre** au fond de sa grotte (E : chacun l'ouvre une fois, pour un montant d'or aléatoire) et parfois son âme, qui permet le **double éveil** de ton Alpha de cette espèce (Tanière : il devient légendaire) : plus d'âme une fois 3 en poche ou l'Alpha déjà légendaire. Si tout le monde sort, il se rendort, guéri.
- **Échap** : menu — retour au lobby, paramètres (affichage : qualité, chiffres des dégâts de tous ou seulement les siens, secousses, latence ; son ; touches et attaque ; membres du village), ou supprimer le village pour repartir de zéro (fondateur ; les autres membres effacent seulement leur progression), avec confirmation
- **Expulsion** (fondateur, Échap › Paramètres) : le joueur est renvoyé au lobby et banni, sa place se libère ; débanni, il revient avec sa progression
- **Chat** : C (réglable) ou le bouton 💬 sous la minicarte, qui compte les messages non lus ; chaque message s'affiche aussi quelques secondes dans une bulle au-dessus de son auteur. Rien n'est conservé : en revenant, on repart d'un chat vide
- **Tableau du village** (panneau sur la place du village, ou Menu) : géants battus, monstres apprivoisés et dons à l'entrepôt de chaque membre, déconnectés compris
- **Son** : musique et ambiance propres à chaque lieu (village, camps, chaque zone ; ambiance seule dans les grottes, musique de combat contre un géant) et bruitages, entièrement synthétisés ; volumes et coupure dans Échap › Paramètres
- **Menu** (Échap, ou le bouton ☰ sous la minicarte) : inviter des amis (le bouton disparaît quand le village est complet), paramètres, retour au lobby
- Un membre **déconnecté** dort près du feu du village (« z z z »), ses Alphas équipés et sa meute autour de lui : certains dorment aussi, les autres flânent dans le village
- **F9** (dev uniquement) : +300 or, +100 bois, +100 pierre et +30 essences de chaque espèce pour tester la forge, l'Hôtel de ville et la Tanière

## Structure

```
shared/   règles et équilibrage (config.ts), protocole réseau, maths
server/   HTTP + WebSocket + salons (index.ts), simulation d'un village (room.ts), sauvegarde Supabase (persist.ts)
supabase/ schéma SQL des profils
client/   lobby, boucle de jeu, rendu Canvas procédural, HUD HTML, minicarte
scripts/  test de fumée multi-clients, migrations
tests/    tests de règles par thème (tests/rules/*.test.ts) et leurs outils communs (helpers.ts)
```

Tout l'équilibrage (PV, dégâts, zones, chance d'apprivoisement, coût de la forge…) est dans
`shared/config.ts`.

## Licence

© 2026 EAnathos, tous droits réservés. Le code est visible mais **ni libre ni open source** : aucune copie,
modification, redistribution ou mise en ligne sans autorisation écrite. Détails dans [LICENSE](LICENSE).
