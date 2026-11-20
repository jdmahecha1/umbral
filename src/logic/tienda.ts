import { mezclar, type Rng } from './rng';

/**
 * La tregua del mercader: tres veces por noche el tiempo se detiene y un
 * mercader vende objetos poderosos a cambio de las monedas de la partida.
 */
export type IdReliquia = 'amuleto' | 'caliz' | 'capa' | 'espinas' | 'linterna' | 'colmillo' | 'leguas';
export type IdConsumibleTienda = 'elixir' | 'pergamino' | 'forja';
export type IdArticulo = IdReliquia | IdConsumibleTienda;

export interface Articulo {
  id: IdArticulo;
  nombre: string;
  /** Qué hace, en una frase clara. */
  texto: string;
  precio: number;
  /** Las reliquias se compran una sola vez; los consumibles, las veces que quieras. */
  tipo: 'reliquia' | 'consumible';
}

export const ARTICULOS: Record<IdArticulo, Articulo> = {
  amuleto: { id: 'amuleto', nombre: 'Amuleto del segundo aliento', texto: 'Si mueres, vuelves a levantarte con la mitad de la vida. Funciona una vez.', precio: 60, tipo: 'reliquia' },
  caliz: { id: 'caliz', nombre: 'Cáliz de ámbar', texto: 'Ganas un 40 % más de experiencia: subes de nivel más rápido.', precio: 40, tipo: 'reliquia' },
  capa: { id: 'capa', nombre: 'Capa de sombra', texto: '1 de cada 6 golpes que recibes no te hace daño.', precio: 50, tipo: 'reliquia' },
  espinas: { id: 'espinas', nombre: 'Cota de espinas', texto: 'Los enemigos que te tocan reciben 12 de daño.', precio: 30, tipo: 'reliquia' },
  linterna: { id: 'linterna', nombre: 'Linterna de plata', texto: 'Ves un 25 % más lejos y tu farol nunca se apaga del todo: siempre le queda al menos un 20 % de aceite.', precio: 45, tipo: 'reliquia' },
  colmillo: { id: 'colmillo', nombre: 'Colmillo de lobo', texto: 'Todas tus armas hacen un 20 % más de daño.', precio: 55, tipo: 'reliquia' },
  leguas: { id: 'leguas', nombre: 'Botas de siete leguas', texto: 'Caminas un 15 % más rápido.', precio: 30, tipo: 'reliquia' },
  elixir: { id: 'elixir', nombre: 'Elixir del ermitaño', texto: 'Recuperas toda la vida y llenas el farol.', precio: 25, tipo: 'consumible' },
  pergamino: { id: 'pergamino', nombre: 'Pergamino del sabio', texto: 'Subes un nivel al instante y eliges una mejora.', precio: 35, tipo: 'consumible' },
  forja: { id: 'forja', nombre: 'Piedra de forja', texto: 'Una de tus armas, elegida al azar, sube un nivel.', precio: 50, tipo: 'consumible' },
};

/** Segundos de la noche en los que llega el mercader. */
export const TREGUAS = [165, 345, 525];
export const AVISO_TREGUA = 10;

/** Precio de cambiar los artículos que se ofrecen; sube cada vez que se usa en la misma visita. */
export function precioCambiar(veces: number): number {
  return 8 + veces * 6;
}

/** Los consumibles se encarecen un poco cada vez que los compras en la misma noche. */
export function precio(id: IdArticulo, compradas: number): number {
  const base = ARTICULOS[id].precio;
  return ARTICULOS[id].tipo === 'consumible' ? base + compradas * 10 : base;
}

/**
 * Elige `n` artículos distintos para la visita. Nunca ofrece una reliquia que
 * ya tienes, ni la piedra de forja si todas tus armas están al máximo.
 */
export function ofrecerArticulos(rng: Rng, reliquias: ReadonlySet<IdReliquia>, puedeForjar: boolean, n = 4): IdArticulo[] {
  const disponibles = (Object.keys(ARTICULOS) as IdArticulo[]).filter((id) => {
    if (ARTICULOS[id].tipo === 'reliquia') return !reliquias.has(id as IdReliquia);
    if (id === 'forja') return puedeForjar;
    return true;
  });
  // Al menos un consumible barato siempre a mano, para que la visita nunca sea inútil.
  const mezcla = mezclar(rng, disponibles);
  const res = mezcla.slice(0, n);
  if (!res.some((id) => ARTICULOS[id].tipo === 'consumible')) {
    const consumible = mezcla.find((id) => ARTICULOS[id].tipo === 'consumible');
    if (consumible) res[res.length - 1] = consumible;
  }
  return res;
}

/** Probabilidad de soltar una moneda de plata (vale 1) según la experiencia del enemigo. */
export function probMoneda(xp: number, codicia: number): number {
  return Math.min(0.9, (0.36 + xp * 0.04) * codicia);
}

/** Probabilidad de una moneda de oro (vale 5). */
export const PROB_ORO = 0.012;
