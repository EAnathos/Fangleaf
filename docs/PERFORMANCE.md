# Performance : références et détection des régressions

Le serveur fait tourner **tous les villages dans un seul process Node**, à `TICK_HZ` ticks par seconde
(`shared/config.ts`). Un tick lent ne ralentit pas qu'un village : il retarde tous les autres. Ce document dit ce qu'on
mesure, sur quels scénarios, avec quels seuils, et ce qu'on vérifie avant de fusionner.

## Ce qu'on mesure

`npm run bench` ([scripts/bench.ts](../scripts/bench.ts)) simule des villages sans réseau, avec le hasard et l'horloge
figés (comme les tests de règles), et mesure :

| Mesure | Pourquoi | Dépend de la machine |
|---|---|---|
| **Génération de l'île** (ms) | Son coût brut, mesuré sur le fil principal | oui |
| **Blocage pendant une génération** (ms) | La plus longue attente de la boucle des villages pendant qu'une île se génère dans le worker ; la mémoire ajoutée au pic est affichée | oui |
| **Tick** : moyenne, p95, p99, max (ms) | Le budget d'un tick est `1000 / TICK_HZ` ms pour tout le process | oui |
| **Snapshots** (octets par joueur et par seconde) | La bande passante de chaque joueur, sérialisée en JSON comme sur le WebSocket | **non** : identique d'une machine à l'autre |

Les 100 premiers ticks (mise en place) ne sont pas comptés ; la mesure porte ensuite sur 1200 ticks, une minute de jeu.

## Scénarios

| Clé | Situation | Ce qu'il fait ressortir |
|---|---|---|
| `solo` | 1 joueur seul, sans meute, sur la plage | le coût de base d'un village (faune sauvage, météo, apparitions) |
| `coop` | 4 joueurs dispersés sur l'île, meutes pleines (`ARMY_CAP`) | l'IA des meutes et l'envoi à 4 vues différentes |
| `bataille` | 4 joueurs au même endroit, meutes pleines, 60 monstres sauvages autour | le combat de masse, le pire cas courant |

Dans les scénarios ordinaires, les joueurs tournent lentement autour de leur point de départ (leur vue change, comme en jeu) et ne meurent pas. Dans `geant`, ils restent dans l'arène pour maintenir le combat ; le géant est réveillé et le groupe lui inflige périodiquement des dégâts.

## Seuils

Définis en tête de [scripts/bench.ts](../scripts/bench.ts) (`THRESHOLDS`) :

- **p95 du tick** : au plus **+25 %** par rapport à la référence. Un écart de moins de 0,5 ms n'est jamais compté
  (bruit de mesure).
- **Snapshots** : au plus **+10 %**. La mesure est déterministe : tout écart vient du code.
- **Génération de l'île** : au plus +25 %, avec un plancher de 100 ms.
- **Blocage pendant une génération** : au plus 250 ms dans tous les cas (`mapBlockMs`). Au-delà, les autres villages
  sentiraient le chargement d'une île.
- **Budget absolu** : un p99 au-delà de la moitié du budget d'un tick est signalé dans tous les cas.

`npm run bench -- --against <fichier>` affiche ✔ ou ✘ pour chaque mesure et sort en erreur (code 1) au-delà d'un seuil.

## Référence

[bench/reference.json](../bench/reference.json) : mesures de `dev` au 11/11/2026 (Windows, Node 22, portable de
développement).

| Scénario | Tick moyen | p95 | p99 | Snapshots par joueur |
|---|---|---|---|---|
| `solo` | 2,3 ms | 4,3 ms | 5,8 ms | 26,1 Ko/s |
| `coop` | 5,0 ms | 8,2 ms | 11,7 ms | 31,7 Ko/s |
| `bataille` | 4,1 ms | 6,6 ms | 8,3 ms | 41,2 Ko/s |

Génération de l'île : environ 2,8 s.

Les temps de ce fichier ne valent que pour la machine qui les a produits : pour comparer des temps, on mesure
toujours **avant et après sur la même machine** (procédure ci-dessous). Les octets de snapshot, eux, se comparent
directement à la référence. On la met à jour (`npm run bench -- --save bench/reference.json`) quand un changement
voulu déplace durablement les chiffres, en le disant dans la PR.

## Avant de fusionner

**Quand** : toute PR qui touche la simulation ou le réseau : `server/room.ts`, `server/grid.ts`, `shared/worldmap.ts`,
`shared/snapshot.ts`, `shared/protocol.ts`, ou qui ajoute des unités, des effets ou des champs envoyés aux joueurs.

1. Sur `dev` à jour, enregistrer la mesure de départ :
   ```bash
   git switch dev && npm run bench -- --save .bench/avant.json
   ```
2. Sur la branche, comparer :
   ```bash
   git switch ma-branche && npm run bench -- --against .bench/avant.json
   ```
3. Coller la sortie de la comparaison dans la description de la PR.
4. En cas de ✘ : relancer une fois (une autre application peut avoir pris le processeur). Si le ✘ persiste, corriger,
   ou expliquer dans la PR pourquoi le coût est accepté (et mettre à jour la référence si c'est durable).

Pour aller plus vite pendant le travail : `npm run bench -- --only bataille --ticks 400`. Le scénario `geant` est nouveau et n'a pas encore de mesure dans la référence historique : le lancer sur la même machine avant/après pour établir sa comparaison.

`.bench/` est ignoré par git : les mesures locales n'y sont jamais commitées.

## Points chauds connus

- **Génération de l'île** : plusieurs secondes de calcul. Elle se fait dans un worker ([server/mapgen.ts](../server/mapgen.ts)) :
  le fil principal ne fait que recevoir l'île (ses tableaux sont transférés, pas copiés), et les autres villages
  continuent de tourner. Un seul worker génère une île à la fois : processeur et mémoire restent bornés quand
  plusieurs villages se chargent ensemble (ils attendent leur tour, deux joueurs qui rouvrent le même village attendent
  la même île). Un cache des îles de villages fermés n'a pas été retenu : il ne sert qu'aux réouvertures (pas aux
  créations), garde en mémoire une île entière par village fermé, et le worker suffit à supprimer le blocage.
  Coût du worker : la première île est plus lente (démarrage du worker et chargement de TypeScript) et la mémoire
  du process monte d'environ 100 Mo au pic pendant une génération (mesuré par `npm run bench`).
- **Les tests de règles** construisaient une île par village de test : c'était l'essentiel de leur durée. Ils
  utilisent désormais un cache par graine (`tests/helpers.ts`), voir [tests/README.md](../tests/README.md).
