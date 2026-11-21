import { describe, expect, it } from 'vitest';
import { actualizarTexto, type TextoCambiable } from '../src/game/texto';

/** Un texto falso que cuenta cuántas veces se redibuja (cada redibujado es una subida a la tarjeta gráfica). */
function falso(texto = '0:00', color = '#fff', resolution = 1) {
  const t = {
    text: texto,
    style: { color, resolution },
    dibujos: 0,
    setText(v: string) {
      t.text = v;
      t.dibujos++;
      return t;
    },
    updateText() {
      t.dibujos++;
      return t;
    },
  };
  return t as typeof t & TextoCambiable;
}

describe('actualizarTexto', () => {
  it('no redibuja si nada cambia (el reloj en cada fotograma)', () => {
    const t = falso('9:59', '#fff');
    for (let i = 0; i < 60; i++) actualizarTexto(t, { texto: '9:59', color: '#fff' });
    expect(t.dibujos).toBe(0);
  });

  it('redibuja una sola vez aunque cambien texto, color y resolución a la vez', () => {
    const t = falso('12', '#fff', 1);
    actualizarTexto(t, { texto: '30', color: '#f00', resolucion: 3 });
    expect(t.dibujos).toBe(1);
    expect(t).toMatchObject({ text: '30', style: { color: '#f00', resolution: 3 } });
  });

  it('si solo cambia el color, redibuja una vez sin tocar el texto', () => {
    const t = falso('0:59', '#fff');
    actualizarTexto(t, { texto: '0:59', color: '#ffd77a' });
    expect(t.dibujos).toBe(1);
    expect(t.style.color).toBe('#ffd77a');
  });
});
