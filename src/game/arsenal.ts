import Phaser from 'phaser';
import { COLOR, CSS } from '../art/paleta';
import type { Sonido } from '../audio/sonido';
import { enCono, recargaBase, statsCampana, statsDagas, statsHoz, statsLlamarada, statsRunas } from '../logic/armas';
import { LIMITES } from '../logic/mejoras';
import type { IdArma, Inventario } from '../logic/mejoras';
import type { Efectos } from './efectos';
import type { Horda } from './horda';
import type { Jugador } from './jugador';

interface Contexto {
  escena: Phaser.Scene;
  jugador: Jugador;
  horda: Horda;
  efectos: Efectos;
  sonido: Sonido;
}

/** Altura del pecho del cazador sobre sus pies: las armas salen de ahí. */
const PECHO = 7;
const RAD = Math.PI / 180;

/**
 * Un arma se recarga sola, pero solo ataca cuando el jugador ataca
 * (clic, barra espaciadora o botón táctil), hacia el ángulo al que apunta.
 */
abstract class Arma {
  nivel = 1;
  reloj = 0;
  constructor(
    protected c: Contexto,
    readonly id: IdArma,
  ) {}

  actualizar(dt: number, atacando: boolean, angulo: number, dano: number, enfriamiento: number): void {
    this.reloj -= dt;
    if (atacando && this.reloj <= 0) {
      this.reloj = recargaBase(this.id, this.nivel) * enfriamiento;
      this.atacar(angulo, dano);
    }
    this.mover(dt, dano);
  }

  protected abstract atacar(angulo: number, dano: number): void;
  /** Lo que sigue en movimiento después del ataque (proyectiles, ondas). */
  protected mover(_dt: number, _dano: number): void {}
  destruir(): void {}
  luz(): number {
    return 0;
  }
  /** 0 recién usada, 1 lista para atacar. */
  carga(enfriamiento: number): number {
    const total = recargaBase(this.id, this.nivel) * enfriamiento;
    return Math.max(0, Math.min(1, 1 - this.reloj / total));
  }
}

class Hoz extends Arma {
  protected atacar(angulo: number, dano: number): void {
    const s = statsHoz(this.nivel);
    this.tajo(angulo, s.alcance, s.angulo * RAD, s.dano * dano);
    if (s.atras) this.c.escena.time.delayedCall(120, () => this.tajo(angulo + Math.PI, s.alcance, s.angulo * RAD, s.dano * dano));
  }

  private tajo(angulo: number, alcance: number, apertura: number, dano: number): void {
    const { jugador: j, horda, escena, sonido } = this.c;
    const cx = j.x;
    const cy = j.y - PECHO;
    horda.enCirculo(cx, cy, alcance, (e) => {
      if (!enCono(Math.atan2(e.y - 6 - cy, e.x - cx), angulo, apertura)) return;
      horda.herir(e, Math.round(dano), Math.cos(angulo) * 80, Math.sin(angulo) * 80);
    });
    sonido.reproducir('tajo', 0.7);
    const img = escena.add
      .image(cx + Math.cos(angulo) * alcance * 0.45, cy + Math.sin(angulo) * alcance * 0.45, 'tajo')
      .setDepth(1_000_040)
      .setRotation(angulo)
      .setScale((alcance * 0.75) / 26, (alcance * 1.7) / 40)
      .setAlpha(0.95);
    escena.tweens.add({
      targets: img,
      x: img.x + Math.cos(angulo) * 6,
      y: img.y + Math.sin(angulo) * 6,
      alpha: 0,
      duration: 170,
      ease: 'Quad.Out',
      onComplete: () => img.destroy(),
    });
  }
}

interface Proyectil {
  spr: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  atraviesa: number;
  golpeados: Set<number>;
}

class Dagas extends Arma {
  private proyectiles: Proyectil[] = [];

  protected atacar(angulo: number): void {
    const s = statsDagas(this.nivel);
    const { jugador: j, escena } = this.c;
    for (let i = 0; i < s.cantidad; i++) {
      const a = angulo + (i - (s.cantidad - 1) / 2) * 0.14;
      const spr = escena.add.image(j.x, j.y - PECHO, 'daga').setRotation(a).setDepth(1_000_010);
      this.proyectiles.push({
        spr,
        x: j.x,
        y: j.y - PECHO,
        vx: Math.cos(a) * s.velocidad,
        vy: Math.sin(a) * s.velocidad,
        vida: 0.85,
        atraviesa: s.atraviesa,
        golpeados: new Set(),
      });
    }
    this.c.sonido.reproducir('daga', 0.5);
  }

  protected mover(dt: number, dano: number): void {
    const s = statsDagas(this.nivel);
    const { horda } = this.c;
    for (let i = this.proyectiles.length - 1; i >= 0; i--) {
      const p = this.proyectiles[i]!;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vida -= dt;
      p.spr.setPosition(p.x, p.y);
      horda.enCirculo(p.x, p.y, 3, (e) => {
        if (p.vida <= 0 || p.golpeados.has(e.uid)) return;
        p.golpeados.add(e.uid);
        horda.herir(e, Math.round(s.dano * dano), p.vx * 0.25, p.vy * 0.25);
        if (p.atraviesa-- <= 0) p.vida = 0;
      });
      if (p.vida <= 0) {
        p.spr.destroy();
        this.proyectiles.splice(i, 1);
      }
    }
  }

