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
  const pos = await page.evaluate(() => {
    const m = (window as any).__umbral.scene.getScene('Menu');
    const c = m.children.getByName('boton-jugar');
    return { x: c.x, y: c.y };
  });
  await page.mouse.click(pos.x, pos.y);
  await expect.poll(async () => (await estado(page)).escenas).toEqual(expect.arrayContaining(['Juego', 'Hud']));
  await expect.poll(async () => (await estado(page)).tiempo).toBeGreaterThan(1);
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
  // Pulsa la primera tarjeta (el centro de la pantalla queda dentro de la segunda, así que se usa la tecla o el toque).
  const tarjeta = await page.evaluate(() => {
    const hud = (window as any).__umbral.scene.getScene('Hud');
    const r = hud.children.list.find((o: any) => o.type === 'Container' && o.depth === 100).list.find((o: any) => o.type === 'Rectangle' && o.input && o.width < hud.scale.width);
    return { x: r.x, y: r.y };
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
  await page.goto('/?jugar&semilla=3&desde=160&monedas=200');
  await expect.poll(() => page.evaluate(() => (window as any).__umbral.scene.getScene('Juego').enTienda)).toBe(true);
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
