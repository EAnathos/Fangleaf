// Bestiaire (outil de dev, /bestiary.html) : anime chaque espèce du jeu (sauvage, apprivoisée, Alpha) avec les vrais sprites.

import { ALPHA_MULT, SPECIES, SPECIES_BY_ZONE, ZONE_NAMES } from '../../shared/config.ts';
import { SPECIES_DESC as DESC } from './speciesInfo.ts';
import { drawUnit } from './sprites.ts';

interface Entry {
  key: string;
  name: string;
  color: string;
  r: number;
  zone: string;
  stats?: string;
  desc: string;
  tag?: string;
}


// Les géants (mini-boss de grotte) n'y figurent pas : on les découvre en jeu.
const ALL: Entry[] = SPECIES_BY_ZONE.filter((i) => !SPECIES[i].boss).map((i) => {
  const s = SPECIES[i];
  return { key: s.key, name: s.name, color: s.color, r: s.r, zone: `Zone ${s.zone} · ${ZONE_NAMES[s.zone - 1]}`, stats: `${s.hp} PV · ${s.dmg} dégâts`, desc: DESC[s.key] ?? '' };
});

const scenes: { canvas: HTMLCanvasElement; e: Entry }[] = [];

function card(e: Entry, parent: HTMLElement) {
  const el = document.createElement('article');
  el.className = 'card';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `${e.name} : sauvage, apprivoisé et Alpha`);
  el.append(canvas);
  const info = document.createElement('div');
  info.className = 'info';
  info.innerHTML = '<div class="title"><b></b><span class="tag"></span></div><span class="stats"></span><span class="desc"></span>';
  info.querySelector('b')!.textContent = e.name;
  const tag = info.querySelector<HTMLElement>('.tag')!;
  tag.textContent = e.zone;
  info.querySelector('.stats')!.textContent = e.stats ?? '';
  info.querySelector('.desc')!.textContent = e.desc;
  if (!e.desc) info.querySelector('.desc')!.remove();
  el.append(info);
  parent.append(el);
  scenes.push({ canvas, e });
}

ALL.forEach((e) => card(e, document.getElementById('all')!));

const t0 = performance.now();
function frame(now: number) {
  const t = (now - t0) / 1000;
  const dpr = Math.min(2, devicePixelRatio || 1);
  for (const { canvas, e } of scenes) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // trois versions côte à côte : sauvage, apprivoisé, Alpha
    const idx = SPECIES.findIndex((sp) => sp.key === e.key);
    const size = SPECIES[idx]?.boss ? 1 : ALPHA_MULT.size; // un Alpha de boss garde sa taille
    const big = e.r * size; // l'Alpha doit tenir dans son tiers
    const scale = Math.min(3, (w / 3) / (big * 2.9), (h * 0.6) / (big * 2.9));
    const variants = [
      { wild: true, alpha: false, owner: undefined as string | undefined, face: -1 },
      { wild: false, alpha: false, owner: '#5CC8B8', face: 1 },
      { wild: false, alpha: true, owner: '#5CC8B8', face: 1 },
    ];
    variants.forEach((v, i) => {
      const r = Math.round(e.r * (v.alpha ? size : 1));
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (w * (i + 0.5)) / 3, dpr * h * 0.58);
      drawUnit(ctx, {
        x: 0, y: 0, r, species: idx, alpha: v.alpha, wild: v.wild, ownerColor: v.owner,
        face: v.face, t, seed: i * 1.3, flash: false,
      });
    });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = '600 12px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(238,231,215,0.6)';
    ['sauvage', 'apprivoisé', 'Alpha'].forEach((l, i) => ctx.fillText(l, (w * (i + 0.5)) / 3, h - 10));
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
