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
- [Jour, nuit, calendrier et météo](#jour-nuit-calendrier-et-météo)
- [Jouer à plusieurs](#jouer-à-plusieurs)

## Contrôles

| Action | PC (touches réglables : Échap › Paramètres) | Au doigt |
|---|---|---|
| Se déplacer | ZQSD / WASD / flèches, ou glisser à la souris | Glisser |
| Attaquer | Automatique, ou clic gauche vers le pointeur (au choix) | Automatique |
| Interagir (bâtiment, grotte, buisson, coffre…) | E | Bouton d'action |
| Tendre un fruit | T | Bouton à baies |
| Capacité de spécialisation | Espace | Bouton de capacité |
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
le village n'est encore qu'un camp de fortune ; tant que le pont n'est pas réparé, on se réveille sur la plage, et
c'est là qu'on reprend des forces (pas sur le pont).

## L'île et ses zones

L'île est générée à partir d'une graine propre à chaque village : forme, côte, lacs, forêts et grottes changent
d'un village à l'autre. Les zones sont des bandes successives, de plus en plus dangereuses à mesure qu'on
s'éloigne de la plage (à partir des Ruines moussues, les zones sont deux fois plus grandes, et plus peuplées) :

1. **Lisière** : Gluants, Sporelins, Escargots des mousses.
2. **Bois profonds** : Loups, Araignées sylvestres ; Lucioles la nuit ; Bigfoots quand la neige couvre l'île ; un arbre abattu réveille parfois un **Tréant**.
3. **Landes** : Sangliers, Ours des fourrés (ils chassent la nuit, dorment le jour), Lièvres des ronces.
4. **Ruines moussues** : Golems de mousse, Feux follets, Guetteurs runiques.
5. **Lacs brumeux** : Crapauds-mortiers, Serpents des brumes (dans l'eau), Crabes des berges ; une brume légère y flotte.
6. **Jungle**, sous la canopée (grands arbres à contreforts, bambous, lianes, marigots) : Gorilles des cimes (ils
   lancent des bananes de loin, cognent de près et fracassent le sol devant eux ; ils se montent), Crocodiles des marais
   (tapis dans l'eau, on ne voit que leurs yeux ; ils en sortent pour attaquer ce qui passe près de la rive, puis y
   retournent ; ils se montent, dans l'eau) et Petits Masqués à la sarbacane (leurs fléchettes **empoisonnent** : on
   perd des PV quelques secondes, une goutte verte au-dessus de la tête). Leurs géants dorment au fond de **temples** à degrés.
7. **Mer de sable**, la plus grande : Suricates, Vers des sables, Vautours ; Scorpions des dunes le jour (dard empoisonné), Chacals fantômes la nuit ; tempêtes de sable, sables mouvants qui s'ouvrent sous les pasges. Un grand volcan s'y dresse.
8. **Entrailles du volcan**, sous la Mer de sable : Salamandres de braise, Chauves-souris de cendre, Tortues-volcans (elles lancent des roches en fusion en cloche, qui mettent le feu) (voir [Le volcan](#le-volcan-et-le-cœur-volcanique)).

Une **brume** couvre tout ce qui se trouve au-delà de la première porte fermée : rien n'y apparaît. Pour ouvrir
la zone suivante, il faut à la fois l'**Hôtel de ville** au bon niveau et avoir vaincu **tous les géants** de la
zone (une fois suffit, pour tout le village), et avoir rapporté au vieil homme le parchemin de la zone. On peut toujours revenir en arrière.

La minicarte (et la grande carte, **M**) se dévoile au fil de l'exploration, pour tout le village. Sur la grande carte,
à la souris, une grotte survolée affiche le petit nom de son géant.

## Combat

- L'attaque est **automatique** sur l'ennemi le plus proche à portée. Sur PC, on peut passer à l'**attaque au clic**
  (Échap › Paramètres) : on frappe alors le monstre visé.
- **Classes**, choisies à l'armurerie (le premier choix est gratuit, les suivants payants) :
  **Guerrier** (corps à corps, plus de PV), **Archer** (tir de loin), **Mage** (orbe qui touche aussi autour de la cible).
  Archers et mages abattent les arbres et cassent les pierres 30 % moins vite.
- **Capacité de spécialisation** (touche Espace, ou le bouton dédié, sur une recharge affichée) : en se spécialisant à la
  Grande armurerie, chaque voie débloque une **capacité active**, pensée pour peser dans un combat de géant, pas seulement
  pour nettoyer du menu fretin. Une par voie :
  - **Berserker — Frénésie** : il entre en rage, frappe bien plus vite et vole de la vie, mais encaisse plus.
  - **Gardien — Rempart** : les alliés autour de lui (dompteurs et meutes) encaissent beaucoup moins un moment.
  - **Tireur d'élite — Tir de rupture** : il marque une cible, qui subit plus de dégâts de tout le monde.
  - **Rôdeur — Pluie de flèches** : une volée s'abat sur une zone et touche tous les monstres pris dedans.
  - **Pyromancien — Météore** : une boule de feu s'abat (gros impact), puis un brasier ronge les monstres touchés, géants compris.
  - **Druide — Floraison** : une floraison de soins rend des PV aux alliés proches, puis les régénère un moment.
- **Spécialisations** : au-delà d'un certain niveau d'arme, la **Grande armurerie** permet de spécialiser sa classe :
  Berserker ou Gardien (guerrier), Tireur d'élite ou Rôdeur (archer), Pyromancien ou Druide (mage).
- L'armurerie améliore séparément l'**arme** (dégâts) et l'**armure** (PV max et réduction des dégâts), ainsi que la
  **torche** (rayon de lumière la nuit), les **bottes** (vitesse) et la **selle** (vitesse des montures). Chaque
  amélioration coûte de l'or et du **bois** : celui du sac d'abord, puis celui de l'entrepôt du village.
- **Tireurs** (Guetteur, Crapaud-mortier, Serpent, Gorille, Petit Masqué) : ils s'immobilisent pour charger leur tir. On s'écarte de la
  trajectoire, ou on sort du cercle annoncé au sol (seul ce qui s'y tient est touché). Monté, un tireur (Serpent, Gorille) tire de loin sur les sauvages,
  sans s'arrêter.
- **Hors du village** (et des camps établis), on ne régénère pas. Les monstres sauvages, eux, récupèrent si on
  cesse de les frapper.
- **Mort** : on perd 15 % de son or et 10 % du bois et de la pierre de son sac (affiché en grand, en rouge), la meute
  ordinaire se disperse, les Alphas restent. On réapparaît au village ou au dernier camp établi qu'on a dépassé.
- **Relever** un coéquipier à terre : **R maintenu** près de lui, pendant le court délai où il reste au sol.
- **Effets en cours** : sous le panneau du dompteur, une vignette colorée par altération (▼ : poison, brûlure, malédiction,
  toile ou boue, étourdissement, sables mouvants, tempête de sable) ou bonus (▲ : cri de l'Alpha, carapace, repos au
  village, soins de l'Alpha lièvre, monture), avec le compte à rebours ; le survol dit ce qu'elle fait. Le bord de l'écran prend la couleur des
  effets, et leurs icônes montent du coin en s'effaçant. Tout se règle dans Paramètres › Affichage (coin, taille, filtre,
  bord teinté (opacité, largeur, foyer du coin), secondes, animations).

## Meute, apprivoisement et montures

- Un monstre vaincu a une chance de rejoindre sa **meute**. Apprivoisé, il est moins fort que sa version sauvage.
  La meute suit son dompteur et combat seule ; trop loin, elle lâche sa cible et revient.
- La meute ordinaire est sauvegardée avec la progression, mais se disperse à la mort.
- Au village et dans les camps, la meute se promène librement autour de son dompteur.
- **Montures** (**F**) : certains Alphas se chevauchent (Loup, Sanglier, Ours, Escargot, Serpent, Vautour), à
  condition d'avoir une **selle** (achetée à l'armurerie, plus rapide en l'améliorant). La monture encaisse une partie
  des coups ; si elle tombe, on est désarçonné.
  - Le **Serpent des brumes** ne va qu'en eau : on embarque près de l'eau, on descend au bord d'une rive, et
    s'il tombe en pleine eau, on se noie.
  - Au bord de l'eau, avec une monture nageuse et une terrestre : **F** en regardant l'eau monte la nageuse, en
    regardant la terre, la terrestre.
  - Le **Vautour** vole : il passe au-dessus de l'eau, des rochers et des arbres. En vol, les monstres ne l'atteignent
    pas au corps à corps, ni le dard du scorpion (seuls leurs tirs et les géants), mais on ne récolte ni bois ni pierre de là-haut. Dans la meute
    aussi, il suit son dompteur en volant, se pose quand il s'arrête, et pique sur sa proie pour se poser à côté et la
    frapper. Pendant une tempête de sable, le vent le cloue au sol : dans le désert, impossible de le monter, et un
    cavalier qui y entre met pied à terre.
  - L'**Escargot** se monte… mais ralentit.

## Alphas et Tanière

- Il n'y a **pas d'Alpha sauvage**. Chaque monstre vaincu peut laisser une **essence** de son espèce ; avec assez
  d'essences, on **éveille** l'Alpha de cette espèce à la Tanière. L'éveil prend un moment, même hors ligne.
- Un Alpha par espèce, hors limite de meute. Tombé, il ressuscite après un délai (plus long pour les espèces fortes) ;
  pendant un combat de géant, ou si son dompteur est à terre, il attend la fin. Sur ordinateur, le HUD dit dans combien
  de temps il revient : une ligne sous le sac, ou une vignette à son portrait près des effets en cours (au choix dans
  Paramètres › Affichage).
- On le **renforce** avec des essences, de plus en plus cher à chaque niveau, et un peu plus dans les zones lointaines.
- Seuls quelques Alphas sont **équipés** à la fois ; les autres se reposent à la Tanière et se promènent sur l'îlot du village.
  Pour que le jeu reste fluide, **30 Alphas au repos au plus** sont montrés en même temps : au-delà, ils sont tirés au hasard
  parmi ceux de tous les membres (en ligne ou endormis), et la sélection ne change que quand une place se libère (un Alpha part) : ceux déjà montrés restent, un arrivant ne prend la place de personne.
- **Filtre de la Tanière** : l'onglet Alphas se règle sur **Équipés**, **Au repos**, **À éveiller** ou **Tous**, chacun avec son
  compteur ; une pastille dit combien d'Alphas attendent une action (éveil, renforcement, double éveil). Les Alphas pas encore
  éveillés sont de petites tuiles, les prêts en premier ; un clic sur une tuile montre ses stats.
- **Marquer un Alpha** (bouton ☆ à côté du nom de sa carte, éveillé ou non) : une barre d'essences s'affiche alors dans le HUD, vers son
  coût d'éveil, puis de renforcement. Un seul à la fois ; marquer le même à nouveau le démarque.
- **Nommer un Alpha** (bouton ✎ à côté du nom de sa carte, équipé ou au repos) : son nom s'affiche sous ses pattes, à la
  couleur de son dompteur, pour tout le village. Un nom vide le lui retire.
- **Bonus de collection** : chaque Alpha éveillé renforce tous les autres.
- **Alphas à pouvoir** : le Lièvre soigne son dompteur et la meute proche (dans la meute, il ne va pas au contact :
  il reste en retrait, derrière son dompteur). Le Suricate et l'Escargot ont une
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
  **E à l'entrepôt** du village pour les verser dans la réserve commune, qui paie les constructions (leurs coûts
  affichent ce qu'il y a dans l'entrepôt). Une barre montre ce qu'il reste à un arbre entamé avant qu'il tombe.
- **Foudre** : sous la pluie, abattre un arbre attire parfois la foudre sur le bûcheron : il perd un peu de PV (elle
  ne l'achève jamais) et reste étourdi un instant.
- Dans la meute, le **Golem de mousse** croque les rochers alentour et le **Tréant** abat les arbres : la pierre et le
  bois reviennent à leur dompteur. **G** (touche de récolte) : ils ne s'occupent plus que de ça, autour de leur
  dompteur, sans se battre ; **G** à nouveau pour les ramener au combat.
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
  - **Armurerie** : classe, arme, armure, torche, bottes ; plus tard la **Grande armurerie** et ses spécialisations.
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
  L'onglet **Inventaire** de l'école montre les livres de son sac (celui en lecture, celui prêt à lire, ceux qui
  attendent le tome d'avant) et ceux déjà lus.

## Grottes et géants

- Chaque espèce hostile a son **géant**, qui dort au fond d'une grotte. On **débloque** la grotte pour tout le village
  (de plus en plus cher selon la zone), puis on y entre avec sa meute (E à l'entrée, E à la sortie pour ressortir).
- **E** près du géant pour lui parler, puis on lance le combat. Ses PV dépendent du nombre de membres du village.
- Il se souvient de toi, le jour même : vaincu, il a peur quand tu reviens (il tremble, une goutte de sueur au front) ;
  s'il t'a corrigé, il se moque de toi.
- Ses coups ordinaires ne touchent qu'une cible ; ses **attaques spéciales** frappent en zone et s'annoncent au sol
  (bond, onde de choc, charge, salves, renforts…) : il faut en sortir avant l'impact.
- Sur ordinateur, en combat, sa barre de vie et son nom s'affichent en haut de l'écran.
- Chaque géant a ses attaques à lui, liées à son espèce :
  - **Champignon Géant** : des **champignons** poussent dans l'arène ; on s'en approche, leur chapeau gonfle et ils
    éclatent (en laissant leurs spores).
  - **Croc-d'Ombre** : il **traque** (il se fond dans l'ombre, file au ras du sol et ressort dans ton dos) et **hurle**
    (on est ralenti, ses louveteaux enragent).
  - **Vieille-Défense** : **ruée folle** (trois charges d'affilée, il rebondit sur les murs) et **bauge** (des flaques
    de boue qui collent).
  - **Ours Colosse** : **étreinte** (il saisit le plus proche, qui ne peut plus bouger, et le broie) ; à bout de forces,
    il **hiberne** pour guérir : frappe-le fort pour le réveiller.
  - **Feu Ancien** : **lueurs trompeuses** (il se divise en trois feux follets à son visage ; les deux leurres tombent
    en quelques coups, puis explosent).
  - **Wyverne-Reine** : **piqué venimeux** (elle disparaît dans le ciel, fond sur sa cible et laisse une mare de venin).
  - **Roi Gorille** : **tambour de guerre** (des anneaux d'onde l'un après l'autre : glisse-toi dans leurs deux
    brèches) et **lancer de tronc** (il roule droit devant lui).
  - **Crocodile Ancien** : **coup de queue** (vers là où il y a le plus de monde, même dans son dos), **roulade de la
    mort** (il happe et tournoie) et **embuscade** (il plonge, file sous sa cible et surgit).
  - **Grand Masque** : **totems** (ils le soignent, lui et ses Petits Masqués : la meute les vise en priorité) et **malédiction** (sors de la marque,
    sinon tu subis plus de dégâts).
  - **Reine des sables** : **gueules des dunes** (le sable s'ouvre sous les dompteurs, aspire, puis se referme en mordant).
  - **Chacal lunaire** : **éclipse** (la nuit tombe sur l'arène, on ne voit plus qu'autour de soi, ses chacals sortent
    de l'ombre) et **reflets de lune** (des copies de lui foncent sur sa cible, de trois côtés).
  - **Scorpion Empereur** : **dard empaleur** (en ligne, il empoisonne fort) et **fouissage** (il s'enfouit et surgit
    sous sa cible).
  - **Salamandre-Mère** : **mue** (sa vieille peau reste et explose, elle file) ; sa **queue** tombe deux fois et se bat
    seule.
  - **Titus Veillafandre**, seigneur des cendres : **écholocation** (des anneaux qui étourdissent) et **suspendu** (il s'accroche au plafond,
    hors d'atteinte ; braises et nuée, puis il fond sur quelqu'un).
  - **Tortue-Montagne** : **toupie de lave** (rentrée dans sa carapace, elle rebondit dans l'arène en semant la lave).
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
  dépendent.
- **Îlots du large** : trois petites îles au large de la côte (zones 3, 5 et 6) — l'**Île des Marées**, le **Pic des
  Wyvernes** et l'**Île de Braise**, annoncées quand on y aborde — qu'on rejoint **à dos de serpent**
  ou de vautour (la meute débarque avec son dompteur). Chacune est gardée par un géant facultatif, **à l'air libre** sur
  son îlot (on lui parle pour le défier ; le combat continue au-dessus de l'eau toute proche, et il se rendort quand
  plus personne n'est là), avec ses créatures autour, du plus facile au plus dur : le **Grand Drake** (zone 3 ; Drakes
  des marées, qui crachent de l'eau ; lui lance des décharges électriques qui rebondissent sur ceux qui se tiennent à côté), la **Wyverne-Reine** (zone 5 ; Wyvernes
  des falaises, au dard empoisonné) et le **Dragon ancien** (zone 6 ; Dragonnets de braise, qui crachent des boules de
  feu en ligne droite). Wyvernes et Dragonnets ont des ailes : ils volent par-dessus l'eau et les obstacles, pour
  poursuivre qui s'enfuit à la nage comme pour suivre leur dompteur (le Drake, lui, n'en a pas). Chacun garde dans son coffre un tome d'**Endurance** (+10 % de PV max par tome), qu'on ne trouve
  que là : le tome I chez le Grand Drake, le II chez la Wyverne-Reine, le III chez le Dragon ancien.
- Vaincu, il laisse un **coffre** (chacun l'ouvre une fois, pour un montant d'or aléatoire) et parfois son **âme**.
  Le dernier géant d'une zone que le village bat (une fois tous vaincus) laisse le **parchemin de la zone** pour le
  vieil homme. Il revient après un délai. Si tout le monde sort, il se
  rendort, guéri.
- Chaque dompteur qui l'a combattu reçoit aussi quelques **essences de son espèce** (des essences de Loup pour
  Croc-d'Ombre) : un peu plus à chaque nouvelle victoire sur ce géant, jusqu'à un plafond, et un peu plus dans les zones lointaines.

## Le volcan et le cœur volcanique

- Un grand volcan se dresse dans la Mer de sable. Sa bouche, à son pied, reste scellée par une croûte d'obsidienne
  tant que le village n'a pas vaincu les trois géants de la Mer de sable ; ensuite, **E** pour y descendre, de jour
  comme de nuit et par tous les temps.
- Les **entrailles du volcan** sont un donjon (zone 7) : un labyrinthe de grandes salles reliées par de longs couloirs,
  différent d'un village à l'autre. On arrive en bas ; le cœur est au centre ; les trois géants du volcan attendent
  chacun dans sa salle, au bout d'un cul-de-sac — un à gauche, un à droite, un en haut — et il faut fouiller pour les
  trouver. Dedans, la minicarte et la carte (**M**) montrent le donjon et les salles déjà vues.
- Chaque couloir est fermé par une **herse**. Chaque salle a sa garnison de créatures de lave : **vider une salle**
  lève les herses de ses couloirs et débloque les salles voisines. La herse d'une salle de géant porte un sceau d'or :
  il faut en plus **payer l'entrée** (**E** devant la herse, une fois pour tout le village). Si plus personne n'est
  dans le donjon pendant deux minutes, les salles se regarnissent et les herses retombent.
- La roche et les herses arrêtent la vue : on ne tire pas d'une salle à l'autre (archers, mages, tortues-volcans…).
- Dans les salles, des mares de lave infranchissables à pied (à dos de vautour, on les survole) et des **pièges** :
  - les **évents de flammes**, en travers des couloirs : ils rougeoient, puis crachent du feu, chacun à son rythme ;
    les flammes montent haut, à dos de vautour on s'y brûle aussi, et la meute qui n'est pas de feu également ;
  - les **dalles piégées**, gravées d'une rune : marcher dessus fait jaillir un geyser de lave peu après (le cercle
    s'allume : on s'écarte). En vol, on ne l'enfonce pas, mais son geyser brûle quiconque est dessus, cavalier,
    meute (sauf les créatures de feu) compris. La dalle se réarme au bout de quelques secondes.
- **Le feu brûle** : flammes, lave, cratères, boules de feu, roches en fusion et coups des créatures de feu mettent
  le feu ; on brûle quelques secondes (une flamme au-dessus de la tête). Plonger dans l'eau l'éteint.
- Au centre, l'**autel du cœur** : une flamme brûle par géant du volcan encore debout. Les trois vaincus, le cœur
  se libère : **E** sur l'autel pour le prendre, une fois pour tout le village. C'est la dernière étape du bateau
  (voir plus bas).
- Les géants du volcan ne laissent pas de parchemin pour le vieil homme.

## Le vieil homme et le bateau

- Près du feu du village, un vieil homme qui ne se souvient plus de rien (**E** pour lui parler).
- Chaque **parchemin de zone** rapporté lui rend les souvenirs de cette zone, d'un trait. On peut les lui faire
  raconter de nouveau, zone par zone (« Les anciens parchemins »).
- Tous ses souvenirs retrouvés, il part au **bateau** échoué au bout de l'île, et n'en bouge plus : c'est là-bas qu'on
  lui parle désormais. Il le reconstruit en plusieurs étapes payées en or et avec la réserve du village (la quille, la
  coque, le pont et les mâts, les voiles, beaucoup de bois et de pierre) ; pendant chaque étape, on le trouve le
  marteau à la main, et on voit le bateau prendre forme. Sa **Pierre de passage** se construit dès que la Mer de sable
  est ouverte.
- Il lui manque encore son **cœur** : celui du volcan. On le pose dans la coque (**E** devant le bateau), et le
  bateau est prêt à prendre la mer, cap sur le Colisée. Prendre la mer joue une cinématique (le départ de l'île), et
  tant que le Kraken n'est pas vaincu, une autre quand il surgit au large (un toucher ou une touche pour passer).

## La haute mer et le Kraken

- On parle à Aubin, au bateau prêt, et on lui demande de **prendre la mer** : on part avec sa meute, et on se retrouve sur le pont, au large. À la poupe,
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

## Jour, nuit, calendrier et météo

- Le ciel suit l'heure du serveur : tout le village voit la même nuit et la même averse.
- **Nuit** : certains monstres dorment (le Lièvre), d'autres se réveillent (l'Ours), d'autres n'apparaissent
  qu'alors (Lucioles, Chacals fantômes). La torche éclaire autour du dompteur.
- **Calendrier** : les jours passent (un jour = un cycle jour et nuit, il commence au lever du soleil), au fil des
  quatre saisons — printemps, été, automne, hiver. La date (saison et jour) s'affiche sous la minicarte ; un clic ouvre
  le calendrier (les saisons de l'année, leurs jours, ce qu'apporte le moment présent). Chaque début, milieu et fin de
  saison est annoncé.
  - Au printemps, les arbres fleurissent ; à l'automne, ils roussissent ; pendant les **Orages d'été**, presque toutes
    les averses tournent à l'orage.
  - **Fin d'année** : la neige s'installe peu à peu à la fin de l'automne, par plaques, jusqu'à tout couvrir (jamais la
    jungle ni le désert), et la pluie tombe en flocons. Quand elle couvre le sol, les mares gèlent et des **Bigfoots**
    rôdent dans les Bois profonds (rares et costauds, ils repartent avec la neige). Elle fond peu à peu au début du
    printemps.
- **Pluie** : l'Escargot l'adore, il va plus vite.
- **Tempête de sable** (Mer de sable) : elle blesse ceux qui restent dehors ; les vers restent sous le sable, les
  suricates cachés, et les vautours sont cloués au sol (sauvages, de la meute, et la monture).
- **Cactus** (Mer de sable) : s'y frotter pique. Les palmiers de la lisière verte, eux, ne piquent pas.
- **Sables mouvants** (Mer de sable) : ils s'ouvrent au hasard sous les pas, n'importe où dans le désert, puis se
  referment. On y avance au ralenti, et à y rester on s'enlise de plus en plus vite (les dégâts grimpent chaque
  seconde) : il faut en sortir tout de suite. À dos de vautour, on passe au-dessus.

## Jouer à plusieurs

- Jusqu'à **4 membres** par village, **connectés ou non** : un membre déconnecté garde sa place. **Menu › Paramètres › Village › Inviter des amis** copie le lien d'invitation (`?v=CODE`).
- La progression est rattachée au **compte dans un village** : un autre village, c'est repartir de zéro. Un compte
  a au plus 3 villages, listés dans le lobby.
- L'or et les essences des monstres vaincus se partagent entre dompteurs proches.
- Quand un coéquipier **réveille un géant**, tout le village en est prévenu, et une petite **flèche** autour de soi
  indique le chemin du combat (la sortie de la grotte où l'on est, puis l'entrée de la sienne) tant que le géant est debout.
- Un membre **déconnecté** dort près du feu du village, sa meute autour de lui.
- **Chat** : **C** ou le bouton 💬 ; chaque message s'affiche aussi dans une bulle au-dessus de son auteur.
- **Menu › Profil** : choisir sa couleur (une par membre du village) et un chapeau, acheté une fois en or. Chaque chapeau débloqué renforce l'arme de 10 %.
- Se connecter sur un autre appareil déconnecte la session en cours (sa progression est sauvegardée d'abord).
- Le **chef** du village (au départ, son fondateur) peut expulser (et réintégrer) un membre, connecté ou non, et
  supprimer le village. Il peut aussi le **transmettre** à un autre membre (Paramètres › Village › Transmettre) : ce
  membre devient le chef, et l'ancien redevient un membre ordinaire. Un chef qui quitte le village le transmet de
  lui-même au membre le plus récemment actif.
- **Nouveautés** : le lobby montre, à gauche, ce qu'apporte la dernière mise à jour du jeu et son numéro de version
  (« nouveau » tant qu'on ne l'avait pas vue) ; les versions précédentes se déplient en dessous. Sur téléphone, la
  pastille « Nouveautés » en haut à gauche l'ouvre.
