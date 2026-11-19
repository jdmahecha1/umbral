/**
 * Rejilla espacial para buscar enemigos cercanos sin recorrerlos todos.
 * Se vacía y se rellena en cada fotograma: con cientos de enemigos es mucho
 * más barato que comparar todos contra todos.
 */
export class Rejilla {
  private celdas = new Map<number, number[]>();
  private libres: number[][] = [];

  constructor(readonly tam: number) {}

  private clave(cx: number, cy: number): number {
    // Desplaza para admitir coordenadas negativas en una sola clave numérica.
    return (cx + 32768) * 65536 + (cy + 32768);
  }

  vaciar(): void {
    for (const lista of this.celdas.values()) {
      lista.length = 0;
      this.libres.push(lista);
    }
    this.celdas.clear();
  }

  insertar(id: number, x: number, y: number): void {
    const k = this.clave(Math.floor(x / this.tam), Math.floor(y / this.tam));
    let lista = this.celdas.get(k);
    if (!lista) {
      lista = this.libres.pop() ?? [];
      this.celdas.set(k, lista);
    }
    lista.push(id);
  }

  /** Llama a `fn` con cada id de las celdas que tocan el círculo (x, y, r). Puede incluir falsos positivos. */
  consultar(x: number, y: number, r: number, fn: (id: number) => void): void {
    const x0 = Math.floor((x - r) / this.tam);
    const x1 = Math.floor((x + r) / this.tam);
    const y0 = Math.floor((y - r) / this.tam);
    const y1 = Math.floor((y + r) / this.tam);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const lista = this.celdas.get(this.clave(cx, cy));
        if (lista) for (const id of lista) fn(id);
      }
    }
  }
}
