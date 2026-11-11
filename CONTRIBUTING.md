# Contribuer à Fangleaf

Le travail passe par une issue et une pull request. On ne pousse jamais directement sur `dev` ou `main`.

- `dev` est la branche d'intégration : les changements y sont regroupés et validés sur le staging.
- `main` correspond à la production. On y promeut `dev` après validation du staging.
- Le détail des environnements (staging, promotion, retour arrière) est dans [docs/ENVIRONNEMENTS.md](docs/ENVIRONNEMENTS.md).
- Chaque pull request doit être reliée à une issue GitHub.

Pour installer le projet et lancer le jeu en local, voir le [README](README.md). Pour comprendre le code, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 1. Issue obligatoire avant de commencer

Avant tout travail :

1. Chercher si une issue ouverte décrit déjà le besoin.
2. Si elle existe, la mettre à jour avec le périmètre, les précisions et les critères d'acceptation manquants.
3. Sinon, créer une issue décrivant le problème ou l'amélioration, le résultat attendu et les critères permettant de considérer le travail comme terminé.
4. Ne pas commencer un changement conséquent sans issue de référence. Pour une correction minime, créer une issue courte reste préférable afin de garder une trace.

Une issue doit rester centrée sur un sujet. Si le périmètre évolue fortement, créer une issue complémentaire et faire les liens entre elles.

## 2. Branches

Partir de `dev` à jour et créer une branche dédiée :

```bash
git switch dev
git pull
git switch -c feat/nom-court
```

Préfixes recommandés :

| Préfixe | Pour |
|---|---|
| `feat/` | une nouveauté de jeu (espèce, bâtiment, zone, mécanique) |
| `fix/` | un bug |
| `perf/` | les performances (rendu, réseau, simulation) |
| `balance/` | l'équilibrage seul (`shared/config.ts`) |
| `docs/` | la documentation |
| `chore/` | outillage, CI, dépendances, déploiement |

Les branches de travail partent de `dev`, jamais directement de `main`. Les commits doivent rester petits, cohérents et compilables.

## 3. Vérifications locales

Pendant le travail, lancer seulement le thème concerné : `npm run test:rules -- volcan` (liste : `npm run test:rules -- --list`).
Avant de pousser, lancer le socle de la CI :

```bash
npm run typecheck && npm run test:rules && npm run smoke && npm run build
```

Ajouter ou adapter les tests lorsqu'un comportement ou une règle change ([tests/README.md](tests/README.md)).
Si la PR touche la simulation ou le réseau, comparer aussi les performances avant et après ([docs/PERFORMANCE.md](docs/PERFORMANCE.md)).

## 4. Pull request obligatoire et lien avec l'issue

Ouvrir une PR de la branche de travail vers `dev` :

```bash
git push -u origin feat/nom-court
gh pr create --base dev
```

Chaque PR doit :

- mentionner l'issue concernée avec `Refs #NUMERO` dans sa description ;
- expliquer ce qui change, pourquoi et comment tester ;
- préciser les tests exécutés et leur résultat ;
- rester limitée à un sujet. Découper les PR trop volumineuses ;
- inclure une capture ou une courte vidéo pour un changement visuel.

Si une PR termine entièrement le travail demandé par l'issue, le signaler explicitement. Ne pas utiliser `Closes #NUMERO` sur une PR vers `dev` : GitHub pourrait fermer l'issue dès la fusion dans `dev`, avant la validation du staging et la mise en production.

## 5. Revue, staging et fermeture des issues

1. La PR vers `dev` doit passer la CI et être relue avant fusion.
2. `dev` est déployé automatiquement sur le staging quand la CI passe : y vérifier les critères d'acceptation (liste de validation dans [docs/ENVIRONNEMENTS.md](docs/ENVIRONNEMENTS.md#valider-sur-le-staging-avant-la-promotion)).
3. Corriger les problèmes détectés en staging via une nouvelle PR liée à la même issue.
4. Quand les changements prévus sont terminés et validés, promouvoir `dev` vers `main` via une PR dédiée.
5. La PR de promotion vers `main` peut utiliser `Closes #NUMERO` pour chaque issue réellement terminée. Une issue partiellement traitée reste ouverte et doit être mise à jour.
6. Après fusion vers `main`, vérifier le déploiement de production et fermer manuellement toute issue terminée qui n'aurait pas été fermée automatiquement.

Une PR fusionnée dans `dev` ne signifie donc pas, à elle seule, que l'issue est terminée.

## 6. Les commits

- En français, au présent, et ils disent ce qui change pour le joueur plutôt que comment c'est codé.
- Plusieurs changements dans un commit : les séparer par `;`.
- Les corrections demandées en revue vont dans un commit à part, par exemple « Revue de la PR : … ».

## 7. Ce qu'on vérifie en revue

- **Le serveur décide** : dégâts, or, apprivoisement, achats et IA se calculent dans `server/room.ts`, jamais d'après ce qu'affirme le client.
- **Les chiffres vont dans `shared/config.ts`** (coûts, PV, durées, rayons), pas en dur dans le code, et la doc n'en recopie aucun.
- **Des tests** : une règle nouvelle ou modifiée a son test dans `tests/rules/` (le fichier du thème concerné). Un comportement de bout en bout (réseau, connexion, achats) peut aller dans `scripts/smoke.ts`.
- **Les performances** : pour une PR qui touche la simulation ou le réseau, la comparaison `npm run bench` est collée dans la description et ne montre aucun ✘ inexpliqué.
- **La base de données** : un changement de schéma, c'est une nouvelle migration numérotée dans `supabase/migrations/`. On ne modifie jamais une migration déjà fusionnée.
- **La doc à jour** : `docs/GUIDE.md` quand le jeu change pour le joueur, `docs/ARCHITECTURE.md` quand la structure change.
- **Pas de secrets** : `.env` n'est jamais commité. Une nouvelle variable d'environnement va dans `.env.example` (sans sa valeur) et dans le README.
- **Le mode dev reste en dev** : triches et raccourcis de test sont désactivés quand `NODE_ENV=production`.

## 8. Version et changelog

Pour chaque changement visible par les joueurs, ajouter un fichier JSON indépendant dans `.changes/` (voir [`.changes/README.md`](.changes/README.md)). Ne plus modifier manuellement `package.json`, `package-lock.json` ni le changelog central.

À chaque push sur `dev` (donc à chaque fusion de PR), le workflow de publication ([release-version.yml](.github/workflows/release-version.yml)) consolide les fragments, choisit le niveau SemVer le plus élevé (`patch`, `minor`, `major`), met à jour la version du package et les nouveautés du lobby, puis relance la CI sur le commit versionné. La version arrive ensuite en production avec la promotion de `dev` vers `main`. Les PR indépendantes n'éditent donc plus les mêmes métadonnées.

## 9. Si la CI échoue

Lire le log de l'étape qui a cassé (`gh pr checks`), puis reproduire en local avec la commande correspondante. Ne pas relancer les tests en boucle sans corriger la cause.

## 10. Licence des contributions

Le projet est publié sous la [PolyForm Noncommercial License 1.0.0](LICENSE) (résumé dans le [README](README.md#licence)). En ouvrant une PR, on accepte que sa contribution soit distribuée sous cette même licence. Ne pas y intégrer de code, d'image ou de son repris d'un autre projet dont la licence serait incompatible avec ces conditions.
