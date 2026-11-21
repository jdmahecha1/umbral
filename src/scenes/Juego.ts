import Phaser from 'phaser';
import { CSS } from '../art/paleta';
import type { Sonido } from '../audio/sonido';
import { Arsenal } from '../game/arsenal';
import { Bot } from '../game/bot';
import type { Controles } from '../game/controles';
import { Efectos } from '../game/efectos';
import { Horda, type Enemigo } from '../game/horda';
import { ACEITE_MAX, Jugador } from '../game/jugador';
import { Mundo } from '../game/mundo';
import { Objetos, type TipoObjeto } from '../game/objetos';
import { Oscuridad } from '../game/oscuridad';
import { bonosAltar, brasasGanadas, guardarAltar, leerAltar } from '../logic/altar';
import { anillo, enjambre, puntoFueraDeVista } from '../logic/aparicion';
import { ENEMIGOS, MAX_VIVOS, elegirTipo, eventosEntre, ritmo, type TipoEnemigo } from '../logic/enemigos';
import { sumarXp, xpParaNivel } from '../logic/experiencia';
import { guardarResultado, leerAjustes, type Records, type Resultado } from '../logic/guardado';
import {
  ARMAS,
  aplicar,
  atributos,
  inventarioInicial,
  maxNivel,
  ofrecer,
  type Extras,
  type IdArma,
  type IdMejora,
  type Inventario,
  type Opcion,
} from '../logic/mejoras';
import { personaje, type DefPersonaje } from '../logic/personajes';
import { crearRng, type Rng } from '../logic/rng';
import {
  ARTICULOS,
  AVISO_TREGUA,
  PROB_ORO,
  TREGUAS,
  ofrecerArticulos,
  precio,
  precioCambiar,
  probMoneda,
  type IdArticulo,
  type IdReliquia,
} from '../logic/tienda';

export interface Estado {
  tiempo: number;
  vida: number;
  vidaMax: number;
  aceite: number;
  nivel: number;
  xp: number;
  xpNecesaria: number;
  bajas: number;
  monedas: number;
  inventario: Inventario;
  cargas: Partial<Record<IdArma, number>>;
  reliquias: IdReliquia[];
  jefe: { nombre: string; vida: number; vidaMax: number } | null;
}

export interface Fin {
  resultado: Resultado;
  nuevos: (keyof Records)[];
  records: Records;
  brasas: number;
  brasasTotales: number;
}

export interface Tienda {
  ofertas: { id: IdArticulo; precio: number }[];
  monedas: number;
  precioCambiar: number;
}

/** Zoom para que se vean unas 230 unidades de alto (o 170 de ancho en móvil vertical). */
export function zoomPara(w: number, h: number): number {
  return Math.max(1.5, Math.min(h / 230, w / 170));
}

export class Juego extends Phaser.Scene {
  private rng!: Rng;
  private sonido!: Sonido;
  private mundo!: Mundo;
  private efectos!: Efectos;
  private oscuridad!: Oscuridad;
  jugador!: Jugador;
  horda!: Horda;
  private objetos!: Objetos;
  private arsenal!: Arsenal;
  controles: Controles | null = null;
  /** Solo para medir la dificultad: un jugador automático y cuántos pasos simular por fotograma. */
  private bot: Bot | null = null;
  private pasos = 1;

  private inv!: Inventario;
  private extras!: { altar: Extras['altar']; reliquias: Set<IdReliquia>; personaje: Extras['personaje'] };
  /** Con quién se juega esta noche. */
  personaje!: DefPersonaje;
  private progreso = { nivel: 1, xp: 0 };
  private tiempo = 0;
  private bajas = 0;
  private monedas = 0;
  private acumulador = 0;
  private pendientes = 0;
  private amuletoUsado = false;
  private tienda = { ofertas: [] as IdArticulo[], cambios: 0, compradas: {} as Partial<Record<IdArticulo, number>> };
  /** Diario de la partida (lo lee el bot de pruebas). */
  registro: string[] = [];
  eligiendo = false;
  enTienda = false;
  pausado = false;
  terminado = false;

  constructor() {
    super('Juego');
  }

