/** Generador pseudoaleatorio con semilla (mulberry32): rápido y reproducible en las pruebas. */
export type Rng = () => number;

export function crearRng(semilla: number): Rng {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Entero en [min, max] (ambos incluidos). */
export function entre(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Elige un elemento según pesos. Devuelve undefined si todos los pesos son 0. */
export function elegirPonderado<T>(rng: Rng, opciones: readonly { valor: T; peso: number }[]): T | undefined {
  const total = opciones.reduce((s, o) => s + Math.max(0, o.peso), 0);
  if (total <= 0) return undefined;
  let r = rng() * total;
  for (const o of opciones) {
    r -= Math.max(0, o.peso);
    if (r < 0) return o.valor;
  }
  return opciones[opciones.length - 1]?.valor;
}

/** Mezcla Fisher-Yates sobre una copia. */
export function mezclar<T>(rng: Rng, lista: readonly T[]): T[] {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Hash entero de dos coordenadas: sirve de semilla para los trozos del mapa. */
export function hash2(x: number, y: number, semilla = 0): number {
  let h = (semilla ^ Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
