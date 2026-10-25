// Son du jeu, entièrement synthétisé (Web Audio) : aucune piste à télécharger.
// - Ambiances par lieu (village, camp, chaque zone, grotte), en fondu enchaîné : nappes douces, vent, eau,
//   feu, et petits événements au hasard (oiseaux, chouette, grillons, carillons, gouttes).
// - Bruitages courts déclenchés par les événements du jeu (coups, tirs, récolte, apprivoisement, coffre…).
// Le navigateur n'autorise le son qu'après un geste du joueur : tout démarre au premier clic ou à la première touche.
// Les recettes des bruitages sont dans sfx.ts, les musiques des lieux dans music.ts.

import { SFX, type Sfx, type Synth } from './sfx.ts';
import { MUSIC, playScore } from './music.ts';

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

export type Ambience = 'village' | 'camp' | 'zone1' | 'zone2' | 'zone3' | 'zone4' | 'zone5' | 'zone6' | 'zone7' | 'cave' | 'boss'; // boss : grotte, géant réveillé
export type { Sfx } from './sfx.ts';

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
  private place?: GainNode; // ambiance du lieu, baissée sous la pluie
  private rainSound?: { gain: GainNode; stop: () => void };
  private rainLevel = 0;
  private stormSound?: { gain: GainNode; stop: () => void };
  private stormLevel = 0;
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
    this.place = ctx.createGain();
    this.place.connect(this.music);
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

  /** Change d'ambiance (fondu enchaîné d'environ 4 s) ; sans effet si c'est déjà celle-ci. */
  ambience(name: Ambience) {
    this.wanted = name;
    if (!this.ctx || name === this.currentName) return;
    const old = this.current, t = this.ctx.currentTime;
    if (old) {
      old.gain.gain.setTargetAtTime(0, t, 1.2);
      setTimeout(() => old.stop(), 6000);
    }
    this.currentName = name;
    this.current = this.build(name);
    this.current.gain.gain.setValueAtTime(0, t);
    this.current.gain.gain.setTargetAtTime(1, t, 1.3); // fondu enchaîné d'environ 4 s : on passe d'un lieu à l'autre en douceur
  }

  /** Pluie (0 à 1) : bruissement continu par-dessus l'ambiance du lieu, qui se fait plus discrète. */
  rain(level: number) {
    if (!this.ctx || level === this.rainLevel || (level > 0 && Math.abs(level - this.rainLevel) < 0.01)) return;
    this.rainLevel = level;
    const ctx = this.ctx, t = ctx.currentTime;
    if (level > 0 && !this.rainSound) {
      const gain = ctx.createGain(), stops: (() => void)[] = [];
      gain.gain.value = 0;
      gain.connect(this.music!);
      // crépitement (aigus) et rumeur (graves), sur le même bruit blanc
      for (const [type, freq, q, vol] of [['bandpass', 3200, 0.5, 0.5], ['lowpass', 420, 0.7, 0.8]] as const) {
        const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = this.noise!;
        src.loop = true;
        src.playbackRate.value = type === 'lowpass' ? 0.7 : 1;
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = q;
        g.gain.value = vol;
        src.connect(f).connect(g).connect(gain);
        src.start(t, Math.random() * 2);
        stops.push(() => src.stop());
      }
      this.rainSound = { gain, stop: () => stops.forEach((s) => s()) };
    }
    if (this.rainSound) this.rainSound.gain.gain.setTargetAtTime(level * 0.22, t, 0.8);
    this.place!.gain.setTargetAtTime(1 - level * 0.4, t, 0.8);
    if (level === 0 && this.rainSound) {
      const r = this.rainSound;
      this.rainSound = undefined;
      setTimeout(() => r.stop(), 4000);
    }
  }

  /** Tempête de sable (0 à 1) : souffle grave et sifflement du vent, par-dessus l'ambiance qui s'efface presque. */
  storm(level: number) {
    if (!this.ctx || level === this.stormLevel || (level > 0 && Math.abs(level - this.stormLevel) < 0.01)) return;
    this.stormLevel = level;
    const ctx = this.ctx, t = ctx.currentTime;
    if (level > 0 && !this.stormSound) {
      const gain = ctx.createGain(), stops: (() => void)[] = [];
      gain.gain.value = 0;
      gain.connect(this.music!);
      for (const [type, freq, q, vol, rate] of [['bandpass', 420, 0.6, 0.9, 0.6], ['bandpass', 2400, 3, 0.25, 1]] as const) {
        const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), depth = ctx.createGain();
        src.buffer = this.noise!;
        src.loop = true;
        src.playbackRate.value = rate;
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = q;
        g.gain.value = vol;
        lfo.frequency.value = 0.15 + Math.random() * 0.1; // rafales
        depth.gain.value = freq * 0.35;
        lfo.connect(depth).connect(f.frequency);
        src.connect(f).connect(g).connect(gain);
        src.start(t, Math.random() * 2);
        lfo.start(t);
        stops.push(() => src.stop(), () => lfo.stop());
      }
      this.stormSound = { gain, stop: () => stops.forEach((s) => s()) };
    }
    if (this.stormSound) this.stormSound.gain.gain.setTargetAtTime(level * 0.3, t, 1);
    this.place!.gain.setTargetAtTime(1 - Math.max(level * 0.7, this.rainLevel * 0.4), t, 1);
    if (level === 0 && this.stormSound) {
      const s = this.stormSound;
      this.stormSound = undefined;
      setTimeout(() => s.stop(), 5000);
    }
  }

  private build(name: Ambience): Running {
    const ctx = this.ctx!, out = ctx.createGain();
    out.connect(this.place!);
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
    } else if (name === 'zone6') {
      // jungle : air lourd et humide, insectes, oiseaux tropicaux, singes au loin, gouttes qui tombent des feuilles
      pad([110, 164.8, 196], 'triangle', 600, 0.028);
      bed('bandpass', 2600, 0.4, 0.03, 900);
      every(0.8, 2.2, () => {
        for (let k = 0; k < 6; k++) tone(3600 + Math.random() * 300, 3500, 0.025, 0.012, 'square', k * 0.045); // cigales
      });
      every(3, 7, () => {
        const f = 1400 + Math.random() * 600; // oiseau tropical : un appel qui monte puis plonge
        tone(f, f * 1.6, 0.12, 0.05, 'sine');
        tone(f * 1.6, f * 0.8, 0.22, 0.045, 'sine', 0.13);
      });
      every(9, 18, () => {
        for (let k = 0; k < 4; k++) tone(520 + k * 90, 900 + k * 120, 0.18, 0.03, 'triangle', k * 0.2); // singes au loin
      });
      every(1.2, 3, drop);
    } else if (name === 'zone7') {
      pad([146.8, 196, 233.1], 'sine', 700, 0.025);
      bed('bandpass', 1100, 0.5, 0.05, 700); // vent qui siffle sur les dunes
      every(4, 9, () => tone(2600, 1700, 0.5, 0.03, 'sine')); // cri lointain d'un rapace
      every(2, 5, () => {
        for (let k = 0; k < 3; k++) tone(5200, 5000, 0.03, 0.015, 'square', k * 0.05); // sable qui crépite
      });
    } else {
      pad([55, 82.4], 'sawtooth', 220, name === 'boss' ? 0.02 : 0.03); // grotte : grondement sourd (combat : sous la musique)
      bed('lowpass', 250, 0.7, 0.025);
      every(1, 3, drop);
    }
    // musique du lieu, par-dessus l'ambiance
    const score = MUSIC[name]?.score;
    if (score) stops.push(playScore(ctx, out, this.noise!, score));
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
    const now = this.ctx.currentTime, gap = name === 'blip' ? 0.06 : 0.03;
    if (now - (this.last.get(name) ?? -1) < gap) return;
    this.last.set(name, now);
    const ctx = this.ctx, out = ctx.createGain();
    out.gain.value = vol;
    out.connect(this.sfxBus!);
    const env = (g: GainNode, t: number, v: number, dur: number) => {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    };
    const synth: Synth = {
      tone: (freq, to, dur, v, type = 'sine', delay = 0) => {
        const t = now + delay, o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        env(g, t, v, dur);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + dur + 0.05);
      },
      hiss: (type, freq, dur, v, to = freq, delay = 0, q = 1) => {
        const t = now + delay, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = this.noise!;
        f.type = type;
        f.Q.value = q;
        f.frequency.setValueAtTime(freq, t);
        f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(v, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f).connect(g).connect(out);
        src.start(t, Math.random());
        src.stop(t + dur + 0.05);
      },
      bell: (freq, dur, v, ratio = 2, index = 2, delay = 0) => {
        // synthèse FM : un modulateur fait vibrer la porteuse, de moins en moins (timbre de cloche, de métal)
        const t = now + delay, car = ctx.createOscillator(), mod = ctx.createOscillator(), depth = ctx.createGain(), g = ctx.createGain();
        car.frequency.value = freq;
        mod.frequency.value = freq * ratio;
        depth.gain.setValueAtTime(freq * index, t);
        depth.gain.exponentialRampToValueAtTime(Math.max(1, freq * index * 0.05), t + dur);
        mod.connect(depth).connect(car.frequency);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(v, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        car.connect(g).connect(out);
        for (const o of [car, mod]) {
          o.start(t);
          o.stop(t + dur + 0.05);
        }
      },
      whoosh: (type, f0, f1, f2, dur, v, q = 2, delay = 0, peak = 0.45) => {
        // souffle qui passe : il enfle jusqu'au milieu (peak : où, de 0 à 1) puis s'éteint, le filtre fait l'aller-retour
        const t = now + delay, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), mid = t + dur * peak;
        src.buffer = this.noise!;
        f.type = type;
        f.Q.value = q;
        f.frequency.setValueAtTime(f0, t);
        f.frequency.exponentialRampToValueAtTime(f1, mid);
        f.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(v, mid);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f).connect(g).connect(out);
        src.start(t, Math.random());
        src.stop(t + dur + 0.05);
      },
      horn: (freq, dur, v, c0, c1, delay = 0) => {
        const t = now + delay, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(freq, t);
        o.frequency.linearRampToValueAtTime(freq * 0.985, t + dur);
        f.type = 'lowpass';
        f.Q.value = 1.5;
        f.frequency.setValueAtTime(c0, t);
        f.frequency.exponentialRampToValueAtTime(c1, t + dur * 0.35);
        f.frequency.exponentialRampToValueAtTime(c0, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(v, t + dur * 0.25);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(f).connect(g).connect(out);
        o.start(t);
        o.stop(t + dur + 0.05);
      },
      thump: (freq, to, dur, v, delay = 0) => {
        // choc grave : la hauteur chute très vite, le volume aussi
        const t = now + delay, o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur * 0.4);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(v, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + dur + 0.05);
      },
    };
    SFX[name].play(synth);
    setTimeout(() => out.disconnect(), 5000);
  }
}

export const sound = new Sound();
