/** Dónde y en qué formación aparecen los enemigos, y cómo se separan entre sí. */
import type { Rng } from './rng';

export interface Punto {
  x: number;
  y: number;
}

export interface Vista {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/** Elige un punto a una distancia corta del borde visible. */
export function puntoFueraDeVista(rng: Rng, vista: Vista, margen = 24): Punto {
  const ancho = Math.max(0, vista.ancho);
  const alto = Math.max(0, vista.alto);
  const distancia = margen + rng() * 40;
  const perimetro = 2 * (ancho + alto);
  let tramo = rng() * perimetro;

  if (tramo < ancho) {
    return { x: vista.x + tramo, y: vista.y - distancia };
  }
  tramo -= ancho;

  if (tramo < alto) {
    return { x: vista.x + ancho + distancia, y: vista.y + tramo };
  }
  tramo -= alto;

  if (tramo < ancho) {
    return { x: vista.x + ancho - tramo, y: vista.y + alto + distancia };
  }
  tramo -= ancho;

  return { x: vista.x - distancia, y: vista.y + alto - tramo };
}

/** Distribuye puntos equidistantes alrededor de un círculo. */
export function anillo(centro: Punto, radio: number, cantidad: number, desfase = 0): Punto[] {
  const total = Math.max(0, Math.floor(cantidad));
  if (total === 0) return [];

  return Array.from({ length: total }, (_, indice) => {
    const angulo = desfase + (2 * Math.PI * indice) / total;
    return {
      x: centro.x + Math.cos(angulo) * radio,
      y: centro.y + Math.sin(angulo) * radio,
    };
  });
}

/** Coloca un grupo compacto fuera de un lado, alineado con el jugador. */
export function enjambre(
  rng: Rng,
  vista: Vista,
  centroJugador: Punto,
  cantidad: number,
  margen = 24,
): Punto[] {
  const total = Math.max(0, Math.floor(cantidad));
  if (total === 0) return [];

  const lado = Math.floor(rng() * 4);
  const distancia = margen + rng() * 40;
  const dispersar = (): number => (rng() - 0.5) * 40;
  const puntos: Punto[] = [];

  for (let i = 0; i < total; i++) {
    const x = centroJugador.x + dispersar();
    const y = centroJugador.y + dispersar();
    // Profundidad hacia afuera: el grupo entra como una mancha, no como una fila.
    const fondo = rng() * 20;

    if (lado === 0) {
      puntos.push({ x, y: vista.y - distancia - fondo });
    } else if (lado === 1) {
      puntos.push({ x: vista.x + vista.ancho + distancia + fondo, y });
    } else if (lado === 2) {
      puntos.push({ x, y: vista.y + vista.alto + distancia + fondo });
    } else {
      puntos.push({ x: vista.x - distancia - fondo, y });
    }
  }

  return puntos;
}

/** Devuelve el empuje necesario para resolver una superposición. */
export function separar(px: number, py: number, qx: number, qy: number, radioMin: number): Punto {
  const dx = px - qx;
  const dy = py - qy;
  const distancia = Math.hypot(dx, dy);
  const superposicion = radioMin - distancia;

  if (superposicion <= 0) return { x: 0, y: 0 };
  if (distancia === 0) return { x: superposicion, y: 0 };

  return {
    x: (dx / distancia) * superposicion,
    y: (dy / distancia) * superposicion,
  };
}

/** Devuelve la dirección unitaria desde p hacia q. */
export function direccionHacia(px: number, py: number, qx: number, qy: number): Punto {
  const dx = qx - px;
  const dy = qy - py;
  const distancia = Math.hypot(dx, dy);

  if (distancia === 0) return { x: 0, y: 0 };
  return { x: dx / distancia, y: dy / distancia };
}

