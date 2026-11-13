# Consignes pour Claude

Fangleaf : jeu coop dans le navigateur, TypeScript partout (client Canvas, serveur Node `ws` autoritaire, Supabase).
À lire avant de commencer : [CONTRIBUTING.md](CONTRIBUTING.md) (workflow), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
(où est quoi), [tests/README.md](tests/README.md) (tests), [docs/PERFORMANCE.md](docs/PERFORMANCE.md) (performance).

## Workflow

- Tout travail part d'une issue GitHub, sur une branche créée depuis `dev` à jour (`feat/`, `fix/`, `perf/`,
  `balance/`, `docs/`, `chore/`), et revient par une PR **vers `dev`**.
- Une issue a des **critères d'acceptation** en cases à cocher (modèle « Tâche »).
- Description de PR : `Termine #N` si la PR remplit tous les critères de l'issue, sinon `Refs #N` (jamais `Closes #N`) ;
  la CI refuse une PR sans l'un ni l'autre. Puis ce qui change, pourquoi, comment tester, les tests lancés et leur
  résultat. Cocher dans l'issue les critères remplis.
- Les déploiements suivent le reste : labels `sur-staging` et `en-production`, fermeture de l'issue une fois en production.
  PR de promotion vers `main` : aucun `Closes #N`.
- Une PR, un sujet. Ne pas mélanger un refactoring et un changement de comportement.
- Ne jamais pousser sur `dev` ni sur `main`, ne jamais réécrire l'historique d'une branche partagée.

## Règles du code

- **Le serveur décide** : dégâts, or, apprivoisement, achats, IA se calculent dans `server/room.ts`. Le client affiche
  et envoie des intentions ; une valeur venue du client est bornée ou vérifiée.
- **Les chiffres vont dans `shared/config.ts`** (coûts, PV, durées, rayons), jamais en dur ailleurs.
- **Base de données** : un changement de schéma est une nouvelle migration numérotée dans `supabase/migrations/` ;
  une migration fusionnée ne se modifie jamais. Elle doit rester compatible avec la version précédente du code.
- **Mode dev** : triches et raccourcis de test seulement quand `NODE_ENV !== 'production'` ou `ALLOW_CHEATS=1`
  (posé sur le staging, pour y préparer une situation de test) ; jamais en production. Une capacité dangereuse
  s'ouvre par une variable du serveur, jamais par une valeur venue d'un build du client.
- **Secrets** : `.env` n'est jamais commité ; une nouvelle variable va dans `.env.example` (sans valeur) et le README.
- **État de la carte** : tout champ ajouté à `WorldMap` est une donnée copiable par `structuredClone` (pas de fonction
  dans un champ), sinon le cache de cartes des tests casse (`WorldMap.clone`).
- Identifiants en anglais, commentaires en français : ils disent **pourquoi**, pas ce que fait la ligne.
- Pas de nouvelle dépendance sans nécessité réelle ; le rendu reste procédural (aucune image).

## Tests

- Pendant le travail, lancer le thème concerné : `npm run test:rules -- volcan` (thèmes : `npm run test:rules -- --list`).
- Avant de pousser, tout le socle de la CI :
  ```bash
  npm run typecheck && npm run test:rules && npm run smoke && npm run build
  ```
- Une règle nouvelle ou modifiée a son test dans `tests/rules/<thème>.test.ts`, écrit avec `rule()` et `check()`
  (`tests/helpers.ts`) : le nom du test dit la règle, le libellé de chaque `check` dit l'attendu et la valeur mesurée.
- Un comportement de bout en bout (réseau, connexion) va dans `scripts/smoke.ts`.
- Ne jamais affaiblir ni supprimer un test pour le faire passer. Un test qui dépend du relief de l'île par hasard
  se corrige en plaçant ses acteurs dans un endroit dégagé ; le vérifier avec deux ou trois `TEST_SEED`.
- Rapporter les résultats tels quels dans la PR, échecs compris.

## Performance

Une PR qui touche la simulation ou le réseau (`server/room.ts`, `server/grid.ts`, `shared/worldmap.ts`,
`shared/snapshot.ts`, `shared/protocol.ts`, nouvelles unités, nouveaux effets, nouveaux champs envoyés) passe le banc
avant et après, sur la même machine, et colle la comparaison dans la PR :

```bash
git switch dev && npm run bench -- --save .bench/avant.json
git switch ma-branche && npm run bench -- --against .bench/avant.json
```

Seuils, scénarios et référence : [docs/PERFORMANCE.md](docs/PERFORMANCE.md).

## Documentation

- Mettre à jour dans la même PR : [docs/GUIDE.md](docs/GUIDE.md) quand le jeu change pour le joueur,
  [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) quand la structure change, le [README](README.md) pour une commande
  ou une variable d'environnement.
- Changement visible par les joueurs : un fragment JSON dans `.changes/` ([.changes/README.md](.changes/README.md)).
  Ne jamais modifier à la main la version de `package.json`, `package-lock.json` ni `client/src/changelog.json`.
- La documentation ne recopie aucun chiffre de `shared/config.ts`.
- Tout est en français : documentation, commentaires, commits, PR, nouveautés du lobby.
- **Ne jamais utiliser de tiret cadratin (—)**, ni dans la documentation, ni dans les commentaires, commits, PR ou
  nouveautés du lobby. Utiliser à la place deux-points, virgule, point-virgule, parenthèses ou `·`. En modifiant un
  paragraphe qui en contient, les remplacer au passage.

## Design

À chaque nouvelle demande de design (écran, panneau, HUD, créature, bâtiment, effet visuel, mise en page), proposer
**plusieurs propositions distinctes** avant d'en réaliser une, et laisser l'utilisateur choisir explicitement.

- Les propositions diffèrent vraiment (disposition, style, lisibilité, comportement), pas seulement par un détail.
- Chacune est travaillée, complète et aussi soignée que les autres : pas d'ébauche ni d'option volontairement moins
  aboutie pour orienter le choix. Pour chacune, dire ce qu'elle apporte et ce qu'elle coûte.
- Ne poursuivre qu'avec la proposition choisie (ou le mélange demandé).

## Commits

En français, au présent, ils disent ce qui change pour le joueur plutôt que comment c'est codé. Plusieurs changements
dans un commit : les séparer par `;`. Les corrections demandées en revue vont dans un commit à part
(« Revue de la PR : … »).

## Sous Windows

Les scripts npm utilisent la syntaxe POSIX (`PORT=3001 tsx …`) : les lancer depuis Git Bash.
