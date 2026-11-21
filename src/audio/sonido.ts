/**
 * Sonido del juego con Web Audio.
 * - Algunos efectos y la música son grabaciones con licencia CC0 (ver `public/sonidos/CREDITOS.md`).
 *   Se cargan en segundo plano al primer toque; mientras tanto, o si el navegador no
 *   puede leerlas, se usa el sonido sintetizado de siempre.
 * - El resto de efectos se sintetizan en el momento.
 * Si el navegador no tiene audio, todo queda en silencio.
 */
type AjustesSonido = { sonido: boolean; musica: boolean };

export type Efecto = 'golpe'|'muerte'|'gema'|'nivel'|'dano'|'tajo'|'daga'|'campana'|'runa'|'boton'|'aceite'|'cofre'|'victoria'|'derrota'|'jefe'|'esquiva'|'moneda';

/** Pistas de música: una tranquila para el menú y otra para la noche. */
export type Pista = 'menu' | 'combate';

/** Grabaciones de cada efecto (se elige una al azar para que no suene siempre igual) y su volumen. */
const MUESTRAS: Partial<Record<Efecto, { archivos: string[]; volumen: number }>> = {
  tajo: { archivos: ['tajo1', 'tajo2'], volumen: 0.55 },
  daga: { archivos: ['daga2', 'daga3'], volumen: 0.5 },
  golpe: { archivos: ['golpe'], volumen: 0.45 },
  esquiva: { archivos: ['esquiva1', 'esquiva2', 'esquiva3'], volumen: 0.9 },
  boton: { archivos: ['boton'], volumen: 0.7 },
  cofre: { archivos: ['cofre'], volumen: 0.7 },
  moneda: { archivos: ['moneda'], volumen: 0.5 },
};

/**
 * Volumen de cada pista (ya vienen igualadas a la misma sonoridad). La de la noche
 * va muy baja, de fondo: no debe tapar los golpes ni distraer.
 */
const VOLUMEN_PISTA: Record<Pista, number> = { menu: 0.5, combate: 0.13 };

/** Carpeta de los sonidos, respetando la ruta base con la que se publica el juego. */
function rutaSonidos(): string {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  return `${base}sonidos/`;
}

type Voz = { nodos: AudioNode[]; fin: number };

export class Sonido {
  private contexto: AudioContext | null = null;
  private maestroEfectos: GainNode | null = null;
  private ruido: AudioBuffer | null = null;
  private habilitadoSonido: boolean;
  private habilitadaMusica: boolean;
  private voces: Voz[] = [];
  private ultimoEfecto = new Map<Efecto, number>();
  private ultimaGema = 0;
  private comboGema = 0;
  private musicaActiva = false;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private nodosMusica: AudioNode[] = [];
  private gananciaMusica: GainNode | null = null;
  private gananciaDron: GainNode | null = null;
  private filtroDron: BiquadFilterNode | null = null;
  private intensidadActual = 0.5;
  // Grabaciones
  private muestras = new Map<string, AudioBuffer>();
  private pistas = new Map<Pista, AudioBuffer>();
  private cargaIniciada = false;
  private pistaDeseada: Pista = 'menu';
  private pistaSonando: { pista: Pista; fuente: AudioBufferSourceNode; ganancia: GainNode } | null = null;

  constructor(ajustes: AjustesSonido) {
    this.habilitadoSonido = ajustes.sonido;
    this.habilitadaMusica = ajustes.musica;
  }

  desbloquear(): void {
    try {
      if (typeof window === 'undefined') return;
      const ConstructorAudio = window.AudioContext;
      if (!ConstructorAudio) return;

      if (!this.contexto) {
        this.contexto = new ConstructorAudio();
        this.configurarAudio();
        this.cargarGrabaciones();
      }
      // resume() es asíncrono: la música solo puede arrancar cuando el contexto ya corre.
      if (this.contexto.state === 'suspended') {
        void this.contexto
          .resume()
          .then(() => {
            if (this.habilitadaMusica) this.musicaIniciar();
          })
          .catch(() => undefined);
      } else if (this.habilitadaMusica) this.musicaIniciar();
    } catch {
      this.limpiarAudio();
    }
  }

