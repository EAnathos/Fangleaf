// Les géants se souviennent du dompteur, le jour même (jour de l'île) : vaincus plusieurs fois, ils ont peur de lui
// (ils tremblent, une goutte de sueur leur coule du front) ; s'ils l'ont corrigé, ils se moquent de lui quand il revient.
// Rien ne passe par le serveur : chaque dompteur a ses propres souvenirs avec chaque géant.

export type Mood = { mood: 'fear' | 'smug'; n: number }; // n : victoires (fear) ou raclées (smug) du jour

type Record = { wins: number; losses: number; last: 'win' | 'loss' };

const SETTLE_S = 2; // un géant revu endormi moins de 2 s après le début du combat : c'est l'image d'avant, pas une défaite

class BossMemory {
  private day = '';
  private rec = new Map<number, Record>(); // grotte → ce qui s'est passé aujourd'hui
  private fights = new Map<number, number>(); // grottes où l'on s'est battu, sans issue connue : → début du combat

  /** Un nouveau jour se lève : les géants oublient. */
  setDay(key: string) {
    if (key === this.day) return;
    this.day = key;
    this.rec.clear();
  }

  /** Le géant de cette grotte est réveillé sous nos yeux : on se bat contre lui. */
  fighting(cave: number, now: number) {
    if (!this.fights.has(cave)) this.fights.set(cave, now);
  }

  /** Le géant est vaincu (par nous, ou par le village pendant qu'on était dans le combat). */
  won(cave: number) {
    if (!this.fights.delete(cave)) return;
    this.bump(cave, 'win');
  }

  /** Revu endormi, guéri, sans avoir été vaincu : il a eu le dessus. */
  settle(cave: number, now: number) {
    const at = this.fights.get(cave);
    if (at === undefined || now - at < SETTLE_S) return;
    this.fights.delete(cave);
    this.bump(cave, 'loss');
  }

  mood(cave: number): Mood | null {
    const r = this.rec.get(cave);
    if (!r) return null;
    return r.last === 'win' ? { mood: 'fear', n: r.wins } : { mood: 'smug', n: r.losses };
  }

  private bump(cave: number, how: 'win' | 'loss') {
    const r = this.rec.get(cave) ?? { wins: 0, losses: 0, last: how };
    if (how === 'win') r.wins++;
    else r.losses++;
    r.last = how;
    this.rec.set(cave, r);
  }
}

export const bossMemory = new BossMemory();

const FEAR = [
  ['Oh non, pas encore toi ! Je viens tout juste de ressusciter…', 'Encore toi ?! Je n\'ai même pas fini de recoller mes morceaux…', 'Toi ?! Déjà ? Je suis à peine revenu à moi…'],
  ['Deux fois aujourd\'hui, ça ne te suffit pas ?! Laisse-moi tranquille…', 'Pitié… Tu n\'as donc rien d\'autre à faire de ta journée ?'],
  ['Tu m\'as déjà battu {n} fois aujourd\'hui ! Je vais finir par déménager…', '{n} fois aujourd\'hui… Je t\'en supplie, va voir un autre géant !'],
];
const SMUG = [
  ['Une raclée ne t\'a pas suffi ?', 'Tiens, te revoilà ! Tu en redemandes ?', 'Déjà de retour ? Tes bleus n\'ont même pas eu le temps de sécher.'],
  ['Encore toi ? Tu es têtu, je te l\'accorde.', 'Deux raclées aujourd\'hui, et tu reviens ? J\'admire.'],
  ['{n} raclées aujourd\'hui… Tu commences à me faire de la peine.', 'Encore ? C\'est la {n}e fois aujourd\'hui ! Tu ne te lasses donc jamais ?'],
];
const FEAR_CRY = ['B-bon… Je ne me laisserai pas faire !', 'Doucement, cette fois !', 'Au secours !'];
const SMUG_CRY = ['Tu vas encore mordre la poussière !', 'Allez, une dernière raclée pour la route !', 'Ha ! Viens là !', 'Tiens, te revoilà ! Tu en redemandes ?', 'Déjà de retour ? Tes bleus n\'ont même pas eu le temps de sécher.'];

const pick = (list: string[], seed: number, n: number) => list[seed % list.length].replace('{n}', String(n));

/** Ce que dit le géant (s : son espèce) quand on vient lui parler, s'il se souvient de nous ; sinon null. */
export function moodLine(m: Mood | null, s: number) {
  if (!m) return null;
  return pick((m.mood === 'fear' ? FEAR : SMUG)[Math.min(2, m.n - 1)], s + m.n, m.n);
}

/** Son cri au début du combat, s'il se souvient de nous ; sinon null. */
export function moodCry(m: Mood | null, s: number) {
  if (!m) return null;
  return pick(m.mood === 'fear' ? FEAR_CRY : SMUG_CRY, s + m.n, m.n);
}
