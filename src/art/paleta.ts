/**
 * Paleta única del juego. Cada carácter de los mapas de píxeles es un color;
 * el punto es transparente. Limitar los colores es lo que da unidad al pixel art.
 */
export const PALETA: Record<string, string> = {
  '0': '#0b0a12', // contorno
  '1': '#1d1b2b',
  '2': '#3a3650',
  '3': '#6b6787',
  '4': '#b9b4c9',
  '5': '#f2eee3', // hueso
  a: '#3b2418',
  b: '#6b3f22',
  c: '#a0662f',
  d: '#e3a34a', // ámbar
  e: '#ffd77a',
  f: '#ff8a3d', // llama
  g: '#1f3a2a',
  h: '#2f5a33',
  i: '#4f8a3c',
  j: '#8cc152',
  k: '#6a1f2b',
  l: '#b03a3a',
  m: '#e86a5a',
  n: '#1e3a5f',
  o: '#3f78a8',
  p: '#7fd1e8',
  q: '#c9f5ff',
  r: '#4a2a5e',
  s: '#8a4fb0',
  t: '#2a2420',
  u: '#5c524a',
  v: '#8f857a',
};

/** Colores sueltos para la interfaz y los efectos, como número para Phaser. */
export const COLOR = {
  noche: 0x07050c,
  fondo: 0x0d0b14,
  panel: 0x16131f,
  borde: 0x3a3650,
  hueso: 0xf2eee3,
  gris: 0xb9b4c9,
  apagado: 0x6b6787,
  ambar: 0xe3a34a,
  ambarClaro: 0xffd77a,
  llama: 0xff8a3d,
  sangre: 0xb03a3a,
  sangreClara: 0xe86a5a,
  musgo: 0x4f8a3c,
  espectro: 0x7fd1e8,
  violeta: 0x8a4fb0,
} as const;

export const CSS = {
  hueso: '#f2eee3',
  gris: '#b9b4c9',
  apagado: '#6b6787',
  ambar: '#e3a34a',
  ambarClaro: '#ffd77a',
  sangre: '#e86a5a',
  musgo: '#8cc152',
  espectro: '#7fd1e8',
  violeta: '#b98ad8',
} as const;
