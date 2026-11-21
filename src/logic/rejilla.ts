/**
 * Rejilla espacial para buscar enemigos cercanos sin recorrerlos todos.
 * Se vacía y se rellena en cada fotograma: con cientos de enemigos es mucho
 * más barato que comparar todos contra todos.
 *
 * Por dentro usa arreglos de números fijos en lugar de un Map de listas: al
 * rellenarla no se crea ningún objeto, y las búsquedas recorren memoria
 * contigua. Las celdas se reparten en cubetas por un hash; cada entrada guarda
 * su celda exacta para no devolver vecinos de otra celda que caiga en la misma cubeta.
 */
const CUBETAS = 1024; // potencia de dos
const MASCARA = CUBETAS - 1;

function cubeta(cx: number, cy: number): number {
  return (Math.imul(cx, 0x9e3779b1) ^ Math.imul(cy, 0x85ebca77)) & MASCARA;
}

export class Rejilla {
  private n = 0;
  private ids = new Int32Array(256);
  private cxs = new Int32Array(256);
  private cys = new Int32Array(256);
  /** Entradas ordenadas por cubeta (se reconstruyen tras insertar). */
  private orden = new Int32Array(256);
  /** Dónde empieza cada cubeta dentro de `orden` (CUBETAS + 1 posiciones). */
  private inicio = new Int32Array(CUBETAS + 1);
  private cursor = new Int32Array(CUBETAS);
  private ordenada = true;
  /** Resultado de la última llamada a `vecinos`. */
  encontrados = new Int32Array(64);

  constructor(readonly tam: number) {}

  vaciar(): void {
    this.n = 0;
    this.ordenada = false;
  }

  insertar(id: number, x: number, y: number): void {
    if (this.n === this.ids.length) this.crecer();
    const i = this.n++;
    this.ids[i] = id;
    this.cxs[i] = Math.floor(x / this.tam);
    this.cys[i] = Math.floor(y / this.tam);
    this.ordenada = false;
  }

  private crecer(): void {
    const doble = (a: Int32Array) => {
      const b = new Int32Array(a.length * 2);
      b.set(a);
      return b;
    };
    this.ids = doble(this.ids);
    this.cxs = doble(this.cxs);
    this.cys = doble(this.cys);
    this.orden = new Int32Array(this.ids.length);
  }

  /** Ordena las entradas por cubeta (ordenación por conteo: un recorrido para contar y otro para colocar). */
  private ordenar(): void {
    const inicio = this.inicio;
    inicio.fill(0);
    for (let i = 0; i < this.n; i++) inicio[cubeta(this.cxs[i]!, this.cys[i]!) + 1]!++;
    for (let b = 0; b < CUBETAS; b++) inicio[b + 1]! += inicio[b]!;
    // Coloca cada entrada usando una copia de los inicios como cursor.
    const cursor = this.cursor;
    cursor.set(inicio.subarray(0, CUBETAS));
    for (let i = 0; i < this.n; i++) this.orden[cursor[cubeta(this.cxs[i]!, this.cys[i]!)]!++] = i;
    this.ordenada = true;
  }

  /** Llama a `fn` con cada id de las celdas que tocan el círculo (x, y, r). Puede incluir falsos positivos. */
  consultar(x: number, y: number, r: number, fn: (id: number) => void): void {
    const total = this.vecinos(x, y, r);
    // Copia: `fn` podría hacer otra búsqueda y pisar `encontrados`.
    const lista = total > 0 ? this.encontrados.slice(0, total) : this.encontrados;
    for (let i = 0; i < total; i++) fn(lista[i]!);
  }

  /**
   * Como `consultar`, pero sin función: deja los ids en `encontrados` y
   * devuelve cuántos son. Pensado para los bucles que se repiten miles de veces
   * por fotograma. La siguiente llamada sobrescribe el resultado.
   */
  vecinos(x: number, y: number, r: number): number {
    if (!this.ordenada) this.ordenar();
    const x0 = Math.floor((x - r) / this.tam);
    const x1 = Math.floor((x + r) / this.tam);
    const y0 = Math.floor((y - r) / this.tam);
    const y1 = Math.floor((y + r) / this.tam);
    let total = 0;
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const b = cubeta(cx, cy);
        const fin = this.inicio[b + 1]!;
        for (let k = this.inicio[b]!; k < fin; k++) {
          const i = this.orden[k]!;
          if (this.cxs[i] !== cx || this.cys[i] !== cy) continue;
          if (total === this.encontrados.length) {
            const mas = new Int32Array(total * 2);
            mas.set(this.encontrados);
            this.encontrados = mas;
          }
          this.encontrados[total++] = this.ids[i]!;
        }
      }
    }
    return total;
  }
}
