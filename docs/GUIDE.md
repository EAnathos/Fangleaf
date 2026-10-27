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
la plage à un **pont de bois** qui traverse un bras de mer jusqu'à l'**îlot du village**. Le pont est cassé : on le
répare (**E** à son pied) avec le bois et la pierre de son sac, ramassés sur la plage et alentour. De l'autre côté,
le village n'est encore qu'un camp de fortune ; tant que le pont n'est pas réparé, on se réveille sur la plage.

## L'île et ses zones

L'île est générée à partir d'une graine propre à chaque village : forme, côte, lacs, forêts et grottes changent
d'un village à l'autre. Les zones sont des bandes successives, de plus en plus dangereuses à mesure qu'on
s'éloigne de la plage (à partir des Ruines moussues, les zones sont deux fois plus grandes, et plus peuplées) :

1. **Lisière** : Gluants, Sporelins, Escargots des mousses.
2. **Bois profonds** : Loups, Araignées sylvestres ; Lucioles la nuit ; un arbre abattu réveille parfois un **Tréant**.
3. **Landes** : Sangliers, Ours des fourrés (ils chassent la nuit, dorment le jour), Lièvres des ronces.
4. **Ruines moussues** : Golems de mousse, Feux follets, Guetteurs runiques.
5. **Lacs brumeux** : Crapauds-mortiers, Serpents des brumes (dans l'eau), Crabes des berges ; une brume légère y flotte.
6. **Jungle**, sous la canopée (grands arbres à contreforts, bambous, lianes, marigots) : Gorilles des cimes (ils
   lancent des bananes de loin, cognent de près et fracassent le sol devant eux ; ils se montent), Crocodiles des marais
   (tapis dans l'eau, on ne voit que leurs yeux ; ils en sortent pour attaquer ce qui passe près de la rive, puis y
   retournent ; ils se montent, dans l'eau) et Petits Masqués à la sarbacane (leurs fléchettes **empoisonnent** : on
   perd des PV quelques secondes, une goutte verte au-dessus de la tête). Leurs géants dorment au fond de **temples** à degrés.
7. **Mer de sable**, la plus grande : Suricates, Vers des sables, Vautours ; Scorpions des dunes le jour (dard empoisonné), Chacals fantômes la nuit ; tempêtes de sable. Un grand volcan s'y dresse.
8. **Entrailles du volcan**, sous la Mer de sable : Salamandres de braise, Chauves-souris de cendre, Tortues-volcans (elles crachent de la lave en cloche) (voir [Le volcan](#le-volcan-et-le-cœur-volcanique)).

Une **brume** couvre tout ce qui se trouve au-delà de la première porte fermée : rien n'y apparaît. Pour ouvrir
la zone suivante, il faut à la fois l'**Hôtel de ville** au bon niveau et avoir vaincu **tous les géants** de la
zone (une fois suffit, pour tout le village), et avoir rapporté au vieil homme le parchemin de la zone. On peut toujours revenir en arrière.

La minicarte (et la grande carte, **M**) se dévoile au fil de l'exploration, pour tout le village. Sur la grande carte,
à la souris, une grotte survolée affiche le petit nom de son géant.

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
- **Tireurs** (Guetteur, Crapaud-mortier, Serpent, Gorille, Petit Masqué) : ils s'immobilisent pour charger leur tir. On s'écarte de la
  trajectoire, ou on sort du cercle annoncé au sol. Monté, un tireur (Serpent, Gorille) tire de loin sur les sauvages,
  sans s'arrêter.
- **Hors du village** (et des camps établis), on ne régénère pas. Les monstres sauvages, eux, récupèrent si on
  cesse de les frapper.
- **Mort** : on perd 15 % de son or et 10 % du bois et de la pierre de son sac (affiché en grand, en rouge), la meute
  ordinaire se disperse, les Alphas restent. On réapparaît au village ou au dernier camp établi qu'on a dépassé.
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
  - Au bord de l'eau, avec une monture nageuse et une terrestre : **F** en regardant l'eau monte la nageuse, en
    regardant la terre, la terrestre.
  - Le **Vautour** vole : il passe au-dessus de l'eau, des rochers et des arbres. Dans la meute aussi, il suit son
    dompteur en volant et se pose quand il s'arrête.
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
  **double éveil** de l'Alpha de cette espèce. Légendaire, il est un peu plus fort, et lance seul (un peu moins fort que
  lui) les attaques spéciales de son géant.
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
- **Tableau du village** : une colonne par membre, en quatre catégories : combat (géants battus, premières victoires,
  monstres vaincus, dégâts, plus gros coup, morts, coéquipiers relevés), dressage (apprivoisés, essences, Alphas
  éveillés et légendaires), récolte et village (bois, pierre, dons, or pour le village), exploration (coffres, livres,
  distance, temps de jeu). Une couronne pour le meilleur de chaque ligne (le moins de morts, pour les morts). Sur
  téléphone, le tableau défile de côté, la colonne des exploits restant en place.
- Les **Alphas au repos** (rangés à la Tanière) se promènent sur l'îlot : ils font la sieste, se roulent par terre,
  reniflent, se courent après et se chamaillent entre eux, ceux de tous les membres.
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
- Sur ordinateur, en combat, sa barre de vie et son nom s'affichent en haut de l'écran.
- L'**Œil des Ruines** tire des salves qui traversent la meute, et maintient un **rayon runique** qui tourne
  lentement autour de lui, vers là où il traverse le plus de monde : on le contourne dans le sens opposé, et on évite
  de s'aligner avec sa meute.
- **Lueur**, la Flamme Ancienne, se téléporte en laissant un **cratère de feu** qui brûle un moment.
- Lacs brumeux : le **Crapaud-Roi** crache sa **langue**, qui ramène contre lui ce qu'elle touche ; l'**Hydre** souffle
  de ses trois têtes (des jets d'eau qui balaient l'avant) et fait jaillir des **geysers** sous les dompteurs ; le
  **Crabe Titan** découpe dans le tas avec sa **grande pince** (tout l'arc devant lui) et noie tout sous des bulles
  d'**écume** qui éclatent et collent.
- Le **Roi-Vautour** lâche des **tornades** qui poursuivent leur cible : elles blessent et aspirent ce qui les approche.
- Le **Scorpion Empereur**, 4e géant de la Mer de sable, est **facultatif** : ni porte, ni parchemin, ni volcan n'en
  dépendent. Ses pinces et son dard empoisonnent, il crache son venin en éventail et appelle ses scorpions.
- **Îlots du large** : cinq petites îles au large de la côte (zones 2 à 6), qu'on rejoint **à dos de serpent** (la
  meute débarque avec son dompteur). Trois sont gardées par un géant facultatif, **à l'air libre** sur son îlot (on lui
  parle pour le défier ; il se rendort quand plus personne n'est sur l'îlot), avec ses créatures autour, du plus
  facile au plus dur : le **Grand Drake** (zone 3 ; Drakes des marées, qui crachent de l'eau), la **Wyverne-Reine**
  (zone 5 ; Wyvernes des falaises, au dard empoisonné) et le **Dragon ancien** (zone 6 ; Dragonnets de braise, qui
  crachent des boules de feu). Chacun garde dans son coffre un **tome qu'on
  ne trouve que là** : **Endurance** (+10 % de PV max), **Navigation** (+25 % de vitesse à dos de serpent) et
  **Trésors** (+15 % d'or des monstres, filons et coffres). Les deux autres îlots ont un **coffre de naufragé** plein
  d'or, qui se remplit de nouveau au bout de 30 minutes (chacun le sien).
- Vaincu, il laisse un **coffre** (chacun l'ouvre une fois, pour un montant d'or aléatoire) et parfois son **âme**.
  Le dernier géant d'une zone que le village bat (une fois tous vaincus) laisse le **parchemin de la zone** pour le
  vieil homme. Il revient après un délai. Si tout le monde sort, il se
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
- Chaque **parchemin de zone** rapporté lui rend les souvenirs de cette zone, d'un trait. On peut les lui faire
  raconter de nouveau, zone par zone (« Les anciens parchemins »).
- Tous ses souvenirs retrouvés, il reconstruit le **bateau** échoué au bout de l'île, en plusieurs étapes payées en
  or et avec la réserve du village. Sa **Pierre de passage** se construit dès que la Mer de sable est ouverte.
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

- Jusqu'à **4 dompteurs** par village. **Menu › Paramètres › Village › Inviter des amis** copie le lien d'invitation (`?v=CODE`).
- La progression est rattachée au **compte dans un village** : un autre village, c'est repartir de zéro. Un compte
  a au plus 3 villages, listés dans le lobby.
- L'or et les essences des monstres vaincus se partagent entre dompteurs proches.
- Un membre **déconnecté** dort près du feu du village, sa meute autour de lui.
- **Chat** : **C** ou le bouton 💬 ; chaque message s'affiche aussi dans une bulle au-dessus de son auteur.
- **Menu › Profil** : choisir sa couleur (une par membre du village) et un chapeau, acheté une fois en or, sans effet en jeu.
- Se connecter sur un autre appareil déconnecte la session en cours (sa progression est sauvegardée d'abord).
- Le **fondateur** peut expulser (et réintégrer) un membre, et supprimer le village.
