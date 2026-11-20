import type { Horda } from './horda';
import type { Jugador } from './jugador';
import type { Objetos } from './objetos';

/**
 * Jugador automático para medir la dificultad (solo con ?bot en la URL).
 * Huye del grupo más cercano, recoge lo que tiene a mano y ataca al enemigo más próximo.
 */
export class Bot {
  private t = 0;

  constructor(
    private j: Jugador,
    private horda: Horda,
    private objetos: Objetos,
  ) {}

  actualizar(dt: number): void {
    this.t += dt;
  }

  vector(): { x: number; y: number } {
    const j = this.j;
    let fx = 0;
    let fy = 0;
    // Repulsión de los enemigos cercanos, más fuerte cuanto más cerca.
    this.horda.enCirculo(j.x, j.y, 70, (e) => {
      const dx = j.x - e.x;
      const dy = j.y - e.y;
      const d = Math.max(4, Math.hypot(dx, dy));
      const peso = (e.def.jefe ? 3 : 1) / (d * d);
      fx += dx * peso;
      fy += dy * peso;
    });
    const peligro = Math.hypot(fx, fy);
    // Sin peligro cerca, va a por lo que hay en el suelo; si no, da vueltas.
    const meta = peligro < 0.004 ? this.objetos.masCercano(j.x, j.y, 120) : null;
    if (meta) {
      fx += (meta.x - j.x) * 0.002;
      fy += (meta.y - j.y) * 0.002;
    } else {
      fx += Math.cos(this.t * 0.4) * 0.002;
      fy += Math.sin(this.t * 0.4) * 0.002;
    }
    const m = Math.hypot(fx, fy);
    return m > 0 ? { x: fx / m, y: fy / m } : { x: 0, y: 0 };
  }

  atacando(): boolean {
    return this.horda.masCercano(this.j.x, this.j.y, 120) !== null;
  }

  apunte(): { x: number; y: number } | null {
    // Como haría una persona: si el jefe está a tiro, se le apunta a él.
    const jefe = this.horda.jefe;
    if (jefe && Math.hypot(jefe.x - this.j.x, jefe.y - this.j.y) < 110) return { x: jefe.x, y: jefe.y - 10 };
    const e = this.horda.masCercano(this.j.x, this.j.y, 200);
    return e ? { x: e.x, y: e.y - 6 } : null;
  }

  bloquear(): void {}
}
