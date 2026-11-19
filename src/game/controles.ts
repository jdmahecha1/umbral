import Phaser from 'phaser';

/**
 * Movimiento con teclado (WASD o flechas) o con un joystick táctil flotante que
 * aparece donde se toca la pantalla. El teclado tiene prioridad.
 */
export class Controles {
  private readonly teclado: Phaser.Input.Keyboard.KeyboardPlugin | null;
  private readonly capaUI: Phaser.Scene;
  private readonly base: Phaser.GameObjects.Graphics;
  private readonly mando: Phaser.GameObjects.Graphics;
  private readonly teclas: Phaser.Input.Keyboard.Key[] = [];
  private readonly teclaEspacio: Phaser.Input.Keyboard.Key | null;
  private readonly ventana: Window | null;

  private tecladoUsado = false;
  private bloqueado = false;
  private punteroId: number | null = null;
  private origenX = 0;
  private origenY = 0;
  private desplazamientoX = 0;
  private desplazamientoY = 0;

  constructor(escena: Phaser.Scene, capaUI?: Phaser.Scene) {
    this.capaUI = capaUI ?? escena;
    this.teclado = escena.input.keyboard ?? null;

    if (this.teclado) {
      this.teclas.push(
        this.teclado.addKey(Phaser.Input.Keyboard.KeyCodes.W, false),
        this.teclado.addKey(Phaser.Input.Keyboard.KeyCodes.A, false),
        this.teclado.addKey(Phaser.Input.Keyboard.KeyCodes.S, false),
        this.teclado.addKey(Phaser.Input.Keyboard.KeyCodes.D, false),
        this.teclado.addKey(Phaser.Input.Keyboard.KeyCodes.UP, true),
        this.teclado.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT, true),
        this.teclado.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN, true),
        this.teclado.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT, true),
      );
      this.teclaEspacio = this.teclado.addKey(
        Phaser.Input.Keyboard.KeyCodes.SPACE,
        true,
      );
      this.teclado.on('keydown', this.alUsarTeclado, this);
    } else {
      this.teclaEspacio = null;
    }

    this.base = this.capaUI.add.graphics();
    this.mando = this.capaUI.add.graphics();

    this.base.setScrollFactor(0).setDepth(20000).setVisible(false);
    this.mando.setScrollFactor(0).setDepth(20000).setVisible(false);

    this.capaUI.input.on('pointerdown', this.alBajarPuntero, this);
    this.capaUI.input.on('pointermove', this.alMoverPuntero, this);
    this.capaUI.input.on('pointerup', this.alSoltarPuntero, this);
    this.capaUI.input.on('pointerupoutside', this.alSoltarPuntero, this);

    this.ventana = typeof window !== 'undefined' ? window : null;
    this.ventana?.addEventListener('blur', this.alPerderFoco);
  }

  private readonly alUsarTeclado = (_evento: KeyboardEvent): void => {
    this.tecladoUsado = true;
  };

  private readonly alPerderFoco = (): void => {
    this.soltarJoystick();
  };

  private alBajarPuntero(puntero: Phaser.Input.Pointer): void {
    if (this.bloqueado || this.punteroId !== null) {
      return;
    }

    // Un toque sobre un botón de la interfaz no mueve al cazador.
    if (this.capaUI.input.hitTestPointer(puntero).length > 0) {
      return;
    }

    if (!puntero.wasTouch && this.tecladoUsado) {
      return;
    }

    this.punteroId = puntero.id;
    this.origenX = puntero.x;
    this.origenY = puntero.y;
    this.desplazamientoX = 0;
    this.desplazamientoY = 0;
    this.actualizarDibujo();
  }

  private alMoverPuntero(puntero: Phaser.Input.Pointer): void {
    if (puntero.id !== this.punteroId || this.bloqueado) {
      return;
    }

    const dx = puntero.x - this.origenX;
    const dy = puntero.y - this.origenY;
    const distancia = Math.hypot(dx, dy);
    const limite = 46;
    const escala = distancia > limite ? limite / distancia : 1;

    this.desplazamientoX = dx * escala;
    this.desplazamientoY = dy * escala;
    this.actualizarDibujo();
  }

  private alSoltarPuntero(puntero: Phaser.Input.Pointer): void {
    if (puntero.id === this.punteroId) {
      this.soltarJoystick();
    }
  }

  private actualizarDibujo(): void {
    if (this.punteroId === null || this.bloqueado) {
      this.base.setVisible(false);
      this.mando.setVisible(false);
      return;
    }

    this.base.clear();
    this.base.fillStyle(0x000000, 0.25);
    this.base.fillCircle(this.origenX, this.origenY, 46);
    this.base.lineStyle(2, 0xf2eee3, 0.35);
    this.base.strokeCircle(this.origenX, this.origenY, 46);

    this.mando.clear();
    this.mando.fillStyle(0xf2eee3, 0.5);
    this.mando.fillCircle(
      this.origenX + this.desplazamientoX,
      this.origenY + this.desplazamientoY,
      18,
    );

    this.base.setVisible(true);
    this.mando.setVisible(true);
  }

  private soltarJoystick(): void {
    this.punteroId = null;
    this.desplazamientoX = 0;
    this.desplazamientoY = 0;
    this.base.setVisible(false);
    this.mando.setVisible(false);
  }

  vector(): { x: number; y: number } {
    if (this.bloqueado) {
      return { x: 0, y: 0 };
    }

    // Orden de this.teclas: W, A, S, D, ↑, ←, ↓, →
    const izquierda =
      this.teclas[1]?.isDown === true ||
      this.teclas[5]?.isDown === true;
    const derecha =
      this.teclas[3]?.isDown === true ||
      this.teclas[7]?.isDown === true;
    const arriba =
      this.teclas[0]?.isDown === true ||
      this.teclas[4]?.isDown === true;
    const abajo =
      this.teclas[2]?.isDown === true ||
      this.teclas[6]?.isDown === true;

    if (izquierda || derecha || arriba || abajo) {
      let x = Number(derecha) - Number(izquierda);
      let y = Number(abajo) - Number(arriba);
      const magnitud = Math.hypot(x, y);

      if (magnitud > 1) {
        x /= magnitud;
        y /= magnitud;
      }

      return { x, y };
    }

    const distancia = Math.hypot(
      this.desplazamientoX,
      this.desplazamientoY,
    );
    const zonaMuerta = 46 * 0.15;

    if (this.punteroId === null || distancia <= zonaMuerta) {
      return { x: 0, y: 0 };
    }

    const magnitud = Math.min(1, (distancia - zonaMuerta) / (46 - zonaMuerta));
    return {
      x: (this.desplazamientoX / distancia) * magnitud,
      y: (this.desplazamientoY / distancia) * magnitud,
    };
  }

  get usandoTactil(): boolean {
    return this.punteroId !== null;
  }

  bloquear(on: boolean): void {
    this.bloqueado = on;

    if (on) {
      this.soltarJoystick();
    }
  }

  destruir(): void {
    this.teclado?.off('keydown', this.alUsarTeclado, this);
    this.capaUI.input.off('pointerdown', this.alBajarPuntero, this);
    this.capaUI.input.off('pointermove', this.alMoverPuntero, this);
    this.capaUI.input.off('pointerup', this.alSoltarPuntero, this);
    this.capaUI.input.off('pointerupoutside', this.alSoltarPuntero, this);
    this.ventana?.removeEventListener('blur', this.alPerderFoco);

    this.base.destroy();
    this.mando.destroy();
    this.teclas.forEach((tecla) => this.teclado?.removeKey(tecla));
    if (this.teclaEspacio) {
      this.teclado?.removeKey(this.teclaEspacio);
    }
  }
}