  setSonido(on: boolean): void {
    this.habilitadoSonido = on;
  }

  setMusica(on: boolean): void {
    this.habilitadaMusica = on;
    if (on) this.musicaIniciar();
    else {
      this.musicaDetener();
      this.detenerPista();
    }
  }

  /** Elige qué música suena: la del menú o la de la noche. Cambia con un fundido. */
  ponerPista(pista: Pista): void {
    this.pistaDeseada = pista;
    this.actualizarPista();
  }

  /** Descarga las grabaciones en segundo plano. Prueba OGG y, si el navegador no lo lee, MP3. */
  private cargarGrabaciones(): void {
    if (this.cargaIniciada || typeof fetch === 'undefined') return;
    this.cargaIniciada = true;
    const leer = async (nombre: string): Promise<AudioBuffer | null> => {
      for (const ext of ['ogg', 'mp3']) {
        try {
          const r = await fetch(`${rutaSonidos()}${nombre}.${ext}`);
          if (!r.ok || !this.contexto) continue;
          return await this.contexto.decodeAudioData(await r.arrayBuffer());
        } catch {
          // Formato no soportado: se prueba el siguiente.
        }
      }
      return null;
    };
    const efectos = [...new Set(Object.values(MUESTRAS).flatMap((m) => m!.archivos))];
    void Promise.all(
      efectos.map(async (n) => {
        const b = await leer(n);
        if (b) this.muestras.set(n, b);
      }),
    ).then(async () => {
      // La música pesa más: se carga después de los efectos, primero la que toca ahora.
      const orden: Pista[] = this.pistaDeseada === 'menu' ? ['menu', 'combate'] : ['combate', 'menu'];
      for (const p of orden) {
        const b = await leer(`musica-${p}`);
        if (b) {
          this.pistas.set(p, b);
          this.actualizarPista();
        }
      }
    });
  }

  /** Hace sonar la pista deseada si ya está cargada; mientras tanto suena la música sintetizada. */
  private actualizarPista(): void {
    const contexto = this.contexto;
    if (!contexto || contexto.state !== 'running') return;
    if (!this.habilitadaMusica) return;
    const buffer = this.pistas.get(this.pistaDeseada);
    if (!buffer) return;
    if (this.pistaSonando?.pista === this.pistaDeseada) return;
    try {
      // La grabación sustituye al dron sintetizado.
      this.musicaDetener();
      this.detenerPista();
      const ahora = contexto.currentTime;
      const ganancia = contexto.createGain();
      ganancia.gain.setValueAtTime(0.0001, ahora);
      ganancia.gain.exponentialRampToValueAtTime(this.volumenPista(this.pistaDeseada), ahora + 1.5);
      ganancia.connect(contexto.destination);
      const fuente = contexto.createBufferSource();
      fuente.buffer = buffer;
      fuente.loop = true;
      fuente.connect(ganancia);
      fuente.start(ahora);
      this.pistaSonando = { pista: this.pistaDeseada, fuente, ganancia };
    } catch {
      this.pistaSonando = null;
    }
  }

  private volumenPista(p: Pista): number {
    // En la noche, la música sube un poco cuando aprieta (jefes, final).
    return VOLUMEN_PISTA[p] * (p === 'combate' ? 0.85 + this.intensidadActual * 0.2 : 1);
  }

  private detenerPista(): void {
    const s = this.pistaSonando;
    const contexto = this.contexto;
    this.pistaSonando = null;
    if (!s || !contexto) return;
    try {
      const ahora = contexto.currentTime;
      s.ganancia.gain.cancelScheduledValues(ahora);
      s.ganancia.gain.setValueAtTime(Math.max(0.0001, s.ganancia.gain.value), ahora);
      s.ganancia.gain.exponentialRampToValueAtTime(0.0001, ahora + 1.2);
      s.fuente.stop(ahora + 1.3);
      setTimeout(() => this.desconectar([s.fuente, s.ganancia]), 1500);
    } catch {
      // Ya estaba detenida.
    }
  }

