/**
 * Formas generadas por código (árboles, arbustos, el tajo de la hoz). Devuelven
 * mapas de caracteres como los sprites dibujados a mano, así comparten paleta
 * y se pueden probar sin navegador.
 */
import { crearRng, type Rng } from '../logic/rng';
import type { Mapa } from './sprites';

type Rejilla = string[][];

function vacia(w: number, h: number): Rejilla {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));
}

function aMapa(g: Rejilla): Mapa {
  return g.map((fila) => fila.join(''));
}

/** Añade un contorno '0' de un píxel alrededor de lo que no es transparente. */
export function contornear(mapa: Mapa): Mapa {
  const h = mapa.length;
  const w = mapa[0]?.length ?? 0;
  const g = mapa.map((f) => [...f]);
  const lleno = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mapa[y]![x] !== '.';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mapa[y]![x] !== '.') continue;
      if (lleno(x - 1, y) || lleno(x + 1, y) || lleno(x, y - 1) || lleno(x, y + 1)) g[y]![x] = '0';
    }
  }
  return aMapa(g);
}

/** Pino oscuro de varias capas, con luz desde arriba a la izquierda. */
export function pino(semilla: number, w = 24, h = 40): Mapa {
  const rng = crearRng(semilla);
  const g = vacia(w, h);
  const cx = Math.floor(w / 2);
  const tronco = 5 + Math.floor(rng() * 2);
  // Tronco
  for (let y = h - tronco - 1; y < h - 1; y++) {
    g[y]![cx - 1] = 'a';
    g[y]![cx] = 'b';
  }
  // Capas de follaje, de abajo hacia arriba, cada una un triángulo.
  const capas = 4;
  const alturaCopa = h - tronco - 2;
  for (let k = 0; k < capas; k++) {
    const base = 1 + Math.round(alturaCopa * (1 - k / (capas + 0.4)));
    const alto = Math.round(alturaCopa * 0.42);
    const semiancho = Math.round((w / 2 - 2) * (1 - k * 0.17));
    for (let dy = 0; dy < alto; dy++) {
      const y = base - dy;
      if (y < 1) continue;
      const media = Math.max(0, Math.round(semiancho * (1 - dy / alto) + (rng() < 0.25 ? 1 : 0)));
      for (let x = cx - media; x <= cx + media - 1; x++) {
        if (x < 1 || x >= w - 1) continue;
        g[y]![x] = 'g';
      }
    }
  }
  // Punta
  g[1]![cx - 1] = 'g';
  // Sombreado: el borde superior izquierdo de cada capa recibe luz.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (g[y]![x] !== 'g') continue;
      const arribaVacio = y === 0 || g[y - 1]![x] === '.';
      const izqVacio = x === 0 || g[y]![x - 1] === '.';
      if (arribaVacio && x <= cx) g[y]![x] = 'i';
      else if (izqVacio || (arribaVacio && x <= cx + 2)) g[y]![x] = 'h';
      else if (x < cx && rng() < 0.18) g[y]![x] = 'h';
      else if (x > cx + 2 && rng() < 0.35) g[y]![x] = '1';
    }
  }
  return contornear(aMapa(g));
}

/** Arbusto bajo con forma de nube. */
export function arbusto(semilla: number, w = 14, h = 9): Mapa {
  const rng = crearRng(semilla);
  const g = vacia(w, h);
  const cx = (w - 1) / 2;
  const cy = h - 3;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const dx = (x - cx) / (w / 2 - 1.2);
      const dy = (y - cy) / (h - 3);
      const borde = 1 + Math.sin(x * 1.7 + semilla) * 0.12;
      if (dx * dx + dy * dy <= borde && y <= h - 2) {
        g[y]![x] = y < cy - 1 && x < cx ? (rng() < 0.5 ? 'i' : 'h') : rng() < 0.6 ? 'g' : 'h';
      }
    }
  }
  if (rng() < 0.5) {
    // Bayas rojas
    for (let i = 0; i < 3; i++) {
      const x = 3 + Math.floor(rng() * (w - 6));
      const y = 3 + Math.floor(rng() * (h - 5));
      if (g[y]![x] !== '.') g[y]![x] = 'l';
    }
  }
  return contornear(aMapa(g));
}

/** Tajo en forma de media luna que se abre hacia la derecha. */
export function tajo(w = 26, h = 40): Mapa {
  const g = vacia(w, h);
  const cx = 2;
  const cy = h / 2 - 0.5;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / (w - 3);
      const dy = (y - cy) / (h / 2 - 1);
      const d = dx * dx + dy * dy;
      // El grosor se afina hacia las puntas.
      const grosor = 0.42 * (1 - Math.abs(dy) * 0.75);
      if (d <= 1 && d >= 1 - grosor && x > cx) {
        const t = (d - (1 - grosor)) / grosor; // 0 interior, 1 exterior
        g[y]![x] = t > 0.72 ? '5' : t > 0.35 ? '4' : '3';
      }
    }
  }
  return aMapa(g);
}

/** Suelo del bosque como mapa de colores CSS (no usa la paleta: es fondo). */
export function suelo(rng: Rng, lado = 128): string[][] {
  const base = ['#1a2117', '#1c2419', '#182015', '#1e271b'];
  const g = Array.from({ length: lado }, () =>
    Array.from({ length: lado }, () => base[Math.floor(rng() * base.length)]!),
  );
  const punto = (x: number, y: number, c: string) => {
    g[((y % lado) + lado) % lado]![((x % lado) + lado) % lado] = c;
  };
  // Manchas de tierra
  for (let i = 0; i < 7; i++) {
    const x0 = Math.floor(rng() * lado);
    const y0 = Math.floor(rng() * lado);
    const r = 3 + Math.floor(rng() * 6);
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++)
        if (x * x + y * y <= r * r && rng() < 0.85) punto(x0 + x, y0 + y, rng() < 0.5 ? '#231e16' : '#272118');
  }
  // Hojas caídas
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(rng() * lado);
    const y = Math.floor(rng() * lado);
    const c = rng() < 0.5 ? '#3a2a1a' : '#4a3020';
    punto(x, y, c);
    if (rng() < 0.6) punto(x + 1, y, c);
  }
  // Briznas de hierba
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rng() * lado);
    const y = Math.floor(rng() * lado);
    punto(x, y, '#2a3d24');
    if (rng() < 0.5) punto(x, y - 1, '#34502b');
  }
  // Piedritas
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(rng() * lado);
    const y = Math.floor(rng() * lado);
    punto(x, y, '#3b3833');
    punto(x + 1, y, '#2c2a26');
  }
  return g;
}
