import Phaser from 'phaser';
import { FUENTE } from './Arranque';

/** Escena de desarrollo (?galeria): muestra todas las texturas ampliadas para revisar el arte. */
export class Galeria extends Phaser.Scene {
  constructor() {
    super('Galeria');
  }

  create(): void {
    this.scale.once('resize', () => this.scene.restart());
    const claves = this.textures.getTextureKeys().filter((k) => !k.startsWith('__') && k !== 'suelo' && k !== 'luz');
    const escala = 4;
    let x = 16;
    let y = 16;
    let altoFila = 0;
    const ancho = this.scale.width;
    this.add.tileSprite(0, 0, ancho, this.scale.height, 'suelo').setOrigin(0).setTileScale(2);
    for (const clave of claves) {
      const tex = this.textures.get(clave);
      const frames = tex.getFrameNames().filter((f) => f !== '__BASE');
      const lista = frames.length > 0 ? frames : [undefined];
      for (const f of lista) {
        const frame = tex.get(f);
        const w = frame.width * escala;
        const h = frame.height * escala;
        if (x + w > ancho - 16) {
          x = 16;
          y += altoFila + 24;
          altoFila = 0;
        }
        this.add.image(x, y, clave, f).setOrigin(0).setScale(escala);
        x += w + 12;
        altoFila = Math.max(altoFila, h);
      }
      this.add.text(x - 12, y + altoFila + 2, clave, { fontFamily: FUENTE, fontSize: '11px', color: '#b9b4c9' }).setOrigin(1, 0);
    }
    this.add.image(ancho - 220, this.scale.height - 220, 'luz').setScale(4).setTint(0xffd77a);
  }
}