  /** Reproduce una grabación del efecto si está cargada. Devuelve false si no hay. */
  private reproducirMuestra(nombre: Efecto, volumen: number, ahora: number): boolean {
    const def = MUESTRAS[nombre];
    const contexto = this.contexto;
    const salida = this.maestroEfectos;
    if (!def || !contexto || !salida) return false;
    const cargadas = def.archivos.map((a) => this.muestras.get(a)).filter((b): b is AudioBuffer => b !== undefined);
    if (cargadas.length === 0) return false;
    try {
      const buffer = cargadas[Math.floor(Math.random() * cargadas.length)]!;
      const fuente = contexto.createBufferSource();
      const ganancia = contexto.createGain();
      fuente.buffer = buffer;
      // Un tono ligeramente distinto cada vez, para que no canse.
      fuente.playbackRate.value = 0.92 + Math.random() * 0.16;
      ganancia.gain.value = Math.max(0, Math.min(1, volumen)) * def.volumen;
      fuente.connect(ganancia);
      ganancia.connect(salida);
      fuente.start(ahora);
      this.voces.push({ nodos: [fuente, ganancia], fin: ahora + buffer.duration + 0.1 });
      return true;
    } catch {
      return false;
    }
  }

  reproducir(nombre: Efecto, volumen = 1): void {
    const contexto = this.contexto;
    const salida = this.maestroEfectos;
    if (!this.habilitadoSonido || !contexto || !salida || contexto.state !== 'running') return;

    const ahora = contexto.currentTime;
    const anterior = this.ultimoEfecto.get(nombre) ?? -Infinity;
    if (ahora - anterior < 0.03) return;
    this.ultimoEfecto.set(nombre, ahora);

    this.voces = this.voces.filter((voz) => voz.fin > ahora);
    if (this.voces.length >= 24) return;
    if (this.reproducirMuestra(nombre, volumen, ahora)) return;

    let tono = 0;
    if (nombre === 'gema') {
      this.comboGema = ahora - this.ultimaGema < 0.4 ? Math.min(12, this.comboGema + 2) : 0;
      this.ultimaGema = ahora;
      tono = this.comboGema;
    }

    try {
      const nodos: AudioNode[] = [];
      const salidaVoz = contexto.createGain();
      const nivel = Math.max(0, Math.min(1, volumen)) * 0.42;
      const duracion = this.duracionEfecto(nombre);
      const ataque = ahora + 0.008;
      const fin = ahora + duracion;

      salidaVoz.gain.setValueAtTime(0.0001, ahora);
      salidaVoz.gain.exponentialRampToValueAtTime(Math.max(0.0002, nivel), ataque);
      salidaVoz.gain.exponentialRampToValueAtTime(0.0001, fin);
      salidaVoz.connect(salida);
      nodos.push(salidaVoz);

      const forma = this.parametrosEfecto(nombre);
      if (forma.ruido && this.ruido) {
        const fuente = contexto.createBufferSource();
        const filtro = contexto.createBiquadFilter();
        fuente.buffer = this.ruido;
        fuente.loop = true;
        filtro.type = forma.filtro ?? 'lowpass';
        filtro.frequency.setValueAtTime(forma.corte ?? 2200, ahora);
        fuente.connect(filtro);
        filtro.connect(salidaVoz);
        fuente.start(ahora);
        fuente.stop(fin + 0.02);
        nodos.push(fuente, filtro);
      }

      if (forma.frecuencia > 0) {
        const oscilador = contexto.createOscillator();
        const ganancia = contexto.createGain();
        oscilador.type = forma.tipo ?? 'triangle';
        oscilador.frequency.setValueAtTime(forma.frecuencia * Math.pow(2, tono / 12), ahora);
        if (forma.finalFrecuencia) {
          oscilador.frequency.exponentialRampToValueAtTime(forma.finalFrecuencia, fin);
        }
        ganancia.gain.setValueAtTime(forma.ruido ? 0.55 : 1, ahora);
        oscilador.connect(ganancia);
        ganancia.connect(salidaVoz);
        oscilador.start(ahora);
        oscilador.stop(fin + 0.02);
        nodos.push(oscilador, ganancia);
      }

      this.voces.push({ nodos, fin: fin + 0.1 });
    } catch {
      // Un dispositivo de audio puede rechazar nodos al desconectarse.
    }
  }

