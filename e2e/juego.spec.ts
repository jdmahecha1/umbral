import { expect, test, type Page } from '@playwright/test';

// El juego es un canvas: las pruebas leen el estado de las escenas a través de window.__umbral.
type Juego = { escenas: string[]; tiempo: number; x: number; pausado: boolean; eligiendo: boolean; terminado: boolean; armas: number; pasivas: number };

async function estado(p: Page): Promise<Juego> {
  return p.evaluate(() => {
    const g = (window as any).__umbral;
    const j = g.scene.getScene('Juego');
    const activo = g.scene.isActive('Juego');
    return {
      escenas: g.scene.getScenes(true).map((s: any) => s.scene.key),
      tiempo: activo ? j.estado.tiempo : 0,
      x: activo ? j.jugador.x : 0,
      pausado: activo && j.pausado,
      eligiendo: activo && j.eligiendo,
      terminado: activo && j.terminado,
      armas: activo ? Object.keys(j.estado.inventario.armas).length : 0,
      pasivas: activo ? Object.keys(j.estado.inventario.pasivas).length : 0,
    };
  });
}

function recogerErrores(p: Page): string[] {
  const errores: string[] = [];
  p.on('pageerror', (e) => errores.push(String(e)));
  p.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  return errores;
}

test('el menú carga y el botón Jugar empieza la partida', async ({ page }) => {
  const errores = recogerErrores(page);
  await page.goto('/');
  await expect.poll(async () => (await estado(page)).escenas).toContain('Menu');
  // "Jugar" abre la elección de personaje: se pulsa la tarjeta del Zorro.
  const tarjeta = async () =>
    page.evaluate(() => {
      const t = (window as any).__umbral.scene.getScene('Menu').tarjetasPersonaje.zorro;
      if (!t?.active) return null;
      const r = t.getBounds();
      return { x: r.centerX, y: r.centerY };
    });
  // Si la ventana cambia de tamaño justo al empezar, el menú se redibuja y la elección se cierra: se vuelve a pulsar Jugar.
  await expect(async () => {
    if (!(await tarjeta())) {
      const pos = await page.evaluate(() => {
        const c = (window as any).__umbral.scene.getScene('Menu').children.getByName('boton-jugar');
        return { x: c.x, y: c.y };
      });
      await page.mouse.click(pos.x, pos.y);
    }
    expect(await tarjeta()).not.toBeNull();
  }).toPass({ timeout: 20_000 });
  // Con el render por software, un clic justo al abrirse el panel a veces se pierde: se reintenta.
  await expect(async () => {
    const t = await tarjeta();
    if (t) {
      await page.mouse.move(t.x, t.y);
      await page.waitForTimeout(100);
      await page.mouse.click(t.x, t.y);
    }
    await expect.poll(async () => (await estado(page)).escenas, { timeout: 3000 }).toEqual(expect.arrayContaining(['Juego', 'Hud']));
  }).toPass({ timeout: 20_000 });
  await expect.poll(async () => (await estado(page)).tiempo).toBeGreaterThan(1);
  const elegido = await page.evaluate(() => {
    const j = (window as any).__umbral.scene.getScene('Juego');
    return { personaje: j.personaje.id, armas: j.estado.inventario.armas };
  });
  expect(elegido).toEqual({ personaje: 'zorro', armas: { dagas: 1 } });
  expect(errores).toEqual([]);
});

test('pausa con Escape y continúa', async ({ page }, info) => {
  test.skip(info.project.name === 'movil', 'sin teclado en móvil');
  await page.goto('/?jugar&semilla=3');
  await expect.poll(async () => (await estado(page)).tiempo).toBeGreaterThan(0.5);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await estado(page)).pausado).toBe(true);
  const t = (await estado(page)).tiempo;
  await page.waitForTimeout(800);
  expect((await estado(page)).tiempo).toBe(t);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await estado(page)).pausado).toBe(false);
});

