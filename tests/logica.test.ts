import { describe, it, expect } from 'vitest';
import { crearRng, entre, elegirPonderado, mezclar, hash2 } from '../src/logic/rng';
import { Rejilla } from '../src/logic/rejilla';
import { xpParaNivel, sumarXp } from '../src/logic/experiencia';
import { MAX_ARMAS, MAX_PASIVAS, candidatas, ofrecer, aplicar, atributos, danoRecibido, inventarioInicial } from '../src/logic/mejoras';
import { statsHoz, statsDagas, statsFarol, statsRunas, statsCampana } from '../src/logic/armas';
import { DURACION, MINIJEFE_EN, EVENTOS, eventosEntre, pesos, ritmo } from '../src/logic/enemigos';
import { AJUSTES_INICIALES, RECORDS_VACIOS, leerAjustes, leerRecords, guardarResultado, formatoTiempo } from '../src/logic/guardado';

describe('rng', () => {
  it('es reproducible con la misma semilla', () => {
    const a = crearRng(12345);
    const b = crearRng(12345);
    expect(Array.from({ length: 20 }, () => a())).toEqual(Array.from({ length: 20 }, () => b()));
  });

  it('genera valores dentro de [0, 1)', () => {
    const rng = crearRng(9);
    for (let i = 0; i < 100; i++) {
      const valor = rng();
      expect(valor).toBeGreaterThanOrEqual(0);
      expect(valor).toBeLessThan(1);
    }
  });

  it('incluye ambos extremos en entre', () => {
    expect(entre(() => 0, 3, 7)).toBe(3);
    expect(entre(() => 0.999999, 3, 7)).toBe(7);
  });

  it('ignora pesos cero y devuelve undefined si todos son cero', () => {
    expect(elegirPonderado(() => 0, [{ valor: 'cero', peso: 0 }, { valor: 'positivo', peso: 1 }])).toBe('positivo');
    expect(elegirPonderado(() => 0, [{ valor: 'a', peso: 0 }, { valor: 'b', peso: 0 }])).toBeUndefined();
  });

  it('mezcla una copia y conserva los elementos', () => {
    const original = [1, 2, 3, 4, 5];
    const resultado = mezclar(crearRng(4), original);
    expect(original).toEqual([1, 2, 3, 4, 5]);
    expect(resultado).not.toBe(original);
    expect([...resultado].sort()).toEqual(original);
  });

  it('calcula un hash determinista', () => {
    expect(hash2(-12, 40, 17)).toBe(hash2(-12, 40, 17));
  });
});

describe('rejilla', () => {
  it('consulta ids cercanos en coordenadas negativas y se puede vaciar', () => {
    const rejilla = new Rejilla(10);
    rejilla.insertar(1, -12, -8);
    rejilla.insertar(2, -1, -1);
    rejilla.insertar(3, 35, 35);
    const encontrados: number[] = [];
    rejilla.consultar(-5, -5, 10, (id) => encontrados.push(id));
    expect(encontrados).toContain(1);
    expect(encontrados).toContain(2);
    rejilla.vaciar();
    const despues: number[] = [];
    rejilla.consultar(-5, -5, 100, (id) => despues.push(id));
    expect(despues).toEqual([]);
  });
});

describe('experiencia', () => {
  it('usa requisitos de experiencia crecientes', () => {
    expect(xpParaNivel(2)).toBeGreaterThan(xpParaNivel(1));
    expect(xpParaNivel(10)).toBeGreaterThan(xpParaNivel(9));
  });

  it('sube varios niveles y conserva el sobrante', () => {
    const progreso = { nivel: 1, xp: 0 };
    // 4 + 9 + 14 = 27: justo tres niveles.
    expect(sumarXp(progreso, 27)).toBe(3);
    expect(progreso).toEqual({ nivel: 4, xp: 0 });
    expect(sumarXp(progreso, 5)).toBe(0);
    expect(progreso).toEqual({ nivel: 4, xp: 5 });
  });
});

describe('mejoras', () => {
  it('respeta los máximos de armas, pasivas y niveles', () => {
    const inv = {
      armas: { hoz: 5, dagas: 5, farol: 5, runas: 5, campana: 5 },
      pasivas: { botas: 5, roble: 5, musgo: 5, iman: 5, filo: 5 },
    };
    expect(Object.keys(inv.armas).length).toBeGreaterThan(MAX_ARMAS);
    expect(Object.keys(inv.pasivas).length).toBeGreaterThan(MAX_PASIVAS);
    expect(candidatas(inv)).toEqual([]);
  });

  it('ofrece opciones sin repetir y consumibles cuando no queda nada', () => {
    const inv = inventarioInicial();
    const opciones = ofrecer(inv, crearRng(11), 3);
    expect(new Set(opciones.map((opcion) => opcion.id)).size).toBe(opciones.length);

    const completa = {
      armas: { hoz: 5, dagas: 5, farol: 5, runas: 5, campana: 5 },
      pasivas: { botas: 5, roble: 5, musgo: 5, iman: 5, filo: 5, reloj: 5, mecha: 5, coraza: 5 },
    };
    expect(ofrecer(completa, crearRng(2)).map((opcion) => opcion.id)).toEqual(['pan', 'aceite']);
  });

  it('no supera el nivel máximo al aplicar y calcula atributos y daño mínimo', () => {
    const inv = inventarioInicial();
    inv.armas.hoz = 5;
    aplicar(inv, 'hoz');
    expect(inv.armas.hoz).toBe(5);

    inv.pasivas.roble = 2;
    inv.pasivas.botas = 1;
    inv.pasivas.coraza = 2;
    expect(atributos(inv)).toMatchObject({ vidaMax: 140, velocidad: 62 * 1.08, armadura: 2 });
    expect(danoRecibido(2, 5)).toBe(1);
  });
});

