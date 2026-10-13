# Fangleaf — Plan du MVP

Jeu coop top-down façon *Wild Tamer* : on se balade sur une carte, on tue des monstres,
on les apprivoise, on mène une meute. Jusqu'à 3 joueurs par village.

Maquettes : canvas design « Fangleaf — Game Design » (lobby, HUD, forge, bestiaire).

---

## 1. Périmètre du MVP

| Pilier | Inclus dans le MVP | Plus tard |
|---|---|---|
| Déplacement | ZQSD / WASD / flèches (positions physiques, marche en AZERTY et QWERTY) | Joystick tactile mobile |
| Combat | Attaque auto du joueur sur l'ennemi le plus proche ; la meute engage seule, mais lâche tout et revient si le dompteur s'éloigne à plus de 320 px | Compétences actives |
| Apprivoisement | 25 % de chance à chaque kill (50 % des stats de la version sauvage), meute max 12 | Objets d'apprivoisement, rareté |
| Alpha | Aucun Alpha sauvage. À la Tanière, on lance l'éveil de l'Alpha d'une espèce avec 15 essences (30 s × zone de l'espèce, il continue hors ligne) (35 % de chance d'en obtenir une par monstre de l'espèce vaincu à proximité), puis on le renforce (10, 16, 26, 41, 66… essences : ×1,6 par niveau). Un Alpha par espèce, hors limite de meute ; il ressuscite après 10 + 8 × zone s | Alphas uniques nommés, boss de zone |
| Progression | Or par kill → forge : arme (dégâts) et armure (PV max + réduction) séparées, 11 niveaux chacune. Essences par kill → Tanière : éveiller puis renforcer chaque Alpha (×1,25 PV/dégâts par niveau) | Arbre d'équipement, niveaux de monstres |
| Mort | La meute ordinaire se disperse, seuls les Alphas restent | |
| Village | Zone sûre, éloignée du point d'arrivée : seule zone de soins (aucune régénération dehors), forge, tanière des Alphas, réapparition après une mort | Bâtiments à construire, stockage |
| Coop | Villages à code (6 lettres), 3 places, lien d'invitation, or et essences partagés à proximité | Comptes, amis, matchmaking public |
| Monde | Carte 12000×12000 générée par graine pour chaque village : camp de départ, village à 800–1100 px dans une direction aléatoire (chemin de terre jusqu'à sa porte), zones de danger irrégulières autour du camp, lacs infranchissables, bois denses et clairières. 2 espèces par zone (8 au total) | Biomes, donjons, cycle jour/nuit |
| Persistance | Compte Google obligatoire (Supabase). Villages persistants (code + graine de la carte). Progression (or, arme, armure, essences, Alphas) par compte ET par village : un autre village = repartir de zéro | Sauvegarde des villages |

### Chiffres d'équilibrage (fichier unique `shared/config.ts`)

| Espèce | Zone | PV | Dégâts | Vitesse | Or | Rôle |
|---|---|---|---|---|---|---|
| Gluant | 1 Lisière | 25 | 2 | lent | 2 | proie de départ |
| Sporelin | 1 | 18 | 3 | rapide | 2 | fragile, en groupe |
| Loup | 2 Bois profonds | 70 | 9 | rapide | 5 | meute |
| Araignée sylvestre | 2 | 55 | 11 | très rapide | 5 | frappe fort, encaisse peu |
| Sanglier | 3 Landes | 180 | 18 | moyen | 10 | charge lourde |
| Ours des fourrés | 3 | 240 | 15 | lent | 12 | tank |
| Golem de mousse | 4 Ruines moussues | 450 | 32 | très lent | 20 | mur |
| Feu follet | 4 | 300 | 40 | moyen, flotte | 22 | le plus dangereux |

Joueur : 60 PV et 10 dégâts au départ.
Arme niveau n : dégâts = (10 + 4n) × 0,75, coût = 25 × 1,6ⁿ. Armure niveau n : PV max = 60 + 20n, réduction = 3n %, coût = 20 × 1,6ⁿ.
Alpha : ×2,5 PV et dégâts du monstre de base, taille ×1,6 ; éveil = 15 essences, renforcement niveau n → n+1 = 10 × 1,6ⁿ essences ; +25 % PV/dégâts par niveau.

---|---|---|---|---|---|
| Gluant | 450–1100 | 30 | 4 | lent | 2 |
| Loup | 1100–1650 | 55 | 8 | rapide | 4 |
| Sanglier | 1650–2100 | 110 | 12 | moyen | 7 |
| Golem de mousse | 2100+ | 240 | 18 | très lent | 12 |

Alpha : ×4 PV, ×2 dégâts, taille ×1,6, or ×5.
Armure niveau n : PV max = 100 + 25n, réduction = 4n %, coût = 20 × 1,6ⁿ.

---

## 2. Évaluation du stack

### Contraintes
- Coop en ligne à 3, « inviter des copains » → il faut un serveur et un partage de lien sans friction.
- MVP rapide à itérer, jouable dans le navigateur (zéro install pour les amis).
- Des centaines d'unités (meutes de 3 joueurs + monstres sauvages).

### Options étudiées

| Option | Pour | Contre | Verdict |
|---|---|---|---|
| **Godot 4** (GDScript + ENet / WebRTC) | Éditeur complet, export natif + web | Export web lourd, multijoueur web via WebRTC/relay pénible, itération moins rapide sans assets | Bon choix si on vise Steam/mobile natif plus tard |
| **Unity + Netcode** | Écosystème énorme | Lourd pour un MVP 2D, build web lent, licence | Non |
| **Phaser 4 + Colyseus** | Moteur 2D mature, rooms/matchmaking prêts | Deux frameworks à apprendre ; l'état synchronisé de Colyseus impose son modèle | Bonne option d'évolution |
| **TypeScript partout : Canvas 2D + Node `ws`** | Une seule langue client/serveur, types partagés, aucune magie, < 3 dépendances runtime, rendu procédural sans assets | On écrit soi-même interpolation, salons, culling | **Retenu pour le MVP** |

### Stack retenu
- **Langage** : TypeScript partout (`shared/` importé par le client et le serveur : règles, espèces, protocole).
- **Client** : Vite + Canvas 2D (rendu procédural, pas d'assets) + HUD en HTML/CSS (plus simple à styler et accessible).
- **Serveur** : Node 24 + `ws`, **serveur autoritaire** pour tout ce qui compte (IA, dégâts, or, apprivoisement, forge) à 20 ticks/s. Le déplacement du joueur est envoyé par le client (contrôles instantanés) puis borné par le serveur : acceptable en coop entre amis.
- **Réseau** : snapshots JSON à 20 Hz, filtrés par distance (rayon de vue), interpolation côté client avec 100 ms de retard.
- **Déploiement** : un seul process Node sert le build statique et le WebSocket sur le même port (Fly.io, Railway, un VPS…).

Chemin d'évolution : passer le rendu sur Phaser/Pixi quand arrivent de vrais sprites, encoder les snapshots en binaire si la bande passante devient un sujet, ajouter une base (SQLite/Postgres) pour la persistance.

---

## 3. Architecture

```
shared/   config.ts (équilibrage, espèces)   protocol.ts (messages)   worldmap.ts (génération de la carte)   math.ts (bruit)
server/   index.ts (HTTP + WS + salons)      room.ts (simulation d'un village)   grid.ts (hash spatial)
client/   index.html  src/main.ts (lobby, boucle)  net.ts  world.ts (terrain)  render.ts  hud.ts  input.ts
scripts/  smoke.ts (test bot : création, 3 joueurs, 4e refusé, snapshots)
```

Flux : le client envoie `create` / `join` → le serveur répond `welcome` (id, code, graine de carte) →
le client envoie sa position 20×/s → le serveur simule et renvoie un snapshot 20×/s
(joueurs, unités visibles, événements : coups, morts, apprivoisements, éveil d'Alpha).

---

## 4. Étapes

1. ✅ Maquettes (lobby, HUD, forge, bestiaire) et direction visuelle « Mousse au crépuscule ».
2. ✅ Squelette monorepo, protocole partagé, serveur de salons (code, 3 places, lien d'invitation).
3. ✅ Simulation : spawn par zones, IA sauvage (errance, aggro, laisse), IA de meute (formation, engagement), combat.
4. ✅ Apprivoisement, traque partagée, Alpha qui ressuscite, or, mort / réapparition, village (soins, forge).
5. ✅ Client : terrain procédural, rendu des unités, interpolation, effets, HUD, minicarte, forge.
6. ✅ Test bot multi-clients (`npm run smoke`) + test manuel navigateur à 2 joueurs, triche de dev F9.
7. ✅ Itération 2 : forge arme/armure, tanière des Alphas + essences, dispersion de la meute à la mort, rappel de la meute, pas de régénération dehors, rééquilibrage, comptes Google + sauvegarde Supabase.
8. ✅ Itération 3 : compte obligatoire, nouveau lobby animé, contours et anneaux ennemis, sanglier à cornes, Alphas uniquement éveillés à la Tanière (plus de traque ni d'Alpha sauvage).
9. ✅ Itération 4 : 4 nouvelles espèces (Sporelin, Araignée, Ours, Feu follet), sanglier à défenses, page bestiaire de dev (`/bestiary.html`).
10. ✅ Itération 5 : carte aléatoire 8000×8000 (shared/worldmap.ts), camp de départ séparé du village, lacs et collisions, minicarte générée.
11. ✅ Itération 6 : brouillard de guerre partagé par le groupe (minicarte, grande carte M, monde), montures (Alphas Loup ×1,6, Sanglier ×1,4, Ours ×1,25 ; la monture encaisse 75 % des coups et mord aussi).
12. ✅ Itération 7 : villages persistants, progression par (compte, village), lobby « Rejoindre le village », annonces de lieu (camp, village, zones), dégâts du héros −25 %, résurrection des Alphas selon la force de leur espèce (10 + 8 × zone s : 18, 26, 34, 42 s).
13. ✅ Itération 8 : monstres sauvages qui récupèrent hors combat (8 %/s après 4 s sans coup), zones ×1,5 dans un monde 12000×12000 (~630 monstres).
14. ✅ Itération 9 : village découvert = apparition au village ; filons d'or à miner (réapparaissent en 3 min) ; 4 grottes avec mini-boss (réapparition 5 min, âme 35 % → Alpha légendaire) ; bonus de collection +10 % par Alpha éveillé.
15. ✅ Itération 10 : 8 grottes (deux par zone, un géant par espèce) avec attaques spéciales annoncées au sol (bond, division, spores, renforts, charge, toiles, onde de choc, rage, rochers, clignement) ; l'âme d'un géant rend légendaire l'Alpha de son espèce (×1,5).
16. ✅ Itération 11 : classes à la forge (guerrier : corps à corps, +25 % PV ; archer : tir à 300 px ; mage : orbe à zone), premier choix gratuit puis 50 or ; évolution légendaire à 3 âmes.
17. ✅ Itération 12 : monstres apprivoisés à 50 % des stats sauvages ; arbres, rochers, filons, palissade (4 portes), bâtiments, tentes et grottes solides (grille partagée client/serveur) ; les membres de meute coincés rejoignent leur dompteur.
18. ✅ Itération 13 : meute ordinaire sauvegardée (migration 005) ; lobby sans flash « fonder un village » ; raccourcis par lettre tapée (M en AZERTY) ; recherche de chemin A* pour la meute et les poursuites.
19. ✅ Itération 14 : Échap → confirmation de retour au lobby ; ennemis ciblent le plus proche ; dégâts affichés à 2 décimales ; 5 Alphas équipés au maximum, les autres au repos à la Tanière (comptent pour la collection).
20. ✅ Itération 15 : la carte devient un long couloir sinueux (20 000 px) qui part du bord haut, droit ou bas, bordé de forêt infranchissable ; 4 zones successives le long d'une piste ; au bout de la zone 4, un emplacement de camp que le village établit pour 500 or (feu qui soigne, réapparition, Pierre de passage) ; Pierres de passage au village et dans chaque camp pour voyager avec sa meute (migration 006 : `villages.camps`) ; populations ramenées à ~300 monstres pour garder une densité proche de l'ancienne carte.
21. ✅ Itération 16 : zone 5 « Lacs brumeux » après le Camp avancé (couloir de 25 000 px, ~35 % d'eau) ; premiers tireurs : Guetteur runique (zone 4, trait runique lent), Crapaud-mortier (tir en cloche annoncé au sol), Serpent des brumes (nage dans les lacs, jet d'eau rapide) ; Crabe des berges (tank de mêlée). Tirs esquivables : charge visible, projectiles simulés par le serveur ; apprivoisés, les tireurs tirent pour la meute. Géants de ces espèces à venir.
22. ✅ Itération 17 : géants des nouvelles espèces — Œil des Ruines (zone 4, salve de traits runiques, renforts), Crapaud-Roi (pluie de mortiers, bond), Hydre des brumes (salve de jets, onde de choc), Crabe Titan (charge, onde de choc, rage) ; 12 grottes (2-2-2-3-3) ; bestiaire dans la Tanière (onglet), rempli par les espèces croisées, sauvegardé (migration 007 : `progress.seen`), sans les géants.
23. Prochaines itérations : mobile/tactile, persistance, plus d'espèces et de biomes, sons, sprites.
