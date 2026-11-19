import Phaser from 'phaser';
import { COLOR, CSS } from '../art/paleta';
import type { Sonido } from '../audio/sonido';
import { statsCampana, statsDagas, statsFarol, statsHoz, statsRunas } from '../logic/armas';
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

abstract class Arma {
  nivel = 1;
  protected reloj = 0;
  constructor(protected c: Contexto) {}
  abstract actualizar(dt: number, dano: number, enfriamiento: number): void;
  destruir(): void {}
  /** Luz extra que aporta el arma. */
  luz(): number {
    return 0;
  }
}

class Hoz extends Arma {
  actualizar(dt: number, dano: number, enfriamiento: number): void {
    const s = statsHoz(this.nivel);
    this.reloj -= dt;
    if (this.reloj > 0) return;
    this.reloj = s.recarga * enfriamiento;
    // Corta hacia el lado del enemigo más cercano; si no hay ninguno a mano, hacia donde mira.
    const j = this.c.jugador;
    const cerca = this.c.horda.masCercano(j.x, j.y, s.ancho + 14);
    const dir = cerca && Math.abs(cerca.x - j.x) > 1 ? Math.sign(cerca.x - j.x) : j.mirando;
    this.tajo(dir, s.ancho, s.alto, s.dano * dano);
    if (s.atras) this.c.escena.time.delayedCall(140, () => this.tajo(-dir, s.ancho, s.alto, s.dano * dano));
  }

