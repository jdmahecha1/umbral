import { describe, expect, it } from 'vitest';
import { ALTAR, ALTAR_VACIO, bonosAltar, brasasGanadas, comprarAltar, leerAltar, guardarAltar, precioSiguiente } from '../src/logic/altar';
import { enCono } from '../src/logic/armas';
import { SIN_EXTRAS, atributos, inventarioInicial } from '../src/logic/mejoras';
import { crearRng } from '../src/logic/rng';
import { ARTICULOS, ofrecerArticulos, precio, precioCambiar, probMoneda, type IdReliquia } from '../src/logic/tienda';

/** Almacén en memoria que imita a localStorage. */
function almacen(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  return { getItem: (k: string) => datos.get(k) ?? null, setItem: (k: string, v: string) => void datos.set(k, v) };
}

describe('altar', () => {
  it('compra un nivel si alcanzan las brasas y no muta el estado original', () => {
    const inicial = { ...structuredClone(ALTAR_VACIO), brasas: 20 };
    const r = comprarAltar(inicial, 'vigor');
    expect(r.ok).toBe(true);
    expect(r.estado.brasas).toBe(5);
    expect(r.estado.niveles.vigor).toBe(1);
    expect(inicial.niveles.vigor).toBe(0);
  });

  it('explica por qué no se puede comprar', () => {
    expect(comprarAltar({ ...structuredClone(ALTAR_VACIO), brasas: 3 }, 'vigor').motivo).toBe('Te faltan 12 brasas');
    const lleno = { brasas: 999, niveles: { ...ALTAR_VACIO.niveles, presteza: 3 } };
    expect(comprarAltar(lleno, 'presteza').motivo).toBe('Ya está al máximo');
    expect(precioSiguiente(lleno, 'presteza')).toBeNull();
  });

  it('las brasas premian el tiempo, las bajas y la victoria', () => {
    expect(brasasGanadas({ tiempo: 0, bajas: 0, victoria: false })).toBe(0);
    expect(brasasGanadas({ tiempo: 300, bajas: 400, victoria: false })).toBe(70);
    expect(brasasGanadas({ tiempo: 600, bajas: 0, victoria: true })).toBe(90);
  });

  it('lee datos corruptos sin romperse y acota los niveles', () => {
    expect(leerAltar(almacen({ 'umbral:altar': '{no es json' }))).toEqual(ALTAR_VACIO);
    const a = almacen({ 'umbral:altar': JSON.stringify({ brasas: -5, niveles: { vigor: 99, fuerza: 'x' } }) });
    const e = leerAltar(a);
    expect(e.brasas).toBe(0);
    expect(e.niveles.vigor).toBe(ALTAR.find((d) => d.id === 'vigor')!.costes.length);
    expect(e.niveles.fuerza).toBe(0);
    guardarAltar({ ...e, brasas: 7 }, a);
    expect(leerAltar(a).brasas).toBe(7);
  });

  it('las bonificaciones del Altar llegan a los atributos', () => {
    const altar = bonosAltar({ ...ALTAR_VACIO.niveles, vigor: 2, fuerza: 2 });
    const base = atributos(inventarioInicial(), SIN_EXTRAS);
    const con = atributos(inventarioInicial(), { altar, reliquias: new Set() });
    expect(con.vidaMax).toBe(base.vidaMax + 20);
    expect(con.dano).toBeCloseTo(base.dano * 1.1);
  });
});

describe('tienda del mercader', () => {
  it('ofrece artículos distintos, sin reliquias que ya tienes y con al menos un consumible', () => {
    const tengo = new Set<IdReliquia>(['amuleto', 'capa']);
    for (let s = 1; s < 50; s++) {
      const ofertas = ofrecerArticulos(crearRng(s), tengo, true);
      expect(new Set(ofertas).size).toBe(ofertas.length);
      expect(ofertas).not.toContain('amuleto');
      expect(ofertas).not.toContain('capa');
      expect(ofertas.some((id) => ARTICULOS[id].tipo === 'consumible')).toBe(true);
    }
  });

  it('no ofrece la piedra de forja si no hay armas que mejorar', () => {
    for (let s = 1; s < 50; s++) expect(ofrecerArticulos(crearRng(s), new Set(), false)).not.toContain('forja');
  });

  it('los consumibles se encarecen al repetirlos; las reliquias no', () => {
    expect(precio('elixir', 2)).toBe(precio('elixir', 0) + 20);
    expect(precio('amuleto', 3)).toBe(precio('amuleto', 0));
    expect(precioCambiar(1)).toBeGreaterThan(precioCambiar(0));
  });

  it('las monedas caen más con enemigos fuertes y con codicia, sin pasar del 90 %', () => {
    expect(probMoneda(3, 1)).toBeGreaterThan(probMoneda(1, 1));
    expect(probMoneda(1, 1.45)).toBeGreaterThan(probMoneda(1, 1));
    expect(probMoneda(100, 5)).toBe(0.9);
  });

  it('las reliquias cambian los atributos', () => {
    const r = (ids: IdReliquia[]) => atributos(inventarioInicial(), { altar: SIN_EXTRAS.altar, reliquias: new Set(ids) });
    expect(r(['capa']).esquiva).toBeCloseTo(1 / 6);
    expect(r(['espinas']).espinas).toBe(12);
    expect(r(['linterna']).aceiteMin).toBe(20);
    expect(r(['caliz']).xp).toBeCloseTo(1.4);
    expect(r(['colmillo']).dano).toBeCloseTo(1.2);
  });
});

describe('apuntado', () => {
  it('enCono funciona al cruzar el ángulo ±180°', () => {
    expect(enCono(Math.PI - 0.1, -Math.PI + 0.1, 0.5)).toBe(true);
    expect(enCono(0, Math.PI, 1)).toBe(false);
    expect(enCono(0.2, 0, 0.5)).toBe(true);
    expect(enCono(0.3, 0, 0.5)).toBe(false);
  });
});
