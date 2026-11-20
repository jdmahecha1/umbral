// Simula noches completas con el bot y resume cuánto aguanta. Mide la dificultad.
// Uso: node scripts/simular.mjs [semillas=3] [rapido=6] [brasas-del-altar=0]
import { chromium } from '@playwright/test';
const semillas = Number(process.argv[2] ?? 3);
const rapido = Number(process.argv[3] ?? 6);
const altar = process.argv[4] ? JSON.parse(process.argv[4]) : null;
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (let s = 1; s <= semillas; s++) {
  const p = await b.newPage({ viewport: { width: 960, height: 600 } });
  const errores = [];
  p.on('pageerror', (e) => errores.push(String(e)));
  await p.goto('http://localhost:5174/');
  await p.evaluate((a) => { localStorage.clear(); if (a) localStorage.setItem('umbral:altar', JSON.stringify(a)); }, altar);
  await p.goto(`http://localhost:5174/?jugar&bot&semilla=${s * 97}&rapido=${rapido}`);
  await p.waitForFunction(() => window.__umbral?.scene.isActive('Juego'));
  const marcas = [];
  let ultimo = 0;
  for (;;) {
    await p.waitForTimeout(2000);
    const e = await p.evaluate(() => { const j = window.__umbral.scene.getScene('Juego'); const e = j.estado; return { t: e.tiempo, vida: Math.round(e.vida), nv: e.nivel, bajas: e.bajas, monedas: e.monedas, fin: j.terminado, armas: e.inventario.armas, jefe: e.jefe ? Math.round(e.jefe.vida) : null }; });
    for (const m of [60, 120, 180, 240, 300, 360, 420, 480, 540, 600]) if (ultimo < m && e.t >= m) marcas.push(`${m / 60}min nv${e.nv} vida${e.vida} bajas${e.bajas}`);
    ultimo = e.t;
    if (e.fin || e.t > 760) {
      const reg = await p.evaluate(() => window.__umbral.scene.getScene('Juego').registro);
      console.log(`semilla ${s}: ${e.fin ? (e.vida > 0 ? 'GANÓ' : 'murió') : 'tiempo'} en ${Math.round(e.t)}s, nivel ${e.nv}, bajas ${e.bajas}, armas ${JSON.stringify(e.armas)}${e.jefe !== null ? `, jefe con ${e.jefe}` : ''}`);
      console.log('   ' + marcas.join(' | '));
      if (reg.length) console.log('   ' + reg.join(' | '));
      if (errores.length) console.log('   ERRORES: ' + errores.join(' ; '));
      break;
    }
  }
  await p.close();
}
await b.close();
