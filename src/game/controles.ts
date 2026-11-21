import Phaser from 'phaser';
import { leerAjustes } from '../logic/guardado';

const RADIO_JOYSTICK = 46;
const ZONA_MUERTA = 0.15;

/**
 * Movimiento y ataque.
 * - PC: WASD o flechas para moverse; clic izquierdo (o espacio) para atacar hacia el cursor.
 * - Móvil: joystick flotante en la mitad izquierda y botón de ataque abajo a la derecha.
 */
export class Controles {
  private readonly teclado: Phaser.Input.Keyboard.KeyboardPlugin | null;
  private readonly teclas: Phaser.Input.Keyboard.Key[] = [];
  private readonly espacio: Phaser.Input.Keyboard.Key | null = null;
  private readonly base: Phaser.GameObjects.Graphics;
  private readonly mando: Phaser.GameObjects.Graphics;
  private readonly boton: Phaser.GameObjects.Graphics;
  private readonly botonIcono: Phaser.GameObjects.Image;

  private bloqueado = false;
  // Joystick táctil
  private dedoMover: number | null = null;
  private origenX = 0;
  private origenY = 0;
  private dx = 0;
  private dy = 0;
  // Ataque
  private dedoAtacar: number | null = null;
  private ratonAtacando = false;
  private ratonX = -1;
  private ratonY = -1;
  private ratonUsado = false;
  private tactil = false;
  /** Opción de ajustes: las armas atacan solas hacia donde se apunta. */
  private autoataque = false;

  constructor(
    private readonly escena: Phaser.Scene,
    private readonly capaUI: Phaser.Scene,
  ) {
    this.teclado = escena.input.keyboard ?? null;
    if (this.teclado) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      // Orden: W, A, S, D, ↑, ←, ↓, →
      for (const k of [K.W, K.A, K.S, K.D]) this.teclas.push(this.teclado.addKey(k, false));
      for (const k of [K.UP, K.LEFT, K.DOWN, K.RIGHT]) this.teclas.push(this.teclado.addKey(k, true));
      this.espacio = this.teclado.addKey(K.SPACE, true);
    }
    this.capaUI.input.mouse?.disableContextMenu();
    this.tactil = this.capaUI.sys.game.device.input.touch;
    this.autoataque = leerAjustes().autoataque;

    this.base = capaUI.add.graphics().setDepth(20000).setVisible(false);
    this.mando = capaUI.add.graphics().setDepth(20000).setVisible(false);
    this.boton = capaUI.add.graphics().setDepth(20000);
    this.botonIcono = capaUI.add.image(0, 0, 'icono-hoz').setDepth(20001);
    this.dibujarBoton();

