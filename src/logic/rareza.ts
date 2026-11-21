import { elegirPonderado, type Rng } from './rng';

/**
 * La rareza dice cuánto cuesta encontrar algo: las mejoras y los artículos más
 * fuertes salen menos. No cambia lo que hacen, solo lo a menudo que aparecen.
 */
export type Rareza = 'comun' | 'rara' | 'epica' | 'legendaria';

export interface DefRareza {
  nombre: string;
  /** Probabilidad relativa de aparecer frente a algo común (1). */
  peso: number;
  /** Color del texto (CSS). */
  css: string;
  /** Color del borde de la tarjeta. */
  borde: number;
}

export const RAREZAS: Record<Rareza, DefRareza> = {
  comun: { nombre: 'Común', peso: 1, css: '#b9b4c9', borde: 0x3a3650 },
  rara: { nombre: 'Rara', peso: 0.6, css: '#7fd1e8', borde: 0x3f78a8 },
  epica: { nombre: 'Épica', peso: 0.3, css: '#b98ad8', borde: 0x8a4fb0 },
  legendaria: { nombre: 'Legendaria', peso: 0.12, css: '#ffd77a', borde: 0xe3a34a },
};

export const ORDEN_RAREZAS: Rareza[] = ['comun', 'rara', 'epica', 'legendaria'];

/**
 * Elige hasta `n` elementos distintos según su peso, sin repetir.
 * Con pesos iguales es un sorteo normal.
 */
export function sortear<T>(rng: Rng, opciones: readonly { valor: T; peso: number }[], n: number): T[] {
  const quedan = opciones.filter((o) => o.peso > 0);
  const res: T[] = [];
  while (res.length < n && quedan.length > 0) {
    const elegido = elegirPonderado(rng, quedan);
    if (elegido === undefined) break;
    res.push(elegido);
    quedan.splice(
      quedan.findIndex((o) => o.valor === elegido),
      1,
    );
  }
  return res;
}