  create(datos: { semilla?: number; desde?: number; monedas?: number; bot?: boolean; rapido?: number; personaje?: string }): void {
    const semilla = datos.semilla ?? Math.floor(Math.random() * 2 ** 31);
    this.rng = crearRng(semilla);
    this.sonido = this.registry.get('sonido') as Sonido;
    Object.assign(this, {
      bajas: 0,
      acumulador: 0,
      pendientes: 0,
      eligiendo: false,
      enTienda: false,
      pausado: false,
      terminado: false,
      amuletoUsado: false,
    });
    this.tiempo = Math.max(0, datos.desde ?? 0);
    this.monedas = Math.max(0, datos.monedas ?? 0);
    this.progreso = { nivel: 1, xp: 0 };
    // Sin personaje en los datos (menú, "Otra noche"), se juega con el último elegido.
    this.personaje = personaje(datos.personaje ?? leerAjustes().personaje);
    this.inv = inventarioInicial(this.personaje.arma);
    this.extras = { altar: bonosAltar(leerAltar().niveles), reliquias: new Set(), personaje: this.personaje.mods };
    this.tienda = { ofertas: [], cambios: 0, compradas: {} };
    this.registro = [];
    this.time.paused = false;

    this.cameras.main.resetFX();
    this.ajustarZoom();
    this.mundo = new Mundo(this, semilla);
    this.efectos = new Efectos(this);
    this.jugador = new Jugador(this, atributos(this.inv, this.extras), this.personaje.id);
    this.horda = new Horda(this, this.efectos);
    this.horda.alGolpear(() => this.sonido.reproducir('golpe', 0.45));
    this.objetos = new Objetos(this);
    this.arsenal = new Arsenal({ escena: this, jugador: this.jugador, horda: this.horda, efectos: this.efectos, sonido: this.sonido });
    this.arsenal.sincronizar(this.inv);
    this.oscuridad = new Oscuridad(this);
    this.cameras.main.centerOn(0, -8);
    this.bot = datos.bot ? new Bot(this.jugador, this.horda, this.objetos) : null;
    this.pasos = Math.max(1, Math.min(8, Math.floor(datos.rapido ?? 1)));

    this.scale.on('resize', this.alRedimensionar, this);
    this.game.events.on(Phaser.Core.Events.BLUR, this.alPerderFoco, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.limpiar());

    this.scene.launch('Hud');
    this.sonido.intensidad(0.3);
  }

  private alRedimensionar(): void {
    this.ajustarZoom();
    this.oscuridad?.ajustar();
  }

  private alPerderFoco(): void {
    if (!this.terminado && !this.eligiendo && !this.enTienda) this.pausar(true);
  }

  private ajustarZoom(): void {
    this.cameras.main.setZoom(zoomPara(this.scale.width, this.scale.height));
  }

  get estado(): Estado {
    const j = this.horda?.jefe;
    return {
      tiempo: this.tiempo,
      vida: this.jugador.vida,
      vidaMax: this.jugador.atrib.vidaMax,
      aceite: this.jugador.aceite,
      nivel: this.progreso.nivel,
      xp: this.progreso.xp,
      xpNecesaria: xpParaNivel(this.progreso.nivel),
      bajas: this.bajas,
      monedas: this.monedas,
      inventario: this.inv,
      cargas: this.arsenal?.cargas() ?? {},
      reliquias: [...this.extras.reliquias],
      jefe: j ? { nombre: j.def.nombre, vida: Math.max(0, j.vida), vidaMax: j.vidaMax } : null,
    };
  }

  /** Congela o reanuda todo lo que se mueve (simulación, tweens, animaciones y temporizadores). */
  private congelar(on: boolean): void {
    this.controles?.bloquear(on);
    this.time.paused = on;
    if (on) {
      this.tweens.pauseAll();
      this.anims.pauseAll();
    } else {
      this.tweens.resumeAll();
      this.anims.resumeAll();
    }
  }

  pausar(on: boolean): void {
    if (this.terminado || this.eligiendo || this.enTienda) return;
    this.pausado = on;
    this.congelar(on);
    this.events.emit('pausa', on);
  }

  private recalcular(): void {
    this.jugador.setAtributos(atributos(this.inv, this.extras));
    this.arsenal.sincronizar(this.inv);
  }

