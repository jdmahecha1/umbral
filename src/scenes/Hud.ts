import Phaser from 'phaser';
import { COLOR, CSS } from '../art/paleta';
import type { Sonido } from '../audio/sonido';
import { Controles } from '../game/controles';
import { DURACION } from '../logic/enemigos';
import { formatoTiempo, guardarAjustes, leerAjustes, leerRecords } from '../logic/guardado';
import type { IdArma, IdMejora, Opcion } from '../logic/mejoras';
import { ARTICULOS, type IdArticulo } from '../logic/tienda';
import type { Estado, Fin, Juego, Tienda } from './Juego';
import { boton, navegarConTeclado, panel, texto, unidad, type Boton, type Guardia } from './ui';

/** Tiempo en que un panel recién abierto no acepta clics ni teclas (evita elegir sin querer). */
const BLOQUEO_MS = 700;

/** Mira pixelada para apuntar con el ratón. */
const MIRA =
  'url("data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="23" height="23" shape-rendering="crispEdges">' +
      '<g fill="#0b0a12"><rect x="10" y="0" width="3" height="8"/><rect x="10" y="15" width="3" height="8"/><rect x="0" y="10" width="8" height="3"/><rect x="15" y="10" width="8" height="3"/></g>' +
      '<g fill="#ffd77a"><rect x="11" y="1" width="1" height="6"/><rect x="11" y="16" width="1" height="6"/><rect x="1" y="11" width="6" height="1"/><rect x="16" y="11" width="6" height="1"/><rect x="11" y="11" width="1" height="1"/></g>' +
      '</svg>',
  ) +
  '") 11 11, crosshair';

/** Interfaz sobre la partida, sin zoom: barras, reloj, mejoras, tienda, pausa y final. */
export class Hud extends Phaser.Scene {
  private juego!: Juego;
  private u = 1;
  private g!: Phaser.GameObjects.Graphics;
  private reloj!: Phaser.GameObjects.Text;
  private nivel!: Phaser.GameObjects.Text;
  private bajas!: Phaser.GameObjects.Text;
  private monedas!: Phaser.GameObjects.Text;
  private jefeNombre!: Phaser.GameObjects.Text;
  private avisoTxt!: Phaser.GameObjects.Text;
  private iconos: Phaser.GameObjects.GameObject[] = [];
  private ranurasArmas: { id: IdArma; x: number; y: number; tam: number }[] = [];
  private firmaInventario = '';
  private capa: Phaser.GameObjects.Container | null = null;
  private soltarTeclado: (() => void) | null = null;
  private avisoAceite = false;
  /** Momento (performance.now) en que se abrió el panel actual. */
  private abiertaEn = 0;

  /**
   * Un clic cuenta solo si el panel lleva abierto un momento y si el botón se
   * presionó DESPUÉS de abrirse: soltar el clic con el que se venía atacando no elige nada.
   */
  private readonly guardia: Guardia = (p) =>
    performance.now() - this.abiertaEn >= BLOQUEO_MS && (!p || p.downTime >= this.abiertaEn);

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
    this.monedas = texto(this, 0, 0, '0', 13 * u, CSS.hueso).setOrigin(0, 0.5);
    this.jefeNombre = texto(this, 0, 0, '', 12 * u, CSS.sangre, true).setOrigin(0.5, 1).setVisible(false);
    this.avisoTxt = texto(this, 0, 0, '', 20 * u, CSS.ambarClaro, 'titulo').setOrigin(0.5).setAlpha(0);
    this.add.image(0, 0, 'icono-calavera').setScale(2 * u).setName('calavera');
    this.add.image(0, 0, 'icono-corazon').setScale(1.6 * u).setName('corazon');
    this.add.image(0, 0, 'icono-farol').setScale(1.5 * u).setName('farol');
    this.add.image(0, 0, 'icono-moneda').setScale(1.8 * u).setName('moneda');
    const pausaBtn = this.add.text(0, 0, 'II', { fontFamily: 'monospace', fontSize: `${Math.round(18 * u)}px`, color: CSS.hueso, fontStyle: 'bold' });
    pausaBtn.setName('pausa').setOrigin(1, 0).setPadding(8 * u, 4 * u, 8 * u, 4 * u).setInteractive({ useHandCursor: true });
    pausaBtn.on('pointerup', () => this.juego.pausar(true));

