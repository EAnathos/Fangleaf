// Musiques des lieux, entièrement synthétisées : un petit séquenceur joue en boucle un morceau (accords, basse,
// arpèges, mélodie, percussions) par-dessus l'ambiance du lieu (vent, oiseaux, feu…). Les grottes n'en ont pas :
// l'ambiance seule ; un géant réveillé y lance la musique de combat.

export type Place = 'village' | 'camp' | 'zone1' | 'zone2' | 'zone3' | 'zone4' | 'zone5' | 'zone6' | 'zone7' | 'cave' | 'boss';

type Inst = 'pluck' | 'flute' | 'bell' | 'soft' | 'brass';
/** Un morceau : tonalité, tempo, grille d'accords et les instruments qui la jouent. */
export interface Score {
  name: string;
  bpm: number;
  root: number; // tonique en Hz (octave de la basse ×4 environ)
  scale: number[]; // demi-tons depuis la tonique
  chords: number[]; // degré de la gamme de chaque accord (une mesure chacun)
  pad?: { type: OscillatorType; vol: number; cutoff: number };
  bass?: { type: OscillatorType; vol: number; pattern: number[] }; // 1 : note (sur 8 croches)
  arp?: { inst: Inst; vol: number; pattern: number[]; octave: number }; // indices dans l'accord (-1 : silence)
  lead?: { inst: Inst; vol: number; density: number; octave: number; long?: boolean }; // mélodie inventée, rejouée par phrases
  drums?: { kick: number[]; hat: number[]; tom?: number[]; vol: number }; // 8 croches par mesure
  echo?: number; // part d'écho (0 à 0,5)
}

const HIJAZ = [0, 1, 4, 5, 7, 8, 10]; // seconde augmentée : couleur des déserts
const PENTA = [0, 3, 5, 7, 10]; // pentatonique mineure : la jungle
const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10], MIX = [0, 2, 4, 5, 7, 9, 10], LYD = [0, 2, 4, 6, 7, 9, 11];

