/** Récords y ajustes guardados en el navegador. Nunca sale nada del equipo. */
export interface Records {
  mejorTiempo: number;
  mejorNivel: number;
  mejorBajas: number;
  partidas: number;
  victorias: number;
}

export interface Ajustes {
  sonido: boolean;
  musica: boolean;
}

export interface Resultado {
  tiempo: number;
  nivel: number;
  bajas: number;
  victoria: boolean;
}

const CLAVE_RECORDS = 'umbral:records';
const CLAVE_AJUSTES = 'umbral:ajustes';

export const RECORDS_VACIOS: Records = { mejorTiempo: 0, mejorNivel: 0, mejorBajas: 0, partidas: 0, victorias: 0 };
export const AJUSTES_INICIALES: Ajustes = { sonido: true, musica: true };

type Almacen = Pick<Storage, 'getItem' | 'setItem'>;

function almacen(): Almacen | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function leer<T extends object>(clave: string, defecto: T, a: Almacen | null): T {
  try {
    const crudo = a?.getItem(clave);
    if (!crudo) return { ...defecto };
    const datos = JSON.parse(crudo) as Partial<T>;
    const res = { ...defecto };
    // Solo acepta campos conocidos y del mismo tipo: protege de datos corruptos.
    for (const k of Object.keys(defecto) as (keyof T)[]) {
      if (typeof datos[k] === typeof defecto[k]) res[k] = datos[k] as T[keyof T];
    }
    return res;
  } catch {
    return { ...defecto };
  }
}

function escribir(clave: string, valor: object, a: Almacen | null): void {
  try {
    a?.setItem(clave, JSON.stringify(valor));
  } catch {
    // Sin almacenamiento (modo privado estricto): se juega igual, sin récords.
  }
}

export function leerRecords(a: Almacen | null = almacen()): Records {
  return leer(CLAVE_RECORDS, RECORDS_VACIOS, a);
}

export function leerAjustes(a: Almacen | null = almacen()): Ajustes {
  return leer(CLAVE_AJUSTES, AJUSTES_INICIALES, a);
}

export function guardarAjustes(ajustes: Ajustes, a: Almacen | null = almacen()): void {
  escribir(CLAVE_AJUSTES, ajustes, a);
}

/** Combina un resultado con los récords. Devuelve los nuevos récords y qué se superó. */
export function registrar(previos: Records, r: Resultado): { records: Records; nuevos: (keyof Records)[] } {
  const records: Records = {
    mejorTiempo: Math.max(previos.mejorTiempo, Math.floor(r.tiempo)),
    mejorNivel: Math.max(previos.mejorNivel, r.nivel),
    mejorBajas: Math.max(previos.mejorBajas, r.bajas),
    partidas: previos.partidas + 1,
    victorias: previos.victorias + (r.victoria ? 1 : 0),
  };
  const nuevos = (['mejorTiempo', 'mejorNivel', 'mejorBajas'] as const).filter(
    (k) => previos.partidas > 0 && records[k] > previos[k],
  );
  return { records, nuevos };
}

export function guardarResultado(r: Resultado, a: Almacen | null = almacen()) {
  const res = registrar(leerRecords(a), r);
  escribir(CLAVE_RECORDS, res.records, a);
  return res;
}

export function formatoTiempo(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
