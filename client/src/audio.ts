// Son du jeu, entièrement synthétisé (Web Audio) : aucune piste à télécharger.
// - Ambiances par lieu (village, camp, chaque zone, grotte), en fondu enchaîné : nappes douces, vent, eau,
//   feu, et petits événements au hasard (oiseaux, chouette, grillons, carillons, gouttes).
// - Bruitages courts déclenchés par les événements du jeu (coups, tirs, récolte, apprivoisement, coffre…).
// Le navigateur n'autorise le son qu'après un geste du joueur : tout démarre au premier clic ou à la première touche.

export interface AudioSettings {
  master: number; // 0 à 1
  music: number; // ambiances
  sfx: number; // bruitages
  muted: boolean;
}

const STORE = 'fangleaf.audio.v1';
const DEFAULTS: AudioSettings = { master: 0.7, music: 0.5, sfx: 0.8, muted: false };

function load(): AudioSettings {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Partial<AudioSettings> | null;
    const n = (v: unknown, d: number) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : d);
    return { master: n(s?.master, DEFAULTS.master), music: n(s?.music, DEFAULTS.music), sfx: n(s?.sfx, DEFAULTS.sfx), muted: !!s?.muted };
  } catch {
    return { ...DEFAULTS };
  }
}

export type Ambience = 'village' | 'camp' | 'zone1' | 'zone2' | 'zone3' | 'zone4' | 'zone5' | 'cave';
export type Sfx =
  | 'hit' | 'hurt' | 'swing' | 'arrow' | 'orb' | 'pick' | 'chop' | 'coin' | 'chest' | 'tame' | 'essence'
  | 'roar' | 'boom' | 'death' | 'fanfare' | 'blip' | 'pop' | 'thunk' | 'chime';

/** Une ambiance en cours : son volume (pour le fondu) et de quoi tout arrêter. */
interface Running {
  gain: GainNode;
  stop: () => void;
}

class Sound {
  readonly settings: AudioSettings = load();
  private ctx?: AudioContext;
  private master?: GainNode;
  private music?: GainNode;
  private sfxBus?: GainNode;
  private noise?: AudioBuffer;
  private current?: Running;
  private currentName?: Ambience;
  private wanted?: Ambience;
  private last = new Map<Sfx, number>();

  constructor() {
    // premier geste du joueur : on a enfin le droit de jouer du son
    const unlock = () => this.unlock();
    addEventListener('pointerdown', unlock, { once: true });
    addEventListener('keydown', unlock, { once: true });
  }

  private unlock() {
    if (this.ctx) return void this.ctx.resume();
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.music = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.music.connect(this.master);
    this.sfxBus.connect(this.master);
    this.master.connect(ctx.destination);
    // 2 s de bruit blanc, réutilisées par le vent, l'eau, le feu et les impacts
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;
    this.apply();
    if (this.wanted) this.ambience(this.wanted);
  }

  /** Volumes (et coupure) appliqués tout de suite, et gardés dans ce navigateur. */
  apply() {
    try {
      localStorage.setItem(STORE, JSON.stringify(this.settings));
    } catch { /* stockage indisponible */ }
    if (!this.ctx) return;
    const t = this.ctx.currentTime, s = this.settings;
    this.master!.gain.setTargetAtTime(s.muted ? 0 : s.master, t, 0.05);
    // son coupé : le moteur audio est mis en pause (plus aucun calcul d'ambiance), repris au retour du son
    if (s.muted && this.ctx.state === 'running') setTimeout(() => this.settings.muted && void this.ctx?.suspend(), 200);
    else if (!s.muted && this.ctx.state === 'suspended') void this.ctx.resume();
    this.music!.gain.setTargetAtTime(s.music, t, 0.05);
    this.sfxBus!.gain.setTargetAtTime(s.sfx, t, 0.05);
  }

  // ───────────────────────── Ambiances ─────────────────────────

  /** Change d'ambiance (fondu de 2 s) ; sans effet si c'est déjà celle-ci. */
  ambience(name: Ambience) {
    this.wanted = name;
    if (!this.ctx || name === this.currentName) return;
    const old = this.current, t = this.ctx.currentTime;
    if (old) {
      old.gain.gain.setTargetAtTime(0, t, 0.6);
      setTimeout(() => old.stop(), 3000);
    }
    this.currentName = name;
    this.current = this.build(name);
    this.current.gain.gain.setValueAtTime(0, t);
    this.current.gain.gain.setTargetAtTime(1, t, 0.7);
  }

