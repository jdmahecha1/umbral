import { mezclar, type Rng } from './rng';

export type IdArma = 'hoz' | 'dagas' | 'farol' | 'runas' | 'campana';
export type IdPasiva = 'botas' | 'roble' | 'musgo' | 'iman' | 'filo' | 'reloj' | 'mecha' | 'coraza';
export type IdConsumible = 'pan' | 'aceite';
export type IdMejora = IdArma | IdPasiva | IdConsumible;

export interface DefMejora {
  id: IdMejora;
  tipo: 'arma' | 'pasiva' | 'consumible';
  nombre: string;
  /** Una descripción por nivel: el índice 0 es la que se ve al obtenerla. */
  niveles: string[];
}

export const MAX_ARMAS = 4;
export const MAX_PASIVAS = 4;

export const ARMAS: Record<IdArma, DefMejora> = {
  hoz: {
    id: 'hoz',
    tipo: 'arma',
    nombre: 'Hoz de plata',
    niveles: [
      'Un tajo amplio hacia donde miras.',
      'Más daño por tajo.',
      'También corta a tu espalda.',
      'El tajo es un 25 % más amplio.',
      'Más daño y tajos más seguidos.',
    ],
  },
  dagas: {
    id: 'dagas',
    tipo: 'arma',
    nombre: 'Dagas de hueso',
    niveles: [
      'Lanza una daga al enemigo más cercano.',
      'Una daga más y atraviesa a un enemigo.',
      'Más daño por daga.',
      'Una daga más.',
      'Una daga más y atraviesan a tres enemigos.',
    ],
  },
  farol: {
    id: 'farol',
    tipo: 'arma',
    nombre: 'Farol sagrado',
    niveles: [
      'Un halo que quema a los que se acercan y amplía tu luz.',
      'El halo es más grande.',
      'Quema más y más seguido.',
      'El halo es más grande.',
      'Quema mucho más.',
    ],
  },
  runas: {
    id: 'runas',
    tipo: 'arma',
    nombre: 'Runas errantes',
    niveles: [
      'Una runa gira a tu alrededor y golpea al pasar.',
      'Una runa más.',
      'Las runas giran más rápido y golpean más fuerte.',
      'Una runa más.',
      'Una runa más y su órbita es más amplia.',
    ],
  },
  campana: {
    id: 'campana',
    tipo: 'arma',
    nombre: 'Campana de difuntos',
    niveles: [
      'Cada pocos segundos, una onda que daña y empuja.',
      'La onda llega más lejos.',
      'Más daño.',
      'Suena más seguido.',
      'Más daño y la onda llega mucho más lejos.',
    ],
  },
};

export const PASIVAS: Record<IdPasiva, DefMejora> = {
  botas: { id: 'botas', tipo: 'pasiva', nombre: 'Botas de viajero', niveles: nivelesIguales('Te mueves un 8 % más rápido.') },
  roble: { id: 'roble', tipo: 'pasiva', nombre: 'Corazón de roble', niveles: nivelesIguales('+20 de vida máxima.') },
  musgo: { id: 'musgo', tipo: 'pasiva', nombre: 'Musgo curativo', niveles: nivelesIguales('Recuperas 0,25 de vida por segundo.') },
  iman: { id: 'iman', tipo: 'pasiva', nombre: 'Ámbar imantado', niveles: nivelesIguales('Atraes las gemas desde un 30 % más lejos.') },
  filo: { id: 'filo', tipo: 'pasiva', nombre: 'Piedra de afilar', niveles: nivelesIguales('Todo tu daño sube un 10 %.') },
  reloj: { id: 'reloj', tipo: 'pasiva', nombre: 'Reloj de arena', niveles: nivelesIguales('Tus armas se recargan un 7 % antes.') },
  mecha: { id: 'mecha', tipo: 'pasiva', nombre: 'Mecha larga', niveles: nivelesIguales('El farol gasta un 15 % menos y alumbra más.') },
  coraza: { id: 'coraza', tipo: 'pasiva', nombre: 'Coraza de cuero', niveles: nivelesIguales('Recibes 1 punto menos de daño por golpe.') },
};

export const CONSUMIBLES: Record<IdConsumible, DefMejora> = {
  pan: { id: 'pan', tipo: 'consumible', nombre: 'Pan de centeno', niveles: ['Recuperas 30 de vida.'] },
  aceite: { id: 'aceite', tipo: 'consumible', nombre: 'Frasco de aceite', niveles: ['Llenas el farol a tope.'] },
};

function nivelesIguales(texto: string): string[] {
  return Array.from({ length: 5 }, () => texto);
}

export function definicion(id: IdMejora): DefMejora {
  return (ARMAS as Record<string, DefMejora>)[id] ?? (PASIVAS as Record<string, DefMejora>)[id] ?? CONSUMIBLES[id as IdConsumible];
}

export function maxNivel(id: IdMejora): number {
  return definicion(id).niveles.length;
}

