import Phaser from 'phaser';
import { CSS } from '../art/paleta';
import type { Sonido } from '../audio/sonido';
import { Mundo } from '../game/mundo';
import { Oscuridad } from '../game/oscuridad';
import { formatoTiempo, guardarAjustes, leerAjustes, leerRecords } from '../logic/guardado';
import { zoomPara } from './Juego';
import { boton, navegarConTeclado, panel, texto, unidad, type Boton } from './ui';

/** Fondo animado del menú: el bosque a oscuras con una luz que sigue al puntero. */
export class FondoMenu extends Phaser.Scene {
  private mundo!: Mundo;
  private oscuridad!: Oscuridad;
  private luz = { x: 0, y: 0 };
  private fatuos: { s: Phaser.GameObjects.Sprite; a: number; r: number; v: number }[] = [];
  private t = 0;

  constructor() {
    super('FondoMenu');
  }

  create(): void {
    this.cameras.main.setZoom(zoomPara(this.scale.width, this.scale.height)).centerOn(0, 0);
    this.mundo = new Mundo(this, 1234);
    this.oscuridad = new Oscuridad(this);
    this.oscuridad.penumbra = 0.9;
    this.fatuos = [];
    for (let i = 0; i < 7; i++) {
      const s = this.add.sprite(0, 0, 'fatuo').play({ key: 'fatuo', startFrame: i % 2 }).setOrigin(0.5, 1);
      this.fatuos.push({ s, a: (i / 7) * Math.PI * 2, r: 60 + (i % 3) * 30, v: 0.15 + (i % 4) * 0.05 });
    }
    const cazador = this.add.sprite(-14, 30, 'cazador', '0').setOrigin(0.5, 1).setDepth(30);
    this.add.image(cazador.x, cazador.y - 1, 'sombra').setDepth(28);
    this.scale.on('resize', this.redimensionar, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.redimensionar, this);
      this.mundo.destruir();
      this.oscuridad.destruir();
    });
  }

  private redimensionar(): void {
    this.cameras.main.setZoom(zoomPara(this.scale.width, this.scale.height));
    this.oscuridad.ajustar();
  }

  update(_t: number, ms: number): void {
    const dt = ms / 1000;
    this.t += dt;
    const cam = this.cameras.main;
    cam.centerOn(Math.sin(this.t * 0.05) * 30, 0);
    this.mundo.actualizar();
    // La luz va hacia el puntero; si no hay puntero, ronda al cazador.
    const p = this.input.activePointer;
    const destino = p.isDown || p.x > 0 ? cam.getWorldPoint(p.x, p.y) : { x: -14, y: 22 };
    const k = 1 - Math.pow(0.02, dt);
    this.luz.x += (destino.x - this.luz.x) * k;
    this.luz.y += (destino.y - this.luz.y) * k;
    this.oscuridad.añadir({ x: -14, y: 22, radio: 46 + Math.sin(this.t * 7) * 1.5 });
    this.oscuridad.añadir({ x: this.luz.x, y: this.luz.y, radio: 34, fuerza: 0.7 });
    for (const f of this.fatuos) {
      f.a += f.v * dt;
      const x = Math.cos(f.a) * f.r * 1.5;
      const y = Math.sin(f.a * 1.3) * f.r * 0.6;
      f.s.setPosition(x, y).setDepth(y).setFlipX(Math.sin(f.a) > 0);
      this.oscuridad.añadir({ x, y: y - 5, radio: 16, fuerza: 0.6 });
    }
    this.oscuridad.dibujar();
  }
}

