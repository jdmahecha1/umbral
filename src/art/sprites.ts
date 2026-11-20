/**
 * Sprites dibujados a mano como mapas de caracteres (ver paleta.ts).
 * Cada sprite es una lista de fotogramas; cada fotograma, una lista de filas.
 * Todos miran a la derecha: el juego los voltea al ir a la izquierda.
 */
import { CIERVO, RAIZON } from './grandes';

export type Mapa = string[];
export type Sprite = Mapa[];

// ── Cazador (16×16) ──────────────────────────────────────────────
const CAZADOR_TORSO: Mapa = [
  '................',
  '.....00000......',
  '....0233320.....',
  '...023333320....',
  '...0233111e0....',
  '...023111110....',
  '...0221111k0....',
  '....0lllll0.....',
  '...0bbbbbbb0....',
  '..0bbabbbbcc0...',
  '..0babbbbb0.000.',
  '..0babbbbb0.0e0.',
  '..0aabbbba0.0f0.',
  '...0aaaaa0..000.',
];

export const CAZADOR: Sprite = [
  [...CAZADOR_TORSO, '...0t0.0t0......', '...00..00.......'],
  [...CAZADOR_TORSO, '..0t0..0t0......', '..00....00......'],
  [...CAZADOR_TORSO, '....0t0t0.......', '....00.00.......'],
];

// ── Enemigos ─────────────────────────────────────────────────────
export const FATUO: Sprite = [
  [
    '..........',
    '....p.....',
    '...pqp....',
    '..pqqqp...',
    '..pq0q0p..',
    '.pqqqqqp..',
    '.opqqqpo..',
    '..oppppo..',
    '...oooo...',
    '..........',
  ],
  [
    '..........',
    '.....p....',
    '....pqp...',
    '..pqqqp...',
    '..pq0q0p..',
    '.pqqqqqp..',
    '.oqqqqqo..',
    '..oppppo..',
    '...oooo...',
    '..........',
  ],
];

const LOBO_CUERPO: Mapa = [
  '..................',
  '..............0.0.',
  '.............02020',
  '00..........022220',
  '020000000000222m20',
  '.0222222222222220.',
  '..02545452222220..',
  '..02454542222220..',
  '..0222222222220...',
];

export const LOBO: Sprite = [
  [...LOBO_CUERPO, '..020.020.020.020.', '..00..00..00..00..', '..................'],
  [...LOBO_CUERPO, '.020..020..020.0..', '.00...00...00..0..', '..................'],
];

const ESPANTAJO_CABEZA: Mapa = [
  '......00......',
  '.....0aa0.....',
  '....0abba0....',
  '..00000000000.',
  '....0cccc0....',
  '....0ecce0....',
  '....0c0c0c....',
];
const ESPANTAJO_PIE: Mapa = [
  '....0bhbb0....',
  '....0bbhb0....',
  '....0bbbb0....',
  '....0dddd0....',
  '...0d.dd.d0...',
  '......00......',
  '......aa......',
  '......aa......',
  '......00......',
];

export const ESPANTAJO: Sprite = [
  [...ESPANTAJO_CABEZA, '.dd0bbbbbb0dd.', 'dd00bbbbbb00dd', ...ESPANTAJO_PIE],
  [...ESPANTAJO_CABEZA, 'd.d0bbbbbb0d.d', '.d00bbbbbb00d.', ...ESPANTAJO_PIE],
];

const ANIMA_CUERPO: Mapa = [
  '....0000....',
  '...0qqqq0...',
  '..0qqqqqq0..',
  '.0qq0qq0qq0.',
  '.0qq0qq0qq0.',
  '.0qqqqqqqq0.',
  '.0qqq00qqq0.',
  '.0pqqqqqqp0.',
  '.0pqqqqqqp0.',
  '.0ppqqqqpp0.',
  '.0pppppppp0.',
];

export const ANIMA: Sprite = [
  [...ANIMA_CUERPO, '.0pp0pp0pp0.', '..0..0..0...', '............'],
  [...ANIMA_CUERPO, '.0p0pp0pp0p.', '...0..0..0..', '............'],
];

const BRUJA_CUERPO = (orbe: string): Mapa => [
  '.......0......',
  '......0r0.....',
  '.....0rr0.....',
  '....0rrsr0....',
  '..0000000000..',
  `.....0ii0..0${orbe}0`,
  `....0iei0..0${orbe}0`,
  '....0iiii0..0.',
  '...0rrrrrr0.0.',
  '..0rrsrrrrcc0.',
  '..0rrsrrrr0.0.',
  '..0rrrsrrr0.0.',
  '..0rrrsrrr0.0.',
  '.0rrrrrsrrr00.',
  '.0rrrrrrrrr0..',
];

export const BRUJA: Sprite = [
  [...BRUJA_CUERPO('j'), '..0s0s0s0s0...'],
  [...BRUJA_CUERPO('e'), '...0s0s0s0s0..'],
];

// ── Proyectiles y efectos ────────────────────────────────────────
export const DAGA: Sprite = [['..00000..', '0cc555440', '..00000..']];

