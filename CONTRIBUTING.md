# Contribuer à Fangleaf

`main` est protégée : on n'y pousse jamais directement. Tout passe par une pull request relue et validée par la CI.
Chaque commit qui arrive sur `main` est déployé en production ([cd.yml](.github/workflows/cd.yml)) : `main` doit toujours marcher.

Pour installer le projet et lancer le jeu en local, voir le [README](README.md). Pour comprendre le code, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Le workflow

1. **Partir d'un `main` à jour**

   ```bash
   git switch main && git pull
   git switch -c feat/nom-court
   ```

2. **Nommer la branche** d'après ce qu'elle fait :

   | Préfixe | Pour |
   |---|---|
   | `feat/` | une nouveauté de jeu (espèce, bâtiment, zone, mécanique) |
   | `fix/` | un bug |
   | `perf/` | les performances (rendu, réseau, simulation) |
   | `balance/` | l'équilibrage seul (`shared/config.ts`) |
   | `docs/` | la documentation |
   | `chore/` | outillage, CI, dépendances, déploiement |

3. **Coder par petits commits**, chacun cohérent et qui compile.

4. **Vérifier en local avant de pousser**. Ce sont les mêmes étapes que la CI :

   ```bash
   npm run typecheck && npm run test:rules && npm run smoke && npm run build
   ```

5. **Pousser et ouvrir la PR** vers `main` :

   ```bash
   git push -u origin feat/nom-court
   gh pr create --base main
   ```

6. **Revue** : il faut au moins **une approbation** d'un autre membre, et le check CI
   *Typecheck, règles, fumée, build* doit être au vert. Un nouveau commit poussé après une approbation l'annule : il faut une nouvelle relecture.
   Toutes les conversations de la revue doivent être résolues avant la fusion.

7. **Fusionner** avec le bouton de la PR (merge commit), puis supprimer la branche. Le déploiement part tout seul.

Si `main` a avancé pendant la revue, on rattrape avec `git merge origin/main` (ou un rebase tant que la branche n'est qu'à soi), puis on repousse.

## Les commits

- **En français**, au présent, et ils disent **ce qui change pour le joueur** plutôt que comment c'est codé :
  « Le Tréant de la meute abat les arbres », pas « ajout de treantChops() ».
- Plusieurs changements dans un commit : on les sépare par « ; ».
- Les corrections demandées en revue vont dans un commit à part, par exemple « Revue de la PR : … ».

## La pull request

- Un titre clair, et dans la description : **ce qui change**, **pourquoi**, et **comment le tester** (où aller, quoi faire en jeu).
- Un changement visible (sprite, HUD, effet) : une capture ou une courte vidéo.
- Une PR par sujet : si elle devient énorme, on la découpe.

## Ce qu'on vérifie en revue

- **Le serveur décide** : dégâts, or, apprivoisement, achats et IA se calculent dans `server/room.ts`, jamais d'après ce qu'affirme le client.
- **Les chiffres vont dans `shared/config.ts`** (coûts, PV, durées, rayons), pas en dur dans le code, et la doc n'en recopie aucun.
- **Des tests** : une règle nouvelle ou modifiée a son test dans `tests/rules/` (le fichier du thème concerné).
  Un comportement de bout en bout (réseau, connexion, achats) peut aller dans `scripts/smoke.ts`, qui doit résister au hasard des combats.
- **La base de données** : un changement de schéma, c'est une nouvelle migration numérotée dans `supabase/migrations/`
  (`028_….sql`, à la suite de la dernière). On ne modifie jamais une migration déjà fusionnée.
- **La doc à jour** : [docs/GUIDE.md](docs/GUIDE.md) quand le jeu change pour le joueur, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) quand la structure change.
- **Pas de secrets** : `.env` n'est jamais commité. Une nouvelle variable d'environnement va dans `.env.example` (sans sa valeur) et dans le README.
- **Le mode dev reste en dev** : triches et raccourcis de test sont désactivés quand `NODE_ENV=production`.

## Si la CI échoue

Lis le log de l'étape qui a cassé (`gh pr checks`, puis le lien du check) et reproduis en local avec la commande correspondante.
Le test de fumée joue de vraies parties avec des bots : s'il échoue de temps en temps, rends le script plus robuste plutôt que de relancer jusqu'à ce que ça passe.
