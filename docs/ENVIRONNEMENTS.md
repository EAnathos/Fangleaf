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
| Adresse | http://localhost:5173 | https://fangleaf-staging.leo-bessin.dev | https://fangleaf.anathos.me |
| Hébergement | ta machine | VPS Coolify (conteneur Docker) | VPS d'EAnathos (pm2 derrière nginx) |
| Lancement | `npm run dev` (3001 et 5173) | image [deploy/Dockerfile](../deploy/Dockerfile), port 4311 | `fangleaf`, port 4310 |
| `VITE_FANGLEAF_ENV` | vide | `staging` (variable Coolify) | vide |
| Projet Supabase | le sien | **un projet dédié** | le projet de prod |
| Triches (F9…) | oui | oui | non |
| Déploiement | | après la CI sur `dev`, ou à la main | après la CI sur `main`, ou à la main |

Le staging tourne comme la prod (même `NODE_ENV`, même code serveur), seuls son hébergement, ses données et son
adresse changent. Un badge **STAGING** rouge est affiché en permanence en haut de l'écran, et l'onglet s'appelle
« Fangleaf · staging ».

Une seule différence de comportement : les **triches (F9)** y répondent, pour pouvoir mettre en place en quelques
secondes la situation qu'on veut vérifier (or, monstres, zone débloquée, géant abattu). Il y faut deux variables que
la production ne déclare pas : `ALLOW_CHEATS=1` pour que le serveur accepte ces messages (variable du serveur seul,
comme `ALLOW_GUESTS` : aucun build du client ne peut les lui ouvrir), et `VITE_FANGLEAF_ENV=staging` pour que le
panneau soit dans le build du client. Le test de fumée lance un serveur comme la prod et un comme le staging, et
vérifie les deux cas.

### Où l'héberger

Le staging tourne sur un **VPS séparé, géré par [Coolify](https://coolify.io)**, et non sur le VPS de la prod : les
deux environnements ne partagent ni machine, ni base, ni process. Une erreur de manipulation sur le staging ne peut
pas toucher la prod, et une charge anormale non plus.

Coolify construit lui-même l'image à partir de [deploy/Dockerfile](../deploy/Dockerfile), lance le conteneur, et son
proxy (Traefik) s'occupe du HTTPS et du certificat : le staging n'a donc ni pm2, ni fichier nginx, ni script de
déploiement. Les fichiers `ecosystem.config.cjs`, [deploy/deploy.sh](../deploy/deploy.sh) et
`deploy/nginx/fangleaf.anathos.me.conf` ne servent qu'à la production.

Ce que fait l'image : installation des dépendances, build du client (les valeurs `VITE_*` y sont figées), puis au
démarrage du conteneur les migrations, et enfin le serveur. Une migration qui échoue empêche le conteneur de démarrer,
donc le déploiement échoue au lieu de laisser un staging à moitié migré.

## Installation du staging (une fois)

1. **Supabase** : créer un projet dédié (par exemple `fangleaf-staging`), dans l'organisation Supabase de la personne
   qui héberge le staging : il ne dépend ainsi ni du projet, ni du compte de la production. Dans *Authentication › Sign In / Providers ›
   Google*, activer Google avec le même ID client OAuth que la prod. Dans *Authentication › URL Configuration* :
   *Site URL* = `https://fangleaf-staging.leo-bessin.dev`, *Redirect URLs* = `https://fangleaf-staging.leo-bessin.dev/**`.
2. **Google Cloud Console** : dans l'ID client OAuth existant, ajouter l'URI de redirection
   `https://<projet-staging>.supabase.co/auth/v1/callback`.
3. **DNS** : un enregistrement pour l'adresse du staging vers le VPS Coolify (inutile si le domaine a déjà un
   enregistrement générique).
