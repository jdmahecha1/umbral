/**
 * Efectos y música sintetizados en el momento con Web Audio: el juego no carga
 * ningún archivo de sonido. Si el navegador no tiene audio, todo queda en silencio.
 */
type AjustesSonido = { sonido: boolean; musica: boolean };

export type Efecto = 'golpe'|'muerte'|'gema'|'nivel'|'dano'|'tajo'|'daga'|'campana'|'runa'|'boton'|'aceite'|'cofre'|'victoria'|'derrota'|'jefe';

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
    else this.musicaDetener();
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