  destruir(): void {
    for (const p of this.proyectiles) p.spr.destroy();
  }
}

class Llamarada extends Arma {
  private llama: Phaser.GameObjects.Graphics;
  private visible = 0;
  private ultimo = 0;
  private alcance = 0;

  constructor(c: Contexto, id: IdArma) {
    super(c, id);
    this.llama = c.escena.add.graphics().setDepth(1_000_035);
  }

  protected atacar(angulo: number, dano: number): void {
    const s = statsLlamarada(this.nivel);
    const { jugador: j, horda, efectos, sonido } = this.c;
    const cx = j.x;
    const cy = j.y - PECHO;
    horda.enCirculo(cx, cy, s.alcance, (e) => {
      if (!enCono(Math.atan2(e.y - 6 - cy, e.x - cx), angulo, s.angulo * RAD)) return;
      horda.herir(e, Math.round(s.dano * dano), Math.cos(angulo) * 40, Math.sin(angulo) * 40, CSS.ambarClaro);
    });
    for (let k = 1; k <= 4; k++) {
      const d = (s.alcance * k) / 4;
      efectos.estallar('brasa', cx + Math.cos(angulo) * d, cy + Math.sin(angulo) * d, 3);
    }
    sonido.reproducir('aceite', 0.8);
    this.visible = 0.22;
    this.ultimo = angulo;
    this.alcance = s.alcance;
  }

  protected mover(dt: number): void {
    const g = this.llama;
    g.clear();
    if (this.visible <= 0) return;
    this.visible -= dt;
    const { jugador: j } = this.c;
    const t = Math.max(0, this.visible / 0.22);
    const apertura = statsLlamarada(this.nivel).angulo * RAD;
    const cx = j.x;
    const cy = j.y - PECHO;
    // Tres capas del cono, de fuera (naranja) a dentro (amarillo), que se apagan.
    const capas: [number, number, number][] = [
      [COLOR.llama, 1, 0.45],
      [COLOR.ambar, 0.75, 0.55],
      [COLOR.ambarClaro, 0.45, 0.7],
    ];
    for (const [color, largo, alfa] of capas) {
      const r = this.alcance * largo * (0.85 + 0.15 * (1 - t));
      g.fillStyle(color, alfa * t);
      g.slice(cx, cy, r, this.ultimo - (apertura / 2) * largo, this.ultimo + (apertura / 2) * largo, false);
      g.fillPath();
    }
  }

  luz(): number {
    return statsLlamarada(this.nivel).luzExtra;
  }

  destruir(): void {
    this.llama.destroy();
  }
}

interface Runa {
  spr: Phaser.GameObjects.Image;
  estado: 'orbita' | 'ida' | 'vuelta';
  x: number;
  y: number;
  vx: number;
  vy: number;
  recorrido: number;
  golpeados: Set<number>;
}

class Runas extends Arma {
  private runas: Runa[] = [];
  private giro = 0;

  private sincronizar(): void {
    const s = statsRunas(this.nivel);
    const { jugador: j, escena } = this.c;
    while (this.runas.length < s.cantidad) {
      this.runas.push({
        spr: escena.add.image(j.x, j.y, 'runa').setDepth(1_000_020),
        estado: 'orbita',
        x: j.x,
        y: j.y,
        vx: 0,
        vy: 0,
        recorrido: 0,
        golpeados: new Set(),
      });
    }
  }

  protected atacar(angulo: number): void {
    this.sincronizar();
    const s = statsRunas(this.nivel);
    const listas = this.runas.filter((r) => r.estado === 'orbita');
    if (listas.length === 0) {
      this.reloj = 0.1; // aún vuelven: reintenta enseguida
      return;
    }
    listas.forEach((r, i) => {
      const a = angulo + (i - (listas.length - 1) / 2) * 0.22;
      r.estado = 'ida';
      r.vx = Math.cos(a) * s.velocidad;
      r.vy = Math.sin(a) * s.velocidad;
      r.recorrido = 0;
      r.golpeados.clear();
    });
    this.c.sonido.reproducir('runa', 0.6);
  }