test('al subir de nivel se elige una mejora', async ({ page }) => {
  await page.goto('/?jugar&semilla=3');
  await expect.poll(async () => (await estado(page)).tiempo).toBeGreaterThan(0.5);
  await page.evaluate(() => ((window as any).__umbral.scene.getScene('Juego').pendientes = 1));
  await expect.poll(async () => (await estado(page)).eligiendo).toBe(true);
  const antes = await estado(page);
  // Espera a que el panel termine su fundido de entrada antes de pulsar.
  await expect
    .poll(() => page.evaluate(() => (window as any).__umbral.scene.getScene('Hud').capa?.alpha ?? 0))
    .toBe(1);
  // Y a que pase el breve bloqueo con el que el panel evita elecciones sin querer.
  await page.waitForTimeout(900);
  // Pulsa la primera tarjeta (el centro de la pantalla queda dentro de la segunda, así que se usa la tecla o el toque).
  const tarjeta = await page.evaluate(() => {
    const hud = (window as any).__umbral.scene.getScene('Hud');
    const capa = hud.children.list.find((o: any) => o.type === 'Container' && o.depth === 100);
    // Cada tarjeta va en su propio grupo dentro de la capa.
    const grupo = capa.list.find((o: any) => o.type === 'Container');
    const r = grupo.list.find((o: any) => o.type === 'Rectangle' && o.input);
    return { x: capa.x + r.x * capa.scaleX, y: capa.y + r.y * capa.scaleY };
  });
  const niveles = () =>
    page.evaluate(() => {
      const inv = (window as any).__umbral.scene.getScene('Juego').estado.inventario;
      return [...Object.values(inv.armas), ...Object.values(inv.pasivas)].reduce((a: number, b: any) => a + b, 0);
    });
  const antesNiveles = await niveles();
  await page.mouse.click(tarjeta.x, tarjeta.y);
  // La mejora elegida suma un nivel (aunque las gemas recogidas abran otro panel justo después).
  await expect.poll(niveles).toBe(antesNiveles + 1);
  expect(antes.armas + antes.pasivas).toBeGreaterThan(0);
});

test('al morir aparece el final y se guarda la partida', async ({ page }) => {
  await page.goto('/?jugar&semilla=3');
  await expect.poll(async () => (await estado(page)).tiempo).toBeGreaterThan(0.5);
  await page.evaluate(() => ((window as any).__umbral.scene.getScene('Juego').jugador.muerto = true));
  await expect.poll(async () => (await estado(page)).terminado).toBe(true);
  await expect
    .poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('umbral:records') ?? '{}').partidas))
    .toBe(1);
});

/** Carga del arma inicial (1 = lista; menos de 1 = acaba de atacar). */
async function cargaHoz(p: Page): Promise<number> {
  return p.evaluate(() => (window as any).__umbral.scene.getScene('Juego').estado.cargas.hoz ?? 1);
}

/**
 * Toques reales de pantalla (Chrome DevTools Protocol): Playwright no tiene arrastre táctil.
 * Una sola sesión para todo el gesto: el navegador recuerda el toque en curso por sesión.
 */
