import Phaser from 'phaser';
import { recolorear } from '../art/sprites';
import { RAIZON } from '../art/grandes';
import { registrarSprite } from '../art/texturas';
import { ENEMIGOS, multVida, type DefEnemigo, type TipoEnemigo } from '../logic/enemigos';
import { Rejilla } from '../logic/rejilla';
import type { Efectos } from './efectos';
import type { Jugador } from './jugador';

export interface Enemigo {
  /** Índice fijo en el pool (para la rejilla). */
  id: number;
  /** Identidad única de esta aparición: un enemigo reciclado no hereda esperas de armas. */
  uid: number;
  activo: boolean;
  def: DefEnemigo;
  spr: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  vida: number;
  vidaMax: number;
  /** Velocidad de empuje (se amortigua). */
  kx: number;
  ky: number;
  edad: number;
  destello: number;
  /** Temporizador genérico: disparos, embestidas, invocaciones. */
  reloj: number;
  /** Estado del jefe: 0 andar, 1 preparar, 2 embestir. */
  fase: number;
  dx: number;
  dy: number;
}

interface Bala {
  spr: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  dano: number;
}

export interface Muerte {
  e: Enemigo;
  x: number;
  y: number;
}

/** Todos los enemigos vivos: aparición, movimiento, choques, daño y muertes. */
export class Horda {
  readonly lista: Enemigo[] = [];
  private libres: Enemigo[] = [];
  private balas: Bala[] = [];
  private rejilla = new Rejilla(24);
  /** Dirección hacia el jugador, reutilizada para cada enemigo (evita crear un objeto por enemigo y fotograma). */
  private dir = { x: 0, y: 0 };
  vivos = 0;
  /** Enemigos muertos pendientes de procesar (la escena decide qué sueltan y luego vacía la lista). */
  readonly muertes: Muerte[] = [];
  /** Jefe activo, si hay uno. */
  jefe: Enemigo | null = null;
  /** Peticiones de invocación de los jefes: la escena las atiende. */
  readonly invocaciones: { tipo: TipoEnemigo; x: number; y: number }[] = [];
  private onGolpe?: () => void;
  private siguienteUid = 1;

  constructor(
    private escena: Phaser.Scene,
    private efectos: Efectos,
  ) {
    if (!escena.textures.exists('guardian')) {
      // El Guardián es un Raizón cubierto de musgo.
      registrarSprite(escena, 'guardian', recolorear(RAIZON, { b: 'h', c: 'i', a: 'g', d: 'j' }));
      escena.anims.create({ key: 'guardian', frames: [{ key: 'guardian', frame: '0' }, { key: 'guardian', frame: '1' }], frameRate: 3, repeat: -1 });
    }
  }

  /** Callback para el sonido de golpe (limitado por el propio módulo de sonido). */
  alGolpear(fn: () => void): void {
    this.onGolpe = fn;
  }

  crear(tipo: TipoEnemigo, x: number, y: number, t: number): Enemigo {
    const def = ENEMIGOS[tipo];
    let e = this.libres.pop();
    if (!e) {
      e = {
        id: this.lista.length,
        uid: 0,
        activo: false,
        def,
        spr: this.escena.add.sprite(0, 0, tipo, '0').setOrigin(0.5, 1),
        x: 0,
        y: 0,
        vida: 0,
        vidaMax: 0,
        kx: 0,
        ky: 0,
        edad: 0,
        destello: 0,
        reloj: 0,
        fase: 0,
        dx: 0,
        dy: 0,
      };
      this.lista.push(e);
    }
    const vida = Math.round(def.vida * (def.jefe ? 1 : multVida(t)));
    Object.assign(e, { uid: this.siguienteUid++, activo: true, def, x, y, vida, vidaMax: vida, kx: 0, ky: 0, edad: 0, destello: 0, reloj: 1 + Math.random() * 2, fase: 0 });
    e.spr.setTexture(tipo, '0').setVisible(true).setActive(true).setAlpha(1).clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    e.spr.setScale(tipo === 'guardian' ? 1.5 : tipo === 'ciervo' ? 1.6 : 1);
    if (this.escena.anims.exists(tipo)) e.spr.play({ key: tipo, startFrame: Math.floor(Math.random() * 2) });
    if (def.jefe) this.jefe = e;
    this.vivos++;
    return e;
  }

  private liberar(e: Enemigo): void {
    e.activo = false;
    e.spr.setVisible(false).setActive(false).stop();
    if (this.jefe === e) this.jefe = null;
    this.libres.push(e);
    this.vivos--;
  }