  musicaIniciar(): void {
    // Si la grabación de la pista ya está lista, suena ella en lugar del dron sintetizado.
    if (this.habilitadaMusica && this.pistas.has(this.pistaDeseada)) {
      this.actualizarPista();
      return;
    }
    if (!this.habilitadaMusica || !this.contexto || this.musicaActiva) return;
    const contexto = this.contexto;
    if (contexto.state !== 'running') return;

    try {
      this.musicaActiva = true;
      const ahora = contexto.currentTime;
      const destino = contexto.createGain();
      destino.gain.setValueAtTime(0.0001, ahora);
      destino.gain.exponentialRampToValueAtTime(0.13, ahora + 1.5);
      destino.connect(contexto.destination);
      this.gananciaMusica = destino;

      const dron = contexto.createGain();
      dron.gain.setValueAtTime(0.0001, ahora);
      dron.gain.linearRampToValueAtTime(0.12 + this.intensidadActual * 0.05, ahora + 1.5);
      dron.connect(destino);
      this.gananciaDron = dron;

      const filtro = contexto.createBiquadFilter();
      filtro.type = 'lowpass';
      filtro.frequency.setValueAtTime(this.frecuenciaDron(), ahora);
      filtro.connect(dron);
      this.filtroDron = filtro;

      const lfo = contexto.createOscillator();
      const profundidad = contexto.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.08, ahora);
      profundidad.gain.setValueAtTime(3, ahora);
      lfo.connect(profundidad);
      profundidad.connect(filtro.frequency);
      lfo.start(ahora);

      const osciladorA = contexto.createOscillator();
      const osciladorB = contexto.createOscillator();
      osciladorA.type = 'sawtooth';
      osciladorB.type = 'sine';
      osciladorA.frequency.setValueAtTime(36, ahora);
      osciladorB.frequency.setValueAtTime(36.7, ahora);
      osciladorA.connect(filtro);
      osciladorB.connect(filtro);
      osciladorA.start(ahora);
      osciladorB.start(ahora);
      this.nodosMusica.push(destino, dron, filtro, lfo, profundidad, osciladorA, osciladorB);

      this.programarNota();
    } catch {
      this.musicaActiva = false;
      this.liberarMusica();
    }
  }

  musicaDetener(): void {
    if (!this.musicaActiva) return;
    this.musicaActiva = false;
    if (this.temporizador !== null) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }

    const contexto = this.contexto;
    const ganancia = this.gananciaMusica;
    if (!contexto || !ganancia) {
      this.liberarMusica();
      return;
    }

    try {
      const ahora = contexto.currentTime;
      ganancia.gain.cancelScheduledValues(ahora);
      ganancia.gain.setValueAtTime(Math.max(0.0001, ganancia.gain.value), ahora);
      ganancia.gain.exponentialRampToValueAtTime(0.0001, ahora + 1.5);
      // Se separan los nodos que se apagan ahora: si la música vuelve a empezar
      // antes de que termine el fundido, la limpieza no debe tocar los nuevos.
      const viejos = this.nodosMusica;
      this.nodosMusica = [];
      this.gananciaMusica = null;
      this.gananciaDron = null;
      this.filtroDron = null;
      setTimeout(() => this.desconectar(viejos), 1600);
    } catch {
      this.liberarMusica();
    }
  }

  intensidad(valor: number): void {
    this.intensidadActual = Math.max(0, Math.min(1, Number.isFinite(valor) ? valor : 0));
    const contexto = this.contexto;
    const s = this.pistaSonando;
    if (contexto && s) {
      try {
        s.ganancia.gain.setTargetAtTime(this.volumenPista(s.pista), contexto.currentTime, 0.5);
      } catch {
        // Sin cambio de volumen.
      }
    }
    const filtro = this.filtroDron;
    const ganancia = this.gananciaDron;
    if (!contexto || !filtro || !ganancia) return;

    const ahora = contexto.currentTime;
    filtro.frequency.setTargetAtTime(this.frecuenciaDron(), ahora, 0.25);
    ganancia.gain.setTargetAtTime(0.12 + this.intensidadActual * 0.05, ahora, 0.25);
  }

  private configurarAudio(): void {
    const contexto = this.contexto;
    if (!contexto) return;

    try {
      const compresor = contexto.createDynamicsCompressor();
      compresor.threshold.value = -20;
      compresor.knee.value = 18;
      compresor.ratio.value = 3;
      compresor.attack.value = 0.008;
      compresor.release.value = 0.18;
      compresor.connect(contexto.destination);

      const maestro = contexto.createGain();
      maestro.gain.value = 0.75;
      maestro.connect(compresor);

      const longitud = Math.max(1, Math.floor(contexto.sampleRate * 2));
      const ruido = contexto.createBuffer(1, longitud, contexto.sampleRate);
      const datos = ruido.getChannelData(0);
      for (let i = 0; i < longitud; i += 1) datos[i] = Math.random() * 2 - 1;

      this.maestroEfectos = maestro;
      this.ruido = ruido;
    } catch {
      this.limpiarAudio();
    }
  }

  private parametrosEfecto(nombre: Efecto): {
    frecuencia: number;
    finalFrecuencia?: number;
    tipo?: OscillatorType;
    ruido?: boolean;
    filtro?: BiquadFilterType;
    corte?: number;
  } {
    switch (nombre) {
      case 'golpe': return { frecuencia: 110, finalFrecuencia: 48, tipo: 'triangle', ruido: true, corte: 900 };
      case 'muerte': return { frecuencia: 180, finalFrecuencia: 42, tipo: 'sawtooth', ruido: true, filtro: 'lowpass', corte: 650 };
      case 'gema': return { frecuencia: 660, finalFrecuencia: 990, tipo: 'sine' };
      case 'nivel': return { frecuencia: 440, finalFrecuencia: 880, tipo: 'triangle' };
      case 'dano': return { frecuencia: 210, finalFrecuencia: 75, tipo: 'square', ruido: true, corte: 1500 };
      case 'tajo': return { frecuencia: 1300, finalFrecuencia: 220, tipo: 'sawtooth', ruido: true, filtro: 'highpass', corte: 1600 };
      case 'daga': return { frecuencia: 1700, finalFrecuencia: 480, tipo: 'triangle', ruido: true, filtro: 'highpass', corte: 2500 };
      case 'campana': return { frecuencia: 740, finalFrecuencia: 520, tipo: 'sine' };
      case 'runa': return { frecuencia: 310, finalFrecuencia: 620, tipo: 'sine' };
      case 'boton': return { frecuencia: 460, finalFrecuencia: 340, tipo: 'square' };
      case 'aceite': return { frecuencia: 95, finalFrecuencia: 140, tipo: 'triangle', ruido: true, corte: 500 };
      case 'cofre': return { frecuencia: 280, finalFrecuencia: 560, tipo: 'triangle', ruido: true, corte: 1200 };
      case 'victoria': return { frecuencia: 392, finalFrecuencia: 784, tipo: 'triangle' };
      case 'derrota': return { frecuencia: 240, finalFrecuencia: 55, tipo: 'sawtooth' };
      case 'jefe': return { frecuencia: 70, finalFrecuencia: 38, tipo: 'sawtooth', ruido: true, corte: 800 };
      case 'esquiva': return { frecuencia: 620, finalFrecuencia: 1500, tipo: 'sine', ruido: true, filtro: 'highpass', corte: 2200 };
      case 'moneda': return { frecuencia: 990, finalFrecuencia: 1320, tipo: 'sine' };
    }
  }

  private duracionEfecto(nombre: Efecto): number {
    switch (nombre) {
      case 'muerte':
      case 'victoria':
      case 'derrota':
      case 'nivel':
      case 'cofre':
        return 0.65;
      case 'gema':
      case 'moneda':
      case 'campana':
      case 'runa':
        return 0.42;
      case 'golpe':
      case 'dano':
      case 'tajo':
      case 'daga':
      case 'boton':
      case 'aceite':
      case 'jefe':
      case 'esquiva':
        return 0.24;
    }
  }

  private programarNota(): void {
    if (!this.musicaActiva || !this.contexto) return;
    const demora = 2000 + Math.random() * 3000;
    this.temporizador = setTimeout(() => {
      this.temporizador = null;
      if (!this.musicaActiva || !this.contexto || !this.gananciaMusica) return;
      this.crearNotaMusical();
      this.programarNota();
    }, demora);
  }

  private crearNotaMusical(): void {
    const contexto = this.contexto;
    const salida = this.gananciaMusica;
    if (!contexto || !salida) return;

    try {
      const escala = [0, 2, 3, 5, 7, 10];
      const grados = escala[Math.floor(Math.random() * escala.length)] ?? 0;
      const octava = Math.random() < 0.78 ? 3 : 4;
      const midi = 50 + grados + (octava - 3) * 12;
      const frecuencia = 440 * Math.pow(2, (midi - 69) / 12);
      const ahora = contexto.currentTime;
      const fin = ahora + 1.8;

      const oscilador = contexto.createOscillator();
      const envolvente = contexto.createGain();
      const eco = contexto.createDelay(1);
      const realimentacion = contexto.createGain();
      const mezclaEco = contexto.createGain();

      oscilador.type = 'sine';
      oscilador.frequency.setValueAtTime(frecuencia, ahora);
      envolvente.gain.setValueAtTime(0.0001, ahora);
      envolvente.gain.exponentialRampToValueAtTime(0.12, ahora + 0.12);
      envolvente.gain.exponentialRampToValueAtTime(0.0001, fin);
      eco.delayTime.value = 0.32 + Math.random() * 0.18;
      realimentacion.gain.value = 0.32;
      mezclaEco.gain.value = 0.35;

      oscilador.connect(envolvente);
      envolvente.connect(salida);
      envolvente.connect(eco);
      eco.connect(mezclaEco);
      mezclaEco.connect(salida);
      eco.connect(realimentacion);
      realimentacion.connect(eco);

      oscilador.start(ahora);
      oscilador.stop(fin + 0.05);
      const nodos: AudioNode[] = [oscilador, envolvente, eco, realimentacion, mezclaEco];
      this.nodosMusica.push(...nodos);
      setTimeout(() => {
        for (const nodo of nodos) {
          try { nodo.disconnect(); } catch { /* Ya desconectado. */ }
        }
        this.nodosMusica = this.nodosMusica.filter((nodo) => !nodos.includes(nodo));
      }, 4500);
    } catch {
      // La música puede continuar aunque una nota falle.
    }
  }

  private frecuenciaDron(): number {
    return 110 + this.intensidadActual * 70;
  }

  private desconectar(nodos: AudioNode[]): void {
    for (const nodo of nodos) {
      try {
        if (nodo instanceof OscillatorNode) nodo.stop();
        nodo.disconnect();
      } catch {
        // El nodo ya había terminado.
      }
    }
  }

  private liberarMusica(): void {
    this.desconectar(this.nodosMusica);
    this.nodosMusica = [];
    this.gananciaMusica = null;
    this.gananciaDron = null;
    this.filtroDron = null;
  }

  private limpiarAudio(): void {
    this.liberarMusica();
    this.contexto = null;
    this.maestroEfectos = null;
    this.ruido = null;
  }
}