  private build(name: Ambience): Running {
    const ctx = this.ctx!, out = ctx.createGain();
    out.connect(this.music!);
    const stops: (() => void)[] = [];
    const timers: number[] = [];
    // nappe : quelques sinus/triangles légèrement désaccordés, filtrés, qui respirent lentement
    const pad = (freqs: number[], type: OscillatorType, cutoff: number, vol: number) => {
      const g = ctx.createGain(), f = ctx.createBiquadFilter(), lfo = ctx.createOscillator(), depth = ctx.createGain();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      g.gain.value = vol;
      lfo.frequency.value = 0.07 + Math.random() * 0.05;
      depth.gain.value = vol * 0.45;
      lfo.connect(depth).connect(g.gain);
      f.connect(g).connect(out);
      for (const fr of freqs) {
        for (const det of [-4, 4]) {
          const o = ctx.createOscillator();
          o.type = type;
          o.frequency.value = fr;
          o.detune.value = det;
          o.connect(f);
          o.start();
          stops.push(() => o.stop());
        }
      }
      lfo.start();
      stops.push(() => lfo.stop());
    };
    // lit de bruit filtré (vent, eau) ; sway fait onduler le filtre
    const bed = (type: BiquadFilterType, freq: number, q: number, vol: number, sway = 0) => {
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = this.noise!;
      src.loop = true;
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      g.gain.value = vol;
      src.connect(f).connect(g).connect(out);
      if (sway) {
        const lfo = ctx.createOscillator(), depth = ctx.createGain();
        lfo.frequency.value = 0.09;
        depth.gain.value = sway;
        lfo.connect(depth).connect(f.frequency);
        lfo.start();
        stops.push(() => lfo.stop());
      }
      src.start();
      stops.push(() => src.stop());
    };
    // événement ponctuel répété au hasard (toutes les min à max secondes)
    const every = (min: number, max: number, play: () => void) => {
      const next = () => {
        timers.push(window.setTimeout(() => {
          play();
          next();
        }, (min + Math.random() * (max - min)) * 1000));
      };
      next();
    };
    const tone = (freq: number, to: number, dur: number, vol: number, type: OscillatorType = 'sine', delay = 0) => {
      const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + dur + 0.05);
    };
    const crackle = () => {
      const t = ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = this.noise!;
      f.type = 'highpass';
      f.frequency.value = 1800;
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      src.connect(f).connect(g).connect(out);
      src.start(t, Math.random());
      src.stop(t + 0.06);
    };
    const bird = () => {
      const base = 2200 + Math.random() * 1200;
      for (let k = 0; k < 2 + Math.floor(Math.random() * 3); k++) tone(base, base * 1.35, 0.09, 0.05, 'sine', k * 0.13);
    };
    const drop = () => tone(1400 + Math.random() * 600, 500, 0.18, 0.06);

