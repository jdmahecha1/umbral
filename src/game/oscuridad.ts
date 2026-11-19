import Phaser from 'phaser';
import { COLOR } from '../art/paleta';

export interface FuenteLuz {
  x: number;
  y: number;
  /** Radio en unidades del mundo. */
  radio: number;
  /** 0..1: cuánto aclara. */
  fuerza?: number;
}

/**
 * Capa de oscuridad sobre el mundo. Cada fotograma se rellena de negro y se
 * "borran" círculos de luz: el del farol y los de las cosas que brillan.
 * Lo que queda fuera se ve en penumbra, no en negro total, para leer siluetas.
 */
export class Oscuridad {
  private rt: Phaser.GameObjects.RenderTexture;
  private fuentes: FuenteLuz[] = [];
  /** Opacidad de la penumbra (0 = sin oscuridad, 1 = negro total). */
  penumbra = 0.86;

  constructor(private escena: Phaser.Scene) {
    this.rt = escena.add.renderTexture(0, 0, 8, 8).setOrigin(0).setDepth(9000);
    this.ajustar();
  }

  /** Ajusta el tamaño al área visible de la cámara (en unidades del mundo). */
  ajustar(): void {
    const cam = this.escena.cameras.main;
    const w = Math.ceil(cam.width / cam.zoom) + 4;
    const h = Math.ceil(cam.height / cam.zoom) + 4;
    this.rt.resize(w, h); // no hace nada si el tamaño no cambia
  }

  añadir(luz: FuenteLuz): void {
    this.fuentes.push(luz);
  }

  /** Redibuja la oscuridad. Llamar una vez por fotograma, después de mover la cámara. */
  dibujar(): void {
    const vista = this.escena.cameras.main.worldView;
    const ox = Math.floor(vista.x) - 2;
    const oy = Math.floor(vista.y) - 2;
    this.rt.setPosition(ox, oy);
    this.rt.clear();
    this.rt.fill(COLOR.noche, this.penumbra);
    for (const l of this.fuentes) {
      const escala = (l.radio * 2) / 96; // la textura 'luz' mide 96 px
      this.rt.stamp('luz', undefined, l.x - ox, l.y - oy, {
        scale: escala,
        alpha: l.fuerza ?? 1,
        blendMode: Phaser.BlendModes.ERASE,
      });
    }
    this.rt.render();
    this.fuentes.length = 0;
  }

  destruir(): void {
    this.rt.destroy();
  }
}