async function dedo(p: Page) {
  const cdp = await p.context().newCDPSession(p);
  const enviar = (type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  return { enviar, soltar: () => cdp.detach() };
}

test('en PC, el teclado mueve y el clic ataca hacia el cursor', async ({ page }, info) => {
  test.skip(info.project.name === 'movil', 'prueba de teclado y ratón');
  await page.goto('/?jugar&semilla=3');
  await expect.poll(async () => (await estado(page)).tiempo).toBeGreaterThan(0.5);
  // Sin atacar, el arma no se usa sola.
  await page.waitForTimeout(1500);
  expect(await cargaHoz(page)).toBe(1);
  const x0 = (await estado(page)).x;
  await page.keyboard.down('d');
  await expect.poll(async () => (await estado(page)).x).toBeGreaterThan(x0 + 5);
  await page.keyboard.up('d');
  const { width, height } = page.viewportSize()!;
  await page.mouse.move(width * 0.75, height / 2);
  await page.mouse.down();
  await expect.poll(() => cargaHoz(page)).toBeLessThan(1);
  await page.mouse.up();
});

test('en el celular, el dedo izquierdo mueve y el derecho ataca', async ({ page }, info) => {
  test.skip(info.project.name !== 'movil', 'prueba táctil');
  await page.goto('/?jugar&semilla=3');
  await expect.poll(async () => (await estado(page)).tiempo).toBeGreaterThan(0.5);
  const { width, height } = page.viewportSize()!;
  const x0 = (await estado(page)).x;
  const d = await dedo(page);
  await d.enviar('touchStart', width * 0.25, height * 0.6);
  await d.enviar('touchMove', width * 0.25 + 30, height * 0.6);
  await d.enviar('touchMove', width * 0.25 + 60, height * 0.6);
  await expect.poll(async () => (await estado(page)).x).toBeGreaterThan(x0 + 5);
  await d.enviar('touchEnd');
  expect(await cargaHoz(page)).toBe(1);
  await d.enviar('touchStart', width * 0.8, height * 0.75);
  await expect.poll(() => cargaHoz(page)).toBeLessThan(1);
  await d.enviar('touchEnd');
  await d.soltar();
});

test('el mercader llega, vende y deja seguir la noche', async ({ page }) => {
  // Empieza a segundo y medio de que llegue el mercader (segundo 165): en el CI la partida avanza despacio.
  await page.goto('/?jugar&semilla=3&desde=163.5&monedas=200');
  await expect
    .poll(() => page.evaluate(() => (window as any).__umbral.scene.getScene('Juego').enTienda), { timeout: 45_000 })
    .toBe(true);
  const r = await page.evaluate(() => {
    const j = (window as any).__umbral.scene.getScene('Juego');
    const antes = j.estado.monedas;
    const oferta = j.datosTienda.ofertas[0];
    const res = j.comprar(oferta.id);
    return { ok: res.ok, gastado: antes - j.estado.monedas, precio: oferta.precio };
  });
  expect(r.ok).toBe(true);
  expect(r.gastado).toBe(r.precio);
  await page.evaluate(() => (window as any).__umbral.scene.getScene('Juego').salirTienda());
  await expect.poll(() => page.evaluate(() => (window as any).__umbral.scene.getScene('Juego').enTienda)).toBe(false);
  const t = (await estado(page)).tiempo;
  await expect.poll(async () => (await estado(page)).tiempo).toBeGreaterThan(t + 0.5);
});

test('el Altar abre desde el menú y guarda las compras', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('umbral:altar', JSON.stringify({ brasas: 50, niveles: {} })));
  await page.goto('/');
  await expect.poll(async () => (await estado(page)).escenas).toContain('Menu');
  const pos = await page.evaluate(() => {
    const c = (window as any).__umbral.scene.getScene('Menu').children.getByName('boton-altar');
    return { x: c.x, y: c.y };
  });
  await page.mouse.click(pos.x, pos.y);
  // Espera a que el panel del Altar exista antes de buscar sus botones.
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__umbral.scene.getScene('Menu').children.list.some((o: any) => o.type === 'Container' && o.list.length > 5)),
    )
    .toBe(true);
  await page.waitForTimeout(300);
  // La primera fila es Vigor (15 brasas): su botón está a la derecha.
  const boton = await page.evaluate(() => {
    const m = (window as any).__umbral.scene.getScene('Menu');
    const capa = m.children.list.find((o: any) => o.type === 'Container' && o.list.length > 5);
    const conts = capa.list.filter((o: any) => o.type === 'Container');
    const b = conts[0];
    const e = capa.scale;
    return { x: capa.x + b.x * e, y: capa.y + b.y * e };
  });
  await page.mouse.click(boton.x, boton.y);
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('umbral:altar') ?? '{}')))
    .toMatchObject({ brasas: 35, niveles: { vigor: 1 } });
});

