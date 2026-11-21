import Phaser from 'phaser';
import { COLOR, CSS } from '../art/paleta';
import { FUENTE, FUENTE_TEXTO } from './Arranque';

/** Unidad de escala de la interfaz según el tamaño de la pantalla. */
export function unidad(scene: Phaser.Scene): number {
  const { width, height } = scene.scale;
  return Phaser.Math.Clamp(Math.min(width, height) / 380, 1, 2.4);
}

export function texto(
  scene: Phaser.Scene,
  x: number,
  y: number,
  contenido: string,
  tam: number,
  color: string = CSS.hueso,
  estilo: boolean | 'titulo' = false,
): Phaser.GameObjects.Text {
  // Pixelify en negrita solo para títulos grandes: a tamaño pequeño confunde la c con la o y el 2 con el 8.
  // Todo lo demás usa Jersey 10, más legible (y más pequeña a igual tamaño, de ahí el 1,3).
  const titulo = estilo === 'titulo';
  return scene.add.text(x, y, contenido, {
    fontFamily: titulo ? FUENTE : FUENTE_TEXTO,
    fontSize: `${Math.round(titulo ? tam : tam * (estilo ? 1.4 : 1.3))}px`,
    fontStyle: titulo ? 'bold' : 'normal',
    color,
    stroke: '#0b0a12',
    strokeThickness: Math.max(2, Math.round(tam / 6)),
  });
}

export interface Boton {
  cont: Phaser.GameObjects.Container;
  etiqueta: Phaser.GameObjects.Text;
  fondo: Phaser.GameObjects.Rectangle;
  pulsar: () => void;
  resaltar: (on: boolean) => void;
}

/**
 * Decide si un clic, toque o tecla cuenta. Sirve para que un clic que venía de
 * atacar no elija sin querer una mejora en un panel que acaba de abrirse.
 */
export type Guardia = (puntero?: Phaser.Input.Pointer) => boolean;

/** Botón rectangular con borde, al estilo de los paneles del juego. */
export function boton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  ancho: number,
  contenido: string,
  alPulsar: () => void,
  u: number,
  guardia?: Guardia,
): Boton {
  const alto = Math.round(34 * u);
  const fondo = scene.add.rectangle(0, 0, ancho, alto, COLOR.panel).setStrokeStyle(Math.max(2, Math.round(2 * u)), COLOR.borde);
  const etiqueta = texto(scene, 0, 0, contenido, 14 * u, CSS.hueso, true).setOrigin(0.5);
  const cont = scene.add.container(x, y, [fondo, etiqueta]).setSize(ancho, alto);
  const resaltar = (on: boolean) => {
    fondo.setStrokeStyle(Math.max(2, Math.round(2 * u)), on ? COLOR.ambar : COLOR.borde);
    fondo.setFillStyle(on ? 0x221c2c : COLOR.panel);
    etiqueta.setColor(on ? CSS.ambarClaro : CSS.hueso);
  };
  const pulsar = () => {
    (scene.registry.get('sonido') as { reproducir: (n: 'boton') => void } | undefined)?.reproducir('boton');
    alPulsar();
  };
  fondo.setInteractive({ useHandCursor: true });
  fondo.on('pointerover', () => resaltar(true));
  fondo.on('pointerout', () => resaltar(false));
  fondo.on('pointerup', (p: Phaser.Input.Pointer) => {
    if (!guardia || guardia(p)) pulsar();
  });
  return { cont, etiqueta, fondo, pulsar, resaltar };
}

/** Panel oscuro con borde doble, para fondos de menús. */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, u: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(COLOR.fondo, 0.94);
  g.fillRect(x - w / 2, y - h / 2, w, h);
  g.lineStyle(Math.max(2, Math.round(2 * u)), COLOR.borde, 1);
  g.strokeRect(x - w / 2, y - h / 2, w, h);
  g.lineStyle(1, COLOR.ambar, 0.35);
  g.strokeRect(x - w / 2 + 4 * u, y - h / 2 + 4 * u, w - 8 * u, h - 8 * u);
  return g;
}

/**
 * Navegación con teclado entre botones: flechas, Tab y Enter (y espacio, salvo
 * que se desactive). Las teclas mantenidas presionadas no cuentan.
 */
export function navegarConTeclado(
  scene: Phaser.Scene,
  botones: Boton[],
  inicial = 0,
  opciones: { guardia?: Guardia; espacio?: boolean } = {},
): () => void {
  let foco = inicial;
  const pintar = () => botones.forEach((b, i) => b.resaltar(i === foco));
  pintar();
  const tecla = (ev: KeyboardEvent) => {
    // Una tecla mantenida (por ejemplo, el espacio de atacar) repite el evento: se ignora.
    if (ev.repeat) return;
    if (['ArrowDown', 'ArrowRight', 'Tab', 's', 'S'].includes(ev.key)) {
      foco = (foco + 1) % botones.length;
      ev.preventDefault();
    } else if (['ArrowUp', 'ArrowLeft', 'w', 'W'].includes(ev.key)) {
      foco = (foco - 1 + botones.length) % botones.length;
    } else if (ev.key === 'Enter' || (ev.key === ' ' && opciones.espacio !== false)) {
      if (!opciones.guardia || opciones.guardia()) botones[foco]?.pulsar();
      return;
    } else return;
    pintar();
  };
  scene.input.keyboard?.on('keydown', tecla);
  return () => scene.input.keyboard?.off('keydown', tecla);
}