/** Lo que el jugador lleva: id → nivel actual (1 a 5). */
export interface Inventario {
  armas: Partial<Record<IdArma, number>>;
  pasivas: Partial<Record<IdPasiva, number>>;
}

export function inventarioInicial(): Inventario {
  return { armas: { hoz: 1 }, pasivas: {} };
}

export function nivelDe(inv: Inventario, id: IdMejora): number {
  return (inv.armas as Record<string, number>)[id] ?? (inv.pasivas as Record<string, number>)[id] ?? 0;
}

export interface Opcion {
  id: IdMejora;
  /** Nivel que tendrá tras elegirla (1 = nueva). */
  nivel: number;
  nombre: string;
  texto: string;
  tipo: DefMejora['tipo'];
}

/** Todas las mejoras que se podrían ofrecer ahora mismo. */
export function candidatas(inv: Inventario): IdMejora[] {
  const res: IdMejora[] = [];
  const numArmas = Object.keys(inv.armas).length;
  const numPasivas = Object.keys(inv.pasivas).length;
  for (const id of Object.keys(ARMAS) as IdArma[]) {
    const n = inv.armas[id] ?? 0;
    if (n > 0 ? n < maxNivel(id) : numArmas < MAX_ARMAS) res.push(id);
  }
  for (const id of Object.keys(PASIVAS) as IdPasiva[]) {
    const n = inv.pasivas[id] ?? 0;
    if (n > 0 ? n < maxNivel(id) : numPasivas < MAX_PASIVAS) res.push(id);
  }
  return res;
}

function aOpcion(inv: Inventario, id: IdMejora): Opcion {
  const def = definicion(id);
  const nivel = def.tipo === 'consumible' ? 1 : nivelDe(inv, id) + 1;
  return { id, nivel, nombre: def.nombre, texto: def.niveles[nivel - 1] ?? def.niveles[0]!, tipo: def.tipo };
}

/**
 * Elige `n` opciones distintas para la subida de nivel. Da prioridad leve a
 * mejorar lo que ya tienes, como en el género. Si no queda nada, ofrece consumibles.
 */
export function ofrecer(inv: Inventario, rng: Rng, n = 3): Opcion[] {
  const pool = candidatas(inv);
  if (pool.length === 0) return (['pan', 'aceite'] as const).map((id) => aOpcion(inv, id));
  // Las que ya tienes aparecen dos veces en la bolsa: más probabilidad, sin repetir.
  const bolsa = pool.flatMap((id) => (nivelDe(inv, id) > 0 ? [id, id] : [id]));
  const elegidas: IdMejora[] = [];
  for (const id of mezclar(rng, bolsa)) {
    if (!elegidas.includes(id)) elegidas.push(id);
    if (elegidas.length === n) break;
  }
  return elegidas.map((id) => aOpcion(inv, id));
}

/** Aplica una mejora elegida. Los consumibles no cambian el inventario. */
export function aplicar(inv: Inventario, id: IdMejora): void {
  const def = definicion(id);
  if (def.tipo === 'arma') {
    const a = id as IdArma;
    inv.armas[a] = Math.min(maxNivel(a), (inv.armas[a] ?? 0) + 1);
  } else if (def.tipo === 'pasiva') {
    const p = id as IdPasiva;
    inv.pasivas[p] = Math.min(maxNivel(p), (inv.pasivas[p] ?? 0) + 1);
  }
}

export interface Atributos {
  vidaMax: number;
  velocidad: number;
  regeneracion: number;
  radioRecoger: number;
  dano: number;
  enfriamiento: number;
  gastoAceite: number;
  luz: number;
  armadura: number;
}

export const BASE: Atributos = {
  vidaMax: 100,
  velocidad: 62,
  regeneracion: 0,
  radioRecoger: 26,
  dano: 1,
  enfriamiento: 1,
  gastoAceite: 1,
  luz: 1,
  armadura: 0,
};

/** Atributos del jugador según sus pasivas. */
export function atributos(inv: Inventario): Atributos {
  const n = (id: IdPasiva) => inv.pasivas[id] ?? 0;
  return {
    vidaMax: BASE.vidaMax + 20 * n('roble'),
    velocidad: BASE.velocidad * (1 + 0.08 * n('botas')),
    regeneracion: BASE.regeneracion + 0.25 * n('musgo'),
    radioRecoger: BASE.radioRecoger * (1 + 0.3 * n('iman')),
    dano: BASE.dano * (1 + 0.1 * n('filo')),
    enfriamiento: BASE.enfriamiento * Math.pow(0.93, n('reloj')),
    gastoAceite: BASE.gastoAceite * Math.pow(0.85, n('mecha')),
    luz: BASE.luz * (1 + 0.08 * n('mecha')),
    armadura: BASE.armadura + n('coraza'),
  };
}

/** Daño recibido tras la armadura: nunca menos de 1. */
export function danoRecibido(bruto: number, armadura: number): number {
  return Math.max(1, Math.round(bruto - armadura));
}