export const ORBE: Sprite = [
  ['.0000.', '0ijji0', '0jeej0', '0jeej0', '0ijji0', '.0000.'],
];

export const RUNA: Sprite = [
  [
    '..00000..',
    '.0233320.',
    '0233p3320',
    '023ppp320',
    '0233p3320',
    '023p3p320',
    '0233p3320',
    '.0233320.',
    '..00000..',
  ],
];

// ── Objetos ──────────────────────────────────────────────────────
export const GEMA: Sprite = [['..0..', '.0e0.', '0eed0', '0edd0', '0ddc0', '.0c0.', '..0..']];

export const ACEITE: Sprite = [
  ['..000..', '..0c0..', '.00000.', '04eee40', '0deeed0', '0ddddd0', '0ddddd0', '.00000.'],
];

export const PAN: Sprite = [['..0000..', '.0dccd0.', '0dcddcd0', '0cccccc0', '0bbbbbb0', '.000000.']];

export const COFRE: Sprite = [
  [
    '.0000000000.',
    '0cbbbbbbbbc0',
    '0bbbbbbbbbb0',
    '000000000000',
    '0bbbb0e0bbb0',
    '0cbbb0d0bbc0',
    '0bbbbb0bbbb0',
    '0cbbbbbbbbc0',
    '0bbbbbbbbbb0',
    '.0000000000.',
  ],
];

// ── Decorado ─────────────────────────────────────────────────────
export const ROCA: Sprite = [
  ['...0000...', '..0uvvu0..', '.0uvvvuu0.', '0uuvuuuuu0', '0tuuuuuut0', '.0tttttt0.', '..000000..'],
];

export const HONGOS: Sprite = [['.00000.', '0l5ll50', '0lllll0', '.00000.', '..040..', '..040..', '..000..']];

export const LAPIDA: Sprite = [
  [
    '...0000...',
    '..023320..',
    '.02330320.',
    '.02000020.',
    '.02330320.',
    '.02330320.',
    '.02333320.',
    '.02333320.',
    '.02222220.',
    '0hh0000hh0',
    '0000000000',
  ],
];

export const HIERBA: Sprite = [['..i...', 'i.h.i.', 'h.h.h.', 'hhhhh.']];