    if (name === 'village' || name === 'camp') {
      pad([220, 277.2, 329.6], 'sine', 900, 0.035);
      bed('lowpass', 500, 0.5, 0.02);
      every(0.15, 0.7, crackle); // le feu de camp crépite
      if (name === 'village') every(5, 11, bird);
    } else if (name === 'zone1') {
      pad([196, 246.9, 293.7], 'sine', 1000, 0.03);
      bed('bandpass', 700, 0.6, 0.02, 250);
      every(3, 8, bird);
    } else if (name === 'zone2') {
      pad([174.6, 207.7, 261.6], 'triangle', 700, 0.03);
      bed('bandpass', 500, 0.8, 0.025, 200);
      every(9, 16, () => {
        tone(420, 400, 0.35, 0.05); // hou… hou (chouette)
        tone(380, 360, 0.5, 0.05, 'sine', 0.5);
      });
      every(6, 12, bird);
    } else if (name === 'zone3') {
      pad([146.8, 220], 'sine', 600, 0.025);
      bed('bandpass', 900, 0.7, 0.04, 500); // vent des landes
      every(1.5, 4, () => {
        for (let k = 0; k < 4; k++) tone(4200, 4100, 0.04, 0.02, 'square', k * 0.07); // grillons
      });
    } else if (name === 'zone4') {
      pad([155.6, 185, 233.1], 'triangle', 650, 0.03);
      bed('bandpass', 600, 1, 0.02, 200);
      every(5, 10, () => {
        for (const [f, d] of [[1318.5, 0], [1567.98, 0.25], [1975.5, 0.5]] as const) tone(f, f * 0.99, 1.2, 0.035, 'sine', d); // runes qui tintent
      });
    } else if (name === 'zone5') {
      pad([164.8, 220, 246.9], 'sine', 800, 0.03);
      bed('lowpass', 380, 0.7, 0.05, 120); // clapotis des lacs
      every(1.5, 4, drop);
    } else {
      pad([55, 82.4], 'sawtooth', 220, 0.03); // grotte : grondement sourd
      bed('lowpass', 250, 0.7, 0.025);
      every(1, 3, drop);
    }
    return {
      gain: out,
      stop: () => {
        timers.forEach(clearTimeout);
        stops.forEach((s) => {
          try {
            s();
          } catch { /* déjà arrêté */ }
        });
        out.disconnect();
      },
    };
  }

  // ───────────────────────── Bruitages ─────────────────────────

  /** Joue un bruitage (vol : 0 à 1, pour les sons lointains). Limité en rafale pour ne pas saturer. */
  play(name: Sfx, vol = 1) {
    if (!this.ctx || this.settings.muted || vol <= 0.02) return;
    const now = this.ctx.currentTime, gap = name === 'hit' || name === 'coin' || name === 'blip' ? 0.06 : 0.03;
    if (now - (this.last.get(name) ?? -1) < gap) return;
    this.last.set(name, now);
    const ctx = this.ctx, out = ctx.createGain();
    out.gain.value = vol;
    out.connect(this.sfxBus!);
    const tone = (freq: number, to: number, dur: number, v: number, type: OscillatorType = 'sine', delay = 0) => {
      const t = now + delay, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + dur + 0.05);
    };
    const hiss = (type: BiquadFilterType, freq: number, dur: number, v: number, to = freq, delay = 0) => {
      const t = now + delay, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = this.noise!;
      f.type = type;
      f.frequency.setValueAtTime(freq, t);
      f.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(out);
      src.start(t, Math.random());
      src.stop(t + dur + 0.05);
    };
    switch (name) {
      case 'hit': // coup qui porte : choc sourd et claquement
        tone(180, 70, 0.12, 0.35, 'triangle');
        hiss('bandpass', 2500, 0.06, 0.25);
        break;
      case 'hurt': // on est touché : coup plus grave
        tone(120, 50, 0.2, 0.4, 'sawtooth');
        hiss('lowpass', 900, 0.12, 0.25);
        break;
      case 'swing':
        hiss('bandpass', 900, 0.14, 0.25, 3000);
        break;
      case 'arrow':
        hiss('bandpass', 3000, 0.18, 0.2, 1200);
        tone(900, 500, 0.06, 0.08, 'triangle');
        break;
      case 'orb':
        tone(500, 1100, 0.22, 0.15, 'sine');
        tone(750, 1650, 0.22, 0.08, 'sine');
        break;
      case 'pick': // pioche sur la roche : tintement métallique
        tone(2200, 2000, 0.12, 0.18, 'triangle');
        tone(3300, 3100, 0.08, 0.08, 'sine');
        hiss('highpass', 4000, 0.05, 0.15);
        break;
      case 'chop': // hache dans le bois : coup mat
        tone(260, 120, 0.12, 0.35, 'triangle');
        hiss('bandpass', 1200, 0.08, 0.2);
        break;
      case 'coin':
        tone(1975.5, 1975.5, 0.12, 0.08);
        tone(2637, 2637, 0.16, 0.06, 'sine', 0.05);
        break;
      case 'chest': // pluie de pièces
        for (let k = 0; k < 7; k++) tone(1800 + Math.random() * 1400, 1700, 0.15, 0.08, 'sine', k * 0.06);
        tone(523.3, 523.3, 0.3, 0.1, 'triangle');
        tone(659.3, 659.3, 0.3, 0.1, 'triangle', 0.1);
        tone(784, 784, 0.45, 0.1, 'triangle', 0.2);
        break;
      case 'tame': // apprivoisé : arpège joyeux
        [523.3, 659.3, 784, 1046.5].forEach((f, k) => tone(f, f, 0.25, 0.12, 'triangle', k * 0.08));
        break;
      case 'essence':
        [1318.5, 1760, 2093].forEach((f, k) => tone(f, f * 1.01, 0.4, 0.06, 'sine', k * 0.07));
        break;
      case 'roar': // un géant se réveille
        tone(110, 55, 1.0, 0.35, 'sawtooth');
        tone(82, 45, 1.1, 0.3, 'square');
        hiss('lowpass', 600, 0.9, 0.3, 200);
        break;
      case 'boom':
        tone(90, 35, 0.5, 0.45, 'sine');
        hiss('lowpass', 1200, 0.4, 0.35, 150);
        break;
      case 'death':
        [392, 329.6, 261.6, 196].forEach((f, k) => tone(f, f * 0.97, 0.35, 0.12, 'triangle', k * 0.16));
        break;
      case 'fanfare': // amélioration, construction, niveau
        [523.3, 659.3, 784].forEach((f, k) => tone(f, f, 0.18, 0.1, 'square', k * 0.09));
        tone(1046.5, 1046.5, 0.5, 0.1, 'square', 0.27);
        break;
      case 'blip': // message du chat
        tone(880, 1200, 0.07, 0.07);
        break;
      case 'pop': // cueillette
        tone(600, 1100, 0.07, 0.12);
        break;
      case 'thunk': // dépôt à l'entrepôt
        tone(200, 110, 0.15, 0.3, 'triangle');
        tone(160, 90, 0.15, 0.25, 'triangle', 0.12);
        break;
      case 'chime': // relevé, réveil d'un Alpha
        [784, 1046.5, 1318.5].forEach((f, k) => tone(f, f, 0.5, 0.07, 'sine', k * 0.1));
        break;
    }
    setTimeout(() => out.disconnect(), 3000);
  }
}

export const sound = new Sound();
