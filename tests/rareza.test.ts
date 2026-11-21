import { describe, expect, it } from 'vitest';
import { ARMAS, CONSUMIBLES, PASIVAS, inventarioInicial, ofrecer, pesoMejora } from '../src/logic/mejoras';
import { ORDEN_RAREZAS, RAREZAS, sortear } from '../src/logic/rareza';
import { crearRng } from '../src/logic/rng';
import { ARTICULOS, ofrecerArticulos } from '../src/logic/tienda';

/** Cuántas veces sale cada id en `veces` sorteos con semillas distintas. */
function contar(veces: number, sacar: (semilla: number) => string[]): Record<string, number> {
  const res: Record<string, number> = {};
  for (let s = 1; s <= veces; s++) for (const id of sacar(s)) res[id] = (res[id] ?? 0) + 1;
  return res;
}

describe('rarezas', () => {
  it('todo lo que puede salir tiene una rareza válida', () => {
    const defs = [...Object.values(ARMAS), ...Object.values(PASIVAS), ...Object.values(CONSUMIBLES), ...Object.values(ARTICULOS)];
    for (const d of defs) expect(ORDEN_RAREZAS, d.id).toContain(d.rareza);
  });

  it('cuanto más rara, menos peso', () => {
    const pesos = ORDEN_RAREZAS.map((r) => RAREZAS[r].peso);
    for (let i = 1; i < pesos.length; i++) expect(pesos[i]).toBeLessThan(pesos[i - 1]!);
  });

  it('sortear no repite, respeta la cantidad e ignora lo que tiene peso 0', () => {
    const opciones = [
      { valor: 'a', peso: 1 },
      { valor: 'b', peso: 0.3 },
      { valor: 'c', peso: 0 },
      { valor: 'd', peso: 2 },
    ];
    for (let s = 1; s < 200; s++) {
      const res = sortear(crearRng(s), opciones, 3);
      expect(res).toHaveLength(3);
      expect(new Set(res).size).toBe(3);
      expect(res).not.toContain('c');
    }
    expect(sortear(crearRng(1), opciones, 10)).toHaveLength(3);
  });

  it('al subir de nivel, un arma épica sale menos que una pasiva común', () => {
    const veces = contar(3000, (s) => ofrecer(inventarioInicial(), crearRng(s), 3).map((o) => o.id));
    expect(veces.dagas!).toBeLessThan(veces.botas! * 0.6);
    expect(veces.campana!).toBeLessThan(veces.dagas!);
  });

  it('lo que ya tienes sale igual de seguido, sea cual sea su rareza', () => {
    const inv = { armas: { hoz: 1, campana: 1 }, pasivas: {} };
    expect(pesoMejora(inv, 'campana')).toBe(pesoMejora(inv, 'hoz'));
    expect(pesoMejora(inv, 'campana')).toBeGreaterThan(pesoMejora(inventarioInicial(), 'campana'));
  });

  it('las tarjetas llevan la rareza de su mejora', () => {
    for (const op of ofrecer(inventarioInicial(), crearRng(5), 3)) {
      const def = { ...ARMAS, ...PASIVAS, ...CONSUMIBLES }[op.id];
      expect(op.rareza).toBe(def.rareza);
    }
  });

  it('en la tienda, la reliquia legendaria sale menos que una común', () => {
    const veces = contar(3000, (s) => ofrecerArticulos(crearRng(s), new Set(), true));
    expect(veces.amuleto!).toBeLessThan(veces.espinas! * 0.4);
  });
});