  /** Mueve a un enemigo lejano a otro punto: más barato que destruirlo y crearlo. */
  reubicar(e: Enemigo, x: number, y: number): void {
    e.x = x;
    e.y = y;
  }

  actualizar(dt: number, j: Jugador, onDanoJugador: (d: number, quien?: Enemigo) => void): void {
    this.rejilla.vaciar();
    for (const e of this.lista) if (e.activo) this.rejilla.insertar(e.id, e.x, e.y);
    const dir = this.dir;

    for (const e of this.lista) {
      if (!e.activo) continue;
      e.edad += dt;
      e.reloj -= dt;
      // Dirección y distancia al jugador con una sola raíz y sin crear objetos (se hace para cada enemigo en cada fotograma).
      const hx = j.x - e.x;
      const hy = j.y - e.y;
      const dist = Math.sqrt(hx * hx + hy * hy);
      dir.x = dist > 0 ? hx / dist : 0;
      dir.y = dist > 0 ? hy / dist : 0;
      let vx = dir.x * e.def.velocidad;
      let vy = dir.y * e.def.velocidad;

      switch (e.def.tipo) {
        case 'anima': {
          // Avanza ondulando, como si flotara.
          const onda = Math.sin(e.edad * 3 + e.id) * 0.9;
          vx += -dir.y * onda * e.def.velocidad;
          vy += dir.x * onda * e.def.velocidad;
          break;
        }
        case 'bruja': {
          // Mantiene la distancia y lanza orbes.
          if (dist < 70) {
            vx = -vx;
            vy = -vy;
          } else if (dist < 100) {
            vx = -dir.y * e.def.velocidad * 0.7;
            vy = dir.x * e.def.velocidad * 0.7;
          }
          if (e.reloj <= 0 && dist < 150) {
            e.reloj = 3.2;
            this.disparar(e.x, e.y - 10, dir.x, dir.y, e.def.dano);
          }
          break;
        }
        case 'guardian': {
          if (e.reloj <= 0) {
            e.reloj = 7;
            for (let i = 0; i < 4; i++) this.invocaciones.push({ tipo: 'fatuo', x: e.x + (i - 1.5) * 14, y: e.y + 12 });
          }
          break;
        }
        case 'ciervo':
          ({ vx, vy } = this.ciervo(e, dir, vx, vy));
          break;
      }

      // Separación: empuja a los vecinos superpuestos para que no se apilen.
      // Separación en línea, sin funciones ni objetos: se ejecuta miles de veces por fotograma.
      let sx = 0;
      let sy = 0;
      const total = this.rejilla.vecinos(e.x, e.y, e.def.radio + 10);
      const vecinos = this.rejilla.encontrados;
      for (let k = 0; k < total; k++) {
        const id = vecinos[k]!;
        if (id === e.id) continue;
        const o = this.lista[id]!;
        if (!o.activo) continue;
        const dx = e.x - o.x;
        const dy = e.y - o.y;
        const min = e.def.radio + o.def.radio;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2);
        if (d === 0) {
          sx += min;
          continue;
        }
        sx += (dx / d) * (min - d);
        sy += (dy / d) * (min - d);
      }
      const empuje = e.def.jefe ? 0 : 6;
      e.x += (vx + e.kx + sx * empuje) * dt;
      e.y += (vy + e.ky + sy * empuje) * dt;
      const amortigua = Math.pow(0.0008, dt);
      e.kx *= amortigua;
      e.ky *= amortigua;

      // Choque con el jugador.
      if (dist < e.def.radio + 5) {
        const d = j.herir(e.def.dano);
        if (d > 0 || j.esquivo) onDanoJugador(d, e);
      }

      if (e.destello > 0) {
        e.destello -= dt;
        if (e.destello <= 0) e.spr.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      }
      const mira = e.def.tipo === 'ciervo' && e.fase === 2 ? e.dx : j.x - e.x;
      e.spr.setPosition(e.x, e.y).setFlipX(mira < 0);
      const prof = Math.floor(e.y);
      if (e.spr.depth !== prof) e.spr.setDepth(prof);
    }

