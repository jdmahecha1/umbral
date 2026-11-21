import { describe, expect, it } from 'vitest';
import { ARMAS, SIN_EXTRAS, atributos, inventarioInicial } from '../src/logic/mejoras';
import { ORDEN_PERSONAJES, PERSONAJES, personaje, rasgos, type ModsPersonaje } from '../src/logic/personajes';
import { SPRITES } from '../src/art/sprites';

const conPersonaje = (mods: ModsPersonaje) => ({ ...SIN_EXTRAS, personaje: mods });

/** Atributos en los que "más" es mejor, con el valor del personaje frente al cazador. */
function comparar(mods: ModsPersonaje): number[] {
  const base = PERSONAJES.cazador.mods;
  return [
    mods.vida - base.vida,
    mods.dano - base.dano,
    mods.velocidad - base.velocidad,
    mods.armadura - base.armadura,
    mods.radioRecoger - base.radioRecoger,
    mods.luz - base.luz,
    base.gastoAceite - mods.gastoAceite,
    mods.xp - base.xp,
  ];
}

describe('personajes', () => {
  it('todos tienen arma válida, textos y sprite', () => {
    expect(ORDEN_PERSONAJES).toEqual(Object.keys(PERSONAJES));
    for (const id of ORDEN_PERSONAJES) {
      const p = PERSONAJES[id];
      expect(ARMAS[p.arma], id).toBeDefined();
      expect(p.nombre && p.papel && p.texto, id).toBeTruthy();
      expect(SPRITES[id], `sprite de ${id}`).toHaveLength(3);
    }
  });

  it('ninguno es mejor ni peor que el cazador en todo', () => {
    for (const id of ORDEN_PERSONAJES.filter((i) => i !== 'cazador')) {
      const d = comparar(PERSONAJES[id].mods);
      expect(d.some((x) => x > 0), `${id} gana en algo`).toBe(true);
      expect(d.some((x) => x < 0), `${id} pierde en algo`).toBe(true);
    }
  });

  it('cada uno cumple su papel', () => {
    const m = (id: keyof typeof PERSONAJES) => PERSONAJES[id].mods;
    const todos = ORDEN_PERSONAJES.map(m);
    expect(m('verdugo').dano).toBe(Math.max(...todos.map((x) => x.dano)));
    expect(m('verdugo').vida).toBe(Math.min(...todos.map((x) => x.vida)));
    expect(m('lenador').vida).toBe(Math.max(...todos.map((x) => x.vida)));
    expect(m('lenador').dano).toBe(Math.min(...todos.map((x) => x.dano)));
    expect(m('zorro').velocidad).toBe(Math.max(...todos.map((x) => x.velocidad)));
  });

  it('sus números llegan a los atributos de la partida', () => {
    const cazador = atributos(inventarioInicial());
    const verduga = atributos(inventarioInicial(), conPersonaje(PERSONAJES.verdugo.mods));
    expect(verduga.vidaMax).toBe(75);
    expect(verduga.dano).toBeCloseTo(cazador.dano * 1.7);
    const lenador = atributos(inventarioInicial(), conPersonaje(PERSONAJES.lenador.mods));
    expect(lenador.armadura).toBe(1);
    expect(lenador.velocidad).toBeCloseTo(cazador.velocidad * 0.85);
    // Se acumulan con las pasivas: Corazón de roble suma 20 sobre la vida del personaje.
    expect(atributos({ armas: { hoz: 1 }, pasivas: { roble: 1 } }, conPersonaje(PERSONAJES.lenador.mods)).vidaMax).toBe(180);
    expect(atributos(inventarioInicial(), conPersonaje(PERSONAJES.cazador.mods))).toEqual(cazador);
  });

  it('empieza con su arma', () => {
    expect(inventarioInicial(PERSONAJES.zorro.arma)).toEqual({ armas: { dagas: 1 }, pasivas: {} });
    expect(inventarioInicial()).toEqual({ armas: { hoz: 1 }, pasivas: {} });
  });

  it('un personaje desconocido (datos viejos o corruptos) es el cazador', () => {
    expect(personaje('nadie').id).toBe('cazador');
    expect(personaje(undefined).id).toBe('cazador');
    expect(personaje('zorro').id).toBe('zorro');
  });

  it('la tarjeta muestra sus números', () => {
    expect(rasgos(PERSONAJES.verdugo)).toEqual(['Vida: 75', 'Daño: +70 %', 'Empieza con: Hoz de plata']);
    expect(rasgos(PERSONAJES.lenador)).toContain('Velocidad: −15 %');
    expect(rasgos(PERSONAJES.farolera)).toContain('Duración del aceite: +43 %');
  });
});
