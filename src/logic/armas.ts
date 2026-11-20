/**
 * Números de cada arma por nivel. Todas se usan al atacar (clic o botón de
 * ataque) y apuntan hacia el cursor. El índice 0 corresponde al nivel 1.
 */
const n = (nivel: number) => Math.max(1, Math.min(5, nivel)) - 1;

export interface StatsHoz {
  dano: number;
  /** Segundos entre tajos. */
  recarga: number;
  /** Radio del arco del tajo. */
  alcance: number;
  /** Apertura total del arco, en grados. */
  angulo: number;
  /** También corta a tu espalda. */
  atras: boolean;
}

export function statsHoz(nivel: number): StatsHoz {
  const i = n(nivel);
  return {
    dano: [12, 16, 16, 16, 22][i]!,
    recarga: [0.55, 0.55, 0.5, 0.5, 0.42][i]!,
    alcance: i >= 3 ? 40 : 32,
    angulo: 130,
    atras: i >= 2,
  };
}

export interface StatsDagas {
  dano: number;
  recarga: number;
  cantidad: number;
  /** A cuántos enemigos atraviesa cada daga antes de romperse. */
  atraviesa: number;
  velocidad: number;
}

export function statsDagas(nivel: number): StatsDagas {
  const i = n(nivel);
  return {
    dano: [9, 9, 13, 13, 14][i]!,
    recarga: 0.7,
    cantidad: [1, 2, 2, 3, 4][i]!,
    atraviesa: [0, 1, 1, 1, 3][i]!,
    velocidad: 240,
  };
}

export interface StatsLlamarada {
  dano: number;
  recarga: number;
  /** Largo del cono de fuego. */
  alcance: number;
  /** Apertura del cono, en grados. */
  angulo: number;
  /** Cuánto amplía la luz del farol, siempre (en unidades del mundo). */
  luzExtra: number;
}

export function statsLlamarada(nivel: number): StatsLlamarada {
  const i = n(nivel);
  return {
    dano: [10, 10, 15, 15, 24][i]!,
    recarga: [1.3, 1.3, 1.05, 1.05, 0.95][i]!,
    alcance: [42, 52, 52, 62, 62][i]!,
    angulo: 55,
    luzExtra: [8, 12, 12, 16, 18][i]!,
  };
}

export interface StatsRunas {
  dano: number;
  cantidad: number;
  recarga: number;
  /** Distancia a la que llegan antes de volver. */
  alcance: number;
  velocidad: number;
}

export function statsRunas(nivel: number): StatsRunas {
  const i = n(nivel);
  return {
    dano: [10, 10, 14, 14, 16][i]!,
    cantidad: [1, 2, 2, 3, 4][i]!,
    recarga: 1.5,
    alcance: [70, 70, 85, 85, 105][i]!,
    velocidad: 190,
  };
}

export interface StatsCampana {
  dano: number;
  recarga: number;
  alcance: number;
  empuje: number;
}

export function statsCampana(nivel: number): StatsCampana {
  const i = n(nivel);
  return {
    dano: [16, 16, 25, 25, 38][i]!,
    recarga: [3.4, 3.4, 3.4, 2.7, 2.7][i]!,
    alcance: [62, 78, 78, 78, 104][i]!,
    empuje: 150,
  };
}

/** Recarga base de cada arma (para el indicador de la interfaz). */
export function recargaBase(id: string, nivel: number): number {
  switch (id) {
    case 'hoz':
      return statsHoz(nivel).recarga;
    case 'dagas':
      return statsDagas(nivel).recarga;
    case 'farol':
      return statsLlamarada(nivel).recarga;
    case 'runas':
      return statsRunas(nivel).recarga;
    case 'campana':
      return statsCampana(nivel).recarga;
    default:
      return 1;
  }
}

/** ¿Está el ángulo `a` dentro del cono centrado en `centro` con apertura `apertura` (radianes)? */
export function enCono(a: number, centro: number, apertura: number): boolean {
  let d = a - centro;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d) <= apertura / 2;
}