  /** El jugador eligió una mejora en el panel de subida de nivel. */
  elegir(id: IdMejora): void {
    if (!this.eligiendo) return;
    aplicar(this.inv, id);
    if (id === 'pan') this.jugador.curar(30);
    if (id === 'aceite') this.jugador.aceite = ACEITE_MAX;
    this.recalcular();
    this.pendientes--;
    this.eligiendo = false;
    this.congelar(false);
  }

  private abrirEleccion(): void {
    this.eligiendo = true;
    this.congelar(true);
    const opciones: Opcion[] = ofrecer(this.inv, this.rng, 3);
    if (this.bot) {
      // Prefiere armas nuevas o mejoras de armas; si no, la primera.
      const op = opciones.find((o) => o.tipo === 'arma') ?? opciones[0]!;
      // Directo: con la escena congelada, un temporizador no llegaría a dispararse.
      this.elegir(op.id);
      return;
    }
    this.sonido.reproducir('nivel');
    this.events.emit('elegir', opciones);
  }

  // ── La tregua del mercader ─────────────────────────────────────

  private puedeForjar(): boolean {
    return (Object.entries(this.inv.armas) as [IdArma, number][]).some(([id, n]) => n < maxNivel(id));
  }

  get datosTienda(): Tienda {
    return {
      ofertas: this.tienda.ofertas.map((id) => ({ id, precio: precio(id, this.tienda.compradas[id] ?? 0) })),
      monedas: this.monedas,
      precioCambiar: precioCambiar(this.tienda.cambios),
    };
  }

  private abrirTienda(): void {
    this.enTienda = true;
    this.congelar(true);
    this.tienda.cambios = 0;
    this.tienda.ofertas = ofrecerArticulos(this.rng, this.extras.reliquias, this.puedeForjar());
    if (this.bot) {
      // Compra reliquias que alcance (las más caras primero) y se va.
      for (const o of [...this.datosTienda.ofertas].sort((a, b) => b.precio - a.precio)) {
        if (ARTICULOS[o.id].tipo === 'reliquia' && o.precio <= this.monedas) this.comprar(o.id);
      }
      this.registro.push(`tienda ${Math.round(this.tiempo)}s: ${[...this.extras.reliquias].join(",") || "nada"} (quedan ${this.monedas})`);
      this.salirTienda();
      return;
    }
    this.sonido.reproducir('cofre');
    this.events.emit('tienda', this.datosTienda);
  }

  /** Compra un artículo. Devuelve un mensaje para la interfaz. */
  comprar(id: IdArticulo): { ok: boolean; mensaje: string } {
    if (!this.enTienda || !this.tienda.ofertas.includes(id)) return { ok: false, mensaje: '' };
    const p = precio(id, this.tienda.compradas[id] ?? 0);
    if (this.monedas < p) return { ok: false, mensaje: `Te faltan ${p - this.monedas} monedas` };
    const art = ARTICULOS[id];
    let mensaje = `Compraste: ${art.nombre}`;
    if (id === 'elixir') {
      this.jugador.curar(this.jugador.atrib.vidaMax);
      this.jugador.aceite = ACEITE_MAX;
    } else if (id === 'pergamino') {
      this.pendientes++;
      mensaje = 'Al salir de la tienda elegirás una mejora';
    } else if (id === 'forja') {
      const armas = (Object.entries(this.inv.armas) as [IdArma, number][]).filter(([a, n]) => n < maxNivel(a));
      if (armas.length === 0) return { ok: false, mensaje: 'Tus armas ya están al máximo' };
      const [arma] = armas[Math.floor(this.rng() * armas.length)]!;
      aplicar(this.inv, arma);
      mensaje = `${ARMAS[arma].nombre} sube al nivel ${this.inv.armas[arma]}`;
    } else {
      this.extras.reliquias.add(id as IdReliquia);
    }
    this.monedas -= p;
    this.tienda.compradas[id] = (this.tienda.compradas[id] ?? 0) + 1;
    // Las reliquias desaparecen del mostrador; los consumibles se quedan (algo más caros).
    if (art.tipo === 'reliquia' || (id === 'forja' && !this.puedeForjar())) this.tienda.ofertas = this.tienda.ofertas.filter((o) => o !== id);
    this.recalcular();
    this.sonido.reproducir('aceite');
    return { ok: true, mensaje };
  }