// ── Íconos de las mejoras ────────────────────────────────────────
export const ICONOS: Record<string, Mapa> = {
  hoz: [
    '...0000000..',
    '..0455554b0.',
    '.040000.0b0.',
    '.00....0b0..',
    '......0b0...',
    '.....0b0....',
    '....0b0.....',
    '...0b0......',
    '..0b0.......',
    '.0c0........',
    '.00.........',
    '............',
  ],
  dagas: ['..00000..', '0cc555440', '..00000..'],
  farol: [
    '...00...',
    '..0..0..',
    '.000000.',
    '0c0ee0c0',
    '0ceffec0',
    '0ceeeec0',
    '0c0ee0c0',
    '.000000.',
    '..0cc0..',
    '...00...',
  ],
  runas: RUNA[0]!,
  campana: [
    '....00....',
    '...0dd0...',
    '..0deed0..',
    '..0dedd0..',
    '.0ddeddd0.',
    '.0ddeddd0.',
    '0dddddddd0',
    '0000000000',
    '....0e0...',
    '.....0....',
  ],
  botas: [
    '..0000....',
    '..0bb0....',
    '..0bb0....',
    '..0cb0....',
    '..0bb0....',
    '..0bbb00..',
    '..0bbbbb0.',
    '.0bbbbbbb0',
    '.000000000',
  ],
  roble: ['.00...00.', '0cb0.0bb0', '0cbb0bbb0', '0bbbbbbb0', '.0bbibb0.', '..0bib0..', '...0b0...', '....0....'],
  musgo: ['...0000...', '..0ijii0..', '.0hijhih0.', '0hhihhhih0', '0ghhhhhhg0', '0gghhghgg0', '.00000000.'],
  iman: [
    '0000..0000',
    '0ee0..0ee0',
    '0dd0..0dd0',
    '0dd0..0dd0',
    '0dd0..0dd0',
    '0ddd00ddd0',
    '.0dddddd0.',
    '..000000..',
  ],
  filo: ['.......e..', '......e.e.', '.00000000.', '0uvvvvvvu0', '0uuuuuuuu0', '0tttttttt0', '.00000000.'],
  reloj: ['bbbbbbbb', '.0eeee0.', '.0eeee0.', '..0ee0..', '...00...', '..0.e0..', '.0..e.0.', '.0eeee0.', 'bbbbbbbb'],
  mecha: [
    '...0....',
    '..0f0...',
    '..0e0...',
    '...0....',
    '..0550..',
    '..0540..',
    '..0540..',
    '..0440..',
    '.000000.',
    '0bbbbbb0',
    '.000000.',
  ],
  coraza: [
    '0000..0000',
    '0bc0000cb0',
    '0bbccccbb0',
    '.0bbbbbb0.',
    '.0bcbbcb0.',
    '.0bbbbbb0.',
    '.0bcbbcb0.',
    '.0bbbbbb0.',
    '..000000..',
  ],
  pan: PAN[0]!,
  aceite: ACEITE[0]!,
  corazon: ['.00...00.', '0ml0.0ll0', '0mll0lll0', '0lllllll0', '.0lllll0.', '..0lll0..', '...0l0...', '....0....'],
  calavera: ['.00000.', '0555550', '0505050', '0555550', '.05550.', '.05050.', '..000..'],
  moneda: ['..000..', '.04550.', '0455540', '0453540', '0444340', '.03330.', '..000..'],
  brasa: ['...0...', '..0f0..', '.0ffe0.', '0ffeef0', '0fe5ef0', '0feeef0', '.0fff0.', '..000..'],
  gema: ['..0..', '.0e0.', '0eed0', '0edd0', '0ddc0', '.0c0.', '..0..'],
  // Reliquias y artículos del mercader
  amuleto: ['..0000..', '.0....0.', '.0....0.', '..0..0..', '...00...', '..0ll0..', '.0lmll0.', '.0llll0.', '..0ll0..', '...00...'],
  caliz: [
    '0000000000',
    '0deeeeeed0',
    '.0deeeed0.',
    '..0dddd0..',
    '...0dd0...',
    '...0dd0...',
    '...0dd0...',
    '..0dddd0..',
    '.00000000.',
  ],
  capa: [
    '...0000...',
    '..0r22r0..',
    '..022220..',
    '.0r2222r0.',
    '.0r2222r0.',
    '0rr2222rr0',
    '0rr2222rr0',
    '0rrr22rrr0',
    '0rrrrrrrr0',
    '0r0r0r0r00',
    '.0.0.0.0..',
  ],
  espinas: ['5...55...5', '05.0uu0.50', '.0uvvvvu0.', '0uvuuuuvu0', '0uuvuuvuu0', '0uuuvvuuu0', '.0uuuuuu0.', '5.0uuuu0.5', '...0000...'],
  colmillo: ['00000000', '05555550', '.055550.', '.055540.', '..05540.', '..0540..', '...050..', '...00...'],
  elixir: ['...00...', '..0cc0..', '..0440..', '.004400.', '0llmmll0', '0lllmll0', '0kllllk0', '.0kkkk0.', '..0000..'],
  pergamino: ['.00000000.', '0c555555c0', '.05333350.', '.05555550.', '.05333350.', '.05555550.', '0c555555c0', '.00000000.'],
  forja: ['..e....e..', '.e..ee..e.', '.000000000', '0uvvvvvvu0', '.0uuuuuu0.', '...0uu0...', '..0uuuu0..', '.0uuuuuu0.', '.00000000.'],
};

// Variantes de color de íconos existentes.
ICONOS.linterna = recolorear([ICONOS.farol!], { c: '4', e: '5', f: 'e' })[0]!;
ICONOS.leguas = recolorear([ICONOS.botas!], { b: 'r', c: 's' })[0]!;

/** Sprites que se convierten en textura con fotogramas animados. */
export const SPRITES: Record<string, Sprite> = {
  cazador: CAZADOR,
  fatuo: FATUO,
  lobo: LOBO,
  espantajo: ESPANTAJO,
  anima: ANIMA,
  bruja: BRUJA,
  daga: DAGA,
  orbe: ORBE,
  runa: RUNA,
  gema: GEMA,
  aceite: ACEITE,
  pan: PAN,
  cofre: COFRE,
  roca: ROCA,
  hongos: HONGOS,
  lapida: LAPIDA,
  hierba: HIERBA,
  moneda: [['..000..', '.04550.', '0455540', '0453540', '0444340', '.03330.', '..000..']],
  raizon: RAIZON,
  ciervo: CIERVO,
};

/** Cambia unos colores por otros: así una gema ámbar se vuelve azul o roja. */
export function recolorear(sprite: Sprite, cambios: Record<string, string>): Sprite {
  return sprite.map((f) => f.map((fila) => [...fila].map((c) => cambios[c] ?? c).join('')));
}

/** Comprueba que un sprite sea rectangular y use solo colores de la paleta. Devuelve los errores. */
export function validar(nombre: string, sprite: Sprite, paleta: Record<string, string>): string[] {
  const errores: string[] = [];
  const ancho = sprite[0]?.[0]?.length ?? 0;
  const alto = sprite[0]?.length ?? 0;
  sprite.forEach((f, i) => {
    if (f.length !== alto) errores.push(`${nombre}[${i}]: ${f.length} filas, se esperaban ${alto}`);
    f.forEach((fila, j) => {
      if (fila.length !== ancho) errores.push(`${nombre}[${i}] fila ${j}: ancho ${fila.length}, se esperaba ${ancho}`);
      for (const c of fila) if (c !== '.' && !(c in paleta)) errores.push(`${nombre}[${i}] fila ${j}: color desconocido '${c}'`);
    });
  });
  return errores;
}
