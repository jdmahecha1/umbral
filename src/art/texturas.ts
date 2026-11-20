import Phaser from 'phaser';
import { crearRng } from '../logic/rng';
import { PALETA } from './paleta';
import { arbusto, pino, suelo, tajo } from './procedural';
import { ICONOS, SPRITES, recolorear, type Mapa, type Sprite } from './sprites';

/** Dibuja un mapa de caracteres en un canvas, en la posición indicada. */
function pintar(ctx: CanvasRenderingContext2D, mapa: Mapa, ox = 0, oy = 0): void {
  mapa.forEach((fila, y) => {
    for (let x = 0; x < fila.length; x++) {
      const c = fila[x]!;
      if (c === '.') continue;
      ctx.fillStyle = PALETA[c] ?? '#ff00ff';
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  });
}

function lienzo(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

/** Registra un sprite con todos sus fotogramas uno al lado del otro ('0', '1', ...). */
export function registrarSprite(scene: Phaser.Scene, clave: string, sprite: Sprite): void {
  const w = sprite[0]![0]!.length;
  const h = sprite[0]!.length;
  const [c, ctx] = lienzo(w * sprite.length, h);
  sprite.forEach((f, i) => pintar(ctx, f, i * w, 0));
  const tex = scene.textures.addCanvas(clave, c);
  if (!tex) return;
  sprite.forEach((_, i) => tex.add(String(i), 0, i * w, 0, w, h));
}

function registrarMapa(scene: Phaser.Scene, clave: string, mapa: Mapa): void {
  registrarSprite(scene, clave, [mapa]);
}

/** Luz del farol: círculo con bandas escalonadas, al estilo pixel art. */
function registrarLuz(scene: Phaser.Scene): void {
  const lado = 96;
  const [c, ctx] = lienzo(lado, lado);
  const centro = (lado - 1) / 2;
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const r = Math.hypot(x - centro, y - centro) / (lado / 2);
      // Tramado en los bordes de banda para que el escalón no se vea liso.
      const tramado = (x + y) % 2 === 0 ? 0.015 : -0.015;
      const rr = r + tramado;
      const a = rr < 0.5 ? 1 : rr < 0.66 ? 0.82 : rr < 0.8 ? 0.58 : rr < 0.92 ? 0.3 : rr < 1 ? 0.1 : 0;
      if (a <= 0) continue;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  scene.textures.addCanvas('luz', c);
}

function registrarSuelo(scene: Phaser.Scene): void {
  const datos = suelo(crearRng(7));
  const [c, ctx] = lienzo(datos.length, datos.length);
  datos.forEach((fila, y) =>
    fila.forEach((color, x) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }),
  );
  scene.textures.addCanvas('suelo', c);
}

function registrarSimples(scene: Phaser.Scene): void {
  // Sombra elíptica bajo los personajes
  const [s, sctx] = lienzo(12, 4);
  sctx.fillStyle = 'rgba(0,0,0,0.38)';
  sctx.fillRect(2, 0, 8, 4);
  sctx.fillRect(0, 1, 12, 2);
  scene.textures.addCanvas('sombra', s);
  // Partículas de un píxel o dos
  const punto = (clave: string, color: string, lado: number) => {
    const [c, ctx] = lienzo(lado, lado);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, lado, lado);
    scene.textures.addCanvas(clave, c);
  };
  punto('chispa', PALETA.e!, 2);
  punto('brasa', PALETA.f!, 1);
  punto('ceniza', PALETA['3']!, 2);
  punto('espectral', PALETA.q!, 2);
  punto('pixel', '#ffffff', 1);
}

/** Genera todas las texturas del juego. Se llama una vez al arrancar. */
export function generarTexturas(scene: Phaser.Scene): void {
  for (const [clave, sprite] of Object.entries(SPRITES)) registrarSprite(scene, clave, sprite);
  // Gemas de tres valores: ámbar (1), azul (3) y roja (10).
  registrarSprite(scene, 'gema-azul', recolorear(SPRITES.gema!, { e: 'q', d: 'p', c: 'o' }));
  registrarSprite(scene, 'gema-roja', recolorear(SPRITES.gema!, { e: 'm', d: 'l', c: 'k' }));
  // Moneda de oro (vale 5): la de plata con colores dorados.
  registrarSprite(scene, 'moneda-oro', recolorear(SPRITES.moneda!, { '3': 'c', '4': 'd', '5': 'e' }));
  for (const [id, mapa] of Object.entries(ICONOS)) registrarMapa(scene, `icono-${id}`, mapa);
  for (let i = 0; i < 3; i++) registrarMapa(scene, `pino-${i}`, pino(11 + i * 31, 22 + i * 2, 36 + i * 4));
  for (let i = 0; i < 2; i++) registrarMapa(scene, `arbusto-${i}`, arbusto(5 + i * 17));
  registrarMapa(scene, 'tajo', tajo());
  registrarLuz(scene);
  registrarSuelo(scene);
  registrarSimples(scene);
}

/** Animaciones de los sprites con varios fotogramas. */
export function crearAnimaciones(scene: Phaser.Scene): void {
  const anim = (clave: string, fotogramas: number[], fps: number) => {
    if (scene.anims.exists(clave)) return;
    scene.anims.create({
      key: clave,
      frames: fotogramas.map((f) => ({ key: clave.split(':')[0]!, frame: String(f) })),
      frameRate: fps,
      repeat: -1,
    });
  };
  anim('cazador:andar', [1, 0, 2, 0], 9);
  anim('fatuo', [0, 1], 6);
  anim('lobo', [0, 1], 8);
  anim('espantajo', [0, 1], 4);
  anim('anima', [0, 1], 4);
  anim('bruja', [0, 1], 3);
  for (const extra of ['raizon', 'guardian', 'ciervo']) {
    if (scene.textures.exists(extra)) anim(extra, [0, 1], 4);
  }
}