  cambiarArticulos(): { ok: boolean; mensaje: string } {
    const p = precioCambiar(this.tienda.cambios);
    if (this.monedas < p) return { ok: false, mensaje: `Te faltan ${p - this.monedas} monedas` };
    this.monedas -= p;
    this.tienda.cambios++;
    this.tienda.ofertas = ofrecerArticulos(this.rng, this.extras.reliquias, this.puedeForjar());
    return { ok: true, mensaje: 'Nuevos objetos a la venta' };
  }

  salirTienda(): void {
    if (!this.enTienda) return;
    this.enTienda = false;
    this.congelar(false);
    // Un respiro al volver: los enemigos siguen donde estaban.
    this.jugador.proteger(1.5);
    this.events.emit('aviso', 'El mercader se marcha');
  }

  // ── Bucle principal ────────────────────────────────────────────

  update(_t: number, deltaMs: number): void {
    for (let i = 0; i < this.pasos; i++) this.paso(deltaMs, i === this.pasos - 1);
  }

  private paso(deltaMs: number, dibujar: boolean): void {
    if (this.terminado || this.pausado || this.eligiendo || this.enTienda) return;
    if (this.pendientes > 0) {
      this.abrirEleccion();
      return;
    }
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    const antes = this.tiempo;
    this.tiempo += dt;
    const j = this.jugador;

    this.bot?.actualizar(dt);
    const control = this.bot ?? this.controles;
    const v = control?.vector() ?? { x: 0, y: 0 };
    const atacando = control?.atacando() ?? false;
    const angulo = this.anguloApunte();
    if (atacando) j.mirando = Math.cos(angulo) >= 0 ? 1 : -1;
    j.actualizar(dt, v.x, v.y, atacando);
    const cam = this.cameras.main;
    const k = 1 - Math.pow(0.0005, dt);
    cam.centerOn(Phaser.Math.Linear(cam.midPoint.x, j.x, k), Phaser.Math.Linear(cam.midPoint.y, j.y - 8, k));
    this.mundo.actualizar();

    this.aparecer(dt, antes);
    this.horda.actualizar(dt, j, (d, quien) => this.alRecibirGolpe(d, quien));
    this.arsenal.actualizar(dt, atacando, angulo);
    this.procesarMuertes();
    this.objetos.actualizar(dt, j, (tipo, valor, x, y) => this.recoger(tipo, valor, x, y));
    if (dibujar) this.dibujarLuces();

    for (const t of TREGUAS) {
      if (antes < t - AVISO_TREGUA && this.tiempo >= t - AVISO_TREGUA) this.events.emit('aviso', 'El mercader llegará en 10 segundos');
      if (antes < t && this.tiempo >= t) {
        this.abrirTienda();
        return;
      }
    }

    if (j.muerto) {
      if (this.extras.reliquias.has('amuleto') && !this.amuletoUsado) this.revivir();
      else this.terminar(false);
    }
  }

  /** Ángulo de ataque: hacia el ratón; sin ratón, hacia el enemigo más cercano o hacia donde miras. */
  private anguloApunte(): number {
    const j = this.jugador;
    const cy = j.y - 7;
    const p = (this.bot ?? this.controles)?.apunte();
    if (p) return Math.atan2(p.y - cy, p.x - j.x);
    const e = this.horda.masCercano(j.x, j.y, 170);
    if (e) return Math.atan2(e.y - 6 - cy, e.x - j.x);
    return Math.hypot(j.dirX, j.dirY) > 0.1 ? Math.atan2(j.dirY, j.dirX) : j.mirando > 0 ? 0 : Math.PI;
  }

  private alRecibirGolpe(d: number, quien?: Enemigo): void {
    const j = this.jugador;
    if (j.esquivo) {
      j.esquivo = false;
      this.efectos.aviso(j.x, j.y - 16, 'esquivado', CSS.espectro);
    } else {
      this.sonido.reproducir('dano');
      this.efectos.numero(j.x, j.y - 16, d, CSS.sangre);
      this.efectos.sacudir(0.003, 90);
    }
    if (quien && j.atrib.espinas > 0) this.horda.herir(quien, j.atrib.espinas, (quien.x - j.x) * 2, (quien.y - j.y) * 2, CSS.gris);
  }