  protected mover(dt: number, dano: number): void {
    this.sincronizar();
    const s = statsRunas(this.nivel);
    const { jugador: j, horda } = this.c;
    this.giro += dt * 2.6;
    const enOrbita = this.runas.filter((r) => r.estado === 'orbita');
    for (const r of this.runas) {
      if (r.estado === 'orbita') {
        // En reposo flotan alrededor del cazador, sin hacer daño.
        const i = enOrbita.indexOf(r);
        const a = this.giro + (i / Math.max(1, enOrbita.length)) * Math.PI * 2;
        r.x = j.x + Math.cos(a) * 12;
        r.y = j.y - PECHO + Math.sin(a) * 6;
        r.spr.setPosition(r.x, r.y).setAlpha(0.75).setScale(0.75).setRotation(0);
        continue;
      }
      if (r.estado === 'vuelta') {
        // Vuelve buscando al cazador allí donde esté.
        const dx = j.x - r.x;
        const dy = j.y - PECHO - r.y;
        const d = Math.hypot(dx, dy) || 1;
        r.vx = (dx / d) * s.velocidad * 1.15;
        r.vy = (dy / d) * s.velocidad * 1.15;
        if (d < 8) {
          r.estado = 'orbita';
          continue;
        }
      }
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.recorrido += Math.hypot(r.vx, r.vy) * dt;
      if (r.estado === 'ida' && r.recorrido >= s.alcance) {
        r.estado = 'vuelta';
        r.golpeados.clear(); // a la vuelta puede volver a golpear
      }
      r.spr.setPosition(r.x, r.y).setAlpha(1).setScale(1).setRotation(r.recorrido * 0.12);
      horda.enCirculo(r.x, r.y, 5, (e) => {
        if (r.golpeados.has(e.uid)) return;
        r.golpeados.add(e.uid);
        horda.herir(e, Math.round(s.dano * dano), r.vx * 0.3, r.vy * 0.3, CSS.violeta);
      });
    }
  }

  destruir(): void {
    for (const r of this.runas) r.spr.destroy();
  }
}

class Campana extends Arma {
  private ondas: { g: Phaser.GameObjects.Graphics; x: number; y: number; t: number; golpeados: Set<number> }[] = [];

  protected atacar(): void {
    const { jugador: j, escena } = this.c;
    this.ondas.push({ g: escena.add.graphics().setDepth(1_000_030), x: j.x, y: j.y - 4, t: 0, golpeados: new Set() });
    this.c.sonido.reproducir('campana');
  }

  protected mover(dt: number, dano: number): void {
    const s = statsCampana(this.nivel);
    const { horda } = this.c;
    const dur = 0.5;
    for (let i = this.ondas.length - 1; i >= 0; i--) {
      const o = this.ondas[i]!;
      o.t += dt;
      const p = Math.min(1, o.t / dur);
      const r = s.alcance * (1 - Math.pow(1 - p, 2));
      o.g.clear();
      o.g.lineStyle(2, COLOR.ambarClaro, 0.8 * (1 - p));
      o.g.strokeCircle(o.x, o.y, r);
      o.g.lineStyle(1, COLOR.hueso, 0.5 * (1 - p));
      o.g.strokeCircle(o.x, o.y, Math.max(0, r - 4));
      horda.enCirculo(o.x, o.y, r, (e) => {
        if (o.golpeados.has(e.uid)) return;
        o.golpeados.add(e.uid);
        const ang = Math.atan2(e.y - o.y, e.x - o.x);
        horda.herir(e, Math.round(s.dano * dano), Math.cos(ang) * s.empuje, Math.sin(ang) * s.empuje, CSS.ambarClaro);
      });
      if (p >= 1) {
        o.g.destroy();
        this.ondas.splice(i, 1);
      }
    }
  }

  destruir(): void {
    for (const o of this.ondas) o.g.destroy();
  }
}

const CLASES: Record<IdArma, new (c: Contexto, id: IdArma) => Arma> = {
  hoz: Hoz,
  dagas: Dagas,
  farol: Llamarada,
  runas: Runas,
  campana: Campana,
};

/** Las armas que lleva el jugador, sincronizadas con su inventario. */
export class Arsenal {
  private armas = new Map<IdArma, Arma>();

  constructor(private c: Contexto) {}

  sincronizar(inv: Inventario): void {
    for (const [id, nivel] of Object.entries(inv.armas) as [IdArma, number][]) {
      let a = this.armas.get(id);
      if (!a) {
        a = new CLASES[id](this.c, id);
        this.armas.set(id, a);
      }
      a.nivel = nivel;
    }
  }

  /** `bono` suma daño momentáneo (Farol de vidrio soplado); el total respeta el tope de daño. */
  actualizar(dt: number, atacando: boolean, angulo: number, bono = 0): void {
    const { enfriamiento } = this.c.jugador.atrib;
    const dano = Math.min(this.c.jugador.atrib.dano * (1 + bono), LIMITES.dano);
    for (const a of this.armas.values()) a.actualizar(dt, atacando, angulo, dano, enfriamiento);
  }

  /** Carga de cada arma (0..1) para dibujar el indicador de la interfaz. */
  cargas(): Partial<Record<IdArma, number>> {
    const res: Partial<Record<IdArma, number>> = {};
    for (const [id, a] of this.armas) res[id] = a.carga(this.c.jugador.atrib.enfriamiento);
    return res;
  }

  luzExtra(): number {
    let l = 0;
    for (const a of this.armas.values()) l += a.luz();
    return l;
  }

  destruir(): void {
    for (const a of this.armas.values()) a.destruir();
    this.armas.clear();
  }
}