4. **Application Coolify** (*+ New › Application › Public Repository*) :
   - dépôt `https://github.com/EAnathos/Fangleaf`, branche `dev`, *Build Pack* **Dockerfile** ;
   - *Base Directory* `/`, *Dockerfile Location* `/deploy/Dockerfile`, *Port Exposes* `4311` ;
   - *Domains* : l'adresse du staging ; cocher le **noindex** du domaine (en-tête `X-Robots-Tag` : le staging n'a
     rien à faire dans les moteurs de recherche) ;
   - *Advanced › Build › Build arguments* : **Managed manually in Dockerfile** (le Dockerfile déclare ses `ARG`) ;
   - *Health check* activé sur `/`, port 4311 ;
   - **Auto deploy désactivé** : c'est GitHub Actions qui déclenche le déploiement, seulement après une CI verte.
5. **Variables d'environnement de l'application** (toutes celles de [.env.example](../.env.example), avec les valeurs
   du projet Supabase **de staging**) :
   - disponibles au build **et** à l'exécution : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_FANGLEAF_ENV=staging` ;
   - exécution seulement : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `ALLOW_CHEATS=1`.

   Les `VITE_*` sont figées dans le build : les changer demande un redéploiement, pas un simple redémarrage. Si l'une
   des deux valeurs Supabase manque au build, l'image refuse de se construire plutôt que de mettre en ligne un
   staging sans connexion Google.
6. **Jeton d'API Coolify** (*Keys & Tokens › API tokens*) avec les capacités `write` et `deploy`.
7. **GitHub** (*Settings*) :
   - *Environments* : créer l'environnement `staging` et y mettre les secrets `COOLIFY_URL` (adresse de l'instance,
     sans barre finale), `COOLIFY_TOKEN` (le jeton ci-dessus) et `COOLIFY_APP_UUID` (identifiant de l'application,
     visible dans l'URL de sa page Coolify).
   - *Secrets and variables › Actions › Variables* : `STAGING_ENABLED` = `true` (tant qu'elle manque, le workflow
     ne fait rien) et `STAGING_URL` = l'adresse publique du staging (obligatoire : le workflow refuse de deviner
     une adresse qui pourrait être celle de quelqu'un d'autre).
   - *Rules › Rulesets* : sur `main`, PR obligatoire et CI « Typecheck, règles, fumée, build » requise.
     Sur `dev`, s'en tenir à « blocage des pushes forcés » et « suppression interdite » : une PR obligatoire ou une CI
     requise y bloquerait aussi le commit de version que release-version.yml pousse directement, et *GitHub Actions*
     n'apparaît pas dans la liste des contournements (ce n'est pas une application installée sur le dépôt). Le reste
     tient à la règle d'équipe : on ne pousse pas sur `dev`, on y arrive par une PR.
8. **Premier déploiement** : depuis Coolify (*Deploy*). Le workflow *CD staging*, lui, n'existe pour GitHub qu'une
   fois `cd-staging.yml` présent sur la branche par défaut (`main`) : c'est une règle de `workflow_run` et de
   `workflow_dispatch`, et tant qu'elle n'est pas remplie il ne se passe rien, sans message d'erreur. Donc, entre la
   fusion dans `dev` et la première promotion vers `main`, le staging se déploie depuis Coolify. Ensuite, c'est
   toujours la version de `main` qui s'exécute, même pour un commit de `dev`.

## Données et secrets : l'isolation

- **Machines séparées** : le staging est sur le VPS Coolify, la prod sur le sien. Aucun fichier, aucun process et
  aucun port en commun.
- **Base et comptes séparés** : le staging a son propre projet Supabase, donc sa propre base, sa propre clé
  `service_role` et ses propres comptes. Une fausse manipulation sur le staging ne touche jamais la prod.
- **Pas de copie des données de prod** vers le staging : elles contiennent des comptes Google, donc des données
  personnelles. Sur le staging, chacun se connecte avec son compte et repart de zéro, puis prépare l'état à tester
  avec F9 plutôt qu'en rejouant toute la partie.
- **Garde-fous automatiques** :
  - le workflow vérifie que l'application Coolify visée déploie bien ce dépôt : une erreur sur `COOLIFY_APP_UUID`
    fait échouer le déploiement au lieu d'écraser une autre application ;
  - [.dockerignore](../.dockerignore) exclut `.env` de l'image : les secrets du staging viennent uniquement des
    variables Coolify, et aucun fichier oublié ne peut les remplacer ;
  - le staging n'a pas accès aux secrets de la prod : ils sont dans l'environnement GitHub `production` et sur le
    VPS de prod, jamais dans l'environnement `staging`.
