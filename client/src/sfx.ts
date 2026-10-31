// Recettes des bruitages, entièrement synthétisées (aucun fichier son à télécharger).

/** Outils de synthèse d'un bruitage (temps en secondes depuis son départ, volumes de 0 à 1). */
export interface Synth {
  /** Oscillateur dont la hauteur glisse de f à to. */
  tone(f: number, to: number, dur: number, vol: number, type?: OscillatorType, delay?: number): void;
  /** Bruit filtré (vent, souffle, frottement), filtre qui glisse de f à to. q : résonance du filtre. */
  hiss(type: BiquadFilterType, f: number, dur: number, vol: number, to?: number, delay?: number, q?: number): void;
  /** Cloche ou métal (synthèse FM) : ratio et index règlent le timbre, plus ou moins métallique. */
  bell(f: number, dur: number, vol: number, ratio?: number, index?: number, delay?: number): void;
  /** Choc grave (sinus qui chute très vite), comme une grosse caisse. */
  thump(f: number, to: number, dur: number, vol: number, delay?: number): void;
  /**
   * Souffle qui passe (swing, flèche) : le volume monte jusqu'au milieu puis retombe, pendant que le filtre glisse
   * de f0 à f1 (au milieu) puis à f2 : un effet Doppler. q : plus il est haut, plus ça siffle.
   */
  whoosh(type: BiquadFilterType, f0: number, f1: number, f2: number, dur: number, vol: number, q?: number, delay?: number, peak?: number): void;
  /** Cuivre grave (dent de scie) : il enfle pendant que son filtre s'ouvre de c0 à c1, puis retombe. */
  horn(f: number, dur: number, vol: number, c0: number, c1: number, delay?: number): void;
}

export type Sfx =
  | 'hurt' | 'swing' | 'arrow' | 'orb' | 'pick' | 'chop' | 'chest'
  | 'roar' | 'boom' | 'death' | 'fanfare' | 'blip' | 'pop' | 'thunk' | 'chime' | 'shout' | 'shell'
  | 'hammer' | 'shiphorn' | 'waves' | 'kraken' | 'splash' | 'zap' | 'howl' | 'drum' | 'screech' | 'chomp';

export interface SfxDef {
  label: string;
  when: string; // quand on l'entend
  play: (s: Synth) => void;
}

const C5 = 523.3, E5 = 659.3, G5 = 784, C6 = 1046.5, E6 = 1318.5, G6 = 1568;
const arp = (s: Synth, notes: number[], step: number, dur: number, vol: number, type: OscillatorType = 'triangle', delay = 0) =>
  notes.forEach((f, k) => s.tone(f, f, dur, vol, type, delay + k * step));

