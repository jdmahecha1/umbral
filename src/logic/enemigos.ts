import { elegirPonderado, type Rng } from './rng';

export type TipoEnemigo = 'fatuo' | 'lobo' | 'espantajo' | 'anima' | 'bruja' | 'raizon' | 'guardian' | 'ciervo';

export interface DefEnemigo {
  tipo: TipoEnemigo;
  nombre: string;
  vida: number;
  velocidad: number;
  dano: number;
  xp: number;
  /** Radio de choque en unidades del mundo. */
  radio: number;
  /** Cuánto le afecta el empuje (0 = nada, 1 = normal). */
  peso: number;
  jefe?: boolean;
  /** Brilla en la oscuridad. */
  luz?: number;
}

export const ENEMIGOS: Record<TipoEnemigo, DefEnemigo> = {
  fatuo: { tipo: 'fatuo', nombre: 'Fuego fatuo', vida: 6, velocidad: 40, dano: 4, xp: 1, radio: 4, peso: 1, luz: 14 },
  lobo: { tipo: 'lobo', nombre: 'Lobo hueco', vida: 15, velocidad: 52, dano: 8, xp: 2, radio: 6, peso: 0.8 },
  espantajo: { tipo: 'espantajo', nombre: 'Espantajo', vida: 32, velocidad: 29, dano: 10, xp: 3, radio: 6, peso: 0.6 },
  anima: { tipo: 'anima', nombre: 'Ánima en pena', vida: 20, velocidad: 44, dano: 9, xp: 3, radio: 5, peso: 0.9, luz: 10 },
  bruja: { tipo: 'bruja', nombre: 'Bruja del pantano', vida: 28, velocidad: 33, dano: 9, xp: 4, radio: 6, peso: 0.7 },
  raizon: { tipo: 'raizon', nombre: 'Raizón', vida: 130, velocidad: 21, dano: 15, xp: 10, radio: 9, peso: 0.25 },
  guardian: { tipo: 'guardian', nombre: 'Guardián de musgo', vida: 1100, velocidad: 24, dano: 18, xp: 40, radio: 13, peso: 0.05, jefe: true },
  ciervo: { tipo: 'ciervo', nombre: 'El Ciervo de Ceniza', vida: 5200, velocidad: 30, dano: 22, xp: 0, radio: 13, peso: 0, jefe: true, luz: 30 },
};

/** Duración de la partida en segundos: al llegar aparece el jefe final. */
export const DURACION = 600;
export const MINIJEFE_EN = 300;
export const MAX_VIVOS = 280;

/** Multiplicador de vida según el minuto: los enemigos se endurecen con el tiempo. */
export function multVida(t: number): number {
  return 1 + Math.max(0, t) / DURACION * 1.6;
}

/** Enemigos que deberían aparecer por segundo en el instante `t`. */
export function ritmo(t: number): number {
  if (t >= DURACION) return 1.5; // durante el jefe, solo escolta
  const base = 0.9 + t * 0.011;
  // Pequeña calma justo después del minijefe para respirar.
  const calma = t > MINIJEFE_EN && t < MINIJEFE_EN + 20 ? 0.5 : 1;
  return base * calma;
}

/** Qué tipos pueden aparecer en `t`, con su peso. */
export function pesos(t: number): { valor: TipoEnemigo; peso: number }[] {
  const m = t / 60;
  return [
    { valor: 'fatuo', peso: m < 2 ? 10 : Math.max(2, 8 - m) },
    { valor: 'lobo', peso: m >= 1 ? 6 : 0 },
    { valor: 'espantajo', peso: m >= 2.5 ? 4 + m * 0.3 : 0 },
    { valor: 'anima', peso: m >= 3.5 ? 4 : 0 },
    { valor: 'bruja', peso: m >= 5.5 ? 2.5 : 0 },
    { valor: 'raizon', peso: m >= 7 ? 1.4 : 0 },
  ];
}

export function elegirTipo(rng: Rng, t: number): TipoEnemigo {
  return elegirPonderado(rng, pesos(t)) ?? 'fatuo';
}

export type Evento =
  | { en: number; tipo: 'anillo'; enemigo: TipoEnemigo; cantidad: number }
  | { en: number; tipo: 'enjambre'; enemigo: TipoEnemigo; cantidad: number }
  | { en: number; tipo: 'jefe'; enemigo: TipoEnemigo };

/** Momentos especiales de la partida. */
export const EVENTOS: Evento[] = [
  { en: 150, tipo: 'anillo', enemigo: 'fatuo', cantidad: 28 },
  { en: 240, tipo: 'enjambre', enemigo: 'lobo', cantidad: 18 },
  { en: MINIJEFE_EN, tipo: 'jefe', enemigo: 'guardian' },
  { en: 390, tipo: 'anillo', enemigo: 'anima', cantidad: 30 },
  { en: 480, tipo: 'enjambre', enemigo: 'lobo', cantidad: 30 },
  { en: 540, tipo: 'anillo', enemigo: 'espantajo', cantidad: 34 },
  { en: DURACION, tipo: 'jefe', enemigo: 'ciervo' },
];

/** Eventos cuyo instante cae en (desde, hasta]. */
export function eventosEntre(desde: number, hasta: number): Evento[] {
  return EVENTOS.filter((e) => e.en > desde && e.en <= hasta);
}
