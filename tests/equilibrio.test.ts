import { describe, expect, it } from 'vitest';
import { ICONOS } from '../src/art/sprites';
import { ALTAR, bonosAltar, type NivelesAltar } from '../src/logic/altar';
import { NIVEL_MAX_ARMA, statsCampana, statsDagas, statsHoz, statsLlamarada, statsRunas } from '../src/logic/armas';
import {
  ARMAS,
  BASE,
  LIMITES,
  PASIVAS,
  atributos,
  cambios,
  maxNivel,
  type IdArma,
  type IdPasiva,
  type Inventario,
} from '../src/logic/mejoras';
import { ORDEN_PERSONAJES, PERSONAJES } from '../src/logic/personajes';
import { crearRng } from '../src/logic/rng';
import { ARTICULOS, objetoDe, ofrecerArticulos, type IdArticulo, type IdReliquia } from '../src/logic/tienda';

/** Todas las combinaciones de `k` elementos de una lista. */
function combinaciones<T>(lista: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (lista.length < k) return [];
  const [primero, ...resto] = lista;
  return [...combinaciones(resto, k - 1).map((c) => [primero!, ...c]), ...combinaciones(resto, k)];
}

const ALTAR_LLENO = Object.fromEntries(ALTAR.map((d) => [d.id, d.costes.length])) as unknown as NivelesAltar;
const TODAS_LAS_RELIQUIAS = (Object.keys(ARTICULOS) as IdArticulo[]).filter((id) => ARTICULOS[id].tipo === 'reliquia') as IdReliquia[];

describe('ninguna combinación rompe el juego', () => {
  it('con cualquier personaje, 4 pasivas al máximo, todas las reliquias y el Altar lleno, los atributos respetan sus topes', () => {
    const pasivas = Object.keys(PASIVAS) as IdPasiva[];
    let revisadas = 0;
    for (const id of ORDEN_PERSONAJES) {
      for (const elegidas of combinaciones(pasivas, 4)) {
        const inv: Inventario = { armas: { hoz: 8 }, pasivas: Object.fromEntries(elegidas.map((p) => [p, maxNivel(p)])) };
        const a = atributos(inv, { altar: bonosAltar(ALTAR_LLENO), reliquias: new Set(TODAS_LAS_RELIQUIAS), personaje: PERSONAJES[id].mods });
        expect(a.dano).toBeLessThanOrEqual(LIMITES.dano);
        expect(a.enfriamiento).toBeGreaterThanOrEqual(LIMITES.enfriamientoMin);
        expect(a.velocidad).toBeLessThanOrEqual(LIMITES.velocidad);
        expect(a.armadura).toBeLessThanOrEqual(LIMITES.armadura);
        expect(a.regeneracion).toBeLessThanOrEqual(LIMITES.regeneracion);
        expect(a.gastoAceite).toBeGreaterThanOrEqual(LIMITES.gastoAceiteMin);
        expect(a.xp).toBeLessThanOrEqual(LIMITES.xp);
        expect(a.recargaEsquiva).toBeGreaterThanOrEqual(LIMITES.recargaEsquivaMin);
        // Los golpes fuertes siempre duelen: el Guardián (18) quita al menos 12.
        expect(18 - a.armadura).toBeGreaterThanOrEqual(12);
        revisadas++;
      }
    }
    expect(revisadas).toBe(ORDEN_PERSONAJES.length * 126);
  });

  it('los topes solo recortan los extremos: sin nada, todo queda como el cazador base', () => {
    const a = atributos({ armas: { hoz: 1 }, pasivas: {} });
    expect(a.dano).toBe(BASE.dano);
    expect(a.velocidad).toBe(BASE.velocidad);
    expect(a.recargaEsquiva).toBe(BASE.recargaEsquiva);
  });
});

describe('armas hasta el nivel 8', () => {
  const stats: Record<IdArma, (n: number) => { dano: number }> = {
    hoz: statsHoz,
    dagas: statsDagas,
    farol: statsLlamarada,
    runas: statsRunas,
    campana: statsCampana,
  };

  it('todas llegan al nivel 8, el daño nunca baja y cada subida cambia algo visible', () => {
    for (const id of Object.keys(ARMAS) as IdArma[]) {
      expect(maxNivel(id)).toBe(NIVEL_MAX_ARMA);
      for (let n = 2; n <= NIVEL_MAX_ARMA; n++) {
        expect(stats[id](n).dano).toBeGreaterThanOrEqual(stats[id](n - 1).dano);
        expect(cambios(id, n).length, `${id} nivel ${n}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('objetos de personaje', () => {
  it('cada personaje tiene su objeto, con ícono', () => {
    for (const id of ORDEN_PERSONAJES) {
      const obj = objetoDe(id);
      expect(obj, id).toBeDefined();
      expect(ICONOS[obj!], obj).toBeDefined();
    }
  });

  it('el mercader ofrece siempre el objeto propio y nunca el de otro personaje', () => {
    for (const id of ORDEN_PERSONAJES) {
      const propio = objetoDe(id)!;
      for (let semilla = 1; semilla <= 30; semilla++) {
        const oferta = ofrecerArticulos(crearRng(semilla), new Set(), true, 4, id);
        expect(oferta).toHaveLength(4);
        expect(oferta).toContain(propio);
        expect(oferta.filter((o) => ARTICULOS[o].personaje && o !== propio)).toEqual([]);
        // Sigue habiendo al menos un consumible.
        expect(oferta.some((o) => ARTICULOS[o].tipo === 'consumible')).toBe(true);
      }
      // Una vez comprado, deja de salir.
      expect(ofrecerArticulos(crearRng(3), new Set([propio]), true, 4, id)).not.toContain(propio);
    }
  });

  it('cada objeto hace lo que dice', () => {
    const inv: Inventario = { armas: { hoz: 1 }, pasivas: {} };
    const con = (r: IdReliquia) => atributos(inv, { altar: bonosAltar(ALTAR_LLENO), reliquias: new Set([r]) });
    const sin = atributos(inv, { altar: bonosAltar(ALTAR_LLENO), reliquias: new Set() });
    expect(con('hacha').ejecutar).toBe(0.15);
    expect(con('savia').curarAlDerribar).toBe(1);
    expect(con('vidrio').bonoFarolLleno).toBe(0.2);
    expect(con('cola').recargaEsquiva).toBeCloseTo(sin.recargaEsquiva * 0.6);
    expect(con('cuerno').dano).toBeCloseTo(sin.dano * 1.08);
  });

  it('todas las mejoras y artículos tienen ícono', () => {
    for (const id of [...Object.keys(ARMAS), ...Object.keys(PASIVAS), ...Object.keys(ARTICULOS), 'esquiva']) {
      expect(ICONOS[id], id).toBeDefined();
    }
  });
});