describe('armas', () => {
  it('no reduce el daño al subir de nivel en ninguna arma', () => {
    const tablas = [statsHoz, statsDagas, statsFarol, statsRunas, statsCampana];
    for (const stats of tablas) {
      for (let nivel = 1; nivel < 5; nivel++) {
        expect(stats(nivel + 1).dano).toBeGreaterThanOrEqual(stats(nivel).dano);
      }
    }
  });

  it('acota los niveles fuera del rango', () => {
    for (const stats of [statsHoz, statsDagas, statsFarol, statsRunas, statsCampana]) {
      expect(stats(0)).toEqual(stats(1));
      expect(stats(99)).toEqual(stats(5));
      expect(stats(-3)).toEqual(stats(1));
    }
  });
});

describe('enemigos', () => {
  it('aumenta el ritmo con el tiempo fuera de la calma', () => {
    expect(ritmo(200)).toBeGreaterThan(ritmo(100));
    // Justo después del minijefe hay una calma, y luego el ritmo sigue subiendo.
    expect(ritmo(MINIJEFE_EN + 5)).toBeLessThan(ritmo(MINIJefeSeguro()));
    expect(ritmo(MINIJEFE_EN + 30)).toBeGreaterThan(ritmo(MINIJefeSeguro()));
  });

  it('al inicio solo pesa fatuo', () => {
    expect(pesos(0).filter((opcion) => opcion.peso > 0).map((opcion) => opcion.valor)).toEqual(['fatuo']);
  });

  it('eventosEntre usa (desde, hasta] y EVENTOS está ordenado', () => {
    expect(eventosEntre(150, 240).map((evento) => evento.en)).toEqual([240]);
    expect(EVENTOS.map((evento) => evento.en)).toEqual([...EVENTOS].map((evento) => evento.en).sort((a, b) => a - b));
    expect(EVENTOS[EVENTOS.length - 1]?.en).toBe(DURACION);
  });
});

describe('guardado', () => {
  it('devuelve los valores por defecto ante datos corruptos o de tipo erróneo', () => {
    const datos = new Map<string, string>([
      ['umbral:records', '{'],
      ['umbral:ajustes', '{"sonido":"sí","musica":false}'],
    ]);
    const almacen = {
      getItem: (clave: string) => datos.get(clave) ?? null,
      setItem: (clave: string, valor: string) => datos.set(clave, valor),
    };
    expect(leerRecords(almacen)).toEqual(RECORDS_VACIOS);
    expect(leerAjustes(almacen)).toEqual({ ...AJUSTES_INICIALES, musica: false });
  });

  it('registra sin nuevos récords en la primera partida y detecta mejoras después', () => {
    const datos = new Map<string, string>();
    const almacen = {
      getItem: (clave: string) => datos.get(clave) ?? null,
      setItem: (clave: string, valor: string) => datos.set(clave, valor),
    };
    const primera = guardarResultado({ tiempo: 60.8, nivel: 2, bajas: 5, victoria: false }, almacen);
    expect(primera.nuevos).toEqual([]);
    const segunda = guardarResultado({ tiempo: 90, nivel: 3, bajas: 8, victoria: true }, almacen);
    expect(segunda.nuevos).toEqual(['mejorTiempo', 'mejorNivel', 'mejorBajas']);
  });

  it('formatea el tiempo como minutos y segundos', () => {
    expect(formatoTiempo(0)).toBe('0:00');
    expect(formatoTiempo(125.9)).toBe('2:05');
    expect(formatoTiempo(-4)).toBe('0:00');
  });
});

function MINIJefeSeguro(): number {
  return MINIJEFE_EN - 50;
}


describe('aparicion', () => {
  const vista = { x: -100, y: -50, ancho: 200, alto: 100 };
  const dentro = (p: { x: number; y: number }) =>
    p.x >= vista.x && p.x <= vista.x + vista.ancho && p.y >= vista.y && p.y <= vista.y + vista.alto;

  it('los enemigos nunca aparecen dentro de la vista', async () => {
    const { puntoFueraDeVista, enjambre } = await import('../src/logic/aparicion');
    const rng = crearRng(3);
    for (let i = 0; i < 500; i++) expect(dentro(puntoFueraDeVista(rng, vista))).toBe(false);
    expect(enjambre(rng, vista, { x: 0, y: 0 }, 40).some(dentro)).toBe(false);
  });

  it('anillo, separar y direccionHacia', async () => {
    const { anillo, separar, direccionHacia } = await import('../src/logic/aparicion');
    const puntos = anillo({ x: 0, y: 0 }, 10, 4);
    expect(puntos).toHaveLength(4);
    for (const p of puntos) expect(Math.hypot(p.x, p.y)).toBeCloseTo(10);
    expect(separar(0, 0, 3, 0, 5)).toEqual({ x: -2, y: 0 });
    expect(separar(0, 0, 9, 0, 5)).toEqual({ x: 0, y: 0 });
    expect(separar(1, 1, 1, 1, 4)).toEqual({ x: 4, y: 0 });
    expect(direccionHacia(0, 0, 0, 0)).toEqual({ x: 0, y: 0 });
    const d = direccionHacia(0, 0, 3, 4);
    expect(d.x).toBeCloseTo(0.6);
    expect(d.y).toBeCloseTo(0.8);
  });
});
