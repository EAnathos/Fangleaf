// Hash spatial uniforme : requêtes de voisinage en O(voisins) au lieu de O(n²).

export interface Body {
  id: number;
  x: number;
  y: number;
  r: number;
}

const CELL = 128;
const key = (cx: number, cy: number) => (cx + 1000) * 4096 + (cy + 1000);

export class Grid<T extends Body> {
  private cells = new Map<number, T[]>();

  clear() {
    this.cells.clear();
  }

  insert(b: T) {
    const k = key(Math.floor(b.x / CELL), Math.floor(b.y / CELL));
    let c = this.cells.get(k);
    if (!c) this.cells.set(k, (c = []));
    c.push(b);
  }

  /** Appelle fn pour chaque corps dont le centre est dans le carré englobant le cercle. */
  query(x: number, y: number, radius: number, fn: (b: T) => void) {
    const x0 = Math.floor((x - radius) / CELL), x1 = Math.floor((x + radius) / CELL);
    const y0 = Math.floor((y - radius) / CELL), y1 = Math.floor((y + radius) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const c = this.cells.get(key(cx, cy));
        if (c) for (const b of c) fn(b);
      }
    }
  }
}
