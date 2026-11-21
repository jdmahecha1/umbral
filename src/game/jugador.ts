import Phaser from 'phaser';
import { danoRecibido, type Atributos } from '../logic/mejoras';

export const ACEITE_MAX = 100;
/** Unidades de aceite por segundo con la mecha normal: un farol lleno dura ~80 s. */
const GASTO_BASE = 1.25;
const INVULNERABLE = 0.6;
/** La esquiva: un impulso corto y rápido durante el que nada te toca. */
const DURACION_ESQUIVA = 0.16;
const VELOCIDAD_ESQUIVA = 3.6;
const INTANGIBLE_ESQUIVA = 0.26;

/** El cazador: posición, vida, aceite del farol y su sprite. */
export class Jugador {
  readonly spr: Phaser.GameObjects.Sprite;
  private sombra: Phaser.GameObjects.Image;
  x = 0;
  y = 0;
  vida: number;
  aceite = ACEITE_MAX;
  /** 1 mira a la derecha, -1 a la izquierda. */
  mirando = 1;
  /** Última dirección de movimiento (para armas que la usan). */
  dirX = 1;
  dirY = 0;
  private invulnerable = 0;
  private tiempo = 0;
  muerto = false;
  /** El último golpe fue esquivado (la escena lo muestra y lo limpia). */
  esquivo = false;
  // Esquiva
  private esquivaT = 0;
  private esquivaX = 0;
  private esquivaY = 0;
  private recargaEsquiva = 0;
  private intangible = 0;
  private estela = 0;

  constructor(
    private escena: Phaser.Scene,
    public atrib: Atributos,
    /** Textura del personaje elegido; su animación de andar es `<clave>:andar`. */
    private clave = 'cazador',
  ) {
    this.vida = atrib.vidaMax;
    this.sombra = escena.add.image(0, 0, 'sombra').setDepth(-1);
    this.spr = escena.add.sprite(0, 0, clave, '0').setOrigin(0.5, 1);
  }

  /**
   * Esquiva en la dirección (dx, dy). Devuelve false si todavía se está recargando.
   * Mientras dura, ningún golpe ni proyectil te hace daño.
   */
  esquivar(dx: number, dy: number): boolean {
    if (this.recargaEsquiva > 0 || this.muerto) return false;
    const m = Math.hypot(dx, dy);
    this.esquivaX = m > 0.01 ? dx / m : this.mirando;
    this.esquivaY = m > 0.01 ? dy / m : 0;
    this.esquivaT = DURACION_ESQUIVA;
    this.intangible = INTANGIBLE_ESQUIVA;
    this.recargaEsquiva = this.atrib.recargaEsquiva;
    this.estela = 0;
    if (Math.abs(this.esquivaX) > 0.15) this.mirando = this.esquivaX > 0 ? 1 : -1;
    return true;
  }

  get esquivando(): boolean {
    return this.esquivaT > 0;
  }

  /** De 0 (recién usada) a 1 (lista). */
  cargaEsquiva(): number {
    return 1 - Math.max(0, Math.min(1, this.recargaEsquiva / this.atrib.recargaEsquiva));
  }

