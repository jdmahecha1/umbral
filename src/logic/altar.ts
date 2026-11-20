/**
 * El Altar: mejoras permanentes que se compran en el menú con brasas.
 * Las brasas se ganan al terminar cada partida y no se pierden nunca.
 */
export type IdAltar = 'vigor' | 'fuerza' | 'presteza' | 'aceite' | 'codicia' | 'saber';

export interface DefAltar {
  id: IdAltar;
  nombre: string;
  icono: string;
  /** Lo que da cada nivel, en palabras simples. */
  porNivel: string;
  /** Precio de cada nivel (el índice 0 es el nivel 1). */
  costes: number[];
}

export const ALTAR: DefAltar[] = [
  { id: 'vigor', nombre: 'Vigor', icono: 'corazon', porNivel: '+10 de vida máxima', costes: [15, 30, 50, 80, 120] },
  { id: 'fuerza', nombre: 'Fuerza', icono: 'filo', porNivel: '+5 % de daño con todas las armas', costes: [20, 40, 65, 100, 150] },
  { id: 'presteza', nombre: 'Agilidad', icono: 'botas', porNivel: '+4 % de velocidad al caminar', costes: [20, 45, 80] },
  { id: 'aceite', nombre: 'Aceite de reserva', icono: 'aceite', porNivel: 'El farol dura un 10 % más', costes: [20, 45, 80] },
  { id: 'codicia', nombre: 'Codicia', icono: 'moneda', porNivel: '+15 % de monedas', costes: [15, 35, 60] },
  { id: 'saber', nombre: 'Saber', icono: 'gema', porNivel: '+8 % de experiencia', costes: [25, 50, 90] },
];

export type NivelesAltar = Record<IdAltar, number>;

export interface EstadoAltar {
  brasas: number;
  niveles: NivelesAltar;
}

export const ALTAR_VACIO: EstadoAltar = {
  brasas: 0,
  niveles: { vigor: 0, fuerza: 0, presteza: 0, aceite: 0, codicia: 0, saber: 0 },
};

export function defAltar(id: IdAltar): DefAltar {
  return ALTAR.find((d) => d.id === id)!;
}

/** Precio del siguiente nivel, o null si ya está al máximo. */
export function precioSiguiente(estado: EstadoAltar, id: IdAltar): number | null {
  const nivel = estado.niveles[id];
  return defAltar(id).costes[nivel] ?? null;
}

/** Compra un nivel si alcanza. Devuelve el nuevo estado (no muta el original). */
export function comprarAltar(estado: EstadoAltar, id: IdAltar): { ok: boolean; estado: EstadoAltar; motivo?: string } {
  const precio = precioSiguiente(estado, id);
  if (precio === null) return { ok: false, estado, motivo: 'Ya está al máximo' };
  if (estado.brasas < precio) return { ok: false, estado, motivo: `Te faltan ${precio - estado.brasas} brasas` };
  return {
    ok: true,
    estado: { brasas: estado.brasas - precio, niveles: { ...estado.niveles, [id]: estado.niveles[id] + 1 } },
  };
}

/** Bonificaciones que el Altar da al empezar cada partida. */
export interface BonosAltar {
  vidaExtra: number;
  dano: number;
  velocidad: number;
  aceite: number;
  monedas: number;
  xp: number;
}

export function bonosAltar(niveles: NivelesAltar): BonosAltar {
  return {
    vidaExtra: 10 * niveles.vigor,
    dano: 1 + 0.05 * niveles.fuerza,
    velocidad: 1 + 0.04 * niveles.presteza,
    aceite: 1 + 0.1 * niveles.aceite,
    monedas: 1 + 0.15 * niveles.codicia,
    xp: 1 + 0.08 * niveles.saber,
  };
}

/** Brasas que da una partida: por bajas, por tiempo aguantado y un premio si amanece. */
export function brasasGanadas(r: { tiempo: number; bajas: number; victoria: boolean }): number {
  return Math.floor(r.bajas / 8) + Math.floor(r.tiempo / 15) + (r.victoria ? 50 : 0);
}

const CLAVE = 'umbral:altar';

type Almacen = Pick<Storage, 'getItem' | 'setItem'>;

function almacen(): Almacen | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function leerAltar(a: Almacen | null = almacen()): EstadoAltar {
  try {
    const crudo = a?.getItem(CLAVE);
    if (!crudo) return structuredClone(ALTAR_VACIO);
    const d = JSON.parse(crudo) as Partial<EstadoAltar>;
    const res = structuredClone(ALTAR_VACIO);
    if (typeof d.brasas === 'number' && d.brasas >= 0) res.brasas = Math.floor(d.brasas);
    for (const def of ALTAR) {
      const v = d.niveles?.[def.id];
      if (typeof v === 'number') res.niveles[def.id] = Math.max(0, Math.min(def.costes.length, Math.floor(v)));
    }
    return res;
  } catch {
    return structuredClone(ALTAR_VACIO);
  }
}

export function guardarAltar(estado: EstadoAltar, a: Almacen | null = almacen()): void {
  try {
    a?.setItem(CLAVE, JSON.stringify(estado));
  } catch {
    // Sin almacenamiento: las compras valen solo para esta sesión.
  }
}
