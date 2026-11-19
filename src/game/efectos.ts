import Phaser from 'phaser';
import { CSS } from '../art/paleta';
import { FUENTE_TEXTO } from '../scenes/Arranque';

export const PROF_EFECTOS = 2_000_000; // por encima de la oscuridad

/** Números de daño, chispas y sacudidas de cámara. Reutiliza los objetos para no crear basura. */
export class Efectos {
  private numeros: Phaser.GameObjects.Text[] = [];
  private libres: Phaser.GameObjects.Text[] = [];
  private emisores = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();

  constructor(private escena: Phaser.Scene) {
    const crear = (clave: string, config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, prof: number) => {
      const e = escena.add.particles(0, 0, clave, { emitting: false, ...config });
      e.setDepth(prof);
      this.emisores.set(clave, e);
    };
    crear('chispa', { lifespan: 380, speed: { min: 20, max: 70 }, alpha: { start: 1, end: 0 }, gravityY: 60 }, PROF_EFECTOS - 2);
    crear('brasa', { lifespan: 700, speed: { min: 10, max: 40 }, alpha: { start: 1, end: 0 }, gravityY: -30 }, PROF_EFECTOS - 2);
    crear('ceniza', { lifespan: 520, speed: { min: 15, max: 55 }, alpha: { start: 0.9, end: 0 }, gravityY: 20 }, 1_000_100);
    crear('espectral', { lifespan: 600, speed: { min: 10, max: 45 }, alpha: { start: 1, end: 0 }, gravityY: -25 }, PROF_EFECTOS - 2);
  }

  /** Partículas de un tipo en un punto. */
  estallar(clave: 'chispa' | 'brasa' | 'ceniza' | 'espectral', x: number, y: number, n: number): void {
    this.emisores.get(clave)?.explode(n, x, y);
  }

  /** Número de daño que sube y se desvanece. */
  numero(x: number, y: number, valor: number, color: string = CSS.hueso): void {
    if (this.numeros.length > 28) return; // con cientos de golpes, basta con unos cuantos números a la vista
    const zoom = this.escena.cameras.main.zoom;
    const t =
      this.libres.pop() ??
      this.escena.add
        .text(0, 0, '', { fontFamily: FUENTE_TEXTO, fontSize: '10px', color: CSS.hueso, stroke: '#0b0a12', strokeThickness: 2 })
        .setOrigin(0.5, 1)
        .setDepth(PROF_EFECTOS);
    t.setResolution(Math.max(1, Math.ceil(zoom)));
    t.setText(String(Math.round(valor))).setColor(color).setPosition(x + (Math.random() - 0.5) * 8, y).setAlpha(1).setVisible(true).setScale(1);
    this.numeros.push(t);
    this.escena.tweens.add({
      targets: t,
      y: t.y - 12,
      alpha: 0,
      duration: 520,
      ease: 'Cubic.Out',
      onComplete: () => {
        t.setVisible(false);
        this.numeros.splice(this.numeros.indexOf(t), 1);
        this.libres.push(t);
      },
    });
  }

  /** Texto grande y breve en el mundo (por ejemplo, "+aceite"). */
  aviso(x: number, y: number, texto: string, color: string): void {
    const t = this.escena.add
      .text(x, y, texto, { fontFamily: FUENTE_TEXTO, fontSize: '9px', color, stroke: '#0b0a12', strokeThickness: 2 })
      .setOrigin(0.5, 1)
      .setDepth(PROF_EFECTOS)
      .setResolution(Math.max(1, Math.ceil(this.escena.cameras.main.zoom)));
    this.escena.tweens.add({ targets: t, y: y - 14, alpha: 0, duration: 900, ease: 'Cubic.Out', onComplete: () => t.destroy() });
  }

  sacudir(intensidad = 0.004, ms = 120): void {
    this.escena.cameras.main.shake(ms, intensidad);
  }
}
