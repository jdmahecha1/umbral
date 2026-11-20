import Phaser from 'phaser';
import { crearAnimaciones, generarTexturas } from '../art/texturas';
import { Sonido } from '../audio/sonido';
import { leerAjustes } from '../logic/guardado';

/** Títulos y botones. */
export const FUENTE = '"Pixelify Sans", monospace';
/** Texto normal y números: sus dígitos se distinguen mejor a tamaño pequeño. */
export const FUENTE_TEXTO = '"Jersey 10", monospace';

/** Genera el arte, prepara el sonido, espera la fuente y pasa al menú. */
export class Arranque extends Phaser.Scene {
  constructor() {
    super('Arranque');
  }

  async create(): Promise<void> {
    generarTexturas(this);
    crearAnimaciones(this);
    this.registry.set('sonido', new Sonido(leerAjustes()));
    try {
      await Promise.all([document.fonts.load(`16px ${FUENTE}`), document.fonts.load(`bold 16px ${FUENTE}`), document.fonts.load(`16px ${FUENTE_TEXTO}`)]);
    } catch {
      // Si la fuente no carga, se usa la monoespaciada del sistema.
    }
    const parametros = new URLSearchParams(location.search);
    if (parametros.has('galeria')) this.scene.start('Galeria');
    else if (parametros.has('jugar')) this.scene.start('Juego', {
        semilla: Number(parametros.get('semilla')) || undefined,
        // Solo para desarrollo y pruebas: empezar la noche en un segundo concreto.
        desde: Number(parametros.get('desde')) || 0,
        monedas: Number(parametros.get('monedas')) || 0,
        bot: parametros.has('bot'),
        rapido: Number(parametros.get('rapido')) || 1,
      });
    else this.scene.start('Menu');
  }
}
