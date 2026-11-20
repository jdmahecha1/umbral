// Capturas de las pantallas principales en Chrome (para revisar la interfaz).
// Uso: node scripts/capturas.mjs [escritorio|movil]
import { chromium, devices } from '@playwright/test';
const modo = process.argv[2] ?? 'escritorio';
const ctx = modo === 'movil' ? devices['Pixel 7'] : { viewport: { width: 1280, height: 800 } };
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage(ctx);
p.setDefaultTimeout(30000);
const errores = [];
p.on('pageerror', (e) => errores.push(String(e)));
p.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
const foto = (n) => p.screenshot({ path: `test-results/${modo}-${n}.png` });
const base = 'http://localhost:5174/';
await p.goto(base);
await p.evaluate(() => localStorage.setItem('umbral:altar', JSON.stringify({ brasas: 140, niveles: { vigor: 2, fuerza: 1, presteza: 0, aceite: 0, codicia: 0, saber: 0 } })));
await p.goto(base);
await p.waitForFunction(() => window.__umbral?.scene.isActive('Menu'));
await p.waitForTimeout(1200);
await foto('menu');
const altar = await p.evaluate(() => { const c = window.__umbral.scene.getScene('Menu').children.getByName('boton-altar'); return { x: c.x, y: c.y }; });
await p.mouse.click(altar.x, altar.y);
await p.waitForTimeout(600);
await foto('altar');
// Partida: atacar con el ratón hacia la derecha.
await p.goto(base + '?jugar&semilla=4&desde=152&monedas=120');
await p.waitForFunction(() => window.__umbral?.scene.isActive('Juego') && window.__umbral.scene.getScene('Juego').estado.tiempo > 151);
const { width, height } = p.viewportSize();
if (modo === 'movil') {
  await p.touchscreen.tap(width * 0.8, height * 0.7);
} else {
  await p.mouse.move(width * 0.7, height * 0.45);
  await p.mouse.down();
}
// Espera a que haya bajas para fotografiar el ataque en acción.
await p.waitForFunction(() => window.__umbral.scene.getScene('Juego').estado.bajas >= 3, null, { timeout: 8000 }).catch(() => {});
await foto('ataque');
if (modo !== 'movil') await p.mouse.up();
await p.evaluate(() => (window.__umbral.scene.getScene('Juego').pendientes = 1));
await p.waitForFunction(() => window.__umbral.scene.getScene('Juego').eligiendo);
await p.waitForTimeout(500);
await foto('nivel');
await p.keyboard.press('1');
await p.waitForFunction(() => window.__umbral.scene.getScene('Juego').enTienda, null, { timeout: 60000 });
await p.waitForTimeout(500);
await foto('tienda');
const estado = await p.evaluate(() => { const j = window.__umbral.scene.getScene('Juego'); return { t: j.estado.tiempo.toFixed(1), monedas: j.estado.monedas, bajas: j.estado.bajas, inv: j.estado.inventario }; });
console.log(modo, JSON.stringify({ estado, errores }));
await b.close();