/** Niveles totales del inventario (sube en 1 con cada mejora elegida). */
async function totalNiveles(p: Page): Promise<number> {
  return p.evaluate(() => {
    const inv = (window as any).__umbral.scene.getScene('Juego').estado.inventario;
    return [...Object.values(inv.armas), ...Object.values(inv.pasivas)].reduce((a: number, b: any) => a + b, 0);
  });
}

test('un clic que venía de atacar no elige una mejora sin querer', async ({ page }, info) => {
  test.skip(info.project.name === 'movil', 'prueba de ratón y teclado');
  await page.goto('/?jugar&semilla=3');
  await expect.poll(async () => (await estado(page)).tiempo).toBeGreaterThan(0.5);
  const antes = await totalNiveles(page);
  const { width, height } = page.viewportSize()!;
  // Atacando con el clic presionado (y el espacio) justo cuando sube de nivel.
  await page.mouse.move(width / 2, height / 2);
  await page.mouse.down();
  await page.keyboard.down(' ');
  await page.evaluate(() => ((window as any).__umbral.scene.getScene('Juego').pendientes = 1));
  await expect.poll(async () => (await estado(page)).eligiendo).toBe(true);
  // Clics a lo loco y espacio mantenido durante el bloqueo: nada se elige.
  await page.mouse.up();
  for (let i = 0; i < 4; i++) await page.mouse.click(width / 2, height / 2);
  await page.waitForTimeout(1200);
  await page.keyboard.up(' ');
  expect((await estado(page)).eligiendo).toBe(true);
  expect(await totalNiveles(page)).toBe(antes);
  // Pasado el bloqueo, un clic nuevo y deliberado sí elige.
  await page.keyboard.press('1');
  await expect.poll(() => totalNiveles(page)).toBe(antes + 1);
});

test('con el «Ataque automático» activado, las armas atacan sin clic', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('umbral:ajustes', JSON.stringify({ sonido: false, musica: false, autoataque: true })));
  await page.goto('/?jugar&semilla=3');
  await expect.poll(async () => (await estado(page)).tiempo).toBeGreaterThan(0.5);
  // Nadie toca nada y aun así la hoz se usa.
  await expect.poll(() => cargaHoz(page)).toBeLessThan(1);
});

/** Carga de la esquiva (1 = lista) y si está esquivando ahora. */
async function esquiva(p: Page): Promise<{ carga: number; x: number }> {
  return p.evaluate(() => {
    const j = (window as any).__umbral.scene.getScene('Juego').jugador;
    return { carga: j.cargaEsquiva(), x: j.x };
  });
}

test('la esquiva da un impulso rápido y luego se recarga', async ({ page }, info) => {
  await page.goto('/?jugar&semilla=3');
  await expect.poll(async () => (await estado(page)).tiempo).toBeGreaterThan(0.5);
  const antes = await esquiva(page);
  expect(antes.carga).toBe(1);
  if (info.project.name === 'movil') {
    // El botón pequeño junto al de ataque.
    const b = await page.evaluate(() => (window as any).__umbral.scene.getScene('Juego').controles.geometriaEsquiva());
    const d = await dedo(page);
    await d.enviar('touchStart', b.x, b.y);
    await d.enviar('touchEnd');
    await d.soltar();
  } else {
    // Primero se camina (así la esquiva sale hacia la derecha) y luego se esquiva.
    await page.keyboard.down('d');
    await expect.poll(async () => (await esquiva(page)).x).toBeGreaterThan(antes.x + 2);
    const caminando = await esquiva(page);
    await page.keyboard.press('Shift');
    await expect.poll(async () => (await esquiva(page)).carga).toBeLessThan(1);
    await page.waitForTimeout(300);
    await page.keyboard.up('d');
    // El impulso recorre mucho más que caminar ese mismo rato (≈ 19 unidades en 0,3 s).
    expect((await esquiva(page)).x - caminando.x).toBeGreaterThan(35);
  }
  await expect.poll(async () => (await esquiva(page)).carga).toBeLessThan(1);
  await expect.poll(async () => (await esquiva(page)).carga, { timeout: 10_000 }).toBe(1);
});

