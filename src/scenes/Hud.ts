import Phaser from 'phaser';
import { COLOR, CSS } from '../art/paleta';
import type { Sonido } from '../audio/sonido';
import { Controles } from '../game/controles';
import { DURACION } from '../logic/enemigos';
import { formatoTiempo, guardarAjustes, leerAjustes } from '../logic/guardado';
import { definicion, type IdMejora, type Opcion } from '../logic/mejoras';
import type { Fin, Juego } from './Juego';
import { boton, navegarConTeclado, panel, texto, unidad, type Boton } from './ui';

/** Interfaz sobre la partida, sin zoom: barras, reloj, mejoras, pausa y final. */
export class Hud extends Phaser.Scene {
  private juego!: Juego;
  private u = 1;
  private g!: Phaser.GameObjects.Graphics;
  private reloj!: Phaser.GameObjects.Text;
  private nivel!: Phaser.GameObjects.Text;
  private bajas!: Phaser.GameObjects.Text;
  private jefeNombre!: Phaser.GameObjects.Text;
  private avisoTxt!: Phaser.GameObjects.Text;
  private iconos: Phaser.GameObjects.GameObject[] = [];
  private firmaInventario = '';
  private capa: Phaser.GameObjects.Container | null = null;
  private soltarTeclado: (() => void) | null = null;
  private avisoAceite = false;

  constructor() {
    super('Hud');
  }