    capaUI.input.on('pointerdown', this.alBajar, this);
    capaUI.input.on('pointermove', this.alMover, this);
    capaUI.input.on('pointerup', this.alSoltar, this);
    capaUI.input.on('pointerupoutside', this.alSoltar, this);
    capaUI.scale.on('resize', this.dibujarBoton, this);
    window.addEventListener('blur', this.soltarTodo);
  }

  /** Posición y radio del botón de ataque táctil, en píxeles de pantalla. */
  private geometriaBoton(): { x: number; y: number; r: number } {
    const { width: w, height: h } = this.capaUI.scale;
    const u = Phaser.Math.Clamp(Math.min(w, h) / 380, 1, 2.4);
    const r = Math.round(36 * u);
    return { x: w - r - Math.round(22 * u), y: h - r - Math.round(26 * u), r };
  }

  private dibujarBoton(): void {
    const { x, y, r } = this.geometriaBoton();
    const pulsado = this.dedoAtacar !== null;
    this.boton.clear();
    this.boton.fillStyle(0x0b0a12, pulsado ? 0.55 : 0.35).fillCircle(x, y, r);
    this.boton.lineStyle(Math.max(2, Math.round(r / 14)), pulsado ? 0xffd77a : 0xf2eee3, pulsado ? 0.9 : 0.45).strokeCircle(x, y, r);
    this.botonIcono.setPosition(x, y).setScale((r * 1.1) / 12).setAlpha(pulsado ? 1 : 0.8);
    // Con el ataque automático no hace falta botón: toda la pantalla sirve para moverse.
    const visible = this.tactil && !this.bloqueado && !this.autoataque;
    this.boton.setVisible(visible);
    this.botonIcono.setVisible(visible);
  }

  private sobreBoton(p: Phaser.Input.Pointer): boolean {
    const { x, y, r } = this.geometriaBoton();
    return Math.hypot(p.x - x, p.y - y) <= r * 1.25;
  }

  private alBajar(p: Phaser.Input.Pointer): void {
    if (this.bloqueado) return;
    // Un toque sobre un botón de la interfaz (pausa, menús) no mueve ni ataca.
    if (this.capaUI.input.hitTestPointer(p).length > 0) return;
    if (p.wasTouch) {
      this.tactil = true;
      if (!this.autoataque && (this.sobreBoton(p) || p.x > this.capaUI.scale.width * 0.5)) {
        if (this.dedoAtacar === null) this.dedoAtacar = p.id;
      } else if (this.dedoMover === null) {
        this.dedoMover = p.id;
        this.origenX = p.x;
        this.origenY = p.y;
        this.dx = 0;
        this.dy = 0;
      }
      this.dibujar();
      return;
    }
    // Ratón: el botón izquierdo ataca.
    this.ratonUsado = true;
    this.ratonX = p.x;
    this.ratonY = p.y;
    if (p.leftButtonDown()) this.ratonAtacando = true;
  }

  private alMover(p: Phaser.Input.Pointer): void {
    if (!p.wasTouch) {
      this.ratonUsado = true;
      this.ratonX = p.x;
      this.ratonY = p.y;
      return;
    }
    if (p.id !== this.dedoMover || this.bloqueado) return;
    const dx = p.x - this.origenX;
    const dy = p.y - this.origenY;
    const d = Math.hypot(dx, dy);
    const k = d > RADIO_JOYSTICK ? RADIO_JOYSTICK / d : 1;
    this.dx = dx * k;
    this.dy = dy * k;
    this.dibujar();
  }

  private alSoltar(p: Phaser.Input.Pointer): void {
    if (p.id === this.dedoMover) {
      this.dedoMover = null;
      this.dx = 0;
      this.dy = 0;
    }
    if (p.id === this.dedoAtacar) this.dedoAtacar = null;
    if (!p.wasTouch && !p.leftButtonDown()) this.ratonAtacando = false;
    this.dibujar();
  }

  private readonly soltarTodo = (): void => {
    this.dedoMover = null;
    this.dedoAtacar = null;
    this.ratonAtacando = false;
    this.dx = 0;
    this.dy = 0;
    this.dibujar();
  };

  private dibujar(): void {
    this.dibujarBoton();
    const activo = this.dedoMover !== null && !this.bloqueado;
    this.base.setVisible(activo);
    this.mando.setVisible(activo);
    if (!activo) return;
    this.base.clear();
    this.base.fillStyle(0x000000, 0.25).fillCircle(this.origenX, this.origenY, RADIO_JOYSTICK);
    this.base.lineStyle(2, 0xf2eee3, 0.35).strokeCircle(this.origenX, this.origenY, RADIO_JOYSTICK);
    this.mando.clear();
    this.mando.fillStyle(0xf2eee3, 0.5).fillCircle(this.origenX + this.dx, this.origenY + this.dy, 18);
  }

  /** Dirección de movimiento, con magnitud de 0 a 1. */
  vector(): { x: number; y: number } {
    if (this.bloqueado) return { x: 0, y: 0 };
    const t = (i: number) => this.teclas[i]?.isDown === true;
    const izq = t(1) || t(5);
    const der = t(3) || t(7);
    const arr = t(0) || t(4);
    const aba = t(2) || t(6);
    if (izq || der || arr || aba) {
      let x = Number(der) - Number(izq);
      let y = Number(aba) - Number(arr);
      const m = Math.hypot(x, y);
      if (m > 1) {
        x /= m;
        y /= m;
      }
      return { x, y };
    }
    const d = Math.hypot(this.dx, this.dy);
    const muerta = RADIO_JOYSTICK * ZONA_MUERTA;
    if (this.dedoMover === null || d <= muerta) return { x: 0, y: 0 };
    const m = Math.min(1, (d - muerta) / (RADIO_JOYSTICK - muerta));
    return { x: (this.dx / d) * m, y: (this.dy / d) * m };
  }

  /** ¿Está el jugador atacando ahora? */
  atacando(): boolean {
    if (this.bloqueado) return false;
    if (this.autoataque) return true;
    return this.ratonAtacando || this.dedoAtacar !== null || this.espacio?.isDown === true;
  }

  /**
   * Punto del mundo al que apunta el ratón, o null si se juega sin ratón
   * (táctil): entonces la escena apunta sola al enemigo más cercano.
   */
  apunte(): { x: number; y: number } | null {
    if (!this.ratonUsado || this.dedoAtacar !== null) return null;
    const p = this.escena.cameras.main.getWorldPoint(this.ratonX, this.ratonY);
    return { x: p.x, y: p.y };
  }

  setAutoataque(on: boolean): void {
    this.autoataque = on;
    this.dibujar();
  }

  get usandoTactil(): boolean {
    return this.tactil;
  }

  bloquear(on: boolean): void {
    this.bloqueado = on;
    if (on) this.soltarTodo();
    else this.dibujar();
  }

  destruir(): void {
    this.capaUI.input.off('pointerdown', this.alBajar, this);
    this.capaUI.input.off('pointermove', this.alMover, this);
    this.capaUI.input.off('pointerup', this.alSoltar, this);
    this.capaUI.input.off('pointerupoutside', this.alSoltar, this);
    this.capaUI.scale.off('resize', this.dibujarBoton, this);
    window.removeEventListener('blur', this.soltarTodo);
    this.base.destroy();
    this.mando.destroy();
    this.boton.destroy();
    this.botonIcono.destroy();
    for (const k of this.teclas) this.teclado?.removeKey(k);
    if (this.espacio) this.teclado?.removeKey(this.espacio);
  }
}