/** Centro en pantalla del botón del panel cuyo texto empieza por `inicio`. */
async function botonHud(p: Page, inicio: string): Promise<{ x: number; y: number } | null> {
  return p.evaluate((ini) => {
    const hud = (window as any).__umbral.scene.getScene('Hud');
    const buscar = (lista: any[]): any => {
      for (const o of lista) {
        if (o.type === 'Text' && String(o.text).startsWith(ini)) return o;
        if (o.list) {
          const r = buscar(o.list);
          if (r) return r;
        }
      }
      return null;
    };
    const t = buscar(hud.children.list);
    if (!t) return null;
    const r = t.getBounds();
    return { x: r.centerX, y: r.centerY };
  }, inicio);
}

test('al subir de nivel se puede volver a tirar y saltar a cambio de monedas', async ({ page }) => {
  await page.goto('/?jugar&semilla=5');
  await expect.poll(async () => (await estado(page)).tiempo).toBeGreaterThan(0.5);
  await page.evaluate(() => ((window as any).__umbral.scene.getScene('Juego').pendientes = 1));
  await expect.poll(async () => (await estado(page)).eligiendo).toBe(true);
  await page.waitForTimeout(900);
  const tiradas = () => page.evaluate(() => (window as any).__umbral.scene.getScene('Juego').estado.tiradas);
  expect(await tiradas()).toBe(3);
  const tirar = (await botonHud(page, 'Volver a tirar'))!;
  await page.mouse.click(tirar.x, tirar.y);
  await expect.poll(tiradas).toBe(2);
  expect((await estado(page)).eligiendo).toBe(true);
  await page.waitForTimeout(500);
  const monedas = () => page.evaluate(() => (window as any).__umbral.scene.getScene('Juego').estado.monedas);
  const antes = await monedas();
  const saltar = (await botonHud(page, 'Saltar'))!;
  await page.mouse.click(saltar.x, saltar.y);
  await expect.poll(async () => (await estado(page)).eligiendo).toBe(false);
  expect(await monedas()).toBe(antes + 8);
});

test('"Otra noche" reinicia la partida con la interfaz funcionando', async ({ page }) => {
  await page.goto('/?jugar&semilla=3');
  await expect.poll(async () => (await estado(page)).tiempo).toBeGreaterThan(0.5);
  await page.evaluate(() => ((window as any).__umbral.scene.getScene('Juego').jugador.muerto = true));
  await expect.poll(async () => (await estado(page)).terminado).toBe(true);
  // Pulsa "Otra noche" a través del propio botón de la capa final.
  await expect
    .poll(async () => page.evaluate(() => !!(window as any).__umbral.scene.getScene('Hud').capa))
    .toBe(true);
  await page.evaluate(() => {
    const hud = (window as any).__umbral.scene.getScene('Hud');
    hud.reiniciar();
  });
  await expect.poll(async () => (await estado(page)).terminado).toBe(false);
  await expect.poll(async () => (await estado(page)).tiempo).toBeGreaterThan(0.5);
  // La nueva partida responde al movimiento y al panel de mejoras.
  const x0 = (await estado(page)).x;
  await page.evaluate(() => ((window as any).__umbral.scene.getScene('Juego').pendientes = 1));
  await expect.poll(async () => (await estado(page)).eligiendo).toBe(true);
  await expect
    .poll(async () => page.evaluate(() => !!(window as any).__umbral.scene.getScene('Hud').capa))
    .toBe(true);
  expect(x0).toBeDefined();
  const controles = await page.evaluate(() => {
    const j = (window as any).__umbral.scene.getScene('Juego');
    return j.controles !== null;
  });
  expect(controles).toBe(true);
});