  private tajo(dir: number, ancho: number, alto: number, dano: number): void {
    const { jugador: j, horda, escena, sonido } = this.c;
    const cy = j.y - PECHO;
    const x0 = dir > 0 ? j.x + 2 : j.x - 2 - ancho;
    horda.enRectangulo(x0, cy - alto / 2, x0 + ancho, cy + alto / 2, (e) => horda.herir(e, Math.round(dano), dir * 70, 0));
    sonido.reproducir('tajo', 0.7);
    const img = escena.add
      .image(j.x + dir * (ancho * 0.45), cy, 'tajo')
      .setDepth(j.y + 1)
      .setFlipX(dir < 0)
      .setScale(ancho / 34, alto / 30)
      .setAlpha(0.95);
    escena.tweens.add({
      targets: img,
      x: img.x + dir * 6,
      alpha: 0,
      scaleX: img.scaleX * 1.15,
      duration: 180,
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

  actualizar(dt: number, dano: number, enfriamiento: number): void {
    const s = statsDagas(this.nivel);
    const { jugador: j, horda, escena } = this.c;
    this.reloj -= dt;
    if (this.reloj <= 0) {
      this.reloj = s.recarga * enfriamiento;
      // Apunta al más cercano; las dagas extra se abren en abanico.
      const objetivo = horda.masCercano(j.x, j.y - PECHO, 170);
      const base = objetivo
        ? Math.atan2(objetivo.y - 6 - (j.y - PECHO), objetivo.x - j.x)
        : Math.atan2(j.dirY, j.dirX || j.mirando);
      for (let i = 0; i < s.cantidad; i++) {
        const a = base + (i - (s.cantidad - 1) / 2) * 0.16;
        const spr = escena.add.image(j.x, j.y - PECHO, 'daga').setRotation(a).setDepth(1_000_010);
        this.proyectiles.push({
          spr,
          x: j.x,
          y: j.y - PECHO,
          vx: Math.cos(a) * s.velocidad,
          vy: Math.sin(a) * s.velocidad,
          vida: 0.9,
          atraviesa: s.atraviesa,
          golpeados: new Set(),
        });
      }
      this.c.sonido.reproducir('daga', 0.5);
    }
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

class Farol extends Arma {
  private halo: Phaser.GameObjects.Graphics;
  private t = 0;

  constructor(c: Contexto) {
    super(c);
    this.halo = c.escena.add.graphics().setDepth(-500_000);
  }

  actualizar(dt: number, dano: number, enfriamiento: number): void {
    const s = statsFarol(this.nivel);
    const { jugador: j, horda } = this.c;
    this.t += dt;
    this.reloj -= dt;
    const r = s.radio + Math.sin(this.t * 4) * 1.5;
    this.halo.clear();
    this.halo.fillStyle(COLOR.ambar, 0.09);
    this.halo.fillCircle(j.x, j.y - 4, r);
    this.halo.lineStyle(1, COLOR.ambarClaro, 0.28);
    this.halo.strokeCircle(j.x, j.y - 4, r);
    if (this.reloj <= 0) {
      this.reloj = s.intervalo * enfriamiento;
      horda.enCirculo(j.x, j.y - 4, s.radio, (e) => horda.herir(e, Math.round(s.dano * dano), 0, 0, CSS.ambarClaro));
    }
  }

  luz(): number {
    return statsFarol(this.nivel).luzExtra;
  }

  destruir(): void {
    this.halo.destroy();
  }
}

class Runas extends Arma {
  private sprites: Phaser.GameObjects.Image[] = [];
  private angulo = 0;
  /** id de enemigo → momento en que puede volver a ser golpeado. */
  private pausa = new Map<number, number>();
  private t = 0;

  actualizar(dt: number, dano: number): void {
    const s = statsRunas(this.nivel);
    const { jugador: j, horda, escena } = this.c;
    this.t += dt;
    this.angulo += s.giro * dt;
    while (this.sprites.length < s.cantidad) this.sprites.push(escena.add.image(0, 0, 'runa').setDepth(1_000_020));
    this.sprites.forEach((spr, i) => {
      const a = this.angulo + (i / s.cantidad) * Math.PI * 2;
      const x = j.x + Math.cos(a) * s.radio;
      const y = j.y - PECHO + Math.sin(a) * s.radio * 0.8;
      spr.setPosition(x, y).setRotation(-a * 0.5);
      horda.enCirculo(x, y, 5, (e) => {
        if ((this.pausa.get(e.uid) ?? 0) > this.t) return;
        this.pausa.set(e.uid, this.t + s.pausa);
        horda.herir(e, Math.round(s.dano * dano), Math.cos(a) * 60, Math.sin(a) * 60, CSS.violeta);
      });
    });
    // Olvida las esperas ya vencidas para que el mapa no crezca sin límite.
    if (this.pausa.size > 400) for (const [k, t] of this.pausa) if (t <= this.t) this.pausa.delete(k);
  }

  destruir(): void {
    for (const s of this.sprites) s.destroy();
  }
}

class Campana extends Arma {
  private ondas: { g: Phaser.GameObjects.Graphics; x: number; y: number; t: number; golpeados: Set<number> }[] = [];

  actualizar(dt: number, dano: number, enfriamiento: number): void {
    const s = statsCampana(this.nivel);
    const { jugador: j, horda, escena } = this.c;
    this.reloj -= dt;
    if (this.reloj <= 0) {
      this.reloj = s.recarga * enfriamiento;
      this.ondas.push({ g: escena.add.graphics().setDepth(1_000_030), x: j.x, y: j.y - 4, t: 0, golpeados: new Set() });
      this.c.sonido.reproducir('campana');
    }
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

const CLASES: Record<IdArma, new (c: Contexto) => Arma> = { hoz: Hoz, dagas: Dagas, farol: Farol, runas: Runas, campana: Campana };

/** Las armas que lleva el jugador, sincronizadas con su inventario. */
export class Arsenal {
  private armas = new Map<IdArma, Arma>();

  constructor(private c: Contexto) {}

  sincronizar(inv: Inventario): void {
    for (const [id, nivel] of Object.entries(inv.armas) as [IdArma, number][]) {
      let a = this.armas.get(id);
      if (!a) {
        a = new CLASES[id](this.c);
        this.armas.set(id, a);
      }
      a.nivel = nivel;
    }
  }

  actualizar(dt: number): void {
    const { dano, enfriamiento } = this.c.jugador.atrib;
    for (const a of this.armas.values()) a.actualizar(dt, dano, enfriamiento);
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
