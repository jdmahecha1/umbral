import { ARMAS, type IdArma } from './mejoras';

/**
 * Los personajes que se pueden elegir al empezar. Todos están disponibles desde
 * el principio. Cada uno gana en algo y lo paga en otra cosa: ninguno es mejor
 * en todo. Los números multiplican a los del cazador (1 = igual).
 */
export type IdPersonaje = 'cazador' | 'verdugo' | 'lenador' | 'zorro' | 'farolera';

export interface ModsPersonaje {
  /** Vida máxima al empezar (el cazador tiene 100). */
  vida: number;
  /** Multiplicadores sobre los atributos del cazador. */
  dano: number;
  velocidad: number;
  /** Daño que bloquea de cada golpe (se suma a la Coraza de cuero). */
  armadura: number;
  radioRecoger: number;
  luz: number;
  /** Cuánto aceite gasta el farol (menos es mejor). */
  gastoAceite: number;
  xp: number;
}

export interface DefPersonaje {
  id: IdPersonaje;
  nombre: string;
  /** Su papel en dos o tres palabras. */
  papel: string;
  /** Qué lo hace distinto, en una frase clara. */
  texto: string;
  /** Arma con la que empieza. */
  arma: IdArma;
  mods: ModsPersonaje;
}

const NEUTRO: ModsPersonaje = { vida: 100, dano: 1, velocidad: 1, armadura: 0, radioRecoger: 1, luz: 1, gastoAceite: 1, xp: 1 };

export const PERSONAJES: Record<IdPersonaje, DefPersonaje> = {
  cazador: {
    id: 'cazador',
    nombre: 'El Cazador',
    papel: 'Equilibrado',
    texto: 'No destaca en nada, pero tampoco le falta nada. Ideal para empezar.',
    arma: 'hoz',
    mods: NEUTRO,
  },
  verdugo: {
    id: 'verdugo',
    nombre: 'La Verduga',
    papel: 'Mucho daño, poca vida',
    texto: 'Sus golpes parten a cualquiera, pero dos mordiscos la tumban. No te dejes rodear.',
    arma: 'hoz',
    mods: { ...NEUTRO, vida: 75, dano: 1.7 },
  },
  lenador: {
    id: 'lenador',
    nombre: 'El Leñador',
    papel: 'Aguanta mucho, pega poco',
    texto: 'Grande como un roble: aguanta golpes que tumbarían a cualquiera, pero es lento y le cuesta derribar enemigos.',
    arma: 'campana',
    mods: { ...NEUTRO, vida: 160, armadura: 1, dano: 0.7, velocidad: 0.85 },
  },
  zorro: {
    id: 'zorro',
    nombre: 'El Zorro',
    papel: 'Rápido y frágil',
    texto: 'Flaco y veloz: corre más que nadie y recoge desde lejos, pero aguanta poco.',
    arma: 'dagas',
    mods: { ...NEUTRO, vida: 75, dano: 0.85, velocidad: 1.25, radioRecoger: 1.25 },
  },
  farolera: {
    id: 'farolera',
    nombre: 'La Farolera',
    papel: 'Luz y experiencia',
    texto: 'Cuida su farol como nadie: ve más lejos, gasta menos aceite y aprende rápido. Es algo débil.',
    arma: 'farol',
    mods: { ...NEUTRO, vida: 90, dano: 0.9, luz: 1.25, gastoAceite: 0.7, xp: 1.15 },
  },
};

export const ORDEN_PERSONAJES: IdPersonaje[] = ['cazador', 'verdugo', 'lenador', 'zorro', 'farolera'];

export function esPersonaje(id: unknown): id is IdPersonaje {
  return typeof id === 'string' && id in PERSONAJES;
}

/** El personaje con ese id, o el cazador si no existe (datos viejos o corruptos). */
export function personaje(id: unknown): DefPersonaje {
  return PERSONAJES[esPersonaje(id) ? id : 'cazador'];
}

const pct = (x: number) => `${x > 1 ? '+' : '−'}${Math.round(Math.abs(x - 1) * 100)} %`;

/** Sus números, en líneas cortas para la tarjeta. Solo lo que cambia respecto al cazador, más la vida. */
export function rasgos(def: DefPersonaje): string[] {
  const m = def.mods;
  const res = [`Vida: ${m.vida}`];
  if (m.dano !== 1) res.push(`Daño: ${pct(m.dano)}`);
  if (m.velocidad !== 1) res.push(`Velocidad: ${pct(m.velocidad)}`);
  if (m.armadura) res.push(`Bloquea ${m.armadura} de daño en cada golpe`);
  if (m.radioRecoger !== 1) res.push(`Recoge desde ${pct(m.radioRecoger)} lejos`);
  if (m.luz !== 1) res.push(`Su farol alumbra ${pct(m.luz)}`);
  if (m.gastoAceite !== 1) res.push(`El aceite le dura ${pct(1 / m.gastoAceite)}`);
  if (m.xp !== 1) res.push(`Experiencia: ${pct(m.xp)}`);
  res.push(`Empieza con: ${ARMAS[def.arma].nombre}`);
  return res;
}