export const MUSIC: Record<Place, { label: string; score: Score | null }> = {
  village: { label: 'Village', score: { name: 'Place du village', bpm: 92, root: 130.8, scale: MAJ, chords: [0, 5, 3, 4], pad: { type: 'triangle', vol: 0.025, cutoff: 1200 }, bass: { type: 'triangle', vol: 0.09, pattern: [1, 0, 0, 0, 1, 0, 0, 0] }, arp: { inst: 'pluck', vol: 0.05, pattern: [0, 1, 2, 1, 0, 1, 2, 1], octave: 2 }, lead: { inst: 'flute', vol: 0.05, density: 0.45, octave: 3 }, echo: 0.2 } },
  camp: { label: 'Plage d\'arrivée et camps', score: { name: 'Braises', bpm: 60, root: 98, scale: MIX, chords: [0, 6, 0, 3], pad: { type: 'triangle', vol: 0.03, cutoff: 600 }, lead: { inst: 'bell', vol: 0.04, density: 0.2, octave: 3, long: true }, echo: 0.4 } },
  zone1: { label: 'Lisière (zone 1)', score: { name: 'Clairière', bpm: 96, root: 146.8, scale: [0, 2, 4, 7, 9], chords: [0, 3, 1, 2], pad: { type: 'sine', vol: 0.025, cutoff: 1100 }, lead: { inst: 'flute', vol: 0.055, density: 0.5, octave: 3 }, bass: { type: 'sine', vol: 0.08, pattern: [1, 0, 0, 0, 1, 0, 0, 0] }, echo: 0.25 } },
  zone2: { label: 'Bois profonds (zone 2)', score: { name: 'Traque', bpm: 112, root: 98, scale: MIN, chords: [0, 5, 3, 4], bass: { type: 'sawtooth', vol: 0.05, pattern: [1, 1, 0, 1, 1, 0, 1, 0] }, arp: { inst: 'pluck', vol: 0.045, pattern: [0, 2, 0, 1, 0, 2, 0, 1], octave: 2 }, drums: { kick: [1, 0, 0, 1, 0, 0, 1, 0], hat: [0, 0, 1, 0, 0, 1, 0, 0], vol: 0.4 }, echo: 0.15 } },
  zone3: { label: 'Landes (zone 3)', score: { name: 'Chevauchée', bpm: 124, root: 98, scale: MIX, chords: [0, 6, 3, 4], bass: { type: 'triangle', vol: 0.1, pattern: [1, 0, 1, 1, 0, 1, 1, 0] }, lead: { inst: 'brass', vol: 0.04, density: 0.45, octave: 3 }, drums: { kick: [1, 0, 0, 1, 0, 0, 1, 0], hat: [0, 1, 0, 1, 0, 1, 0, 1], tom: [0, 0, 0, 0, 0, 0, 0, 1], vol: 0.45 }, echo: 0.12 } },
  zone4: { label: 'Ruines moussues (zone 4)', score: { name: 'Runes', bpm: 84, root: 110, scale: MIN, chords: [0, 5, 6, 4], pad: { type: 'sine', vol: 0.03, cutoff: 800 }, arp: { inst: 'bell', vol: 0.035, pattern: [0, 2, 1, 3, 2, 1, 0, 2], octave: 3 }, echo: 0.4 } },
  zone5: { label: 'Lacs brumeux (zone 5)', score: { name: 'Reflets', bpm: 84, root: 130.8, scale: LYD, chords: [0, 1, 5, 4], arp: { inst: 'pluck', vol: 0.05, pattern: [0, 2, 3, 2, 1, 2, 3, 2], octave: 2 }, pad: { type: 'triangle', vol: 0.025, cutoff: 1000 }, bass: { type: 'sine', vol: 0.07, pattern: [1, 0, 0, 0, 1, 0, 0, 0] }, echo: 0.3 } },
  zone6: { label: 'Jungle (zone 6)', score: { name: 'Canopée', bpm: 104, root: 110, scale: PENTA, chords: [0, 3, 4, 2], pad: { type: 'triangle', vol: 0.022, cutoff: 750 }, bass: { type: 'sine', vol: 0.08, pattern: [1, 0, 0, 1, 0, 1, 0, 0] }, arp: { inst: 'pluck', vol: 0.05, pattern: [0, 2, 1, 2, 0, 3, 1, 2], octave: 2 }, lead: { inst: 'flute', vol: 0.04, density: 0.3, octave: 3 }, drums: { kick: [1, 0, 0, 1, 0, 0, 1, 0], hat: [0, 1, 0, 1, 0, 1, 1, 1], tom: [0, 0, 1, 0, 1, 0, 0, 1], vol: 0.35 }, echo: 0.22 } },
  zone7: { label: 'Mer de sable (zone 7)', score: { name: 'Mirages', bpm: 88, root: 110, scale: HIJAZ, chords: [0, 1, 0, 6], pad: { type: 'triangle', vol: 0.025, cutoff: 900 }, arp: { inst: 'pluck', vol: 0.05, pattern: [0, 1, 2, 1, 3, 2, 1, 0], octave: 2 }, lead: { inst: 'flute', vol: 0.045, density: 0.35, octave: 3 }, drums: { kick: [1, 0, 0, 1, 0, 0, 1, 0], hat: [0, 0, 0, 0, 0, 0, 0, 0], tom: [0, 0, 1, 0, 0, 1, 0, 1], vol: 0.3 }, echo: 0.3 } },
  cave: { label: 'Grottes', score: null }, // ambiance seule
  boss: { label: 'Combat de géant', score: { name: 'Duel', bpm: 152, root: 98, scale: MIN, chords: [0, 0, 5, 4], bass: { type: 'square', vol: 0.035, pattern: [1, 0, 1, 1, 0, 1, 1, 0] }, arp: { inst: 'pluck', vol: 0.05, pattern: [0, 1, 2, 3, 2, 1, 0, 1], octave: 2 }, drums: { kick: [1, 0, 0, 0, 1, 0, 0, 0], hat: [1, 1, 1, 1, 1, 1, 1, 1], vol: 0.4 }, echo: 0.1 } },
};