export class Menu extends Phaser.Scene {
  private soltarTeclado: (() => void) | null = null;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.scene.launch('FondoMenu');
    this.scene.sendToBack('FondoMenu');
    const sonido = this.registry.get('sonido') as Sonido;
    const desbloquear = () => sonido.desbloquear();
    this.input.once('pointerdown', desbloquear);
    this.input.keyboard?.once('keydown', desbloquear);
    this.construir();
    this.scale.on('resize', this.construir, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.construir, this);
      this.soltarTeclado?.();
      this.scene.stop('FondoMenu');
    });
  }

  private construir(): void {
    this.soltarTeclado?.();
    this.children.removeAll(true);
    const { width: w, height: h } = this.scale;
    const u = unidad(this);
    const sonido = this.registry.get('sonido') as Sonido;
    const ajustes = leerAjustes();
    const records = leerRecords();

    const yTitulo = h * 0.2;
    const titulo = texto(this, w / 2, yTitulo, 'UMBRAL', 54 * u, CSS.ambarClaro, true).setOrigin(0.5);
    titulo.setShadow(0, Math.round(4 * u), '#6a1f2b', 0, true, true);
    this.tweens.add({ targets: titulo, alpha: 0.82, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    texto(this, w / 2, yTitulo + 40 * u, 'Aguanta la noche. El farol no durará.', 13 * u, CSS.gris).setOrigin(0.5);

    const ancho = Math.min(w - 48, 240 * u);
    const y0 = h * 0.5;
    const etiquetaSonido = () => `Sonido: ${ajustes.sonido ? 'sí' : 'no'}`;
    const etiquetaMusica = () => `Música: ${ajustes.musica ? 'sí' : 'no'}`;
    const b: Boton[] = [];
    b.push(boton(this, w / 2, y0, ancho, 'Jugar', () => this.jugar(), u));
    b.push(boton(this, w / 2, y0 + 44 * u, ancho, 'Cómo se juega', () => this.ayuda(), u));
    b.push(
      boton(this, w / 2, y0 + 88 * u, ancho, etiquetaSonido(), () => {
        ajustes.sonido = !ajustes.sonido;
        sonido.setSonido(ajustes.sonido);
        guardarAjustes(ajustes);
        b[2]!.etiqueta.setText(etiquetaSonido());
      }, u),
    );
    b.push(
      boton(this, w / 2, y0 + 132 * u, ancho, etiquetaMusica(), () => {
        ajustes.musica = !ajustes.musica;
        sonido.setMusica(ajustes.musica);
        guardarAjustes(ajustes);
        b[3]!.etiqueta.setText(etiquetaMusica());
      }, u),
    );
    b[0]!.cont.setName('boton-jugar');
    this.soltarTeclado = navegarConTeclado(this, b);

    if (records.partidas > 0) {
      texto(
        this,
        w / 2,
        y0 + 176 * u,
        `Mejor noche: ${formatoTiempo(records.mejorTiempo)} · Nivel ${records.mejorNivel} · ${records.mejorBajas} bajas`,
        11 * u,
        CSS.apagado,
      ).setOrigin(0.5);
    }
    texto(this, w / 2, h - 14 * u, 'toriikarii · arte y sonido hechos en código · MIT', 9 * u, CSS.apagado).setOrigin(0.5, 1);
  }

  private jugar(): void {
    (this.registry.get('sonido') as Sonido).desbloquear();
    this.scene.start('Juego', {});
  }

  private ayuda(): void {
    this.soltarTeclado?.();
    const { width: w, height: h } = this.scale;
    const u = unidad(this);
    const ancho = Math.min(w - 24, 420 * u);
    const alto = Math.min(h - 24, 360 * u);
    const velo = this.add.rectangle(0, 0, w, h, 0x07050c, 0.6).setOrigin(0).setInteractive();
    const capa = this.add.container(0, 0, [velo, panel(this, w / 2, h / 2, ancho, alto, u)]);
    const top = h / 2 - alto / 2 + 22 * u;
    capa.add(texto(this, w / 2, top, 'Cómo se juega', 20 * u, CSS.ambarClaro, true).setOrigin(0.5, 0));
    const lineas = [
      'Muévete con WASD, las flechas o arrastrando el dedo. Tus armas atacan solas.',
      'Recoge el ámbar que dejan los enemigos para subir de nivel y elegir mejoras.',
      'El farol es tu vista y se gasta. Recoge aceite o el bosque te comerá a oscuras.',
      'A los cinco minutos llega un guardián. Si aguantas diez, amanece... pero algo despierta.',
      'Esc o P para pausar.',
    ];
    const t = texto(this, w / 2 - ancho / 2 + 24 * u, top + 40 * u, lineas.map((l) => `· ${l}`).join('\n\n'), 12 * u, CSS.hueso);
    t.setWordWrapWidth(ancho - 48 * u, true).setLineSpacing(2 * u);
    capa.add(t);
    const cerrar = boton(
      this,
      w / 2,
      h / 2 + alto / 2 - 30 * u,
      Math.min(ancho - 48 * u, 200 * u),
      'Entendido',
      () => {
        this.soltarTeclado?.();
        capa.destroy();
        this.construir();
      },
      u,
    );
    capa.add(cerrar.cont);
    this.soltarTeclado = navegarConTeclado(this, [cerrar]);
  }
}
