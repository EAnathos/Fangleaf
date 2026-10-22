# Fangleaf — Architecture

Jeu coop top-down façon *Wild Tamer*, jusqu'à 4 joueurs par village, dans le navigateur.
Les règles et l'équilibrage (espèces, coûts, zones…) sont dans `shared/config.ts` : ce document n'en recopie aucun chiffre.

## Choix du stack

Contraintes de départ : coop en ligne entre amis (un lien d'invitation, rien à installer), itération rapide,
des centaines d'unités à simuler (meutes de 4 joueurs et monstres sauvages).

| Option | Pour | Contre | Verdict |
|---|---|---|---|
| Godot 4 (GDScript + ENet / WebRTC) | Éditeur complet, export natif et web | Export web lourd, multijoueur web via WebRTC/relais pénible | Si un jour on vise Steam ou le mobile natif |
| Unity + Netcode | Écosystème énorme | Lourd pour de la 2D, build web lent, licence | Non |
| Phaser + Colyseus | Moteur 2D mature, salons prêts | Deux frameworks ; l'état synchronisé de Colyseus impose son modèle | Piste d'évolution |
| **TypeScript partout : Canvas 2D + Node `ws`** | Une seule langue, types partagés client/serveur, peu de dépendances, rendu procédural sans assets | Interpolation, salons et filtrage par distance écrits à la main | **Retenu** |

- **Langage** : TypeScript partout. `shared/` est importé tel quel par le client et le serveur.
- **Client** : Vite, Canvas 2D (sprites, terrain, effets, ciel : tout est dessiné, aucune image), HUD en HTML/CSS, son et musique synthétisés (Web Audio).
- **Serveur** : Node 24 + `ws`, **autoritaire** pour tout ce qui compte (IA, dégâts, or, apprivoisement, achats) à 20 ticks/s.
  Le déplacement du joueur vient du client (contrôles instantanés) et le serveur le borne à la vitesse maximale : suffisant en coop entre amis.
- **Persistance** : Supabase (Postgres + connexion Google). Le serveur est le seul à écrire, avec la clé `service_role`.
- **Déploiement** : un seul process Node sert le build statique et le WebSocket (VPS derrière nginx).

Pistes d'évolution : Pixi ou Phaser pour le rendu si de vrais sprites arrivent, snapshots binaires si la bande passante devient un sujet.

## Arborescence

```
shared/    config.ts      règles et équilibrage (espèces, coûts, zones, bâtiments)
           worldmap.ts    l'île générée par graine : zones, lacs, grottes, obstacles, chemins
           protocol.ts    messages du WebSocket
           snapshot.ts    envoi différentiel des snapshots (même règle des deux côtés)
           weather.ts     jour, nuit, averses et tempêtes, tirés de l'heure et de la graine du village
           math.ts        bruit, hasard à graine
server/    index.ts       HTTP (build statique en prod), WebSocket /ws, salons, boucle de simulation
           room.ts        simulation d'un village : IA, combat, meutes, géants, économie
           grid.ts        hash spatial (voisinage sans O(n²))
           persist.ts     sauvegarde Supabase : villages et progression par (compte, village)
client/    index.html     lobby, HUD et panneaux
           og.html        page de dev qui produit l'aperçu des liens (public/og.jpg)
           src/main.ts    lobby : créer ou rejoindre un village
           src/game.ts    boucle de jeu : prédiction locale, rendu, événements
           src/net.ts     WebSocket et interpolation
           src/hud.ts     HUD et panneaux (forge, Tanière, marché, Hôtel de ville…)
           src/world.ts, sprites.ts, caves.ts, fx.ts, anim.ts, sky.ts, fog.ts   rendu
           src/audio.ts, music.ts, sfx.ts                                      son
supabase/  migrations SQL (npm run db:migrate)
tests/     tests de règles par thème (tests/rules/*.test.ts) et leurs outils (helpers.ts)
scripts/   test de fumée multi-clients (smoke.ts), migrations
deploy/    service systemd, nginx, script de déploiement (lancé par .github/workflows/cd.yml)
```

## Flux réseau

1. Le client envoie `create` (fonder un village) ou `join` (rejoindre par son code), avec son jeton de session Supabase ; le serveur répond `welcome` : id du joueur, code, graine de la carte.
   Le client génère la même île que le serveur à partir de la graine : la carte ne passe jamais sur le réseau.
2. Le client envoie sa position 20 fois par seconde, et ses actions (interagir, acheter, tendre un fruit…) quand elles arrivent.
3. Le serveur simule le village à 20 ticks/s et envoie à chaque joueur un snapshot par tick :
   - **filtré par distance** : seules les unités dans son rayon de vue ;
   - **différentiel** : seulement ce qui a changé depuis le dernier envoi, plus la liste des unités sorties de la vue (`shared/snapshot.ts`) ;
   - **avec les événements** du tick (coups, morts, apprivoisements, attaques annoncées…), filtrés eux aussi : un coup porté loin d'un joueur ne lui est pas envoyé.
4. Le client reconstitue l'état complet, affiche les autres avec 100 ms de retard (interpolation) et son propre dompteur sans retard (prédiction).

Le ciel (jour, nuit, météo) n'est pas transmis : client et serveur le calculent chacun à partir de l'heure et de la graine.

## Tests

- `npm run test:rules` : la simulation sans réseau, un fichier par thème, hasard et horloge figés (même résultat en local et en CI).
- `npm run smoke` : le vrai serveur et 4 bots WebSocket, de la création du village jusqu'à sa suppression.

La CI (`.github/workflows/ci.yml`) lance le typecheck, les deux tests et le build ; le déploiement suit quand elle passe.