/** Petit générateur aléatoire reproductible (une mélodie stable pour un morceau donné). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Joue un morceau en boucle sur out (avec un écho), jusqu'à stop(). La mélodie est inventée une fois, phrase de
 * 4 mesures sur les notes des accords, puis rejouée avec de légères variations : on la reconnaît d'une boucle à l'autre.
 */
export function playScore(ctx: AudioContext, out: AudioNode, noise: AudioBuffer, sc: Score) {
  const bus = ctx.createGain();
  bus.connect(out);
  if (sc.echo) {
    const delay = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain(), tone = ctx.createBiquadFilter();
    delay.delayTime.value = (60 / sc.bpm) * 0.75; // écho en croche pointée
    fb.gain.value = 0.35;
    wet.gain.value = sc.echo;
    tone.type = 'lowpass';
    tone.frequency.value = 2400;
    bus.connect(delay).connect(tone).connect(fb).connect(delay);
    tone.connect(wet).connect(out);
  }
  const step = 60 / sc.bpm / 2; // une croche
  const note = (deg: number, oct: number) => {
    const n = sc.scale.length, d = ((deg % n) + n) % n, o = Math.floor(deg / n);
    return sc.root * 2 ** (oct + o + sc.scale[d] / 12);
  };
  const chordOf = (bar: number) => sc.chords[bar % sc.chords.length];
  const triad = (bar: number) => [0, 2, 4, 7].map((k) => chordOf(bar) + k); // tierces empilées (+ octave)
  const live = new Set<AudioScheduledSourceNode>();
  const track = (s: AudioScheduledSourceNode) => {
    live.add(s);
    s.onended = () => live.delete(s);
  };

  const voice = (inst: Inst, f: number, t: number, dur: number, vol: number) => {
    const o = ctx.createOscillator(), g = ctx.createGain(), flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    o.frequency.value = f;
    let attack = 0.01, release = dur;
    if (inst === 'pluck') {
      o.type = 'triangle';
      flt.frequency.setValueAtTime(f * 6, t);
      flt.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.3);
      release = Math.min(dur, 0.6);
    } else if (inst === 'flute') {
      o.type = 'sine';
      flt.frequency.value = f * 4;
      attack = 0.06;
      const vib = ctx.createOscillator(), vd = ctx.createGain(); // léger vibrato
      vib.frequency.value = 5;
      vd.gain.value = f * 0.006;
      vib.connect(vd).connect(o.frequency);
      vib.start(t + 0.15);
      vib.stop(t + dur + 0.1);
      track(vib);
    } else if (inst === 'bell') {
      o.type = 'sine';
      flt.frequency.value = f * 8;
      const m = ctx.createOscillator(), md = ctx.createGain(); // FM : timbre de cloche
      m.frequency.value = f * 3.5;
      md.gain.setValueAtTime(f * 1.5, t);
      md.gain.exponentialRampToValueAtTime(f * 0.05, t + dur);
      m.connect(md).connect(o.frequency);
      m.start(t);
      m.stop(t + dur + 0.1);
      track(m);
      attack = 0.003;
    } else if (inst === 'brass') {
      o.type = 'sawtooth';
      flt.frequency.setValueAtTime(f * 1.2, t);
      flt.frequency.linearRampToValueAtTime(f * 4, t + 0.08);
      flt.frequency.linearRampToValueAtTime(f * 2.5, t + dur);
      attack = 0.04;
    } else {
      o.type = 'triangle';
      flt.frequency.value = f * 3;
      attack = 0.08;
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack + 0.02, release));
    o.connect(flt).connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.1);
    track(o);
  };
  const drum = (kind: 'kick' | 'hat' | 'tom', t: number, vol: number) => {
    if (kind === 'hat') {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noise;
      f.type = 'highpass';
      f.frequency.value = 7000;
      g.gain.setValueAtTime(vol * 0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      s.connect(f).connect(g).connect(bus);
      s.start(t, Math.random());
      s.stop(t + 0.06);
      track(s);
      return;
    }
    const o = ctx.createOscillator(), g = ctx.createGain(), f0 = kind === 'kick' ? 110 : 160, f1 = kind === 'kick' ? 45 : 90;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * (kind === 'kick' ? 0.5 : 0.35), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'kick' ? 0.3 : 0.4));
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + 0.45);
    track(o);
  };

  // mélodie : 4 mesures de 8 croches, sur les notes de l'accord (et parfois une note de passage)
  const rand = rng(Math.round(sc.bpm * 1000 + sc.root));
  const phrase: (number | null)[][] = [];
  for (let bar = 0; bar < 4; bar++) {
    const row: (number | null)[] = [];
    let last = 2;
    for (let i = 0; i < 8; i++) {
      const lead = sc.lead;
      const play = lead && (i === 0 || rand() < lead.density) && !(lead.long && i % 2);
      if (!play) {
        row.push(null);
        continue;
      }
      last = Math.max(0, Math.min(6, last + Math.round((rand() - 0.5) * 3)));
      row.push(rand() < 0.75 ? Math.round(last / 2) * 2 : last); // surtout des notes de l'accord
    }
    phrase.push(row);
  }

  let barStart = ctx.currentTime + 0.1, bar = 0, padStop: (() => void) | null = null;
  const scheduleBar = (t0: number, b: number) => {
    const tri = triad(b);
    if (sc.pad) {
      // accord tenu sur toute la mesure, qui se fond dans le suivant
      const stops: (() => void)[] = [];
      const g = ctx.createGain(), flt = ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.value = sc.pad.cutoff;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(sc.pad.vol, t0 + 0.6);
      g.gain.setValueAtTime(sc.pad.vol, t0 + step * 8 - 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + step * 8 + 0.8);
      flt.connect(g).connect(bus);
      for (const deg of tri.slice(0, 3)) {
        for (const det of [-5, 5]) {
          const o = ctx.createOscillator();
          o.type = sc.pad.type;
          o.frequency.value = note(deg, 1);
          o.detune.value = det;
          o.connect(flt);
          o.start(t0);
          o.stop(t0 + step * 8 + 0.9);
          track(o);
          stops.push(() => o.stop());
        }
      }
      padStop = () => stops.forEach((s) => s());
    }
    for (let i = 0; i < 8; i++) {
      const t = t0 + i * step;
      if (sc.bass?.pattern[i]) voice('soft', note(tri[0], 0), t, step * 1.6, sc.bass.vol);
      const a = sc.arp?.pattern[i];
      if (sc.arp && a !== undefined && a >= 0) voice(sc.arp.inst, note(tri[a % tri.length], sc.arp.octave), t, step * 2.5, sc.arp.vol);
      const m = phrase[b % 4][i];
      if (sc.lead && m !== null) {
        const vary = b % 8 >= 4 && i === 7 ? 1 : 0; // la reprise varie un peu sa fin de mesure
        voice(sc.lead.inst, note(chordOf(b) + m + vary, sc.lead.octave), t, step * (sc.lead.long ? 3.5 : 1.8), sc.lead.vol);
      }
      if (sc.drums) {
        if (sc.drums.kick[i]) drum('kick', t, sc.drums.vol);
        if (sc.drums.hat[i]) drum('hat', t, sc.drums.vol);
        if (sc.drums.tom?.[i]) drum('tom', t, sc.drums.vol);
      }
    }
  };
  // on programme les mesures un peu à l'avance (horloge audio précise), une vérification toutes les 200 ms
  const tick = () => {
    while (barStart < ctx.currentTime + 1.2) {
      scheduleBar(barStart, bar++);
      barStart += step * 8;
    }
  };
  tick();
  const timer = window.setInterval(tick, 200);
  return () => {
    clearInterval(timer);
    padStop?.();
    for (const s of live) {
      try {
        s.stop();
      } catch { /* déjà arrêté */ }
    }
    bus.disconnect();
  };
}
