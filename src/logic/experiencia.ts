/** Experiencia necesaria para pasar del nivel `n` al `n + 1`. */
export function xpParaNivel(n: number): number {
  if (n < 1) return 4;
  // Curva suave al principio y más empinada después del nivel 20.
  const base = 4 + (n - 1) * 5;
  return n > 20 ? Math.round(base * (1 + (n - 20) * 0.06)) : base;
}

export interface Progreso {
  nivel: number;
  xp: number;
}

/** Suma experiencia y devuelve cuántos niveles se subieron. Muta `p`. */
export function sumarXp(p: Progreso, cantidad: number): number {
  p.xp += cantidad;
  let subidas = 0;
  while (p.xp >= xpParaNivel(p.nivel)) {
    p.xp -= xpParaNivel(p.nivel);
    p.nivel++;
    subidas++;
  }
  return subidas;
}
