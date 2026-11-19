// Prueba rápida en Chrome real: abre una partida, se mueve, toma capturas y vuelca el estado.
// Uso: node scripts/probar.mjs [segundos] [carpeta-salida]
import { chromium } from '@playwright/test';

const segundos = Number(process.argv[2] ?? 20);
const salida = process.argv[3] ?? 'test-results';
const navegador = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pagina = await navegador.newPage({ viewport: { width: 1280, height: 800 } });
const errores = [];
pagina.on('pageerror', (e) => errores.push(String(e)));
pagina.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
await pagina.goto(`http://localhost:5174/?jugar&semilla=7&desde=${process.env.DESDE ?? 0}`);
await pagina.waitForTimeout(1500);
const quieto = process.argv[4] === 'quieto';
const teclas = ['d', 's', 'a', 'w'];
for (let i = 0; i < segundos; i++) {
  const k = teclas[Math.floor(i / 3) % 4];
  if (!quieto) await pagina.keyboard.down(k);
  await pagina.waitForTimeout(1000);
  await pagina.keyboard.up(k);
  // Si aparece el panel de mejoras, elige la primera.
  const eligiendo = await pagina.evaluate(() => window.__umbral.scene.getScene('Juego').eligiendo);
  if (eligiendo) {
    await pagina.screenshot({ path: `${salida}/nivel.png` });
    await pagina.keyboard.press('1');
  }
  if (i === Math.floor(segundos / 2)) await pagina.screenshot({ path: `${salida}/medio.png` });
}
await pagina.screenshot({ path: `${salida}/final.png` });
const estado = await pagina.evaluate(() => {
  const j = window.__umbral.scene.getScene('Juego');
  const e = j.estado;
  return { tiempo: e.tiempo.toFixed(1), vida: Math.round(e.vida), aceite: Math.round(e.aceite), nivel: e.nivel, bajas: e.bajas, vivos: j.horda.vivos, inv: e.inventario, fps: Math.round(window.__umbral.loop.actualFps) };
});
console.log(JSON.stringify({ estado, errores }, null, 1));
await navegador.close();
