import { describe, expect, it } from 'vitest';
import { Rejilla } from '../src/logic/rejilla';
import { crearRng } from '../src/logic/rng';

/** Lo que una búsqueda DEBE encontrar: todos los puntos cuya celda toca el círculo (comparando con todos, sin trucos). */
function esperado(puntos: { id: number; x: number; y: number }[], tam: number, x: number, y: number, r: number): number[] {
  const x0 = Math.floor((x - r) / tam);
  const x1 = Math.floor((x + r) / tam);
  const y0 = Math.floor((y - r) / tam);
  const y1 = Math.floor((y + r) / tam);
  return puntos
    .filter((p) => {
      const cx = Math.floor(p.x / tam);
      const cy = Math.floor(p.y / tam);
      return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
    })
    .map((p) => p.id)
    .sort((a, b) => a - b);
}

describe('rejilla', () => {
  it('encuentra exactamente lo mismo que comparar con todos, también con coordenadas negativas', () => {
    const rng = crearRng(4);
    const rejilla = new Rejilla(24);
    for (let ronda = 0; ronda < 5; ronda++) {
      // Más de 256 puntos: obliga a crecer por dentro.
      const puntos = Array.from({ length: 700 }, (_, id) => ({ id, x: (rng() - 0.5) * 1600, y: (rng() - 0.5) * 1600 }));
      rejilla.vaciar();
      for (const p of puntos) rejilla.insertar(p.id, p.x, p.y);
      for (let q = 0; q < 50; q++) {
        const x = (rng() - 0.5) * 1600;
        const y = (rng() - 0.5) * 1600;
        const r = 5 + rng() * 120;
        const total = rejilla.vecinos(x, y, r);
        const hallados = Array.from(rejilla.encontrados.slice(0, total)).sort((a, b) => a - b);
        expect(hallados).toEqual(esperado(puntos, 24, x, y, r));
        const conFuncion: number[] = [];
        rejilla.consultar(x, y, r, (id) => conFuncion.push(id));
        expect(conFuncion.sort((a, b) => a - b)).toEqual(hallados);
      }
    }
  });

  it('muchos en la misma celda (una horda apiñada) no se pierden', () => {
    const rejilla = new Rejilla(24);
    for (let id = 0; id < 300; id++) rejilla.insertar(id, 5 + (id % 7), 5 + (id % 5));
    expect(rejilla.vecinos(10, 10, 1)).toBe(300);
  });

  it('una búsqueda dentro de otra no estropea la de fuera', () => {
    const rejilla = new Rejilla(10);
    for (let id = 0; id < 20; id++) rejilla.insertar(id, id * 3, 0);
    const fuera: number[] = [];
    rejilla.consultar(0, 0, 30, (id) => {
      fuera.push(id);
      rejilla.vecinos(500, 500, 5); // otra búsqueda en medio (no encuentra nada)
    });
    expect(fuera.sort((a, b) => a - b)).toEqual(Array.from({ length: 14 }, (_, i) => i));
  });

  it('al vaciarla, ya no devuelve nada', () => {
    const rejilla = new Rejilla(10);
    rejilla.insertar(1, 0, 0);
    expect(rejilla.vecinos(0, 0, 5)).toBe(1);
    rejilla.vaciar();
    expect(rejilla.vecinos(0, 0, 500)).toBe(0);
  });
});