  actualizar(dt: number, mx: number, my: number, atacando = false): void {
    this.tiempo += dt;
    this.recargaEsquiva = Math.max(0, this.recargaEsquiva - dt);
    this.intangible = Math.max(0, this.intangible - dt);
    if (this.esquivaT > 0) {
      // Durante la esquiva se ignora el control: impulso recto y una estela.
      this.esquivaT -= dt;
      const v = this.atrib.velocidad * VELOCIDAD_ESQUIVA;
      this.x += this.esquivaX * v * dt;
      this.y += this.esquivaY * v * dt;
      this.estela -= dt;
      if (this.estela <= 0) {
        this.estela = 0.035;
        this.dejarEstela();
      }
      mx = 0;
      my = 0;
    }
    const moviendo = Math.hypot(mx, my) > 0.05;
    this.x += mx * this.atrib.velocidad * dt;
    this.y += my * this.atrib.velocidad * dt;
    if (moviendo) {
      this.dirX = mx;
      this.dirY = my;
      // Mientras ataca, mira hacia donde apunta (lo decide la escena).
      if (!atacando && Math.abs(mx) > 0.15) this.mirando = mx > 0 ? 1 : -1;
      const andar = `${this.clave}:andar`;
      if (this.spr.anims.currentAnim?.key !== andar) this.spr.play(andar);
    } else if (this.spr.anims.isPlaying) {
      this.spr.stop();
      this.spr.setFrame('0');
    }
    // Leve balanceo al respirar para que no parezca congelado.
    const respiro = moviendo ? 0 : Math.round(Math.sin(this.tiempo * 2.4) * 0.6);
    this.spr.setPosition(this.x, this.y + respiro).setFlipX(this.mirando < 0).setDepth(this.y);
    this.sombra.setPosition(this.x, this.y - 1).setDepth(this.y - 2);

    this.aceite = Math.max(this.atrib.aceiteMin, this.aceite - GASTO_BASE * this.atrib.gastoAceite * dt);
    if (this.atrib.regeneracion > 0) this.vida = Math.min(this.atrib.vidaMax, this.vida + this.atrib.regeneracion * dt);

    if (this.invulnerable > 0) {
      this.invulnerable -= dt;
      // Parpadeo mientras dura la invulnerabilidad.
      this.spr.setAlpha(this.invulnerable > 0 && Math.floor(this.invulnerable * 20) % 2 === 0 ? 0.45 : 1);
    }
  }

  /** Copia translúcida del personaje que se desvanece: marca el recorrido de la esquiva. */
  private dejarEstela(): void {
    const fantasma = this.escena.add
      .image(this.x, this.y, this.clave, this.spr.frame.name)
      .setOrigin(0.5, 1)
      .setFlipX(this.mirando < 0)
      .setTint(0x7fd1e8)
      .setAlpha(0.55)
      .setDepth(this.y - 1);
    this.escena.tweens.add({ targets: fantasma, alpha: 0, duration: 220, onComplete: () => fantasma.destroy() });
  }

  /** Aplica daño si no está en su breve invulnerabilidad. Devuelve el daño hecho (0 si no hubo). */
  herir(bruto: number): number {
    if (this.invulnerable > 0 || this.intangible > 0 || this.muerto) return 0;
    // La Capa de sombra hace que algunos golpes no dañen (con un breve respiro igualmente).
    if (this.atrib.esquiva > 0 && Math.random() < this.atrib.esquiva) {
      this.invulnerable = INVULNERABLE;
      this.esquivo = true;
      return 0;
    }
    const d = danoRecibido(bruto, this.atrib.armadura);
    this.vida = Math.max(0, this.vida - d);
    this.invulnerable = INVULNERABLE;
    this.spr.setTint(0xe86a5a).setTintMode(Phaser.TintModes.FILL);
    this.escena.time.delayedCall(90, () => this.spr.clearTint().setTintMode(Phaser.TintModes.MULTIPLY));
    if (this.vida <= 0) this.muerto = true;
    return d;
  }

  /** Unos segundos sin recibir daño (al volver de la tienda o al revivir). */
  proteger(segundos: number): void {
    this.invulnerable = Math.max(this.invulnerable, segundos);
  }

  revivir(): void {
    this.muerto = false;
    this.vida = Math.round(this.atrib.vidaMax / 2);
    this.proteger(2.5);
  }

  curar(cantidad: number): void {
    this.vida = Math.min(this.atrib.vidaMax, this.vida + cantidad);
  }

  /** Cambia los atributos (al subir una pasiva); la vida extra se suma también a la actual. */
  setAtributos(nuevos: Atributos): void {
    const extra = nuevos.vidaMax - this.atrib.vidaMax;
    this.atrib = nuevos;
    if (extra > 0) this.vida += extra;
    this.aceite = Math.max(this.aceite, nuevos.aceiteMin);
  }

  /** Radio de luz del farol según el aceite (en unidades del mundo). */
  radioLuz(extra: number): number {
    const t = this.aceite / ACEITE_MAX;
    const parpadeo = Math.sin(this.tiempo * 9) * 1.2 + Math.sin(this.tiempo * 23) * 0.6;
    return (30 + 64 * Math.sqrt(t) + extra) * this.atrib.luz + parpadeo;
  }
}