export const SFX: Record<Sfx, SfxDef> = {
  hurt: {
    label: 'Touché', when: 'Un monstre te frappe.',
    play: (s) => { s.tone(120, 50, 0.2, 0.4, 'sawtooth'); s.hiss('lowpass', 900, 0.12, 0.25); },
  },
  swing: {
    label: 'Coup d\'épée dans le vide', when: 'Guerrier en attaque au clic.',
    play: (s) => { s.whoosh('bandpass', 900, 4200, 1300, 0.42, 0.35, 8); s.whoosh('lowpass', 300, 1500, 400, 0.42, 0.25, 1); },
  },

  arrow: {
    label: 'Flèche', when: 'L\'archer tire.',
    play: (s) => { s.tone(200, 140, 0.07, 0.18, 'triangle'); s.whoosh('bandpass', 5200, 3200, 1100, 0.5, 0.32, 4, 0.02, 0.3); },
  },

  orb: {
    label: 'Orbe du mage', when: 'Le mage lance son orbe.',
    play: (s) => { s.tone(140, 420, 0.3, 0.1, 'sawtooth'); s.tone(700, 1400, 0.3, 0.08, 'sine'); s.hiss('bandpass', 1500, 0.25, 0.1, 4000, 0, 3); },
  },
  pick: {
    label: 'Pioche', when: 'Tu mines un filon d\'or ou un rocher.',
    play: (s) => { s.thump(300, 150, 0.06, 0.35); s.hiss('bandpass', 1800, 0.09, 0.3, 1200, 0, 1); s.bell(1900, 0.12, 0.06, 1.5, 2); },
  },
  chop: {
    label: 'Hache', when: 'Tu coupes du bois mort.',
    play: (s) => { s.tone(260, 120, 0.12, 0.35, 'triangle'); s.hiss('bandpass', 1200, 0.08, 0.2); },
  },
  chest: {
    label: 'Coffre du géant', when: 'Tu ouvres le coffre d\'un géant vaincu.',
    play: (s) => { arp(s, [C5, E5, G5, C6], 0.09, 0.35, 0.11); for (let k = 0; k < 6; k++) s.bell(2200 + Math.random() * 1800, 0.3, 0.05, 2.76, 2, 0.3 + k * 0.07); },
  },
  roar: {
    label: 'Réveil du géant', when: 'Tu réveilles un géant : le combat commence.',
    play: (s) => {
      // cor de film : un accord grave de cuivres qui s'ouvre, enfle et retombe
      s.thump(80, 26, 1.2, 0.6);
      for (const [f, v] of [[55, 0.16], [82.4, 0.12], [110, 0.1], [55.6, 0.1]] as const) s.horn(f, 2.8, v, 150, 1400);
      s.hiss('lowpass', 600, 2.6, 0.2, 80);
    },
  },


  boom: {
    label: 'Attaque qui frappe', when: 'Bond, onde de choc, rochers… d\'un géant qui touche le sol.',
    play: (s) => { s.thump(85, 28, 0.6, 0.7); s.hiss('lowpass', 1600, 0.55, 0.4, 90); },
  },
  death: {
    label: 'Tu tombes', when: 'Tes PV tombent à zéro.',
    play: (s) => [392, 329.6, 261.6, 196].forEach((f, k) => s.tone(f, f * 0.97, 0.35, 0.12, 'triangle', k * 0.16)),
  },
  fanfare: {
    label: 'Amélioration', when: 'Arme, armure, Alpha renforcé, bâtiment construit, Hôtel de ville.',
    play: (s) => { arp(s, [G5, C6, E6], 0.08, 0.14, 0.08, 'square'); s.tone(G6, G6, 0.45, 0.08, 'square', 0.24); s.tone(C6, C6, 0.45, 0.06, 'triangle', 0.24); },
  },
  blip: {
    label: 'Message', when: 'Un message arrive dans le chat.',
    play: (s) => { s.tone(1400, 1400, 0.03, 0.06); s.tone(1800, 1800, 0.03, 0.06, 'sine', 0.05); },
  },
  pop: {
    label: 'Cueillette', when: 'Tu cueilles des baies.',
    play: (s) => { s.tone(400, 1000, 0.05, 0.1); s.tone(800, 1600, 0.05, 0.07, 'sine', 0.06); s.tone(600, 1300, 0.05, 0.06, 'sine', 0.12); },
  },
  thunk: {
    label: 'Dépôt à l\'entrepôt', when: 'Tu vides ton sac de bois et de pierre.',
    play: (s) => { s.tone(230, 210, 0.1, 0.25, 'triangle'); s.thump(120, 60, 0.15, 0.4, 0.09); s.hiss('lowpass', 900, 0.12, 0.2, 400, 0.1); },
  },
  shout: {
    label: 'Cri du suricate', when: 'Un Alpha suricate se dresse et crie : les alliés autour de lui frappent plus fort.',
    play: (s) => {
      // trois jappements aigus qui montent, puis un appel plus long
      for (let k = 0; k < 3; k++) s.tone(1500 + k * 180, 2300 + k * 220, 0.07, 0.12, 'square', k * 0.09);
      s.tone(1900, 2900, 0.22, 0.1, 'triangle', 0.3);
      s.hiss('bandpass', 3200, 0.2, 0.06, 4200, 0.3, 4);
    },
  },
  shell: {
    label: 'Carapace de l\'escargot', when: 'Un Alpha escargot dresse sa carapace : les alliés autour de lui encaissent moins.',
    play: (s) => { s.thump(160, 70, 0.18, 0.35); s.bell(880, 0.7, 0.08, 1.41, 1.5, 0.05); s.bell(1320, 0.6, 0.05, 1.41, 1.2, 0.12); },
  },
  hammer: {
    label: 'Marteau d\'Aubin', when: 'Aubin bâtit le bateau, au bout de l\'île.',
    play: (s) => { s.thump(420, 180, 0.05, 0.3); s.bell(1250, 0.1, 0.05, 1.7, 1.2); s.hiss('bandpass', 2400, 0.05, 0.15, 1500, 0, 2); },
  },
  shiphorn: {
    label: 'Corne du bateau', when: 'Le bateau largue les amarres.',
    play: (s) => {
      // une corne de brume, longue et grave, deux notes
      s.horn(73.4, 2.4, 0.2, 200, 900);
      s.horn(110, 2.4, 0.12, 200, 1100);
      s.horn(65.4, 2.2, 0.18, 200, 900, 2.5);
      s.horn(98, 2.2, 0.1, 200, 1000, 2.5);
    },
  },
  waves: {
    label: 'Vagues', when: 'Le bateau prend la mer.',
    play: (s) => { for (let k = 0; k < 3; k++) s.hiss('lowpass', 700, 1.6, 0.18, 220, k * 1.3, 0.7); },
  },
  kraken: {
    label: 'Le Kraken surgit', when: 'Le Kraken jaillit des flots et s\'attaque au bateau.',
    play: (s) => {
      s.thump(60, 22, 1.6, 0.8);
      for (const [f, v] of [[41, 0.18], [61.7, 0.14], [46.2, 0.12], [82.4, 0.08]] as const) s.horn(f, 3.4, v, 90, 900);
      s.hiss('lowpass', 900, 2.8, 0.35, 60);
      s.tone(180, 40, 2.2, 0.12, 'sawtooth', 0.4);
    },
  },
  howl: {
    label: 'Hurlement', when: 'Croc-d\'Ombre hurle à la mort (ou le Chacal lunaire appelle l\'éclipse).',
    play: (s) => { s.tone(330, 520, 0.5, 0.22, 'sawtooth'); s.tone(520, 300, 1.1, 0.2, 'triangle', 0.45); s.tone(262, 410, 1.4, 0.12, 'sine', 0.1); s.hiss('bandpass', 900, 1.4, 0.08, 600, 0.1, 3); },
  },
  drum: {
    label: 'Tambour de guerre', when: 'Le Roi Gorille se frappe le torse : un anneau d\'onde part.',
    play: (s) => { s.thump(70, 38, 0.35, 0.8); s.thump(95, 50, 0.2, 0.4, 0.09); s.hiss('lowpass', 500, 0.3, 0.25, 120); },
  },
  screech: {
    label: 'Cri strident', when: 'Le Seigneur des cendres lance son écholocation.',
    play: (s) => { s.tone(2400, 3600, 0.25, 0.12, 'square'); s.tone(3200, 2100, 0.35, 0.1, 'sawtooth', 0.12); s.hiss('highpass', 6000, 0.4, 0.15, 3000, 0, 6); },
  },
  chomp: {
    label: 'Mâchoires', when: 'Une gueule des dunes se referme, un crocodile happe sa proie.',
    play: (s) => { s.thump(140, 60, 0.18, 0.6); s.hiss('lowpass', 2600, 0.2, 0.35, 400); s.tone(180, 90, 0.12, 0.2, 'square', 0.04); },
  },
  zap: {
    label: 'Décharge', when: 'L\'éclair du Grand Drake rebondit d\'un monstre à l\'autre.',
    play: (s) => { s.hiss('highpass', 5000, 0.22, 0.35, 2500, 0, 4); s.tone(1800, 300, 0.12, 0.18, 'square'); s.tone(1400, 250, 0.1, 0.12, 'sawtooth', 0.06); },
  },
  splash: {
    label: 'Gerbe d\'eau', when: 'Un tentacule du Kraken s\'abat sur le pont.',
    play: (s) => { s.thump(110, 40, 0.4, 0.5); s.hiss('lowpass', 3200, 0.7, 0.4, 300); s.hiss('highpass', 4000, 0.4, 0.15, 1500, 0.05); },
  },
  chime: {
    label: 'Relevé, Alpha éveillé', when: 'Un coéquipier te relève, un Alpha s\'éveille.',
    play: (s) => arp(s, [C5, E5, G5, C6, E6, G6], 0.05, 0.4, 0.07),
  },
};
