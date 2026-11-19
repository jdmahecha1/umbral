import Phaser from 'phaser';
import type { Jugador } from './jugador';

export type TipoObjeto = 'gema' | 'aceite' | 'pan' | 'cofre';

interface Objeto {
  spr: Phaser.GameObjects.Image;
  tipo: TipoObjeto;
  valor: number;
  x: number;
  y: number;
  atraido: boolean;
  v: number;
  t: number;
}

const MAX_GEMAS = 350;

function claveGema(valor: number): string {
  return valor >= 10 ? 'gema-roja' : valor >= 3 ? 'gema-azul' : 'gema';
}

/** Gemas de experiencia, aceite, pan y cofres tirados por el suelo. */
export class Objetos {
  private lista: Objeto[] = [];
  private gemas = 0;

  constructor(private escena: Phaser.Scene) {}

  soltar(tipo: TipoObjeto, x: number, y: number, valor = 1): void {
    if (tipo === 'gema' && this.gemas >= MAX_GEMAS) {
      // Demasiadas gemas: el valor se suma a la más cercana en vez de crear otra.
      let mejor: Objeto | undefined;
      let d = Infinity;
      for (const o of this.lista) {
        if (o.tipo !== 'gema') continue;
        const dd = Math.abs(o.x - x) + Math.abs(o.y - y);
        if (dd < d) {
          d = dd;
          mejor = o;
        }
      }
      if (mejor) {
        mejor.valor += valor;
        mejor.spr.setTexture(claveGema(mejor.valor));
        return;
      }
    }
    const clave = tipo === 'gema' ? claveGema(valor) : tipo;
    const spr = this.escena.add.image(x, y, clave).setOrigin(0.5, 1).setDepth(y - 500);
    this.lista.push({ spr, tipo, valor, x, y, atraido: false, v: 0, t: Math.random() * 6 });
    if (tipo === 'gema') this.gemas++;
    // Pequeño salto al aparecer.
    this.escena.tweens.add({ targets: spr, y: y - 4, duration: 120, yoyo: true, ease: 'Quad.Out' });
  }

  /** Mueve los atraídos y devuelve los que el jugador recogió este fotograma. */
  actualizar(dt: number, j: Jugador, recoger: (tipo: TipoObjeto, valor: number, x: number, y: number) => void): void {
    const radio = j.atrib.radioRecoger;
    for (let i = this.lista.length - 1; i >= 0; i--) {
      const o = this.lista[i]!;
      o.t += dt;
      const dx = j.x - o.x;
      const dy = j.y - 5 - o.y;
      const d = Math.hypot(dx, dy);
      if (!o.atraido && d < (o.tipo === 'cofre' ? 10 : radio)) this.atraer(o);
      if (o.atraido) {
        o.v = Math.min(260, o.v + 420 * dt);
        o.x += (dx / (d || 1)) * o.v * dt;
        o.y += (dy / (d || 1)) * o.v * dt;
        o.spr.setPosition(o.x, o.y);
      } else if (o.tipo !== 'gema') {
        // Los objetos especiales flotan un poco para llamar la atención.
        o.spr.y = o.y + Math.round(Math.sin(o.t * 3) * 1);
      }
      if (d < 6) {
        recoger(o.tipo, o.valor, o.x, o.y);
        if (o.tipo === 'gema') this.gemas--;
        o.spr.destroy();
        this.lista.splice(i, 1);
      }
    }
  }

  private atraer(o: Objeto): void {
    o.atraido = true;
    // El bote de aparición movería la gema a la vez que la atracción.
    this.escena.tweens.killTweensOf(o.spr);
  }

  /** Atrae todas las gemas hacia el jugador (al abrir un cofre). */
  atraerTodas(): void {
    for (const o of this.lista) if (o.tipo === 'gema' && !o.atraido) this.atraer(o);
  }

  /** Puntos que brillan en la oscuridad (aceite y cofres). */
  brillos(fn: (x: number, y: number) => void): void {
    for (const o of this.lista) if (o.tipo === 'aceite' || o.tipo === 'cofre') fn(o.x, o.y - 4);
  }

  destruir(): void {
    for (const o of this.lista) o.spr.destroy();
    this.lista.length = 0;
  }
}
