// Compétences affichées au bestiaire de la Tanière : attaques des géants (et de quelques monstres), traits des espèces.

import { type BossMove, type Ranged, type Species, CURSE_BONUS, HUG_S, POISON_S, SPARK_JUMPS } from '../../shared/config.ts';

/** Famille d'une compétence : son pictogramme sur sa carte. */
export type SkillIcon = 'zone' | 'line' | 'arc' | 'cloud' | 'ring' | 'summon' | 'rage' | 'hidden' | 'shot' | 'grab' | 'heal' | 'trait' | 'mount' | 'night';

/** Une carte de compétence : son nom, ce qu'elle fait (et comment s'en sortir), sa famille. */
export interface Skill {
  name: string;
  desc: string;
  icon: SkillIcon;
  boss?: boolean; // attaque spéciale (cadre rouge) plutôt que trait de l'espèce
}

/** Ce que fait chaque attaque spéciale, et comment l'esquiver. */
export const MOVE_INFO: Record<BossMove['kind'], { desc: string; icon: SkillIcon }> = {
  leap: { icon: 'zone', desc: 'Il bondit sur sa cible et écrase la zone d\'arrivée, annoncée au sol : sors du cercle.' },
  split: { icon: 'summon', desc: 'À certains seuils de vie, il se divise en petits gluants.' },
  spores: { icon: 'cloud', desc: 'Des nuages de spores sous les dompteurs : ils rongent tant qu\'on reste dedans.' },
  summon: { icon: 'summon', desc: 'Il appelle des renforts de son espèce : occupe-t\'en avant qu\'ils ne s\'accumulent.' },
  charge: { icon: 'line', desc: 'Un couloir s\'annonce, puis il le traverse d\'un coup : écarte-toi de côté.' },
  web: { icon: 'cloud', desc: 'Des toiles qui collent : on y est ralenti un moment.' },
  slam: { icon: 'zone', desc: 'Il se dresse puis retombe : une onde de choc tout autour de lui. Éloigne-toi.' },
  enrage: { icon: 'rage', desc: 'Sous un seuil de vie, il s\'enrage : il frappe plus souvent et va plus vite.' },
  rocks: { icon: 'zone', desc: 'Il projette des rochers sur plusieurs cibles, chacun annoncé au sol.' },
  blink: { icon: 'hidden', desc: 'Il disparaît et réapparaît près d\'une cible en explosant (zone annoncée).' },
  volley: { icon: 'shot', desc: 'Une salve de projectiles en éventail : glisse-toi entre eux.' },
  mortar: { icon: 'zone', desc: 'Une pluie de tirs en cloche, chacun annoncé par un cercle au sol.' },
  trail: { icon: 'cloud', desc: 'Il sème des flaques de lave derrière lui : ne marche pas dans sa trace.' },
  spin: { icon: 'arc', desc: 'Il s\'arrête : des jets de flammes tournent autour de lui. Tourne avec eux, ou éloigne-toi.' },
  lash: { icon: 'line', desc: 'Des coups de tentacule, chacun annoncé par un couloir.' },
  ink: { icon: 'cloud', desc: 'Des nuages d\'encre sous les dompteurs : ils brûlent et ralentissent.' },
  laser: { icon: 'line', desc: 'Un rayon qui balaie vers là où il traverse le plus de monde : contourne-le dans l\'autre sens.' },
  pound: { icon: 'zone', desc: 'Il fracasse le sol devant lui, sur sa cible.' },
  pincer: { icon: 'arc', desc: 'Sa grande pince découpe tout l\'arc devant lui : passe dans son dos.' },
  bubbles: { icon: 'zone', desc: 'Des bulles d\'écume gonflent sous les cibles puis éclatent ; l\'écume colle.' },
  tongue: { icon: 'line', desc: 'Des coups de langue en couloir : ce qu\'elle touche est ramené contre lui.' },
  geyser: { icon: 'zone', desc: 'Des geysers jaillissent sous les cibles, l\'un après l\'autre.' },
  breath: { icon: 'arc', desc: 'Ses trois têtes soufflent des jets d\'eau qui balaient l\'avant.' },
  tornado: { icon: 'cloud', desc: 'Des tornades poursuivent leur cible : elles blessent et aspirent.' },
  stalk: { icon: 'hidden', desc: 'Il se fond dans l\'ombre (intouchable), file au ras du sol et bondit dans ton dos : guette ses yeux rouges.' },
  howl: { icon: 'rage', desc: 'Son hurlement ralentit les dompteurs autour de lui ; ses louveteaux enragent.' },
  rampage: { icon: 'line', desc: 'Trois charges d\'affilée : il rebondit contre les murs. Suis les couloirs annoncés.' },
  mud: { icon: 'cloud', desc: 'Il projette de la boue : des flaques qui collent et blessent un peu.' },
  hug: { icon: 'grab', desc: `Il se jette sur le plus proche et l'enserre : la cible ne bouge plus pendant ${String(HUG_S).replace('.', ',')} s.` },
  hibernate: { icon: 'heal', desc: 'À bout de forces, il s\'endort pour guérir : frappe-le fort pour le réveiller.' },
  shrooms: { icon: 'zone', desc: 'Des champignons poussent dans l\'arène : approche-toi et leur chapeau gonfle, puis ils éclatent.' },
  decoys: { icon: 'summon', desc: 'Il se divise en trois feux follets à son visage : les deux leurres tombent vite, puis explosent.' },
  venomdive: { icon: 'hidden', desc: 'Elle disparaît dans le ciel, puis fond sur sa cible (son ombre grandit) et laisse une mare de venin.' },
  drum: { icon: 'ring', desc: 'Des anneaux d\'onde partent l\'un après l\'autre : glisse-toi dans leurs deux brèches.' },
  log: { icon: 'line', desc: 'Il soulève un tronc et le fait rouler droit devant lui.' },
  tail: { icon: 'arc', desc: 'Un large coup de queue vers là où il y a le plus de monde, même dans son dos.' },
  roll: { icon: 'grab', desc: 'Il happe ce qu\'il touche et l\'entraîne en tournoyant.' },
  ambush: { icon: 'hidden', desc: 'Il plonge sous terre, file sous sa cible en la suivant, puis surgit : bouge au dernier moment.' },
  totem: { icon: 'heal', desc: 'Il plante un totem qui soigne les siens : casse-le en priorité.' },
  curse: { icon: 'zone', desc: `Une marque violette sous un dompteur : s'il y reste, il subit ${Math.round(CURSE_BONUS * 100)} % de dégâts en plus.` },
  maw: { icon: 'cloud', desc: 'Le sable s\'ouvre sous les dompteurs, aspire, puis se referme en mordant : sors-en vite.' },
  eclipse: { icon: 'night', desc: 'La nuit tombe sur l\'arène : on ne voit plus qu\'autour de soi, et ses chacals sortent de l\'ombre.' },
  mirage: { icon: 'line', desc: 'Des reflets de lui foncent sur sa cible depuis trois côtés, l\'un après l\'autre.' },
  impale: { icon: 'line', desc: 'Il projette sa queue en ligne droite : le dard empoisonne fort.' },
  molt: { icon: 'zone', desc: 'Elle mue : sa vieille peau reste sur place et explose pendant qu\'elle file.' },
  tailcut: { icon: 'summon', desc: 'À deux reprises, sa queue tombe et se bat seule (une autre repousse).' },
  echo: { icon: 'ring', desc: 'Des anneaux sonores qui étourdissent : on ne bouge plus un instant.' },
  roost: { icon: 'hidden', desc: 'Il s\'accroche au plafond, hors d\'atteinte : braises et nuée, puis il fond sur quelqu\'un.' },
  shellspin: { icon: 'line', desc: 'Rentrée dans sa carapace, elle rebondit dans l\'arène en semant la lave (elle encaisse moins).' },
};