    this.juego.controles = new Controles(this.juego, this);
    this.input.setDefaultCursor(MIRA);
    this.input.keyboard?.on('keydown-ESC', () => this.alternarPausa());
    this.input.keyboard?.on('keydown-P', () => this.alternarPausa());

    this.juego.events.on('elegir', this.mostrarEleccion, this);
    this.juego.events.on('tienda', this.mostrarTienda, this);
    this.juego.events.on('pausa', this.alPausar, this);
    this.juego.events.on('fin', this.mostrarFin, this);
    this.juego.events.on('aviso', this.aviso, this);
    this.scale.on('resize', this.colocar, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.juego.events.off('elegir', this.mostrarEleccion, this);
      this.juego.events.off('tienda', this.mostrarTienda, this);
      this.juego.events.off('pausa', this.alPausar, this);
      this.juego.events.off('fin', this.mostrarFin, this);
      this.juego.events.off('aviso', this.aviso, this);
      this.scale.off('resize', this.colocar, this);
      this.juego.controles?.destruir();
      this.juego.controles = null;
      this.soltarTeclado?.();
      this.input.setDefaultCursor('default');
    });
    this.colocar();
    // En las primeras partidas se avisa de que existe el ataque automático.
    if (!leerAjustes().autoataque && leerRecords().partidas < 3) {
      const tactil = this.sys.game.device.input.touch;
      this.time.delayedCall(2500, () =>
        this.consejo(
          tactil
            ? 'Consejo: si no quieres tocar para atacar, activa el "Ataque automático" en la pausa (botón II).'
            : 'Consejo: si no quieres hacer clic todo el rato, activa el "Ataque automático" en la pausa (Esc).',
        ),
      );
    }
  }

  /** Mensaje breve en la parte baja de la pantalla que aparece y se desvanece solo. */
  private consejo(msg: string): void {
    const { width: w, height: h } = this.scale;
    const u = this.u;
    const t = texto(this, w / 2, h - 90 * u, msg, 12 * u, CSS.ambarClaro)
      .setOrigin(0.5, 1)
      .setWordWrapWidth(Math.min(w - 32, 520 * u), true)
      .setAlign('center')
      .setAlpha(0)
      .setDepth(50);
    this.tweens.add({ targets: t, alpha: 1, duration: 400, yoyo: true, hold: 6500, onComplete: () => t.destroy() });
  }

  private alternarPausa(): void {
    const j = this.juego;
    if (j.terminado || j.eligiendo || j.enTienda) return;
    j.pausar(!j.pausado);
  }

  private obj<T extends Phaser.GameObjects.GameObject>(nombre: string): T {
    return this.children.getByName(nombre) as T;
  }

  private colocar(): void {
    this.u = unidad(this);
    const { width: w } = this.scale;
    const u = this.u;
    const m = Math.round(12 * u);
    this.reloj.setPosition(w / 2, m + 6 * u);
    this.nivel.setPosition(w - m, m + 6 * u);
    this.obj<Phaser.GameObjects.Text>('pausa').setPosition(w - m + 8 * u, m + 26 * u);
    this.bajas.setPosition(w - m - 4 * u, m + 55 * u);
    this.obj<Phaser.GameObjects.Image>('corazon').setPosition(m + 7 * u, m + 22 * u);
    this.obj<Phaser.GameObjects.Image>('farol').setPosition(m + 7 * u, m + 42 * u);
    this.obj<Phaser.GameObjects.Image>('moneda').setPosition(m + 7 * u, m + 62 * u);
    this.monedas.setPosition(m + 18 * u, m + 62 * u);
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
    const pXp = Math.min(1, e.xp / e.xpNecesaria);
    g.fillStyle(COLOR.fondo, 0.9).fillRect(0, 0, w, altoXp + 2);
    g.fillStyle(COLOR.ambar, 1).fillRect(0, 0, w * pXp, altoXp);
    g.fillStyle(COLOR.ambarClaro, 1).fillRect(0, 0, w * pXp, Math.max(1, Math.round(u)));
    this.nivel.setText(`Nv ${e.nivel}`);

    // Vida, aceite y monedas.
    const bx = m + 18 * u;
    const bw = Math.round(Math.min(150 * u, w * 0.32));
    const bh = Math.round(9 * u);
    this.barra(bx, m + 17 * u, bw, bh, e.vida / e.vidaMax, COLOR.sangre, COLOR.sangreClara);
    this.barra(bx, m + 37 * u, bw, bh, e.aceite / 100, COLOR.ambar, COLOR.ambarClaro);
    this.monedas.setText(String(e.monedas));

    // Reloj: cuenta hacia el amanecer.
    const restante = DURACION - e.tiempo;
    this.reloj.setText(restante > 0 ? formatoTiempo(restante) : '¡Amanece!');
    this.reloj.setColor(restante < 60 && restante > 0 ? CSS.ambarClaro : CSS.hueso);
    this.bajas.setText(String(e.bajas));
    this.obj<Phaser.GameObjects.Image>('calavera').setPosition(this.bajas.x - this.bajas.width - 12 * u, this.bajas.y + this.bajas.height / 2);

    // Barra del jefe.
    if (e.jefe) {
      const jw = Math.min(w * 0.6, 420 * u);
      this.jefeNombre.setText(e.jefe.nombre).setVisible(true);
      this.barra(w / 2 - jw / 2, m + 68 * u, jw, Math.round(8 * u), e.jefe.vida / e.jefe.vidaMax, COLOR.violeta, 0xb98ad8);
    } else this.jefeNombre.setVisible(false);

    // Viñeta roja con poca vida: tres franjas de opacidad decreciente.
    if (e.vida / e.vidaMax < 0.3 && !this.juego.terminado) {
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
      this.aviso('¡El farol se apaga! Busca aceite');
    } else if (e.aceite > 30) this.avisoAceite = false;

    this.dibujarInventario(e);
    // Recarga de cada arma: la parte oscura baja a medida que el arma se prepara.
    for (const r of this.ranurasArmas) {
      const c = e.cargas[r.id] ?? 1;
      if (c < 1) g.fillStyle(0x07050c, 0.7).fillRect(r.x - r.tam / 2, r.y - r.tam / 2, r.tam, r.tam * (1 - c));
    }
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

  private dibujarInventario(e: Estado): void {
    const firma = JSON.stringify([e.inventario, e.reliquias, this.scale.width, this.scale.height]);
    if (firma === this.firmaInventario) return;
    this.firmaInventario = firma;
    for (const o of this.iconos) o.destroy();
    this.iconos = [];
    this.ranurasArmas = [];
    const u = this.u;
    const m = Math.round(12 * u);
    const tam = Math.round(22 * u);
    const sep = Math.round(6 * u);
    // Abajo a la izquierda: armas, pasivas y, encima, las reliquias más pequeñas.
    const yPasivas = this.scale.height - m - tam;
    const yArmas = yPasivas - tam - sep;
    const ranura = (id: string, x: number, y: number, t: number, nivel?: number) => {
      const fondo = this.add.rectangle(x, y, t, t, COLOR.panel, 0.85).setStrokeStyle(Math.max(1, Math.round(u)), COLOR.borde);
      const ic = this.add.image(x, y, `icono-${id}`);
      ic.setScale(Math.min((t - 6 * u) / ic.width, (t - 6 * u) / ic.height));
      this.iconos.push(fondo, ic);
      if (nivel !== undefined) this.iconos.push(texto(this, x + t / 2 - 2 * u, y + t / 2 - u, String(nivel), 9 * u, CSS.ambarClaro).setOrigin(1, 1));
    };
    (Object.entries(e.inventario.armas) as [IdArma, number][]).forEach(([id, n], i) => {
      const x = m + i * (tam + sep) + tam / 2;
      ranura(id, x, yArmas + tam / 2, tam, n);
      this.ranurasArmas.push({ id, x, y: yArmas + tam / 2, tam });
    });
    Object.entries(e.inventario.pasivas).forEach(([id, n], i) => ranura(id, m + i * (tam + sep) + tam / 2, yPasivas + tam / 2, tam, n));
    const chica = Math.round(16 * u);
    e.reliquias.forEach((id, i) => ranura(id, m + i * (chica + 4 * u) + chica / 2, yArmas - sep - chica / 2, chica));
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
    this.input.setDefaultCursor(MIRA);
  }

  private abrirCapa(): Phaser.GameObjects.Container {
    this.cerrarCapa();
    this.input.setDefaultCursor('default');
    this.abiertaEn = performance.now();
    const { width: w, height: h } = this.scale;
    const velo = this.add.rectangle(0, 0, w, h, 0x07050c, 0.78).setOrigin(0).setInteractive();
    this.capa = this.add.container(0, 0, [velo]).setDepth(100);
    return this.capa;
  }

  /**
   * Tarjeta seleccionable con ícono, título, etiqueta, una frase de qué hace y
   * líneas de detalle. Su alto se ajusta al texto. Devuelve el botón y su alto.
   */
  private tarjeta(
    capa: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    datos: { icono: string; titulo: string; etiqueta: string; colorEtiqueta: string; que: string; detalle: string[]; numero?: number; apagada?: boolean },
    alPulsar: () => void,
  ): { boton: Boton; alto: number; grupo: Phaser.GameObjects.Container } {
    const u = this.u;
    const pad = 10 * u;
    const tx = x - w / 2 + 54 * u;
    const ancho = w - 64 * u;
    const titulo = texto(this, tx, 0, datos.titulo, 14 * u, CSS.hueso, true);
    const etiqueta = texto(this, x + w / 2 - pad, 0, datos.etiqueta, 11 * u, datos.colorEtiqueta).setOrigin(1, 0);
    titulo.setWordWrapWidth(Math.max(60, ancho - etiqueta.width - 8 * u), true);
    const que = texto(this, tx, 0, datos.que, 11 * u, CSS.gris).setWordWrapWidth(ancho, true);
    const detalle = datos.detalle.length
      ? texto(this, tx, 0, datos.detalle.join('\n'), 11 * u, CSS.ambarClaro).setWordWrapWidth(ancho, true).setLineSpacing(1 * u)
      : null;
    const alto = Math.max(64 * u, pad + titulo.height + 4 * u + que.height + (detalle ? 4 * u + detalle.height : 0) + pad);
    const top = y;
    const fondo = this.add.rectangle(x, top + alto / 2, w, alto, COLOR.panel).setStrokeStyle(Math.max(2, Math.round(2 * u)), COLOR.borde);
    titulo.setY(top + pad);
    etiqueta.setY(top + pad + 2 * u);
    que.setY(titulo.y + titulo.height + 4 * u);
    detalle?.setY(que.y + que.height + 4 * u);
    const ic = this.add.image(x - w / 2 + 28 * u, top + alto / 2, `icono-${datos.icono}`);
    ic.setScale(Math.min((32 * u) / ic.width, (32 * u) / ic.height));
    const piezas: Phaser.GameObjects.GameObject[] = [fondo, ic, titulo, etiqueta, que];
    if (detalle) piezas.push(detalle);
    if (datos.numero) piezas.push(texto(this, x - w / 2 + 5 * u, top + 3 * u, String(datos.numero), 9 * u, CSS.apagado));
    const grupo = this.add.container(0, 0, piezas);
    capa.add(grupo);
    if (datos.apagada) for (const p of piezas) (p as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(0.55);
    const resaltar = (on: boolean) => {
      fondo.setStrokeStyle(Math.max(2, Math.round(2 * u)), on ? COLOR.ambar : COLOR.borde).setFillStyle(on ? 0x221c2c : COLOR.panel);
      titulo.setColor(on ? CSS.ambarClaro : CSS.hueso);
    };
    const pulsar = () => {
      (this.registry.get('sonido') as Sonido).reproducir('boton');
      alPulsar();
    };
    fondo.setInteractive({ useHandCursor: true });
    fondo.on('pointerover', () => resaltar(true));
    fondo.on('pointerout', () => resaltar(false));
    fondo.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.guardia(p)) pulsar();
    });
    return { boton: { cont: capa, etiqueta: titulo, fondo, pulsar, resaltar }, alto, grupo };
  }

  private mostrarEleccion(opciones: Opcion[]): void {
    const capa = this.abrirCapa();
    const { width: w, height: h } = this.scale;
    const u = this.u;
    const ancho = Math.min(w - 24, 420 * u);
    const sep = Math.round(10 * u);
    const tituloY = Math.max(16 * u, h * 0.06);
    capa.add(texto(this, w / 2, tituloY, '¡Subes de nivel!', 22 * u, CSS.ambarClaro, 'titulo').setOrigin(0.5, 0));
    capa.add(texto(this, w / 2, tituloY + 30 * u, 'Elige una mejora (clic, toque o teclas 1, 2 y 3)', 12 * u, CSS.gris).setOrigin(0.5, 0));

    let y = tituloY + 58 * u;
    const tarjetas: Boton[] = [];
    const grupos: Phaser.GameObjects.Container[] = [];
    opciones.forEach((op, i) => {
      const etiqueta =
        op.tipo === 'consumible' ? 'Al momento' : op.nivel === 1 ? (op.tipo === 'arma' ? 'Arma nueva' : 'Nueva') : `Nivel ${op.nivel} de 5`;
      const { boton: b, alto, grupo } = this.tarjeta(
        capa,
        w / 2,
        y,
        ancho,
        { icono: op.id, titulo: op.nombre, etiqueta, colorEtiqueta: op.nivel === 1 ? CSS.musgo : CSS.ambar, que: op.que, detalle: op.cambios, numero: i + 1 },
        () => {
          this.cerrarCapa();
          this.juego.elegir(op.id as IdMejora);
        },
      );
      tarjetas.push(b);
      grupos.push(grupo);
      y += alto + sep;
    });
    // Si no cabe en pantallas muy bajas, se reduce todo el bloque.
    const alto = y - sep;
    if (alto > h - 8) capa.setScale((h - 8) / alto).setPosition((w - w * ((h - 8) / alto)) / 2, 0);
    this.soltarTeclado = navegarConTeclado(this, tarjetas, 0, { guardia: this.guardia, espacio: false });
    const numeros = (ev: KeyboardEvent) => {
      const n = Number(ev.key);
      if (ev.repeat || !this.guardia()) return;
      if (n >= 1 && n <= tarjetas.length) tarjetas[n - 1]!.pulsar();
    };
    this.input.keyboard?.on('keydown', numeros);
    const soltar = this.soltarTeclado;
    this.soltarTeclado = () => {
      soltar();
      this.input.keyboard?.off('keydown', numeros);
    };
    this.entrada(capa, grupos);
  }

  /**
   * Las tarjetas entran deslizándose y medio apagadas; cuando ya se pueden elegir,
   * se encienden. Así se ve que el panel acaba de aparecer y no se elige nada sin querer.
   */
  private entrada(capa: Phaser.GameObjects.Container, grupos: Phaser.GameObjects.Container[]): void {
    capa.setAlpha(0);
    this.tweens.add({ targets: capa, alpha: 1, duration: 150 });
    grupos.forEach((g, i) => {
      g.setAlpha(0).setY(14 * this.u);
      this.tweens.add({ targets: g, alpha: 0.45, y: 0, delay: 60 + i * 90, duration: 220, ease: 'Quad.Out' });
    });
    this.time.delayedCall(BLOQUEO_MS, () => {
      if (!this.capa || this.capa !== capa) return;
      for (const g of grupos) this.tweens.add({ targets: g, alpha: 1, duration: 140 });
    });
  }

  // ── La tregua del mercader ─────────────────────────────────────

  private mostrarTienda(datos: Tienda, mensaje = '', redibujar = false): void {
    const capa = this.abrirCapa();
    // Tras una compra se redibuja: un bloqueo breve evita comprar dos veces con un doble clic.
    if (redibujar) this.abiertaEn = performance.now() - BLOQUEO_MS + 250;
    const gruposTienda: Phaser.GameObjects.Container[] = [];
    const { width: w, height: h } = this.scale;
    const u = this.u;
    const columnas = w >= 760 * Math.min(u, 1.6) ? 2 : 1;
    const anchoTotal = Math.min(w - 24, (columnas === 2 ? 760 : 420) * u);
    const sep = Math.round(10 * u);
    const anchoTarjeta = (anchoTotal - sep * (columnas - 1)) / columnas;
    let y = Math.max(14 * u, h * 0.04);
    capa.add(texto(this, w / 2, y, 'La tregua del mercader', 22 * u, CSS.ambarClaro, 'titulo').setOrigin(0.5, 0));
    y += 30 * u;
    capa.add(
      texto(this, w / 2, y, 'El tiempo se detiene. Compra con tus monedas: se pierden al terminar la partida.', 12 * u, CSS.gris)
        .setOrigin(0.5, 0)
        .setWordWrapWidth(anchoTotal, true)
        .setAlign('center'),
    );
    y += 34 * u;
    const bolsa = this.add.image(w / 2 - 30 * u, y + 8 * u, 'icono-moneda').setScale(2 * u);
    capa.add([bolsa, texto(this, w / 2 - 18 * u, y + 8 * u, `${datos.monedas} monedas`, 14 * u, CSS.hueso).setOrigin(0, 0.5)]);
    y += 26 * u;

    const elementos: Boton[] = [];
    const x0 = w / 2 - anchoTotal / 2;
    let altoFila = 0;
    datos.ofertas.forEach((o, i) => {
      const art = ARTICULOS[o.id];
      const col = i % columnas;
      if (col === 0 && i > 0) {
        y += altoFila + sep;
        altoFila = 0;
      }
      const alcanza = datos.monedas >= o.precio;
      const { boton: b, alto, grupo } = this.tarjeta(
        capa,
        x0 + col * (anchoTarjeta + sep) + anchoTarjeta / 2,
        y,
        anchoTarjeta,
        {
          icono: o.id,
          titulo: art.nombre,
          etiqueta: `${o.precio} monedas`,
          colorEtiqueta: alcanza ? CSS.ambarClaro : CSS.sangre,
          que: art.texto,
          detalle: [art.tipo === 'reliquia' ? 'Reliquia: dura hasta el final de esta partida' : 'Efecto inmediato'],
          apagada: !alcanza,
        },
        () => this.comprar(o.id as IdArticulo),
      );
      elementos.push(b);
      gruposTienda.push(grupo);
      altoFila = Math.max(altoFila, alto);
    });
    if (datos.ofertas.length === 0) {
      capa.add(texto(this, w / 2, y + 10 * u, 'El mercader ya no tiene nada más para ti.', 12 * u, CSS.gris).setOrigin(0.5, 0));
      altoFila = 30 * u;
    }
    y += altoFila + sep;
    const aviso = texto(this, w / 2, y, mensaje, 12 * u, mensaje.startsWith('Te faltan') ? CSS.sangre : CSS.musgo).setOrigin(0.5, 0);
    capa.add(aviso);
    y += 24 * u;
    const anchoBoton = Math.min(anchoTotal, 280 * u);
    const cambiar = boton(this, w / 2, y + 17 * u, anchoBoton, `Cambiar artículos (${datos.precioCambiar} monedas)`, () => this.cambiar(), u, this.guardia);
    const seguir = boton(this, w / 2, y + 17 * u + 44 * u, anchoBoton, 'Seguir la noche', () => {
      this.cerrarCapa();
      this.juego.salirTienda();
    }, u, this.guardia);
    capa.add([cambiar.cont, seguir.cont]);
    elementos.push(cambiar, seguir);
    const altoTotal = y + 17 * u + 44 * u + 24 * u;
    if (altoTotal > h) capa.setScale(h / altoTotal).setPosition((w - w * (h / altoTotal)) / 2, 0);
    this.soltarTeclado = navegarConTeclado(this, elementos, elementos.length - 1, { guardia: this.guardia, espacio: false });
    if (!redibujar) this.entrada(capa, gruposTienda);
  }

  private comprar(id: IdArticulo): void {
    const r = this.juego.comprar(id);
    this.mostrarTienda(this.juego.datosTienda, r.mensaje, true);
  }

  private cambiar(): void {
    const r = this.juego.cambiarArticulos();
    this.mostrarTienda(this.juego.datosTienda, r.mensaje, true);
  }

  // ── Pausa y final ──────────────────────────────────────────────

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
    capa.add(panel(this, w / 2, h / 2, ancho + 40 * u, 300 * u, u));
    capa.add(texto(this, w / 2, h / 2 - 120 * u, 'Pausa', 24 * u, CSS.ambarClaro, 'titulo').setOrigin(0.5));
    const etiquetaAuto = () => `Ataque automático: ${ajustes.autoataque ? 'sí' : 'no'}`;
    const etiquetaSonido = () => `Sonido: ${ajustes.sonido ? 'sí' : 'no'}`;
    const etiquetaMusica = () => `Música: ${ajustes.musica ? 'sí' : 'no'}`;
    const b: Boton[] = [];
    b.push(boton(this, w / 2, h / 2 - 70 * u, ancho, 'Continuar', () => this.juego.pausar(false), u, this.guardia));
    b.push(
      boton(this, w / 2, h / 2 - 25 * u, ancho, etiquetaAuto(), () => {
        ajustes.autoataque = !ajustes.autoataque;
        guardarAjustes(ajustes);
        this.juego.controles?.setAutoataque(ajustes.autoataque);
        b[1]!.etiqueta.setText(etiquetaAuto());
      }, u, this.guardia),
    );
    b.push(
      boton(this, w / 2, h / 2 + 20 * u, ancho, etiquetaSonido(), () => {
        ajustes.sonido = !ajustes.sonido;
        sonido.setSonido(ajustes.sonido);
        guardarAjustes(ajustes);
        b[2]!.etiqueta.setText(etiquetaSonido());
      }, u, this.guardia),
    );
    b.push(
      boton(this, w / 2, h / 2 + 65 * u, ancho, etiquetaMusica(), () => {
        ajustes.musica = !ajustes.musica;
        sonido.setMusica(ajustes.musica);
        guardarAjustes(ajustes);
        b[3]!.etiqueta.setText(etiquetaMusica());
      }, u, this.guardia),
    );
    b.push(boton(this, w / 2, h / 2 + 110 * u, ancho, 'Abandonar', () => this.irAlMenu(), u, this.guardia));
    for (const x of b) capa.add(x.cont);
    this.soltarTeclado = navegarConTeclado(this, b, 0, { guardia: this.guardia, espacio: false });
  }

  private mostrarFin(fin: Fin): void {
    const capa = this.abrirCapa();
    const { width: w, height: h } = this.scale;
    const u = this.u;
    const r = fin.resultado;
    const ancho = Math.min(w - 32, 340 * u);
    capa.add(panel(this, w / 2, h / 2, ancho, 370 * u, u));
    capa.add(
      texto(this, w / 2, h / 2 - 145 * u, r.victoria ? 'Amaneció' : 'Te devoró la noche', 24 * u, r.victoria ? CSS.ambarClaro : CSS.sangre, 'titulo').setOrigin(0.5),
    );
    capa.add(
      texto(this, w / 2, h / 2 - 118 * u, r.victoria ? 'El Ciervo de Ceniza cayó con la primera luz.' : 'El bosque guarda otra lámpara apagada.', 11 * u, CSS.gris)
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
      const y = h / 2 - 82 * u + i * 26 * u;
      capa.add(texto(this, w / 2 - ancho / 2 + 34 * u, y, k, 14 * u, CSS.gris));
      capa.add(texto(this, w / 2 + ancho / 2 - 34 * u, y, v, 15 * u, CSS.hueso).setOrigin(1, 0));
      if (fin.nuevos.includes(clave)) capa.add(texto(this, w / 2 + 6 * u, y + 2 * u, 'récord', 10 * u, CSS.ambarClaro, true).setOrigin(0.5, 0));
    });
    // Brasas: lo que se gana para siempre.
    const yb = h / 2 + 6 * u;
    capa.add(this.add.image(w / 2 - 70 * u, yb + 8 * u, 'icono-brasa').setScale(2 * u));
    capa.add(texto(this, w / 2 - 56 * u, yb + 8 * u, `+${fin.brasas} brasas (tienes ${fin.brasasTotales})`, 14 * u, CSS.ambarClaro).setOrigin(0, 0.5));
    capa.add(
      texto(this, w / 2, yb + 26 * u, 'Gasta tus brasas en el Altar del menú: sus mejoras duran para siempre.', 10 * u, CSS.gris)
        .setOrigin(0.5, 0)
        .setWordWrapWidth(ancho - 32 * u, true)
        .setAlign('center'),
    );
    const b = [
      boton(this, w / 2, h / 2 + 92 * u, ancho - 60 * u, 'Otra noche', () => this.reiniciar(), u, this.guardia),
      boton(this, w / 2, h / 2 + 136 * u, ancho - 60 * u, 'Menú', () => this.irAlMenu(), u, this.guardia),
    ];
    for (const x of b) capa.add(x.cont);
    this.soltarTeclado = navegarConTeclado(this, b, 0, { guardia: this.guardia, espacio: false });
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
