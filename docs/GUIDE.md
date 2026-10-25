# Fangleaf — Guide du jeu

Comment se joue Fangleaf, thème par thème. Les prix, pourcentages et durées ne sont pas recopiés ici :
ils sont affichés dans le jeu et définis dans [`shared/config.ts`](../shared/config.ts).

- [Contrôles](#contrôles)
- [Premiers pas](#premiers-pas)
- [L'île et ses zones](#lîle-et-ses-zones)
- [Combat](#combat)
- [Meute, apprivoisement et montures](#meute-apprivoisement-et-montures)
- [Alphas et Tanière](#alphas-et-tanière)
- [Récolte, baies et gibier](#récolte-baies-et-gibier)
- [Village et bâtiments](#village-et-bâtiments)
- [Camps et voyages](#camps-et-voyages)
- [Grottes et géants](#grottes-et-géants)
- [Le volcan et le cœur volcanique](#le-volcan-et-le-cœur-volcanique)
- [Le vieil homme et le bateau](#le-vieil-homme-et-le-bateau)
- [La haute mer et le Kraken](#la-haute-mer-et-le-kraken)
- [Jour, nuit et météo](#jour-nuit-et-météo)
- [Jouer à plusieurs](#jouer-à-plusieurs)

## Contrôles

| Action | PC (touches réglables : Échap › Paramètres) | Au doigt |
|---|---|---|
| Se déplacer | ZQSD / WASD / flèches, ou glisser à la souris | Glisser |
| Attaquer | Automatique, ou clic gauche vers le pointeur (au choix) | Automatique |
| Interagir (bâtiment, grotte, buisson, coffre…) | E | Bouton d'action |
| Tendre un fruit | T | Bouton à baies |
| Monter / descendre de sa monture | F | Bouton selle |
| Relever un coéquipier | R maintenu | Bouton maintenu |
| Grande carte | M, ou clic sur la minicarte | Toucher la minicarte |
| Chat | C | Bouton 💬 |
| Menu, fermer un panneau | Échap | Bouton ☰ |

## Premiers pas

On se réveille sur une plage inconnue, sans arme. Une épée est plantée dans le sable tout près : il faut tirer
plusieurs fois dessus (**E**) pour la déterrer, et on ne peut pas se battre avant. Un chemin de cailloux mène de
la plage à un **pont de bois** : il traverse un bras de mer jusqu'à l'**îlot du village**, d'abord à l'état de camp
de fortune.

## L'île et ses zones

L'île est générée à partir d'une graine propre à chaque village : forme, côte, lacs, forêts et grottes changent
d'un village à l'autre. Les zones sont des bandes successives, de plus en plus dangereuses à mesure qu'on
s'éloigne de la plage :

1. **Lisière** : Gluants, Sporelins, Escargots des mousses.
2. **Bois profonds** : Loups, Araignées sylvestres ; Lucioles la nuit ; un arbre abattu réveille parfois un **Tréant**.
3. **Landes** : Sangliers, Ours des fourrés (ils chassent la nuit, dorment le jour), Lièvres des ronces.
4. **Ruines moussues** : Golems de mousse, Feux follets, Guetteurs runiques.
5. **Lacs brumeux** : Crapauds-mortiers, Serpents des brumes (dans l'eau), Crabes des berges.
6. **Mer de sable**, la plus grande : Suricates, Vers des sables, Vautours ; Chacals fantômes la nuit ; tempêtes de sable. Un grand volcan s'y dresse.
7. **Entrailles du volcan**, sous la Mer de sable : Salamandres de braise, Chauves-souris de cendre, Tortues-volcans (elles crachent de la lave en cloche) (voir [Le volcan](#le-volcan-et-le-cœur-volcanique)).

Une **brume** couvre tout ce qui se trouve au-delà de la première porte fermée : rien n'y apparaît. Pour ouvrir
la zone suivante, il faut à la fois l'**Hôtel de ville** au bon niveau et avoir vaincu **tous les géants** de la
zone (une fois suffit, pour tout le village). Pour la Mer de sable, il faut en plus avoir rapporté au vieil homme
les parchemins des géants des Lacs brumeux. On peut toujours revenir en arrière.

La minicarte (et la grande carte, **M**) se dévoile au fil de l'exploration, pour tout le village.

## Combat

- L'attaque est **automatique** sur l'ennemi le plus proche à portée. Sur PC, on peut passer à l'**attaque au clic**
  (Échap › Paramètres) : on frappe alors le monstre visé.
- **Classes**, choisies à la forge (le premier choix est gratuit, les suivants payants) :
  **Guerrier** (corps à corps, plus de PV), **Archer** (tir de loin), **Mage** (orbe qui touche aussi autour de la cible).
- **Spécialisations** : au-delà d'un certain niveau d'arme, la **Grande forge** permet de spécialiser sa classe :
  Berserker ou Gardien (guerrier), Tireur d'élite ou Rôdeur (archer), Pyromancien ou Druide (mage).
- La forge améliore séparément l'**arme** (dégâts) et l'**armure** (PV max et réduction des dégâts), ainsi que la
  **torche** (rayon de lumière la nuit), les **bottes** (vitesse) et la **selle** (vitesse des montures). Chaque
  amélioration coûte de l'or et du **bois** : celui du sac d'abord, puis celui de l'entrepôt du village.
- **Tireurs** (Guetteur, Crapaud-mortier, Serpent) : ils s'immobilisent pour charger leur tir. On s'écarte de la
  trajectoire, ou on sort du cercle annoncé au sol.
- **Hors du village** (et des camps établis), on ne régénère pas. Les monstres sauvages, eux, récupèrent si on
  cesse de les frapper.
- **Mort** : on perd une part de son or, la meute ordinaire se disperse, les Alphas restent. On réapparaît au
  village ou au dernier camp établi qu'on a dépassé.
- **Relever** un coéquipier à terre : **R maintenu** près de lui, pendant le court délai où il reste au sol.

## Meute, apprivoisement et montures

- Un monstre vaincu a une chance de rejoindre sa **meute**. Apprivoisé, il est moins fort que sa version sauvage.
  La meute suit son dompteur et combat seule ; trop loin, elle lâche sa cible et revient.
- La meute ordinaire est sauvegardée avec la progression, mais se disperse à la mort.
- Au village et dans les camps, la meute se promène librement autour de son dompteur.
- **Montures** (**F**) : certains Alphas se chevauchent (Loup, Sanglier, Ours, Escargot, Serpent, Vautour), à
  condition d'avoir une **selle** (achetée à la forge, plus rapide en l'améliorant). La monture encaisse une partie
  des coups ; si elle tombe, on est désarçonné.
  - Le **Serpent des brumes** ne va qu'en eau : on embarque près de l'eau, on descend au bord d'une rive, et
    s'il tombe en pleine eau, on se noie.
  - Le **Vautour** vole : il passe au-dessus de l'eau, des rochers et des arbres.
  - L'**Escargot** se monte… mais ralentit.

## Alphas et Tanière

- Il n'y a **pas d'Alpha sauvage**. Chaque monstre vaincu peut laisser une **essence** de son espèce ; avec assez
  d'essences, on **éveille** l'Alpha de cette espèce à la Tanière. L'éveil prend un moment, même hors ligne.
- Un Alpha par espèce, hors limite de meute. Tombé, il ressuscite après un délai (plus long pour les espèces fortes) ;
  pendant un combat de géant, ou si son dompteur est à terre, il attend la fin.
- On le **renforce** avec des essences, de plus en plus cher à chaque niveau, et un peu plus dans les zones lointaines.
- Seuls quelques Alphas sont **équipés** à la fois ; les autres se reposent à la Tanière.
- **Bonus de collection** : chaque Alpha éveillé renforce tous les autres.
- **Alphas à pouvoir** : le Lièvre soigne son dompteur et la meute proche. Le Suricate et l'Escargot ont une
  compétence, lancée seule au combat dès qu'elle est rechargée : le Suricate se dresse et crie (les alliés autour de lui
  frappent plus fort), l'Escargot dresse sa carapace (ils encaissent moins). Elle profite à tous les alliés proches,
  dompteurs et meutes, pendant quelques secondes : une épée et ses flèches, ou un bouclier, au-dessus de leur tête.
- **Alpha légendaire** : l'âme du géant d'une espèce (voir [Grottes et géants](#grottes-et-géants)) permet le
  **double éveil** de l'Alpha de cette espèce. Légendaire, il lance seul l'attaque spéciale de son géant.
- **Bestiaire** (onglet de la Tanière) : chaque espèce croisée y entre, avec ses stats et comment la combattre.
  On y choisit la forme montrée : sauvage, Alpha, légendaire, ou géant une fois vaincu.

## Récolte, baies et gibier

- **Récolte** : à côté d'un arbre (bois), d'un rocher (pierre) ou d'un filon (or et un peu de pierre), le dompteur
  sort sa hache ou sa pioche tout seul quand aucun monstre n'est à portée. Bois et pierre vont dans son sac :
  **E à l'entrepôt** du village pour les verser dans la réserve commune, qui paie les constructions.
- **Baies** : **E** près d'un buisson garni pour cueillir. **T** pour tendre un fruit ; fruit en main, on ne se bat plus.
- **Gibier passif** (Escargot, Lièvre, Luciole, Suricate) : il n'attaque jamais et vient manger aux buissons.
  Fruit tendu, il s'approche peu à peu, et chaque fruit mangé peut l'apprivoiser (bien plus rarement pour un
  monstre hostile). Mais il est craintif quand on arrive les mains vides :
  - l'**Escargot** rentre dans sa coquille, intouchable ;
  - le **Lièvre** détale ;
  - les **Suricates** courent se cacher dans leur tanière (devant un vautour aussi).

## Village et bâtiments

- Le village, sur son îlot relié à l'île par un pont de bois, est la zone sûre : on s'y soigne, on y réapparaît, et
  les monstres sauvages ne passent pas le pont. Sa palissade n'est pas ronde : large d'est en ouest, quatre portes.
- Au départ, ce n'est qu'un camp : on monte la **palissade**, puis on **défriche** chaque emplacement avant d'y
  bâtir. Chaque bâtiment se construit **une fois pour tout le village**, avec l'or de celui qui le paie et le bois
  et la pierre de la réserve commune :
  - **Forge** : classe, arme, armure, torche, bottes ; plus tard la **Grande forge** et ses spécialisations.
  - **Tanière** : Alphas et bestiaire.
  - **Marché** : vendre les monstres de sa meute, acheter ceux des espèces déjà croisées.
  - **Pierre de passage** : voyage instantané vers les camps établis.
- **Hôtel de ville** : en le construisant, on nomme le village (renommable ensuite). Chaque niveau débloque la
  suite (Marché, Pierre de passage, puis une porte de zone par niveau).
- **Tableau du village** : géants battus, monstres apprivoisés et dons à l'entrepôt de chaque membre.
- **École des dompteurs** : elle aussi au village, mais on ne la construit pas soi-même. Son plan dort dans un vieux
  coffre du **Camp avancé** : une fois le camp établi, **E** pour l'ouvrir (une fois pour tout le village). Aubin la
  bâtit ensuite contre de l'or, du bois et de la pierre, comme une étape du bateau ; le chantier prend un moment,
  même quand personne n'est là.

## Camps et voyages

- Un **emplacement de camp** attend au bout de la zone 4. Le village l'établit contre de l'or (un seul membre
  paie) : feu qui soigne, réapparition sur place, Pierre de passage.
- **E** devant une Pierre de passage : voyager d'un camp à l'autre avec sa meute.
- **École des dompteurs** (au village, voir plus haut ; son plan est au Camp avancé). Les coffres
  des géants cachent parfois un **livre d'apprentissage**, d'une discipline au hasard :
  **Meute** (une place de plus), **Apprivoisement**, **Essences** ou **Récolte** (meilleures chances, plus de bois et
  de pierre). Son tome dépend de la zone du géant (I : Lisière et Bois profonds ; II : Landes et Ruines moussues ;
  III : Lacs brumeux et Mer de sable). On n'a qu'**un exemplaire de chaque tome** : il enseigne une leçon de sa
  discipline, et les tomes se lisent dans l'ordre (trois leçons par discipline, soit trois places de meute en plus au
  total). À l'école, **E** pour lire une leçon : elle prend un moment (même hors ligne), une seule à la fois. Un coffre ne donne jamais un tome qu'on a déjà, ni un tome déjà lu.

## Grottes et géants

- Chaque espèce hostile a son **géant**, qui dort au fond d'une grotte. On **débloque** la grotte pour tout le village
  (de plus en plus cher selon la zone), puis on y entre avec sa meute (E à l'entrée, E à la sortie pour ressortir).
- **E** près du géant pour lui parler, puis on lance le combat. Ses PV dépendent du nombre de membres du village.
- Ses coups ordinaires ne touchent qu'une cible ; ses **attaques spéciales** frappent en zone et s'annoncent au sol
  (bond, onde de choc, charge, salves, renforts…) : il faut en sortir avant l'impact.
- L'**Œil des Ruines** tire des salves qui traversent la meute, et maintient un **rayon runique** qui tourne
  lentement autour de lui : on le contourne dans le sens opposé.
- Vaincu, il laisse un **coffre** (chacun l'ouvre une fois, pour un montant d'or aléatoire), parfois son **âme**, et
  la première fois, un **parchemin** pour le vieil homme. Il revient après un délai. Si tout le monde sort, il se
  rendort, guéri.

## Le volcan et le cœur volcanique

- Un grand volcan se dresse dans la Mer de sable. Sa bouche, à son pied, reste scellée par une croûte d'obsidienne
  tant que le village n'a pas vaincu les trois géants de la Mer de sable ; ensuite, **E** pour y descendre, de jour
  comme de nuit et par tous les temps.
- Les **entrailles du volcan** sont une grande salle souterraine (zone 7) : mares de lave infranchissables,
  créatures de lave, et trois antres de géants à débloquer comme les autres grottes.
- Au centre, l'**autel du cœur** : une flamme brûle par géant du volcan encore debout. Les trois vaincus, le cœur
  se libère : **E** sur l'autel pour le prendre, une fois pour tout le village. C'est la dernière étape du bateau
  (voir plus bas).
- Les géants du volcan ne laissent pas de parchemin pour le vieil homme.

## Le vieil homme et le bateau

- Près du feu du village, un vieil homme qui ne se souvient plus de rien (**E** pour lui parler).
- Chaque **parchemin** rapporté lui rend un souvenir de l'histoire de l'île, dans l'ordre.
- Tous ses souvenirs retrouvés, il reconstruit le **bateau** échoué au bout de l'île, en plusieurs étapes payées en
  or et avec la réserve du village. Une fois fini, une Pierre de passage y mène.
- Il lui manque encore son **cœur** : celui du volcan. On le pose dans la coque (**E** devant le bateau), et le
  bateau est prêt à prendre la mer, cap sur le Colisée.

## La haute mer et le Kraken

- **E** devant le bateau prêt : on prend la mer avec sa meute, et on se retrouve sur le pont, au large. À la poupe,
  **E** pour faire demi-tour et rentrer au port.
- Quelques secondes après qu'on est monté à bord, le **Kraken** surgit contre le flanc du bateau. Il ne quitte pas
  l'eau, mais ses coups de tentacule s'abattent sur tout le pont (couloirs annoncés), et ses tentacules s'agrippent
  au bastingage (ils ne rapportent rien, mais frappent ce qui passe à portée).
- **Trois phases** : chaque fois qu'on le vainc, il replonge, intouchable, file sous l'eau (ses bulles le trahissent)
  et resurgit ailleurs autour du bateau (bâbord, tribord ou devant la proue), avec toute sa vie et de
  nouvelles attaques (nuages d'encre qui ralentissent, pluie d'eau, plus de tentacules ; à la dernière, il frappe
  plus souvent).
- Tant qu'il n'est pas vaincu, on ne va pas plus loin. Vaincu, il laisse un coffre, et la route du Colisée est libre
  (le Colisée arrive bientôt). S'il ne reste plus personne à bord, il replonge, guéri.

## Jour, nuit et météo

- Le ciel suit l'heure du serveur : tout le village voit la même nuit et la même averse.
- **Nuit** : certains monstres dorment (le Lièvre), d'autres se réveillent (l'Ours), d'autres n'apparaissent
  qu'alors (Lucioles, Chacals fantômes). La torche éclaire autour du dompteur.
- **Pluie** : l'Escargot l'adore, il va plus vite.
- **Tempête de sable** (Mer de sable) : elle blesse ceux qui restent dehors ; les vers restent sous le sable, les
  vautours très haut, les suricates cachés.
- **Cactus** (Mer de sable) : s'y frotter pique. Les palmiers de la lisière verte, eux, ne piquent pas.

## Jouer à plusieurs

- Jusqu'à **4 dompteurs** par village. **Menu › Inviter des amis** copie le lien d'invitation (`?v=CODE`).
- La progression est rattachée au **compte dans un village** : un autre village, c'est repartir de zéro. Un compte
  a au plus 3 villages, listés dans le lobby.
- L'or et les essences des monstres vaincus se partagent entre dompteurs proches.
- Un membre **déconnecté** dort près du feu du village, sa meute autour de lui.
- **Chat** : **C** ou le bouton 💬 ; chaque message s'affiche aussi dans une bulle au-dessus de son auteur.
- Le **fondateur** peut expulser (et réintégrer) un membre, et supprimer le village.
