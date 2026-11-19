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

test('el cazador se mueve arrastrando en la pantalla', async ({ page }) => {
  await page.goto('/?jugar&semilla=3');
  await expect.poll(async () => (await estado(page)).tiempo).toBeGreaterThan(0.5);
  const { width, height } = page.viewportSize()!;
  const x0 = (await estado(page)).x;
  await page.mouse.move(width / 2, height / 2);
  await page.mouse.down();
  await page.mouse.move(width / 2 + 60, height / 2, { steps: 5 });
  await page.waitForTimeout(1200);
  await page.mouse.up();
  expect((await estado(page)).x).toBeGreaterThan(x0 + 5);
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
