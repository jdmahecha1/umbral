import Phaser from 'phaser';
import { COLOR, CSS } from '../art/paleta';
import type { Sonido } from '../audio/sonido';
import { Mundo } from '../game/mundo';
import { Oscuridad } from '../game/oscuridad';
import { ALTAR, comprarAltar, defAltar, guardarAltar, leerAltar, precioSiguiente } from '../logic/altar';
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
    const altar = leerAltar();

    const yTitulo = h * 0.17;
    const titulo = texto(this, w / 2, yTitulo, 'UMBRAL', 54 * u, CSS.ambarClaro, 'titulo').setOrigin(0.5);
    titulo.setShadow(0, Math.round(4 * u), '#6a1f2b', 0, true, true);
    this.tweens.add({ targets: titulo, alpha: 0.82, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    texto(this, w / 2, yTitulo + 40 * u, 'Aguanta la noche. El farol no durará.', 13 * u, CSS.gris).setOrigin(0.5);

    const ancho = Math.min(w - 48, 260 * u);
    const paso = 40 * u;
    const y0 = Math.max(yTitulo + 80 * u, h * 0.38);
    const etiquetaSonido = () => `Sonido: ${ajustes.sonido ? 'sí' : 'no'}`;
    const etiquetaMusica = () => `Música: ${ajustes.musica ? 'sí' : 'no'}`;
    const etiquetaAuto = () => `Ataque automático: ${ajustes.autoataque ? 'sí' : 'no'}`;
    const b: Boton[] = [];
    b.push(boton(this, w / 2, y0, ancho, 'Jugar', () => this.jugar(), u));
    b.push(boton(this, w / 2, y0 + paso, ancho, `El Altar (${altar.brasas} brasas)`, () => this.altar(), u));
    b.push(boton(this, w / 2, y0 + paso * 2, ancho, 'Cómo se juega', () => this.ayuda(), u));
    // Sonido y música en una misma fila para que el menú quepa en pantallas bajas.
    const medio = (ancho - 8 * u) / 2;
    b.push(
      boton(this, w / 2 - medio / 2 - 4 * u, y0 + paso * 3, medio, etiquetaSonido(), () => {
        ajustes.sonido = !ajustes.sonido;
        sonido.setSonido(ajustes.sonido);
        guardarAjustes(ajustes);
        b[3]!.etiqueta.setText(etiquetaSonido());
      }, u),
    );
    b.push(
      boton(this, w / 2 + medio / 2 + 4 * u, y0 + paso * 3, medio, etiquetaMusica(), () => {
        ajustes.musica = !ajustes.musica;
        sonido.setMusica(ajustes.musica);
        guardarAjustes(ajustes);
        b[4]!.etiqueta.setText(etiquetaMusica());
      }, u),
    );
    b.push(
      boton(this, w / 2, y0 + paso * 4, ancho, etiquetaAuto(), () => {
        ajustes.autoataque = !ajustes.autoataque;
        guardarAjustes(ajustes);
        b[5]!.etiqueta.setText(etiquetaAuto());
      }, u),
    );
    for (const x of b.slice(3)) x.etiqueta.setFontSize(Math.round(17 * u));
    b[0]!.cont.setName('boton-jugar');
    b[1]!.cont.setName('boton-altar');
    this.soltarTeclado = navegarConTeclado(this, b);

    if (records.partidas > 0) {
      texto(
        this,
        w / 2,
        y0 + paso * 4 + 36 * u,
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

  /** Capa modal centrada; si su contenido es más alto que la pantalla, se reduce. */
  private capaModal(alto: number): { capa: Phaser.GameObjects.Container; cerrar: () => void } {
    this.soltarTeclado?.();
    const { width: w, height: h } = this.scale;
    const velo = this.add.rectangle(0, 0, w, h, 0x07050c, 0.75).setOrigin(0).setInteractive();
    const capa = this.add.container(0, 0, [velo]);
    const escala = Math.min(1, (h - 16) / alto);
    if (escala < 1) {
      velo.setScale(1 / escala).setPosition(-(w / escala - w) / 2, -(h / escala - h) / 2);
      capa.setScale(escala).setPosition((w - w * escala) / 2, (h - h * escala) / 2);
    }
    const cerrar = () => {
      this.soltarTeclado?.();
      capa.destroy();
      this.construir();
    };
    return { capa, cerrar };
  }

  private ayuda(): void {
    const { width: w, height: h } = this.scale;
    const u = unidad(this);
    const ancho = Math.min(w - 24, 460 * u);
    const lineas = [
      'Cada partida es una noche de 10 minutos en el bosque.',
      'Muévete con WASD o las flechas. En el celular, arrastra el dedo por la mitad izquierda de la pantalla.',
      'Ataca con el clic izquierdo (puedes mantenerlo presionado) o con la barra espaciadora: tus armas apuntan hacia el cursor. En el celular, mantén el dedo en la mitad derecha: mientras lo tocas, atacas y tus armas apuntan al enemigo más cercano.',
      '¿Prefieres no hacer clic todo el rato? Activa "Ataque automático" en este menú o en la pausa: tus armas atacarán solas hacia donde apuntes (en el celular, al enemigo más cercano).',
      'Cada arma tarda un momento en volver a estar lista: lo ves en su ícono, abajo a la izquierda.',
      'Recoge el ámbar que dejan los enemigos para subir de nivel y elegir una mejora.',
      'Tu farol alumbra a tu alrededor, pero su aceite se agota. Recoge aceite para no quedarte a oscuras.',
      'Tres veces por noche llega el mercader: el tiempo se detiene y puedes comprar objetos con las monedas que recogiste.',
      'A los cinco minutos llega un guardián. Si aguantas diez, amanece… pero algo despierta.',
      'Al terminar la partida ganas brasas. Gástalas en el Altar del menú: sus mejoras duran para siempre.',
      'Para pausar: Esc o P, o el botón II de arriba a la derecha.',
    ];
    const t = texto(this, 0, 0, lineas.map((l) => `· ${l}`).join('\n\n'), 12 * u, CSS.hueso);
    t.setWordWrapWidth(ancho - 48 * u, true).setLineSpacing(2 * u);
    const alto = t.height + 130 * u;
    const { capa, cerrar } = this.capaModal(alto);
    const top = h / 2 - alto / 2;
    capa.add(panel(this, w / 2, h / 2, ancho, alto, u));
    capa.add(texto(this, w / 2, top + 22 * u, 'Cómo se juega', 20 * u, CSS.ambarClaro, 'titulo').setOrigin(0.5, 0));
    t.setPosition(w / 2 - ancho / 2 + 24 * u, top + 60 * u);
    capa.add(t);
    const listo = boton(this, w / 2, top + alto - 32 * u, Math.min(ancho - 48 * u, 200 * u), 'Entendido', cerrar, u);
    capa.add(listo.cont);
    this.soltarTeclado = navegarConTeclado(this, [listo]);
  }

  /** El Altar: mejoras permanentes que se compran con brasas. */
  private altar(mensaje = ''): void {
    const { width: w, height: h } = this.scale;
    const u = unidad(this);
    const estado = leerAltar();
    const ancho = Math.min(w - 24, 480 * u);
    // En pantallas angostas la descripción ocupa dos líneas: cada fila necesita más alto.
    const fila = (ancho < 420 * u ? 70 : 58) * u;
    const alto = 128 * u + ALTAR.length * fila + 60 * u;
    const { capa, cerrar } = this.capaModal(alto);
    const top = h / 2 - alto / 2;
    capa.add(panel(this, w / 2, h / 2, ancho, alto, u));
    capa.add(texto(this, w / 2, top + 20 * u, 'El Altar', 22 * u, CSS.ambarClaro, 'titulo').setOrigin(0.5, 0));
    capa.add(
      texto(this, w / 2, top + 50 * u, 'Mejoras que duran para siempre. Se pagan con las brasas que ganas al terminar cada noche.', 11 * u, CSS.gris)
        .setOrigin(0.5, 0)
        .setWordWrapWidth(ancho - 40 * u, true)
        .setAlign('center'),
    );
    capa.add(this.add.image(w / 2 - 50 * u, top + 96 * u, 'icono-brasa').setScale(2 * u));
    capa.add(texto(this, w / 2 - 36 * u, top + 96 * u, `${estado.brasas} brasas`, 15 * u, CSS.ambarClaro).setOrigin(0, 0.5));
    if (mensaje) capa.add(texto(this, w / 2, top + 112 * u, mensaje, 11 * u, mensaje.startsWith('Te faltan') ? CSS.sangre : CSS.musgo).setOrigin(0.5, 0));

    const botones: Boton[] = [];
    const izq = w / 2 - ancho / 2 + 18 * u;
    const anchoBoton = Math.min(150 * u, ancho * 0.36);
    ALTAR.forEach((def, i) => {
      const y = top + 128 * u + i * fila;
      const nivel = estado.niveles[def.id];
      const max = def.costes.length;
      const precio = precioSiguiente(estado, def.id);
      const g = this.add.graphics();
      g.lineStyle(1, COLOR.borde, 0.6).lineBetween(izq, y + fila - 4 * u, w / 2 + ancho / 2 - 18 * u, y + fila - 4 * u);
      const ic = this.add.image(izq + 14 * u, y + fila / 2 - 2 * u, `icono-${def.icono}`);
      ic.setScale(Math.min((26 * u) / ic.width, (26 * u) / ic.height));
      const nombre = texto(this, izq + 36 * u, y + 6 * u, `${def.nombre}  ${nivel}/${max}`, 13 * u, CSS.hueso, true);
      const desc = texto(this, izq + 36 * u, y + 26 * u, `Cada nivel: ${def.porNivel}.`, 11 * u, CSS.gris).setWordWrapWidth(
        ancho - 36 * u - anchoBoton - 40 * u,
        true,
      );
      capa.add([g, ic, nombre, desc]);
      const etiqueta = precio === null ? 'Al máximo' : `Mejorar: ${precio} brasas`;
      const b = boton(this, w / 2 + ancho / 2 - 18 * u - anchoBoton / 2, y + fila / 2 - 2 * u, anchoBoton, etiqueta, () => {
        const r = comprarAltar(leerAltar(), def.id);
        if (r.ok) guardarAltar(r.estado);
        this.soltarTeclado?.();
        capa.destroy();
        this.altar(r.ok ? `${defAltar(def.id).nombre} sube al nivel ${r.estado.niveles[def.id]}` : r.motivo);
      }, u);
      b.etiqueta.setFontSize(Math.round(16 * u));
      if (precio === null || estado.brasas < precio) b.etiqueta.setColor(CSS.apagado);
      capa.add(b.cont);
      botones.push(b);
    });
    const salir = boton(this, w / 2, top + alto - 32 * u, Math.min(ancho - 48 * u, 200 * u), 'Volver', cerrar, u);
    capa.add(salir.cont);
    botones.push(salir);
    this.soltarTeclado = navegarConTeclado(this, botones, botones.length - 1);
  }
}
