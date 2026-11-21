import type { IdPersonaje } from './personajes';
import { RAREZAS, sortear, type Rareza } from './rareza';
import type { Rng } from './rng';

/**
 * La tregua del mercader: tres veces por noche el tiempo se detiene y un
 * mercader vende objetos poderosos a cambio de las monedas de la partida.
 */
export type IdReliquia =
  | 'amuleto'
  | 'caliz'
  | 'capa'
  | 'espinas'
  | 'linterna'
  | 'colmillo'
  | 'leguas'
  // Una por personaje: solo la vende el mercader a quien corresponde.
  | 'cuerno'
  | 'hacha'
  | 'savia'
  | 'cola'
  | 'vidrio';
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
  /** Lo raros que son: los más fuertes salen menos en la tienda. */
  rareza: Rareza;
  /** Si es el objeto de un personaje, solo se le ofrece a él (y siempre, hasta que lo compre). */
  personaje?: IdPersonaje;
}

export const ARTICULOS: Record<IdArticulo, Articulo> = {
  amuleto: { id: 'amuleto', nombre: 'Amuleto del segundo aliento', texto: 'Si mueres, vuelves a levantarte con la mitad de la vida. Funciona una vez.', precio: 60, tipo: 'reliquia', rareza: 'legendaria' },
  caliz: { id: 'caliz', nombre: 'Cáliz de ámbar', texto: 'Ganas un 40 % más de experiencia: subes de nivel más rápido.', precio: 40, tipo: 'reliquia', rareza: 'rara' },
  capa: { id: 'capa', nombre: 'Capa de sombra', texto: '1 de cada 6 golpes que recibes no te hace daño.', precio: 50, tipo: 'reliquia', rareza: 'epica' },
  espinas: { id: 'espinas', nombre: 'Cota de espinas', texto: 'Los enemigos que te tocan reciben 12 de daño.', precio: 30, tipo: 'reliquia', rareza: 'comun' },
  linterna: { id: 'linterna', nombre: 'Linterna de plata', texto: 'Ves un 25 % más lejos y tu farol nunca se apaga del todo: siempre le queda al menos un 20 % de aceite.', precio: 45, tipo: 'reliquia', rareza: 'rara' },
  colmillo: { id: 'colmillo', nombre: 'Colmillo de lobo', texto: 'Todas tus armas hacen un 20 % más de daño.', precio: 55, tipo: 'reliquia', rareza: 'epica' },
  leguas: { id: 'leguas', nombre: 'Botas de siete leguas', texto: 'Caminas un 15 % más rápido.', precio: 30, tipo: 'reliquia', rareza: 'comun' },
  elixir: { id: 'elixir', nombre: 'Elixir del ermitaño', texto: 'Recuperas toda la vida y llenas el farol.', precio: 25, tipo: 'consumible', rareza: 'comun' },
  pergamino: { id: 'pergamino', nombre: 'Pergamino del sabio', texto: 'Subes un nivel al instante y eliges una mejora.', precio: 35, tipo: 'consumible', rareza: 'rara' },
  // Objetos de personaje: refuerzan lo que ya hace bien cada uno, sin tapar su punto débil.
  cuerno: {
    id: 'cuerno',
    nombre: 'Cuerno de caza',
    texto: 'Un poco de todo: +8 % de daño, +8 % de velocidad y recoges desde un 20 % más lejos.',
    precio: 50,
    tipo: 'reliquia',
    rareza: 'epica',
    personaje: 'cazador',
  },
  hacha: {
    id: 'hacha',
    nombre: 'Hacha del verdugo',
    texto: 'Los enemigos con menos del 15 % de vida mueren al primer golpe. No funciona con jefes.',
    precio: 55,
    tipo: 'reliquia',
    rareza: 'epica',
    personaje: 'verdugo',
  },
  savia: {
    id: 'savia',
    nombre: 'Savia de roble',
    texto: 'Recuperas 1 de vida por cada enemigo que derribas (hasta 4 por segundo).',
    precio: 55,
    tipo: 'reliquia',
    rareza: 'epica',
    personaje: 'lenador',
  },
  cola: {
    id: 'cola',
    nombre: 'Cola de zorro',
    texto: 'Tu esquiva se recarga un 40 % antes.',
    precio: 45,
    tipo: 'reliquia',
    rareza: 'epica',
    personaje: 'zorro',
  },
  vidrio: {
    id: 'vidrio',
    nombre: 'Farol de vidrio soplado',
    texto: 'Mientras tu farol tenga más de la mitad de aceite, haces un 20 % más de daño.',
    precio: 50,
    tipo: 'reliquia',
    rareza: 'epica',
    personaje: 'farolera',
  },
  forja: { id: 'forja', nombre: 'Piedra de forja', texto: 'Una de tus armas, elegida al azar, sube un nivel.', precio: 50, tipo: 'consumible', rareza: 'epica' },
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

/** El objeto propio de un personaje, si tiene. */
export function objetoDe(personaje: IdPersonaje): IdReliquia | undefined {
  return (Object.keys(ARTICULOS) as IdArticulo[]).find((id) => ARTICULOS[id].personaje === personaje) as IdReliquia | undefined;
}

/**
 * Elige `n` artículos distintos para la visita. Nunca ofrece una reliquia que
 * ya tienes, ni la piedra de forja si todas tus armas están al máximo. El
 * objeto de tu personaje sale siempre (hasta que lo compres) y los de los
 * demás personajes, nunca.
 */
export function ofrecerArticulos(
  rng: Rng,
  reliquias: ReadonlySet<IdReliquia>,
  puedeForjar: boolean,
  n = 4,
  personaje: IdPersonaje = 'cazador',
): IdArticulo[] {
  const propio = objetoDe(personaje);
  const conPropio = propio !== undefined && !reliquias.has(propio);
  const disponibles = (Object.keys(ARTICULOS) as IdArticulo[]).filter((id) => {
    if (ARTICULOS[id].personaje) return false;
    if (ARTICULOS[id].tipo === 'reliquia') return !reliquias.has(id as IdReliquia);
    if (id === 'forja') return puedeForjar;
    return true;
  });
  const res = sortear(rng, disponibles.map((id) => ({ valor: id, peso: RAREZAS[ARTICULOS[id].rareza].peso })), conPropio ? n - 1 : n);
  // Al menos un consumible siempre a mano, para que la visita nunca sea inútil.
  if (!res.some((id) => ARTICULOS[id].tipo === 'consumible')) {
    const [consumible] = sortear(
      rng,
      disponibles.filter((id) => ARTICULOS[id].tipo === 'consumible').map((id) => ({ valor: id, peso: RAREZAS[ARTICULOS[id].rareza].peso })),
      1,
    );
    if (consumible) res[res.length - 1] = consumible;
  }
  return conPropio ? [propio, ...res] : res;
}

/** Probabilidad de soltar una moneda de plata (vale 1) según la experiencia del enemigo. */
export function probMoneda(xp: number, codicia: number): number {
  return Math.min(0.9, (0.36 + xp * 0.04) * codicia);
}

/** Probabilidad de una moneda de oro (vale 5). */
export const PROB_ORO = 0.012;
