import Phaser from 'phaser';
import { crearRng, elegirPonderado, hash2 } from '../logic/rng';

const TROZO = 192;
const DECORADO = [
  { valor: 'pino', peso: 3.2 },
  { valor: 'arbusto', peso: 2 },
  { valor: 'hierba', peso: 3 },
  { valor: 'roca', peso: 1.4 },
  { valor: 'hongos', peso: 1 },
  { valor: 'lapida', peso: 0.5 },
] as const;

/**
 * Suelo infinito y decorado del bosque. El decorado se genera por trozos con una
 * semilla según su posición: al volver a un sitio, los árboles siguen donde estaban.
 */
export class Mundo {
  private suelo: Phaser.GameObjects.TileSprite;
  private trozos = new Map<string, Phaser.GameObjects.Image[]>();

  constructor(
    private escena: Phaser.Scene,
    private semilla: number,
  ) {
    this.suelo = escena.add.tileSprite(0, 0, 16, 16, 'suelo').setOrigin(0).setDepth(-1_000_000);
  }

  actualizar(): void {
    const vista = this.escena.cameras.main.worldView;
    // El suelo cubre la vista y desplaza su patrón con la cámara.
    const x = Math.floor(vista.x) - 2;
    const y = Math.floor(vista.y) - 2;
    this.suelo.setPosition(x, y).setSize(Math.ceil(vista.width) + 4, Math.ceil(vista.height) + 4);
    this.suelo.setTilePosition(x, y);

    // Trozos visibles (más un margen) se crean; los lejanos se destruyen.
    const x0 = Math.floor((vista.x - 64) / TROZO);
    const x1 = Math.floor((vista.right + 64) / TROZO);
    const y0 = Math.floor((vista.y - 64) / TROZO);
    const y1 = Math.floor((vista.bottom + 96) / TROZO);
    const vivos = new Set<string>();
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const k = `${cx},${cy}`;
        vivos.add(k);
        if (!this.trozos.has(k)) this.trozos.set(k, this.crearTrozo(cx, cy));
      }
    }
    for (const [k, objs] of this.trozos) {
      if (vivos.has(k)) continue;
      for (const o of objs) o.destroy();
      this.trozos.delete(k);
    }
  }

  private crearTrozo(cx: number, cy: number): Phaser.GameObjects.Image[] {
    const rng = crearRng(hash2(cx, cy, this.semilla));
    const cantidad = 6 + Math.floor(rng() * 6);
    const objs: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < cantidad; i++) {
      const x = cx * TROZO + rng() * TROZO;
      const y = cy * TROZO + rng() * TROZO;
      // Claro despejado alrededor del punto de inicio.
      if (Math.hypot(x, y) < 70) continue;
      const tipo = elegirPonderado(rng, DECORADO) ?? 'hierba';
      const clave =
        tipo === 'pino' ? `pino-${Math.floor(rng() * 3)}` : tipo === 'arbusto' ? `arbusto-${Math.floor(rng() * 2)}` : tipo;
      const img = this.escena.add
        .image(Math.round(x), Math.round(y), clave)
        .setOrigin(0.5, 1)
        .setDepth(y)
        .setFlipX(rng() < 0.5);
      if (tipo === 'hierba') img.setDepth(y - 1000); // la hierba siempre queda por debajo
      objs.push(img);
    }
    return objs;
  }

  destruir(): void {
    for (const objs of this.trozos.values()) for (const o of objs) o.destroy();
    this.trozos.clear();
    this.suelo.destroy();
  }
}
