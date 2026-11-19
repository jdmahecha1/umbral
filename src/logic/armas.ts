/**
 * Números de cada arma por nivel. Se separan de Phaser para poder ajustarlos
 * y probarlos sin abrir el juego. El índice 0 corresponde al nivel 1.
 */
const n = (nivel: number) => Math.max(1, Math.min(5, nivel)) - 1;

export interface StatsHoz {
  dano: number;
  recarga: number;
  ancho: number;
  alto: number;
  atras: boolean;
}

export function statsHoz(nivel: number): StatsHoz {
  const i = n(nivel);
  return {
    dano: [11, 15, 15, 15, 21][i]!,
    recarga: [1.1, 1.1, 1.1, 1.1, 0.9][i]!,
    ancho: i >= 3 ? 46 : 37,
    alto: i >= 3 ? 26 : 21,
    atras: i >= 2,
  };
}

export interface StatsDagas {
  dano: number;
  recarga: number;
  cantidad: number;
  atraviesa: number;
  velocidad: number;
}

export function statsDagas(nivel: number): StatsDagas {
  const i = n(nivel);
  return {
    dano: [8, 8, 12, 12, 13][i]!,
    recarga: 1.05,
    cantidad: [1, 2, 2, 3, 4][i]!,
    atraviesa: [0, 1, 1, 1, 3][i]!,
    velocidad: 230,
  };
}

export interface StatsFarol {
  dano: number;
  intervalo: number;
  radio: number;
  /** Cuánto amplía la luz del jugador, en unidades del mundo. */
  luzExtra: number;
}

export function statsFarol(nivel: number): StatsFarol {
  const i = n(nivel);
  return {
    dano: [3, 3, 5, 5, 9][i]!,
    intervalo: [0.6, 0.6, 0.45, 0.45, 0.45][i]!,
    radio: [26, 33, 33, 40, 40][i]!,
    luzExtra: [8, 12, 12, 16, 18][i]!,
  };
}

export interface StatsRunas {
  dano: number;
  cantidad: number;
  radio: number;
  /** Radianes por segundo. */
  giro: number;
  /** Segundos que tarda una runa en volver a golpear al mismo enemigo. */
  pausa: number;
}

export function statsRunas(nivel: number): StatsRunas {
  const i = n(nivel);
  return {
    dano: [7, 7, 10, 10, 11][i]!,
    cantidad: [1, 2, 2, 3, 4][i]!,
    radio: i >= 4 ? 40 : 31,
    giro: i >= 2 ? 3.6 : 2.8,
    pausa: 0.45,
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
    dano: [14, 14, 22, 22, 34][i]!,
    recarga: [4.6, 4.6, 4.6, 3.6, 3.6][i]!,
    alcance: [62, 78, 78, 78, 104][i]!,
    empuje: 150,
  };
}