  create(): void {
    this.juego = this.scene.get('Juego') as Juego;
    this.u = unidad(this);
    this.firmaInventario = '';
    this.capa = null;
    this.iconos = [];
    const u = this.u;
    this.g = this.add.graphics();
    this.reloj = texto(this, 0, 0, '0:00', 24 * u, CSS.hueso).setOrigin(0.5, 0);
    this.nivel = texto(this, 0, 0, 'Nv 1', 14 * u, CSS.ambarClaro).setOrigin(1, 0);
    this.bajas = texto(this, 0, 0, '0', 15 * u, CSS.gris).setOrigin(1, 0);
    this.jefeNombre = texto(this, 0, 0, '', 12 * u, CSS.sangre, true).setOrigin(0.5, 1).setVisible(false);
    this.avisoTxt = texto(this, 0, 0, '', 20 * u, CSS.ambarClaro, true).setOrigin(0.5).setAlpha(0);
    this.add.image(0, 0, 'icono-calavera').setScale(2 * u).setName('calavera');
    this.add.image(0, 0, 'icono-corazon').setScale(1.6 * u).setName('corazon');
    this.add.image(0, 0, 'icono-farol').setScale(1.5 * u).setName('farol');
    const pausaBtn = this.add.text(0, 0, 'II', { fontFamily: 'monospace', fontSize: `${Math.round(18 * u)}px`, color: CSS.hueso, fontStyle: 'bold' });
    pausaBtn.setName('pausa').setOrigin(1, 0).setPadding(8 * u, 4 * u, 8 * u, 4 * u).setInteractive({ useHandCursor: true });
    pausaBtn.on('pointerup', () => this.juego.pausar(true));

    this.juego.controles = new Controles(this.juego, this);
    this.input.keyboard?.on('keydown-ESC', () => this.alternarPausa());
    this.input.keyboard?.on('keydown-P', () => this.alternarPausa());

    this.juego.events.on('elegir', this.mostrarEleccion, this);
    this.juego.events.on('pausa', this.alPausar, this);
    this.juego.events.on('fin', this.mostrarFin, this);
    this.juego.events.on('aviso', this.aviso, this);
    this.scale.on('resize', this.colocar, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.juego.events.off('elegir', this.mostrarEleccion, this);
      this.juego.events.off('pausa', this.alPausar, this);
      this.juego.events.off('fin', this.mostrarFin, this);
      this.juego.events.off('aviso', this.aviso, this);
      this.scale.off('resize', this.colocar, this);
      this.juego.controles?.destruir();
      this.juego.controles = null;
      this.soltarTeclado?.();
    });
    this.colocar();
  }

  private alternarPausa(): void {
    if (this.juego.terminado || this.juego.eligiendo) return;
    this.juego.pausar(!this.juego.pausado);
  }

  private colocar(): void {
    this.u = unidad(this);
    const { width: w } = this.scale;
    const u = this.u;
    const m = Math.round(12 * u);
    this.reloj.setPosition(w / 2, m + 6 * u);
    this.nivel.setPosition(w - m, m + 6 * u);
    (this.children.getByName('pausa') as Phaser.GameObjects.Text).setPosition(w - m + 8 * u, m + 26 * u);
    (this.children.getByName('calavera') as Phaser.GameObjects.Image).setPosition(w - m - 64 * u, m + 64 * u);
    this.bajas.setPosition(w - m - 4 * u, m + 55 * u).setOrigin(1, 0);
    (this.children.getByName('calavera') as Phaser.GameObjects.Image).setPosition(this.bajas.x - this.bajas.width - 12 * u, m + 64 * u);
    (this.children.getByName('corazon') as Phaser.GameObjects.Image).setPosition(m + 7 * u, m + 22 * u);
    (this.children.getByName('farol') as Phaser.GameObjects.Image).setPosition(m + 7 * u, m + 42 * u);
    this.jefeNombre.setPosition(w / 2, m + 64 * u);
    this.avisoTxt.setPosition(w / 2, this.scale.height * 0.3);
    this.firmaInventario = '';
  }

  update(): void {
    const e = this.juego.estado;
    const { width: w, height: h } = this.scale;
    const u = this.u;
    const m = Math.round(12 * u);
    const g = this.g;
    g.clear();

    // Experiencia: barra fina a lo ancho de la pantalla.
    const altoXp = Math.round(6 * u);
    g.fillStyle(COLOR.fondo, 0.9).fillRect(0, 0, w, altoXp + 2);
    g.fillStyle(COLOR.ambar, 1).fillRect(0, 0, (w * e.xp) / e.xpNecesaria, altoXp);
    g.fillStyle(COLOR.ambarClaro, 1).fillRect(0, 0, (w * e.xp) / e.xpNecesaria, Math.max(1, Math.round(u)));
    this.nivel.setText(`Nv ${e.nivel}`);

    // Vida y aceite.
    const bx = m + 18 * u;
    const bw = Math.round(Math.min(150 * u, w * 0.32));
    const bh = Math.round(9 * u);
    this.barra(bx, m + 17 * u, bw, bh, e.vida / e.vidaMax, COLOR.sangre, COLOR.sangreClara);
    this.barra(bx, m + 37 * u, bw, bh, e.aceite / 100, COLOR.ambar, COLOR.ambarClaro);

    // Reloj: cuenta hacia el amanecer.
    const restante = DURACION - e.tiempo;
    this.reloj.setText(restante > 0 ? formatoTiempo(restante) : '¡Amanece!');
    this.reloj.setColor(restante < 60 && restante > 0 ? CSS.ambarClaro : CSS.hueso);
    this.bajas.setText(String(e.bajas));
    (this.children.getByName('calavera') as Phaser.GameObjects.Image).setPosition(this.bajas.x - this.bajas.width - 12 * u, this.bajas.y + this.bajas.height / 2);

    // Barra del jefe.
    if (e.jefe) {
      const jw = Math.min(w * 0.6, 420 * u);
      this.jefeNombre.setText(e.jefe.nombre).setVisible(true);
      this.barra(w / 2 - jw / 2, m + 68 * u, jw, Math.round(8 * u), e.jefe.vida / e.jefe.vidaMax, COLOR.violeta, 0xb98ad8);
    } else this.jefeNombre.setVisible(false);

    // Viñeta roja con poca vida.
    if (e.vida / e.vidaMax < 0.3 && !this.juego.terminado) {
      // Tres franjas de opacidad decreciente: un degradado escalonado, al estilo pixel art.
      const a = 0.16 + Math.sin(this.time.now / 180) * 0.06;
      const paso = Math.round(Math.min(w, h) * 0.022);
      for (let i = 0; i < 3; i++) {
        const o = i * paso;
        g.fillStyle(COLOR.sangre, a * (1 - i * 0.33));
        g.fillRect(o, o, w - 2 * o, paso).fillRect(o, h - o - paso, w - 2 * o, paso);
        g.fillRect(o, o + paso, paso, h - 2 * o - 2 * paso).fillRect(w - o - paso, o + paso, paso, h - 2 * o - 2 * paso);
      }
    }

    if (e.aceite < 15 && !this.avisoAceite) {
      this.avisoAceite = true;
      this.aviso('El farol se apaga');
    } else if (e.aceite > 30) this.avisoAceite = false;

    this.dibujarInventario(e.inventario);
  }

  private barra(x: number, y: number, w: number, h: number, p: number, color: number, brillo: number): void {
    const g = this.g;
    const b = Math.max(1, Math.round(this.u));
    g.fillStyle(0x0b0a12, 1).fillRect(x - b, y - b, w + 2 * b, h + 2 * b);
    g.fillStyle(COLOR.panel, 1).fillRect(x, y, w, h);
    const lleno = Math.max(0, Math.min(1, p)) * w;
    g.fillStyle(color, 1).fillRect(x, y, lleno, h);
    g.fillStyle(brillo, 1).fillRect(x, y, lleno, Math.max(1, Math.round(h / 3)));
  }

  private dibujarInventario(inv: Juego['estado']['inventario']): void {
    const firma = JSON.stringify(inv);
    if (firma === this.firmaInventario) return;
    this.firmaInventario = firma;
    for (const o of this.iconos) o.destroy();
    this.iconos = [];
    const u = this.u;
    const m = Math.round(12 * u);
    const tam = Math.round(22 * u);
    const y0 = this.scale.height - m - tam;
    const fila = (ids: [string, number][], y: number) =>
      ids.forEach(([id, nivel], i) => {
        const x = m + i * (tam + 6 * u) + tam / 2;
        const fondo = this.add.rectangle(x, y + tam / 2, tam, tam, COLOR.panel, 0.85).setStrokeStyle(Math.max(1, Math.round(u)), COLOR.borde);
        const ic = this.add.image(x, y + tam / 2, `icono-${id}`);
        ic.setScale(Math.min((tam - 6 * u) / ic.width, (tam - 6 * u) / ic.height));
        const n = texto(this, x + tam / 2 - 2 * u, y + tam - 1 * u, String(nivel), 9 * u, CSS.ambarClaro).setOrigin(1, 1);
        this.iconos.push(fondo, ic, n);
      });
    fila(Object.entries(inv.armas) as [string, number][], y0 - tam - 6 * u);
    fila(Object.entries(inv.pasivas) as [string, number][], y0);
  }

  private aviso(msg: string): void {
    this.tweens.killTweensOf(this.avisoTxt);
    this.avisoTxt.setText(msg).setAlpha(0).setScale(0.9);
    this.tweens.add({ targets: this.avisoTxt, alpha: 1, scale: 1, duration: 250, yoyo: true, hold: 1600, ease: 'Quad.Out' });
  }

  // ── Capas modales ──────────────────────────────────────────────

  private cerrarCapa(): void {
    this.soltarTeclado?.();
    this.soltarTeclado = null;
    this.capa?.destroy();
    this.capa = null;
  }

  private abrirCapa(): Phaser.GameObjects.Container {
    this.cerrarCapa();
    const { width: w, height: h } = this.scale;
    const velo = this.add.rectangle(0, 0, w, h, 0x07050c, 0.72).setOrigin(0).setInteractive();
    this.capa = this.add.container(0, 0, [velo]).setDepth(100);
    return this.capa;
  }

  private mostrarEleccion(opciones: Opcion[]): void {
    const capa = this.abrirCapa();
    const { width: w, height: h } = this.scale;
    const u = this.u;
    const ancho = Math.min(w - 32, 380 * u);
    const altoTarjeta = Math.round(70 * u);
    const sep = Math.round(10 * u);
    const total = opciones.length * altoTarjeta + (opciones.length - 1) * sep;
    const y0 = h / 2 - total / 2 + 18 * u;
    capa.add(texto(this, w / 2, y0 - 34 * u, '¡Subes de nivel!', 22 * u, CSS.ambarClaro, true).setOrigin(0.5, 1));
    capa.add(texto(this, w / 2, y0 - 12 * u, 'Elige una mejora', 12 * u, CSS.gris).setOrigin(0.5, 1));

    const tarjetas: Boton[] = opciones.map((op, i) => {
      const y = y0 + i * (altoTarjeta + sep) + altoTarjeta / 2;
      return this.tarjeta(capa, w / 2, y, ancho, altoTarjeta, op, i + 1, () => {
        this.cerrarCapa();
        this.juego.elegir(op.id as IdMejora);
      });
    });
    this.soltarTeclado = navegarConTeclado(this, tarjetas);
    const numeros = (ev: KeyboardEvent) => {
      const n = Number(ev.key);
      if (n >= 1 && n <= tarjetas.length) tarjetas[n - 1]!.pulsar();
    };
    this.input.keyboard?.on('keydown', numeros);
    const soltar = this.soltarTeclado;
    this.soltarTeclado = () => {
      soltar();
      this.input.keyboard?.off('keydown', numeros);
    };
    capa.setAlpha(0);
    this.tweens.add({ targets: capa, alpha: 1, duration: 160 });
  }

  private tarjeta(
    capa: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    op: Opcion,
    numero: number,
    alElegir: () => void,
  ): Boton {
    const u = this.u;
    const fondo = this.add.rectangle(x, y, w, h, COLOR.panel).setStrokeStyle(Math.max(2, Math.round(2 * u)), COLOR.borde);
    const ic = this.add.image(x - w / 2 + 28 * u, y, `icono-${op.id}`);
    ic.setScale(Math.min((34 * u) / ic.width, (34 * u) / ic.height));
    const etiqueta =
      op.tipo === 'consumible' ? 'Al momento' : op.nivel === 1 ? (op.tipo === 'arma' ? 'Arma nueva' : 'Nueva') : `Nivel ${op.nivel}`;
    const tx = x - w / 2 + 54 * u;
    const nombre = texto(this, tx, y - h / 2 + 9 * u, op.nombre, 14 * u, CSS.hueso, true);
    const tag = texto(this, x + w / 2 - 10 * u, y - h / 2 + 10 * u, etiqueta, 11 * u, op.nivel === 1 ? CSS.musgo : CSS.ambar).setOrigin(1, 0);
    const desc = texto(this, tx, y - h / 2 + 30 * u, definicion(op.id).niveles[op.nivel - 1] ?? op.texto, 11 * u, CSS.gris);
    desc.setWordWrapWidth(w - 64 * u, true);
    const num = texto(this, x - w / 2 + 6 * u, y - h / 2 + 4 * u, String(numero), 9 * u, CSS.apagado);
    capa.add([fondo, ic, nombre, tag, desc, num]);
    const resaltar = (on: boolean) => {
      fondo.setStrokeStyle(Math.max(2, Math.round(2 * u)), on ? COLOR.ambar : COLOR.borde).setFillStyle(on ? 0x221c2c : COLOR.panel);
      nombre.setColor(on ? CSS.ambarClaro : CSS.hueso);
    };
    const pulsar = () => {
      (this.registry.get('sonido') as Sonido).reproducir('boton');
      alElegir();
    };
    fondo.setInteractive({ useHandCursor: true });
    fondo.on('pointerover', () => resaltar(true));
    fondo.on('pointerout', () => resaltar(false));
    fondo.on('pointerup', pulsar);
    return { cont: capa, etiqueta: nombre, fondo, pulsar, resaltar };
  }

  private alPausar(on: boolean): void {
    if (!on) {
      this.cerrarCapa();
      return;
    }
    const capa = this.abrirCapa();
    const { width: w, height: h } = this.scale;
    const u = this.u;
    const sonido = this.registry.get('sonido') as Sonido;
    const ajustes = leerAjustes();
    const ancho = Math.min(w - 48, 260 * u);
    capa.add(panel(this, w / 2, h / 2, ancho + 40 * u, 250 * u, u));
    capa.add(texto(this, w / 2, h / 2 - 95 * u, 'Pausa', 24 * u, CSS.ambarClaro, true).setOrigin(0.5));
    const etiquetaSonido = () => `Sonido: ${ajustes.sonido ? 'sí' : 'no'}`;
    const etiquetaMusica = () => `Música: ${ajustes.musica ? 'sí' : 'no'}`;
    const b: Boton[] = [];
    b.push(boton(this, w / 2, h / 2 - 45 * u, ancho, 'Continuar', () => this.juego.pausar(false), u));
    b.push(
      boton(this, w / 2, h / 2 + 0 * u, ancho, etiquetaSonido(), () => {
        ajustes.sonido = !ajustes.sonido;
        sonido.setSonido(ajustes.sonido);
        guardarAjustes(ajustes);
        b[1]!.etiqueta.setText(etiquetaSonido());
      }, u),
    );
    b.push(
      boton(this, w / 2, h / 2 + 45 * u, ancho, etiquetaMusica(), () => {
        ajustes.musica = !ajustes.musica;
        sonido.setMusica(ajustes.musica);
        guardarAjustes(ajustes);
        b[2]!.etiqueta.setText(etiquetaMusica());
      }, u),
    );
    b.push(boton(this, w / 2, h / 2 + 90 * u, ancho, 'Abandonar', () => this.irAlMenu(), u));
    for (const x of b) capa.add(x.cont);
    this.soltarTeclado = navegarConTeclado(this, b);
  }

  private mostrarFin(fin: Fin): void {
    const capa = this.abrirCapa();
    const { width: w, height: h } = this.scale;
    const u = this.u;
    const r = fin.resultado;
    const ancho = Math.min(w - 32, 340 * u);
    capa.add(panel(this, w / 2, h / 2, ancho, 330 * u, u));
    capa.add(
      texto(this, w / 2, h / 2 - 125 * u, r.victoria ? 'Amaneció' : 'Te devoró la noche', 24 * u, r.victoria ? CSS.ambarClaro : CSS.sangre, true).setOrigin(0.5),
    );
    capa.add(
      texto(this, w / 2, h / 2 - 98 * u, r.victoria ? 'El Ciervo de Ceniza cayó con la primera luz.' : 'El bosque guarda otra lámpara apagada.', 11 * u, CSS.gris)
        .setOrigin(0.5)
        .setWordWrapWidth(ancho - 32 * u, true)
        .setAlign('center'),
    );
    const filas: [string, string, keyof Fin['records']][] = [
      ['Tiempo', formatoTiempo(r.tiempo), 'mejorTiempo'],
      ['Nivel', String(r.nivel), 'mejorNivel'],
      ['Bajas', String(r.bajas), 'mejorBajas'],
    ];
    filas.forEach(([k, v, clave], i) => {
      const y = h / 2 - 55 * u + i * 26 * u;
      capa.add(texto(this, w / 2 - ancho / 2 + 34 * u, y, k, 14 * u, CSS.gris));
      capa.add(texto(this, w / 2 + ancho / 2 - 34 * u, y, v, 15 * u, CSS.hueso).setOrigin(1, 0));
      if (fin.nuevos.includes(clave)) capa.add(texto(this, w / 2 + 6 * u, y + 2 * u, 'récord', 10 * u, CSS.ambarClaro, true).setOrigin(0.5, 0));
    });
    capa.add(
      texto(this, w / 2, h / 2 + 30 * u, `Partidas: ${fin.records.partidas} · Amaneceres: ${fin.records.victorias}`, 10 * u, CSS.apagado).setOrigin(0.5),
    );
    const b = [
      boton(this, w / 2, h / 2 + 72 * u, ancho - 60 * u, 'Otra noche', () => this.reiniciar(), u),
      boton(this, w / 2, h / 2 + 116 * u, ancho - 60 * u, 'Menú', () => this.irAlMenu(), u),
    ];
    for (const x of b) capa.add(x.cont);
    this.soltarTeclado = navegarConTeclado(this, b);
    capa.setAlpha(0);
    this.tweens.add({ targets: capa, alpha: 1, duration: 400 });
  }

  private reiniciar(): void {
    this.cerrarCapa();
    // Reiniciar la partida relanza también esta escena.
    this.juego.scene.restart({});
  }

  private irAlMenu(): void {
    this.cerrarCapa();
    this.scene.stop('Juego');
    if (this.scene.get('Menu')) this.scene.start('Menu');
    else this.scene.stop();
  }
}