  private revivir(): void {
    this.amuletoUsado = true;
    this.extras.reliquias.delete('amuleto');
    this.recalcular();
    const j = this.jugador;
    j.revivir();
    // Al levantarse, una onda aparta a los que lo rodeaban.
    this.horda.enCirculo(j.x, j.y - 6, 70, (e) => {
      const a = Math.atan2(e.y - j.y, e.x - j.x);
      this.horda.herir(e, 1, Math.cos(a) * 220, Math.sin(a) * 220);
    });
    this.cameras.main.flash(500, 255, 215, 122);
    this.sonido.reproducir('nivel');
    this.events.emit('aviso', '¡El amuleto te devolvió a la vida!');
  }

  private vista() {
    const w = this.cameras.main.worldView;
    return { x: w.x, y: w.y, ancho: w.width, alto: w.height };
  }

  private aparecer(dt: number, antes: number): void {
    const t = this.tiempo;
    const vista = this.vista();
    this.acumulador += ritmo(t) * dt;
    while (this.acumulador >= 1) {
      this.acumulador -= 1;
      if (this.horda.vivos >= MAX_VIVOS) continue;
      const p = puntoFueraDeVista(this.rng, vista);
      this.horda.crear(elegirTipo(this.rng, t), p.x, p.y, t);
    }

    for (const ev of eventosEntre(antes, t)) {
      const j = this.jugador;
      if (ev.tipo === 'anillo') {
        const r = Math.hypot(vista.ancho, vista.alto) / 2 + 10;
        for (const p of anillo({ x: j.x, y: j.y }, r, ev.cantidad, this.rng() * Math.PI)) this.horda.crear(ev.enemigo, p.x, p.y, t);
        this.events.emit('aviso', 'Te rodean…');
      } else if (ev.tipo === 'enjambre') {
        for (const p of enjambre(this.rng, vista, j, ev.cantidad)) this.horda.crear(ev.enemigo, p.x, p.y, t);
        this.events.emit('aviso', 'Una manada se acerca');
      } else {
        const p = puntoFueraDeVista(this.rng, vista, 30);
        this.horda.crear(ev.enemigo, p.x, p.y, t);
        this.sonido.reproducir('jefe');
        this.sonido.intensidad(ev.enemigo === 'ciervo' ? 1 : 0.7);
        this.efectos.sacudir(0.006, 400);
        this.events.emit('aviso', ENEMIGOS[ev.enemigo].nombre);
      }
    }

    // Los enemigos que se quedan muy atrás reaparecen delante: la presión no afloja.
    const limite = Math.max(vista.ancho, vista.alto) * 0.95;
    for (const e of this.horda.lista) {
      if (!e.activo || e.def.jefe) continue;
      if (Math.abs(e.x - this.jugador.x) > limite || Math.abs(e.y - this.jugador.y) > limite) {
        const p = puntoFueraDeVista(this.rng, vista);
        this.horda.reubicar(e, p.x, p.y);
      }
    }
  }

  private invocar(tipo: TipoEnemigo, x: number, y: number): void {
    if (this.horda.vivos < MAX_VIVOS) this.horda.crear(tipo, x, y, this.tiempo);
  }

