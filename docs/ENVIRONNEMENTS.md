# Environnements : dev, staging et production

Un changement passe par trois étapes avant d'arriver chez les joueurs : sa branche de travail, la branche `dev`
(déployée sur le **staging**) puis `main` (la **production**). Ce document décrit qui déploie quoi, comment le staging
est isolé de la prod, ce qu'on vérifie avant de promouvoir et comment revenir en arrière.

Le workflow de contribution lui-même (issues, PR, revue) est dans [CONTRIBUTING.md](../CONTRIBUTING.md).

## Branches et promotion

```
feat/…, fix/…  ──PR──▶  dev  ──CI──▶  staging     (automatique)
                         │
                         └──PR de promotion──▶  main  ──CI──▶  production   (automatique)
```

- Les branches de travail partent de `dev` et y reviennent par PR. On ne pousse jamais directement sur `dev` ni `main`.
- À chaque push sur `dev`, [release-version.yml](../.github/workflows/release-version.yml) consolide les fragments
  `.changes/` (version et nouveautés du lobby) puis relance la CI sur le commit de version.
- Quand la CI passe sur `dev`, [cd-staging.yml](../.github/workflows/cd-staging.yml) déploie ce commit sur le staging.
- Quand le staging est validé (voir plus bas), on ouvre une **PR de promotion** de `dev` vers `main` :
  - titre `Promotion dev → main (vX.Y.Z)`, avec la version affichée sur le staging ;
  - description : la liste des PR incluses, et un `Closes #N` pour chaque issue réellement terminée ;
  - fusion par **commit de fusion** (« Create a merge commit »), jamais par squash ni rebase : `dev` et `main` doivent
    garder un historique commun, sinon la promotion suivante est en conflit.
- Quand la CI passe sur `main`, [cd.yml](../.github/workflows/cd.yml) déploie la production.

**Correctif urgent en production** : branche `fix/…` partie de `main`, PR vers `main`, puis fusion de `main` dans `dev`
(par PR) pour que le correctif ne soit pas perdu à la promotion suivante.

## Les trois environnements

| | Local | Staging | Production |
|---|---|---|---|
| Branche | n'importe laquelle | `dev` | `main` |
| Adresse | http://localhost:5173 | https://staging.fangleaf.anathos.me | https://fangleaf.anathos.me |
| Clone sur la machine | | `~/eanathos/Fangleaf-staging` | `~/eanathos/Fangleaf` |
| Process pm2, port | `npm run dev` (3001 et 5173) | `fangleaf-staging`, 4311 | `fangleaf`, 4310 |
| `VITE_FANGLEAF_ENV` (`.env`) | vide | `staging` | vide |
| Projet Supabase | le sien | **un projet dédié** | le projet de prod |
| Triches (F9…) | oui | non (`NODE_ENV=production`) | non |
| Déploiement | | après la CI sur `dev`, ou à la main | après la CI sur `main`, ou à la main |

Le staging tourne exactement comme la prod (même `NODE_ENV`, même build), seuls ses données et son adresse changent.
Un badge **STAGING** rouge est affiché en permanence en haut de l'écran, et l'onglet s'appelle « Fangleaf · staging ».

### Où l'héberger

Par défaut, le staging tourne **sur le même VPS que la prod**, dans un clone, un process pm2, un port et un vhost nginx
à part : aucun coût en plus, et les mêmes versions de Node, pm2 et nginx que la prod. Sa limite mémoire est celle de
la prod (512 Mo, `ecosystem.config.cjs`) : il ne peut pas l'affamer.

La proposition de `0h37` d'héberger le staging sur sa machine reste possible sans rien changer au code : il suffit de
renseigner les secrets de l'environnement GitHub `staging` (voir l'installation, étape 6). Points à vérifier avant :
disponibilité de la machine, accès SSH par une clé dédiée au déploiement, Node 22 ou plus, pm2 et nginx installés,
DNS de l'adresse du staging pointé vers elle.

## Installation du staging (une fois)

1. **Supabase** : créer un second projet (par exemple `fangleaf-staging`). Dans *Authentication › Sign In / Providers ›
   Google*, activer Google avec le même ID client OAuth que la prod. Dans *Authentication › URL Configuration* :
   *Site URL* = `https://staging.fangleaf.anathos.me`, *Redirect URLs* = `https://staging.fangleaf.anathos.me/**`.
2. **Google Cloud Console** : dans l'ID client OAuth existant, ajouter l'URI de redirection
   `https://<projet-staging>.supabase.co/auth/v1/callback`.
3. **DNS** : un enregistrement A (et AAAA) `staging.fangleaf.anathos.me` vers la machine du staging.
4. **Clone et `.env`** sur la machine :
   ```bash
   git clone https://github.com/EAnathos/Fangleaf.git ~/eanathos/Fangleaf-staging
   cd ~/eanathos/Fangleaf-staging && git checkout --detach origin/dev
   cp .env.example .env   # valeurs du projet Supabase de staging, et VITE_FANGLEAF_ENV=staging
   bash deploy/deploy.sh  # dépendances, migrations sur la base de staging, build, démarrage de fangleaf-staging
   ```
5. **nginx** : [deploy/nginx/staging.fangleaf.anathos.me.conf](../deploy/nginx/staging.fangleaf.anathos.me.conf),
   étapes en tête du fichier (certificat Let's Encrypt d'abord).