- **Secrets** : `.env` n'est jamais commité ; les secrets du staging vivent dans Coolify, et ceux dont GitHub a
  besoin pour déclencher le déploiement dans l'environnement GitHub `staging`.

### Migrations

- Elles passent **d'abord sur le staging**, au démarrage du conteneur (`npm run db:migrate`) : une migration cassée
  empêche le conteneur de démarrer et fait échouer le déploiement, donc elle n'arrive pas en prod.
- Elles ne s'appliquent qu'une fois (table `_migrations`) : un redémarrage du conteneur ne rejoue rien.
- Elles ne vont que vers l'avant : une migration fusionnée ne se modifie plus, on en écrit une nouvelle.
- Un retour arrière du code n'annule pas une migration. Une migration doit donc rester compatible avec la version
  précédente du code : ajouter une colonne avec une valeur par défaut d'abord, retirer l'ancienne dans une version suivante.
- Le staging est jetable : si sa base devient incohérente, on peut la vider ou recréer le projet Supabase, puis
  relancer le déploiement pour réappliquer toutes les migrations.

## Valider sur le staging avant la promotion

À faire sur https://fangleaf-staging.leo-bessin.dev, sur le commit de `dev` qu'on s'apprête à promouvoir :

1. Le dernier run *CD staging* est vert et la version du lobby est celle attendue. Le badge STAGING est affiché.
2. Pour chaque issue incluse : vérifier ses critères d'acceptation, et noter le résultat en commentaire de l'issue.
3. Tour de non-régression, à deux comptes (deux navigateurs, ou un ami) :
   - connexion Google, création d'un village, invitation et arrivée du second joueur ;
   - combat, apprivoisement, achat à la forge ;
   - quitter puis revenir dans le village : or, ressources, équipement et Alphas sont conservés ;
   - sur téléphone si l'interface a changé.
4. Pas d'erreur dans les logs : page de l'application dans Coolify, onglet *Logs*.

Un problème trouvé en staging se corrige par une nouvelle PR vers `dev`, liée à la même issue. On ne promeut pas
tant que la liste n'est pas entièrement verte.

## Retour arrière

**Staging** : *Actions › CD staging › Run workflow* (disponible une fois le workflow sur `main`, voir l'installation,
étape 8), avec dans `ref` le SHA du dernier commit de `dev` qui fonctionnait. Le déploiement manuel accepte n'importe quel commit ; le déploiement automatique, lui, ne fait jamais
reculer le staging (si deux CI finissent dans le désordre, l'ancienne est ignorée). Corriger ensuite par une PR vers
`dev` (un `git revert` de la PR fautive si besoin) : la CI suivante redéploie `dev` normalement.

Coolify sait aussi redémarrer l'image précédente (*Deployments › Rollback*) : c'est plus rapide, mais le commit visé
par l'application ne change pas, donc le prochain déploiement automatique repartira de `dev`.

**Production** :

1. **Voie normale** : annuler la promotion par une PR vers `main`.
   ```bash
   git switch main && git pull
   git switch -c fix/annule-promotion-vX.Y.Z
   git revert -m 1 <commit de fusion de la promotion>
   git push -u origin HEAD && gh pr create --base main
   ```
   Une fois fusionnée, la CI puis la CD redéploient `main`. Fusionner ensuite `main` dans `dev`.
2. **Urgence** (site cassé, pas le temps d'attendre la CI) : sur le VPS de prod,
   `cd ~/eanathos/Fangleaf && git checkout --detach <SHA sain> && bash deploy/deploy.sh`, puis faire quand même la
   voie normale : le prochain déploiement automatique repart de `main`.

Dans les deux cas, les migrations déjà appliquées restent : si l'une d'elles est en cause, la corriger par une
nouvelle migration. Les redémarrages sont sans risque pour les joueurs : le serveur sauvegarde les progressions
à l'arrêt.