  private procesarMuertes(): void {
    // Incluye las muertes de golpes programados fuera del bucle (el tajo trasero de la hoz).
    const muertes = this.horda.muertes.splice(0);
    const codicia = this.jugador.atrib.monedas;
    for (const m of muertes) {
      const def = m.e.def;
      this.bajas++;
      if (def.tipo === 'ciervo') {
        this.terminar(true);
        return;
      }
      if (def.tipo === 'guardian') {
        this.objetos.soltar('cofre', m.x, m.y);
        for (let i = 0; i < 5; i++) this.objetos.soltar('moneda', m.x + (i - 2) * 6, m.y + 6, 5);
        this.sonido.intensidad(0.45);
      }
      if (def.xp > 0) this.objetos.soltar('gema', m.x + (this.rng() - 0.5) * 4, m.y, def.xp);
      if (this.rng() < PROB_ORO * codicia) this.objetos.soltar('moneda', m.x - 3, m.y + 2, 5);
      else if (this.rng() < probMoneda(def.xp, codicia)) this.objetos.soltar('moneda', m.x - 3, m.y + 2, 1);
      // Más aceite cuando el farol está bajo: la luz es tensa, no imposible.
      const probAceite = this.jugador.aceite < 30 ? 0.06 : 0.025;
      if (this.rng() < probAceite) this.objetos.soltar('aceite', m.x + 4, m.y);
      else if (this.rng() < 0.007) this.objetos.soltar('pan', m.x - 4, m.y);
      if (def.tipo === 'raizon' && this.rng() < 0.5) this.objetos.soltar('aceite', m.x, m.y + 4);
    }
    for (const inv of this.horda.invocaciones.splice(0)) this.invocar(inv.tipo, inv.x, inv.y);
  }

  private recoger(tipo: TipoObjeto, valor: number, x: number, y: number): void {
    const j = this.jugador;
    if (tipo === 'gema') {
      this.pendientes += sumarXp(this.progreso, valor * j.atrib.xp);
      this.sonido.reproducir('gema', 0.5);
    } else if (tipo === 'moneda') {
      this.monedas += valor;
      this.sonido.reproducir('gema', 0.35);
    } else if (tipo === 'aceite') {
      j.aceite = Math.min(ACEITE_MAX, j.aceite + 40);
      this.sonido.reproducir('aceite');
      this.efectos.aviso(x, y - 8, '+aceite', CSS.ambarClaro);
    } else if (tipo === 'pan') {
      j.curar(30);
      this.sonido.reproducir('aceite');
      this.efectos.aviso(x, y - 8, '+30 vida', CSS.musgo);
    } else {
      this.pendientes += 2;
      j.aceite = ACEITE_MAX;
      this.objetos.atraerTodas();
      this.sonido.reproducir('cofre');
      this.efectos.estallar('chispa', x, y - 6, 30);
    }
  }

  private dibujarLuces(): void {
    const j = this.jugador;
    this.oscuridad.añadir({ x: j.x, y: j.y - 8, radio: j.radioLuz(this.arsenal.luzExtra()) });
    const w = this.cameras.main.worldView;
    for (const e of this.horda.lista) {
      if (!e.activo || !e.def.luz) continue;
      if (e.x < w.x - 30 || e.x > w.right + 30 || e.y < w.y - 30 || e.y > w.bottom + 40) continue;
      this.oscuridad.añadir({ x: e.x, y: e.y - 6, radio: e.def.luz, fuerza: 0.55 });
    }
    this.objetos.brillos((x, y) => this.oscuridad.añadir({ x, y, radio: 12, fuerza: 0.6 }));
    this.oscuridad.dibujar();
  }

  private terminar(victoria: boolean): void {
    if (this.terminado) return;
    this.terminado = true;
    this.controles?.bloquear(true);
    this.sonido.reproducir(victoria ? 'victoria' : 'derrota');
    this.sonido.intensidad(0.2);
    const resultado: Resultado = { tiempo: this.tiempo, nivel: this.progreso.nivel, bajas: this.bajas, victoria };
    const { records, nuevos } = guardarResultado(resultado);
    // Las brasas se guardan para siempre: se gastan en el Altar del menú.
    const brasas = brasasGanadas(resultado);
    const altar = leerAltar();
    altar.brasas += brasas;
    guardarAltar(altar);
    if (victoria) this.cameras.main.flash(1200, 255, 215, 122);
    else this.cameras.main.fade(1400, 7, 5, 12);
    const fin: Fin = { resultado, nuevos, records, brasas, brasasTotales: altar.brasas };
    this.time.delayedCall(victoria ? 900 : 1100, () => this.events.emit('fin', fin));
  }

  private limpiar(): void {
    this.scale.off('resize', this.alRedimensionar, this);
    this.game.events.off(Phaser.Core.Events.BLUR, this.alPerderFoco, this);
    this.arsenal.destruir();
    this.objetos.destruir();
    this.horda.destruir();
    this.mundo.destruir();
    this.oscuridad.destruir();
  }
}