6. **GitHub** (*Settings*) :
   - *Environments* : créer l'environnement `staging`. Si le staging est sur une autre machine que la prod, y définir
     les secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` et `VPS_PORT` de cette machine (ils priment sur ceux du dépôt).
   - *Secrets and variables › Actions › Variables* : `STAGING_ENABLED` = `true` (tant qu'elle manque, le workflow
     ne fait rien). Facultatif : `STAGING_URL` et `STAGING_DIR` si l'adresse ou le dossier diffèrent des valeurs par défaut.
   - *Rules › Rulesets* : protéger `dev` et `main` (PR obligatoire, CI « Typecheck, règles, fumée, build » requise).
     Sur `dev`, ajouter *GitHub Actions* aux contournements autorisés : sans cela, release-version.yml ne peut plus
     pousser le commit de version.

## Données et secrets : l'isolation

- **Base et comptes séparés** : le staging a son propre projet Supabase, donc sa propre base, sa propre clé
  `service_role` et ses propres comptes. Une fausse manipulation sur le staging ne touche jamais la prod.
- **Pas de copie des données de prod** vers le staging : elles contiennent des comptes Google, donc des données
  personnelles. Sur le staging, chacun se connecte avec son compte et repart de zéro ; F9 n'existe pas (mode prod),
  on avance en jouant ou on prépare l'état voulu directement dans la base de staging.
- **Garde-fous automatiques** :
  - `deploy/deploy.sh` refuse de déployer le staging si son `.env` n'a pas de `SUPABASE_URL`, ou si `SUPABASE_URL`,
    `VITE_SUPABASE_URL` ou `DATABASE_URL` sont identiques à celles du clone de prod (`../Fangleaf`, ou `PROD_DIR`) ;
  - le workflow refuse de déployer dans un dossier dont le `.env` ne déclare pas `VITE_FANGLEAF_ENV=staging` :
    une erreur sur `STAGING_DIR` ne peut pas envoyer `dev` en production ;
  - `ecosystem.config.cjs` lit l'environnement dans le `.env` du clone : un `pm2 reload` lancé à la main dans le clone
    de staging relance `fangleaf-staging` sur le port 4311, jamais l'app de prod.
- **Secrets** : `.env` n'est jamais commité ; les secrets du staging vont dans l'environnement GitHub `staging`.

### Migrations

- Elles passent **d'abord sur le staging** (`deploy.sh` lance `npm run db:migrate`) : une migration cassée échoue là,
  pas en prod.
- Elles ne vont que vers l'avant : une migration fusionnée ne se modifie plus, on en écrit une nouvelle.
- Un retour arrière du code n'annule pas une migration. Une migration doit donc rester compatible avec la version
  précédente du code : ajouter une colonne avec une valeur par défaut d'abord, retirer l'ancienne dans une version suivante.
- Le staging est jetable : si sa base devient incohérente, on peut la vider ou recréer le projet, puis relancer le
  déploiement pour réappliquer toutes les migrations.

## Valider sur le staging avant la promotion

À faire sur https://staging.fangleaf.anathos.me, sur le commit de `dev` qu'on s'apprête à promouvoir :

1. Le dernier run *CD staging* est vert et la version du lobby est celle attendue. Le badge STAGING est affiché.
2. Pour chaque issue incluse : vérifier ses critères d'acceptation, et noter le résultat en commentaire de l'issue.
3. Tour de non-régression, à deux comptes (deux navigateurs, ou un ami) :
   - connexion Google, création d'un village, invitation et arrivée du second joueur ;
   - combat, apprivoisement, achat à la forge ;
   - quitter puis revenir dans le village : or, ressources, équipement et Alphas sont conservés ;
   - sur téléphone si l'interface a changé.
4. Pas d'erreur dans les logs : `pm2 logs fangleaf-staging --lines 200 --nostream`.

Un problème trouvé en staging se corrige par une nouvelle PR vers `dev`, liée à la même issue. On ne promeut pas
tant que la liste n'est pas entièrement verte.

## Retour arrière

**Staging** : *Actions › CD staging › Run workflow*, avec dans `ref` le SHA du dernier commit de `dev` qui
fonctionnait. Le déploiement manuel accepte n'importe quel commit ; le déploiement automatique, lui, ne fait jamais
reculer le staging. Corriger ensuite par une PR vers `dev` (un `git revert` de la PR fautive si besoin) : la CI
suivante redéploie `dev` normalement.

**Production** :

1. **Voie normale** : annuler la promotion par une PR vers `main`.
   ```bash
   git switch main && git pull
   git switch -c fix/annule-promotion-vX.Y.Z
   git revert -m 1 <commit de fusion de la promotion>
   git push -u origin HEAD && gh pr create --base main
   ```
   Une fois fusionnée, la CI puis la CD redéploient `main`. Fusionner ensuite `main` dans `dev`.
2. **Urgence** (site cassé, pas le temps d'attendre la CI) : sur le VPS,
   `cd ~/eanathos/Fangleaf && git checkout --detach <SHA sain> && bash deploy/deploy.sh`, puis faire quand même la
   voie normale : le prochain déploiement automatique repart de `main`.

Dans les deux cas, les migrations déjà appliquées restent : si l'une d'elles est en cause, la corriger par une
nouvelle migration. Les redémarrages sont sans risque pour les joueurs : le serveur sauvegarde les progressions
à l'arrêt.