/** Carte d'une attaque spéciale. */
export const moveSkill = (m: BossMove, name: string): Skill => ({ name, desc: MOVE_INFO[m.kind].desc, icon: MOVE_INFO[m.kind].icon, boss: true });

const SHOT: Record<Ranged['kind'], string> = {
  bolt: 'Trait runique : un projectile lent en ligne droite. Esquive de côté.',
  arc: 'Tir en cloche : il retombe là où tu étais, sur un cercle annoncé.',
  jet: 'Jet d\'eau rapide, en ligne droite : esquive de côté.',
  banana: 'Bananes lancées en cloche, sur un cercle annoncé.',
  dart: `Fléchettes de sarbacane : elles empoisonnent (${POISON_S} s).`,
  fire: 'Boules de feu en ligne droite : esquive de côté.',
  spark: `Décharge électrique qui rebondit sur ${SPARK_JUMPS} ennemis proches.`,
};

/** Traits d'une espèce, en cartes (forme sauvage ; tame : apprivoisée, ses habitudes de sauvage ne comptent plus). */
export function traitSkills(sp: Species, tame: boolean): Skill[] {
  const out: Skill[] = [];
  const add = (name: string, desc: string, icon: SkillIcon = 'trait') => out.push({ name, desc, icon });
  if (sp.ranged) add('Tireur', `${SHOT[sp.ranged.kind]} Portée ${sp.ranged.range} px, ${String(sp.ranged.windup).replace('.', ',')} s pour viser.`, 'shot');
  if (sp.brawler) add('Bagarreur', 'Collé à sa cible, il cogne au corps à corps au lieu de tirer.');
  if (sp.venom) add('Venin', `Ses coups empoisonnent (${POISON_S} s) : ne reste pas collé à lui.`);
  if (sp.reach) add('Allonge', 'Il se jette hors de l\'eau sur ce qui passe au bord.');
  if (!tame) {
    if (sp.passive) add('Passif', 'Il ne se bat pas : il broute les buissons et fuit qui le frappe. Tends-lui une baie (T).', 'heal');
    if (sp.burrows) add('Fouisseur', 'Il file sous le sable, intouchable, et surgit sous sa cible (cercle annoncé).', 'hidden');
    if (sp.flies) add('Vol', 'Il plane hors d\'atteinte puis pique là où tombe son ombre ; posé, on peut le frapper. Une tempête le cloue au sol.', 'hidden');
    if (sp.shy) add('Craintif', 'Un dompteur sans fruit ou un vautour approche : la colonie court se cacher dans sa tanière.');
    if (sp.shell) add('Coquille', 'Approché sans fruit, il rentre dans sa coquille, intouchable.');
    if (sp.skittish) add('Détale', 'Il fuit devant un dompteur qui approche sans fruit en main.');
    if (sp.ambush) add('Embuscade', 'Tapi dans l\'eau, il en sort pour attaquer ce qui passe, puis y retourne.', 'hidden');
    if (sp.sleeps) add(sp.sleeps === 'night' ? 'Dort la nuit' : 'Dort le jour', 'Endormi, il ne voit personne : on peut le surprendre.', 'night');
    if (sp.night) add('Nocturne', 'Il n\'apparaît qu\'à la nuit tombée et s\'en va au lever du jour.', 'night');
    if (sp.day) add('Diurne', 'Il n\'apparaît que le jour et s\'enfouit au coucher du soleil.', 'night');
    if (sp.season === 3) add('Hivernal', 'Il ne sort qu\'en hiver, et repart à la fonte des neiges.', 'night');
    if (sp.rainSpeed) add('Aime la pluie', 'Sous une grosse averse, il va bien plus vite.');
    if (sp.swim) add('Aquatique', 'Sauvage, il ne quitte jamais l\'eau.');
    if (sp.isle) add('Îlot du large', 'Il ne vit que sur l\'îlot de son géant, au large de la côte.');
  } else if (sp.swim || sp.amphibious) add('Nageur', 'Dans la meute, il suit son dompteur sur terre et dans l\'eau.');
  return out;
}
