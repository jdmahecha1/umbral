import { ALTAR_VACIO, bonosAltar, type BonosAltar } from './altar';
import { statsCampana, statsDagas, statsHoz, statsLlamarada, statsRunas } from './armas';
import { mezclar, type Rng } from './rng';
import type { IdReliquia } from './tienda';

export type IdArma = 'hoz' | 'dagas' | 'farol' | 'runas' | 'campana';
export type IdPasiva = 'botas' | 'roble' | 'musgo' | 'iman' | 'filo' | 'reloj' | 'mecha' | 'coraza';
export type IdConsumible = 'pan' | 'aceite';
export type IdMejora = IdArma | IdPasiva | IdConsumible;

export interface DefMejora {
  id: IdMejora;
  tipo: 'arma' | 'pasiva' | 'consumible';
  nombre: string;
  /** Qué hace, en una frase clara para cualquier persona. */
  que: string;
  /** Nivel máximo. */
  max: number;
}

export const MAX_ARMAS = 4;
export const MAX_PASIVAS = 4;

export const ARMAS: Record<IdArma, DefMejora> = {
  hoz: { id: 'hoz', tipo: 'arma', nombre: 'Hoz de plata', que: 'Al atacar, das un tajo en arco hacia donde apuntas. Golpea a todos los que alcanza.', max: 5 },
  dagas: { id: 'dagas', tipo: 'arma', nombre: 'Dagas de hueso', que: 'Al atacar, lanzas dagas hacia donde apuntas. Llegan lejos.', max: 5 },
  farol: { id: 'farol', tipo: 'arma', nombre: 'Llamarada del farol', que: 'Al atacar, sueltas un chorro de fuego hacia donde apuntas. Además, tu farol alumbra más.', max: 5 },
  runas: { id: 'runas', tipo: 'arma', nombre: 'Runas errantes', que: 'Al atacar, lanzas runas que van hacia donde apuntas y vuelven a ti, golpeando a la ida y a la vuelta.', max: 5 },
  campana: { id: 'campana', tipo: 'arma', nombre: 'Campana de difuntos', que: 'Al atacar, la campana suena y una onda daña y aleja a todos los enemigos que te rodean.', max: 5 },
};

export const PASIVAS: Record<IdPasiva, DefMejora> = {
  botas: { id: 'botas', tipo: 'pasiva', nombre: 'Paso ligero', que: 'Caminas más rápido.', max: 5 },
  roble: { id: 'roble', tipo: 'pasiva', nombre: 'Corazón de roble', que: 'Tienes más vida máxima.', max: 5 },
  musgo: { id: 'musgo', tipo: 'pasiva', nombre: 'Musgo curativo', que: 'Recuperas vida poco a poco, sin hacer nada.', max: 5 },
  iman: { id: 'iman', tipo: 'pasiva', nombre: 'Ámbar imantado', que: 'Atraes el ámbar y las monedas desde más lejos.', max: 5 },
  filo: { id: 'filo', tipo: 'pasiva', nombre: 'Piedra de afilar', que: 'Todas tus armas hacen más daño.', max: 5 },
  reloj: { id: 'reloj', tipo: 'pasiva', nombre: 'Reloj de arena', que: 'Tus armas tardan menos en volver a estar listas.', max: 5 },
  mecha: { id: 'mecha', tipo: 'pasiva', nombre: 'Mecha larga', que: 'El aceite del farol dura más y ves más lejos.', max: 5 },
  coraza: { id: 'coraza', tipo: 'pasiva', nombre: 'Coraza de cuero', que: 'Cada golpe que recibes te quita un poco menos de vida.', max: 5 },
};

export const CONSUMIBLES: Record<IdConsumible, DefMejora> = {
  pan: { id: 'pan', tipo: 'consumible', nombre: 'Pan de centeno', que: 'Recuperas 30 de vida ahora mismo.', max: 1 },
  aceite: { id: 'aceite', tipo: 'consumible', nombre: 'Frasco de aceite', que: 'Llenas el farol ahora mismo.', max: 1 },
};

export function definicion(id: IdMejora): DefMejora {
  return (ARMAS as Record<string, DefMejora>)[id] ?? (PASIVAS as Record<string, DefMejora>)[id] ?? CONSUMIBLES[id as IdConsumible];
}

