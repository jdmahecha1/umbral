import { describe, expect, it } from 'vitest';
import { PALETA } from '../src/art/paleta';
import { ICONOS, SPRITES, recolorear, validar } from '../src/art/sprites';

describe('sprites', () => {
  it('todos son rectangulares y usan solo colores de la paleta', () => {
    const errores = Object.entries(SPRITES).flatMap(([n, s]) => validar(n, s, PALETA));
    const iconos = Object.entries(ICONOS).flatMap(([n, m]) => validar(`icono ${n}`, [m], PALETA));
    expect([...errores, ...iconos]).toEqual([]);
  });

  it('validar detecta filas desiguales y colores desconocidos', () => {
    expect(validar('x', [['ab', 'a']], PALETA)).toHaveLength(1);
    expect(validar('x', [['zz']], PALETA)).toHaveLength(2);
  });

  it('recolorear cambia solo los colores indicados', () => {
    expect(recolorear([['ed.0']], { e: 'q', d: 'p' })).toEqual([['qp.0']]);
  });
});

describe('formas generadas', () => {
  it('pinos, arbustos y tajo son válidos y deterministas', async () => {
    const { arbusto, contornear, pino, tajo } = await import('../src/art/procedural');
    const formas = { pino: pino(11), arbusto: arbusto(5), tajo: tajo() };
    for (const [n, m] of Object.entries(formas)) expect(validar(n, [m], PALETA)).toEqual([]);
    expect(pino(11)).toEqual(pino(11));
    expect(pino(11)).not.toEqual(pino(42));
    expect(contornear(['...', '.a.', '...'])).toEqual(['.0.', '0a0', '.0.']);
  });

  it('el suelo es cuadrado y repetible con la misma semilla', async () => {
    const { suelo } = await import('../src/art/procedural');
    const { crearRng } = await import('../src/logic/rng');
    const a = suelo(crearRng(7), 32);
    expect(a).toHaveLength(32);
    expect(a.every((f) => f.length === 32)).toBe(true);
    expect(a).toEqual(suelo(crearRng(7), 32));
  });
});
