# Tests

Deux niveaux, lancés tous les deux par la CI :

| Niveau | Commande | Ce qu'il vérifie | Durée |
|---|---|---|---|
| **Règles** | `npm run test:rules` | la simulation (`server/room.ts`) sans réseau : une règle du jeu par test | une minute environ |
| **Fumée** | `npm run smoke` | le vrai serveur et 4 bots WebSocket : connexion, salons, snapshots, combat, forge, anti-téléportation | une demi-minute |

Un comportement de règle (dégâts, coûts, IA, récompenses…) va dans les tests de règles. Un comportement qui n'existe
que de bout en bout (connexion, messages, limites du serveur HTTP) va dans `scripts/smoke.ts`.

## Lancer une partie des tests

```bash
npm run test:rules -- --list                            # les thèmes
npm run test:rules -- volcan                            # un thème
npm run test:rules -- volcan meute                      # plusieurs
npm run test:rules -- geants --test-name-pattern=Kraken # les tests d'un thème dont le nom contient « Kraken »
npm run test:rules -- monde geants attaques --seeds=1,42,777 # thèmes ciblés, sur trois graines
```

Les options de `node:test` passent telles quelles, écrites avec `=`. `--seeds=1,42,777` relance les seuls thèmes demandés
avec chacune des graines : utile pour vérifier les tests sensibles au relief sans multiplier toute la suite.

## Les thèmes (`tests/rules/`)

Un fichier par thème du jeu. Une règle nouvelle ou modifiée va dans le fichier de son thème ; on n'en crée un nouveau
que pour un thème nouveau.

| Fichier | Thème |
|---|---|
| `monde` | la carte : génération, espèces par zone, obstacles, recherche de chemin, portes, brume |
| `camera` | la caméra souple du client : zone morte, suivi, regard vers l'avant, téléportation |
| `combat` | le combat des dompteurs : attaque, classes, mort, régénération, relever un coéquipier |
| `meute` | la meute : apprivoisement, rappel, essences, sauvegarde, montures |
| `alphas` | les Alphas de la Tanière : éveil, renfort, équipement, bonus de collection, retour après une chute |
| `capacites` | les capacités de spécialisation |
| `statuts` | les effets d'état (bonus, malus) |
| `faune` | la faune sauvage : tireurs, gibier, baies, bestiaire |
| `geants` | les géants et leurs grottes |
| `attaques` | les attaques propres de chaque géant |
| `volcan` | le volcan et ses entrailles |
| `iles` | les îlots du large |
| `kraken` | la haute mer et le Kraken |
| `meteo` | jour, nuit, météo, saisons et affinités |
| `village` | le village : parchemins, forge, camps, bâtiments, marché, Hôtel de ville, récolte |
| `ecole` | l'École des dompteurs |
| `retours` | essences des géants, noms des Alphas, combats signalés |
| `divers` | les petites règles sans thème propre |
| `reseau` | l'envoi différentiel des snapshots et des événements |
| `http` | le serveur HTTP (fichiers statiques, URL malformées) |
| `triche` | l'écran de triche du mode dev (F9) |
| `sprites`, `tint` | des fonctions pures du rendu (robes, couleurs) |

## Écrire un test

Les outils communs sont dans [helpers.ts](helpers.ts) :

- `rule(nom, fn)` : un test. Le **nom est une phrase** qui dit la règle attendue (« Le géant regagne toute sa vie quand
  le combat est perdu »). Avant chaque test, le hasard et l'horloge repartent de zéro : un test donne le même résultat
  seul ou avec les autres, en local comme en CI.
- `check(condition, libellé)` : une vérification. Le **libellé dit ce qui est attendu et ce qui a été mesuré**
  (`` `PV du géant : ${boss.hp} / ${boss.maxHp}` ``), pour comprendre un échec sans relancer.
- `room()` : un village de test, tous bâtiments construits, toutes grottes ouvertes, tous géants vaincus. Pour un autre
  état de départ : `new Room('TEST', undefined, { … })`.
- `noop` : le `send` d'un joueur dont on n'écoute pas les messages.

## Déterminisme et cache de cartes

- **Hasard et horloge figés** : `Math.random` suit une graine (`TEST_SEED`, 1 par défaut) et `Date.now` est fixé à
  midi (`TEST_NOW`). Un test qui veut la nuit ou un orage avance `Date.now` lui-même.
- **Une seule île** : tous les villages de `room()` sont sur la même île, quelle que soit leur place dans le test. Un
  test qui a besoin d'une île précise passe sa graine à `new Room`.
- **Cache de cartes** : générer une île prend plusieurs secondes. `tests/helpers.ts` remplace `Room.makeMap` par un
  cache par graine qui donne à chaque village une **copie profonde** (`WorldMap.clone`) : un arbre abattu, un filon
  épuisé ou une palissade construite dans un test n'existe pas dans le suivant. Conséquence pour le code : tout état
  ajouté à `WorldMap` doit rester une donnée (nombre, tableau, `Set`, `Map`, objet simple), jamais une fonction stockée
  dans un champ, sinon `structuredClone` échoue.
- **Un test ne doit pas dépendre du relief par hasard** : s'il ne passe que parce qu'un obstacle se trouve (ou non) à
  tel endroit de l'île, il cassera avec une autre graine. Le vérifier avec deux ou trois `TEST_SEED` différentes, et
  placer les acteurs dans un endroit dégagé (voir `open()` dans `geants.test.ts`).