    this.actualizarBalas(dt, j, onDanoJugador);
  }

  /** El Ciervo anda, se prepara temblando y embiste en línea recta. */
  private ciervo(e: Enemigo, dir: { x: number; y: number }, vx: number, vy: number) {
    if (e.fase === 0 && e.reloj <= 0) {
      e.fase = 1;
      e.reloj = 0.9;
      e.dx = dir.x;
      e.dy = dir.y;
      e.spr.setTint(0xff8a3d).setTintMode(Phaser.TintModes.ADD);
      e.destello = 0;
    } else if (e.fase === 1) {
      e.spr.x += (Math.random() - 0.5) * 2;
      if (e.reloj <= 0) {
        e.fase = 2;
        e.reloj = 1.1;
        e.spr.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      }
      return { vx: 0, vy: 0 };
    } else if (e.fase === 2) {
      if (Math.random() < 0.6) this.efectos.estallar('brasa', e.x, e.y - 20, 1);
      if (e.reloj <= 0) {
        e.fase = 0;
        e.reloj = 4.5 + Math.random() * 2;
        if (Math.random() < 0.5) {
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            this.invocaciones.push({ tipo: 'fatuo', x: e.x + Math.cos(a) * 30, y: e.y + Math.sin(a) * 30 });
          }
        }
      }
      return { vx: e.dx * 175, vy: e.dy * 175 };
    }
    return { vx: vx * (e.vida < e.vidaMax / 2 ? 1.35 : 1), vy: vy * (e.vida < e.vidaMax / 2 ? 1.35 : 1) };
  }

  private disparar(x: number, y: number, dx: number, dy: number, dano: number): void {
    const spr = this.escena.add.image(x, y, 'orbe').setDepth(1_000_050);
    this.balas.push({ spr, x, y, vx: dx * 70, vy: dy * 70, vida: 4, dano });
  }

  private actualizarBalas(dt: number, j: Jugador, onDanoJugador: (d: number, quien?: Enemigo) => void): void {
    for (let i = this.balas.length - 1; i >= 0; i--) {
      const b = this.balas[i]!;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vida -= dt;
      b.spr.setPosition(b.x, b.y);
      if (Math.hypot(b.x - j.x, b.y - (j.y - 6)) < 7) {
        const d = j.herir(b.dano);
        if (d > 0 || j.esquivo) onDanoJugador(d);
        b.vida = 0;
      }
      if (b.vida <= 0) {
        b.spr.destroy();
        this.balas.splice(i, 1);
      }
    }
  }

  /** Hace daño a un enemigo y lo empuja en la dirección (kx, ky). */
  herir(e: Enemigo, dano: number, kx = 0, ky = 0, color?: string): void {
    if (!e.activo) return;
    e.vida -= dano;
    e.kx += kx * e.def.peso;
    e.ky += ky * e.def.peso;
    if (e.def.tipo !== 'ciervo' || e.fase !== 1) {
      e.destello = 0.07;
      e.spr.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    }
    this.efectos.numero(e.x, e.y - e.spr.displayHeight, dano, color);
    this.onGolpe?.();
    if (e.vida <= 0) {
      this.muertes.push({ e, x: e.x, y: e.y });
      const clave = e.def.tipo === 'fatuo' || e.def.tipo === 'anima' ? 'espectral' : 'ceniza';
      this.efectos.estallar(clave, e.x, e.y - 6, e.def.jefe ? 40 : 6);
      this.liberar(e);
    }
  }

  /** Recorre los enemigos activos dentro de un círculo. */
  enCirculo(x: number, y: number, r: number, fn: (e: Enemigo) => void): void {
    this.rejilla.consultar(x, y, r + 16, (id) => {
      const e = this.lista[id]!;
      if (e.activo && Math.hypot(e.x - x, e.y - 6 - y) <= r + e.def.radio) fn(e);
    });
  }

  /** Recorre los enemigos activos que tocan un rectángulo. */
  enRectangulo(x0: number, y0: number, x1: number, y1: number, fn: (e: Enemigo) => void): void {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const r = Math.hypot(x1 - x0, y1 - y0) / 2;
    this.rejilla.consultar(cx, cy, r + 16, (id) => {
      const e = this.lista[id]!;
      const ey = e.y - 6;
      if (e.activo && e.x + e.def.radio >= x0 && e.x - e.def.radio <= x1 && ey + e.def.radio >= y0 && ey - e.def.radio <= y1) fn(e);
    });
  }

  /** El enemigo activo más cercano dentro de `rMax`, o null. */
  masCercano(x: number, y: number, rMax: number, excluir?: Set<number>): Enemigo | null {
    // Compara distancias al cuadrado: mismo resultado, sin una raíz por enemigo.
    let mejor: Enemigo | null = null;
    let d2Mejor = rMax * rMax;
    for (const e of this.lista) {
      if (!e.activo || excluir?.has(e.uid)) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < d2Mejor) {
        d2Mejor = d2;
        mejor = e;
      }
    }
    return mejor;
  }

  destruir(): void {
    for (const e of this.lista) e.spr.destroy();
    for (const b of this.balas) b.spr.destroy();
    this.lista.length = 0;
    this.balas.length = 0;
  }
}
