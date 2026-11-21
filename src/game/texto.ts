import type Phaser from 'phaser';

/** Lo mínimo de un texto de Phaser que hace falta aquí (así se puede probar sin Phaser). */
export type TextoCambiable = Pick<Phaser.GameObjects.Text, 'text' | 'setText' | 'updateText'> & {
  style: Pick<Phaser.GameObjects.TextStyle, 'color' | 'resolution'>;
};

/**
 * Cambia el contenido, el color y la resolución de un texto redibujándolo como
 * mucho UNA vez, y solo si algo cambió de verdad.
 *
 * En Phaser, cada texto es una imagen que se dibuja y se sube a la tarjeta
 * gráfica. `setColor` y `setResolution` la vuelven a dibujar siempre, aunque el
 * valor sea el mismo; llamarlos en cada fotograma subía una textura nueva 60
 * veces por segundo.
 */
export function actualizarTexto(t: TextoCambiable, cambios: { texto?: string; color?: string; resolucion?: number }): void {
  let estilo = false;
  if (cambios.color !== undefined && t.style.color !== cambios.color) {
    t.style.color = cambios.color;
    estilo = true;
  }
  if (cambios.resolucion !== undefined && t.style.resolution !== cambios.resolucion) {
    t.style.resolution = cambios.resolucion;
    estilo = true;
  }
  // setText ya dibuja con el estilo nuevo; si el contenido no cambia, basta con redibujar.
  if (cambios.texto !== undefined && t.text !== cambios.texto) t.setText(cambios.texto);
  else if (estilo) t.updateText();
}