export function maxNivel(id: IdMejora): number {
  return definicion(id).max;
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
  /** Qué hace (frase clara). */
  que: string;
  /** Cambios concretos con números, por ejemplo "Daño: 12 → 16". */
  cambios: string[];
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

const seg = (s: number) => `${s.toFixed(2).replace(/0$/, '').replace('.', ',')} s`;
const pct = (x: number) => `${Math.round(x * 100)} %`;

/** Nombra un tamaño con palabras: los números internos del juego no le dicen nada a un jugador. */
function tamano(valor: number, umbrales: [number, string][]): string {
  let res = umbrales[0]![1];
  for (const [min, nombre] of umbrales) if (valor >= min) res = nombre;
  return res;
}

const ALCANCE_CORTO: [number, string][] = [[0, 'corto'], [38, 'medio'], [50, 'largo'], [60, 'muy largo']];
const DISTANCIA: [number, string][] = [[0, 'media'], [80, 'larga'], [100, 'muy larga']];
const ONDA: [number, string][] = [[0, 'mediana'], [70, 'grande'], [100, 'enorme']];
/** Luz base del farol lleno, para expresar la luz extra en porcentaje. */
const LUZ_BASE = 94;

/** Pares [etiqueta, valor] de un arma en un nivel: para mostrar "antes → después". */
function statsArma(id: IdArma, nivel: number): [string, string][] {
  switch (id) {
    case 'hoz': {
      const s = statsHoz(nivel);
      return [
        ['Daño', String(s.dano)],
        ['Alcance', tamano(s.alcance, ALCANCE_CORTO)],
        ['Espera entre tajos', seg(s.recarga)],
        ['También golpea a los enemigos a tu espalda', s.atras ? 'sí' : 'no'],
      ];
    }
    case 'dagas': {
      const s = statsDagas(nivel);
      return [['Daño', String(s.dano)], ['Dagas por ataque', String(s.cantidad)], ['Enemigos que atraviesa cada daga', String(s.atraviesa)]];
    }
    case 'farol': {
      const s = statsLlamarada(nivel);
      return [
        ['Daño', String(s.dano)],
        ['Alcance del fuego', tamano(s.alcance, ALCANCE_CORTO)],
        ['Espera entre llamaradas', seg(s.recarga)],
        ['Tu farol alumbra', `+${Math.round((s.luzExtra / LUZ_BASE) * 100)} %`],
      ];
    }
    case 'runas': {
      const s = statsRunas(nivel);
      return [['Daño', String(s.dano)], ['Runas por ataque', String(s.cantidad)], ['Distancia', tamano(s.alcance, DISTANCIA)]];
    }
    case 'campana': {
      const s = statsCampana(nivel);
      return [['Daño', String(s.dano)], ['Tamaño de la onda', tamano(s.alcance, ONDA)], ['Espera entre campanadas', seg(s.recarga)]];
    }
  }
}

/** Lo que da una pasiva en total a ese nivel: pares [etiqueta, valor]. */
function totalPasiva(id: IdPasiva, nivel: number): [string, string][] {
  switch (id) {
    case 'botas':
      return [['Velocidad', `+${pct(0.08 * nivel)}`]];
    case 'roble':
      return [['Vida máxima', `+${20 * nivel}`]];
    case 'musgo':
      return [['Vida que recuperas', `${2 * nivel} cada 5 segundos`]];
    case 'iman':
      return [['Distancia para recoger', `+${pct(0.3 * nivel)}`]];
    case 'filo':
      return [['Daño de todas las armas', `+${pct(0.1 * nivel)}`]];
    case 'reloj':
      return [['Tus armas atacan', `+${pct(1 / Math.pow(0.93, nivel) - 1)} más rápido`]];
    case 'mecha':
      return [
        ['El aceite dura', `+${pct(1 / Math.pow(0.85, nivel) - 1)}`],
        ['Ves más lejos', `+${pct(0.08 * nivel)}`],
      ];
    case 'coraza':
      return [['Daño que bloqueas en cada golpe', String(nivel)]];
  }
}

/** Cambios concretos al pasar al nivel `nivel` (con números). */
export function cambios(id: IdMejora, nivel: number): string[] {
  const def = definicion(id);
  if (def.tipo === 'consumible') return [];
  const ahora = def.tipo === 'pasiva' ? totalPasiva(id as IdPasiva, nivel) : statsArma(id as IdArma, nivel);
  // Las cualidades de sí/no se escriben como frase, sin dos puntos.
  const linea = (k: string, v: string, antes?: string) =>
    v === 'sí' ? `Ahora ${k.charAt(0).toLowerCase()}${k.slice(1)}` : antes === undefined ? `${k}: ${v}` : `${k}: ${antes} → ${v}`;
  if (nivel === 1) return ahora.filter(([, v]) => v !== 'no').map(([k, v]) => (v === 'sí' ? k : linea(k, v)));
  const antes = def.tipo === 'pasiva' ? totalPasiva(id as IdPasiva, nivel - 1) : statsArma(id as IdArma, nivel - 1);
  // Solo lo que cambia, para que se vea al instante qué mejora.
  // Se empareja por posición ANTES de filtrar, para que cada valor vaya con su "antes".
  return ahora
    .map(([k, v], i) => [k, v, antes[i]![1]] as const)
    .filter(([, v, a]) => v !== a)
    .map(([k, v, a]) => linea(k, v, a));
}

function aOpcion(inv: Inventario, id: IdMejora): Opcion {
  const def = definicion(id);
  const nivel = def.tipo === 'consumible' ? 1 : nivelDe(inv, id) + 1;
  return { id, nivel, nombre: def.nombre, que: def.que, cambios: cambios(id, nivel), tipo: def.tipo };
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
  /** Multiplicador de experiencia. */
  xp: number;
  /** Multiplicador de probabilidad de monedas. */
  monedas: number;
  /** Probabilidad de que un golpe no haga daño (0..1). */
  esquiva: number;
  /** Daño a los enemigos que te tocan. */
  espinas: number;
  /** Aceite mínimo (0..100) por debajo del cual el farol no baja. */
  aceiteMin: number;
}

export const BASE: Atributos = {
  vidaMax: 100,
  velocidad: 62,
  regeneracion: 0,
  radioRecoger: 40,
  dano: 1,
  enfriamiento: 1,
  gastoAceite: 1,
  luz: 1,
  armadura: 0,
  xp: 1,
  monedas: 1,
  esquiva: 0,
  espinas: 0,
  aceiteMin: 0,
};

/** Lo que llega de fuera de la partida (Altar) y lo comprado al mercader (reliquias). */
export interface Extras {
  altar: BonosAltar;
  reliquias: ReadonlySet<IdReliquia>;
}

export const SIN_EXTRAS: Extras = { altar: bonosAltar(ALTAR_VACIO.niveles), reliquias: new Set() };

/** Atributos del jugador según sus pasivas, el Altar y las reliquias. */
export function atributos(inv: Inventario, extras: Extras = SIN_EXTRAS): Atributos {
  const n = (id: IdPasiva) => inv.pasivas[id] ?? 0;
  const r = (id: IdReliquia) => extras.reliquias.has(id);
  const a = extras.altar;
  return {
    vidaMax: BASE.vidaMax + 20 * n('roble') + a.vidaExtra,
    velocidad: BASE.velocidad * (1 + 0.08 * n('botas')) * a.velocidad * (r('leguas') ? 1.15 : 1),
    regeneracion: BASE.regeneracion + 0.4 * n('musgo'),
    radioRecoger: BASE.radioRecoger * (1 + 0.3 * n('iman')),
    dano: BASE.dano * (1 + 0.1 * n('filo')) * a.dano * (r('colmillo') ? 1.2 : 1),
    enfriamiento: BASE.enfriamiento * Math.pow(0.93, n('reloj')),
    gastoAceite: (BASE.gastoAceite * Math.pow(0.85, n('mecha'))) / a.aceite,
    luz: BASE.luz * (1 + 0.08 * n('mecha')) * (r('linterna') ? 1.25 : 1),
    armadura: BASE.armadura + n('coraza'),
    xp: a.xp * (r('caliz') ? 1.4 : 1),
    monedas: a.monedas,
    esquiva: r('capa') ? 1 / 6 : 0,
    espinas: r('espinas') ? 12 : 0,
    aceiteMin: r('linterna') ? 20 : 0,
  };
}

/** Daño recibido tras la armadura: nunca menos de 1. */
export function danoRecibido(bruto: number, armadura: number): number {
  return Math.max(1, Math.round(bruto - armadura));
}
