# Cómo colaborar en Umbral

Guía para quien ayuda con las actualizaciones del juego. Si tienes permiso de colaborador, puedes subir cambios directamente: la web se actualiza sola cuando las pruebas pasan.

## 1. Preparar tu equipo (una sola vez)

1. Acepta la invitación al repositorio. Llega a tu correo, o la ves en <https://github.com/jdmahecha1/umbral/invitations>.
2. Instala [Git](https://git-scm.com/downloads) y [Node.js 24](https://nodejs.org/).
3. Descarga el proyecto e instala lo que necesita:

```bash
git clone https://github.com/jdmahecha1/umbral.git
cd umbral
npm install
```

4. Arráncalo con `npm run dev` y abre la dirección que aparece, normalmente <http://localhost:5173>. Los cambios que guardes se ven al instante.

## 2. El día a día

```bash
git pull                     # 1. trae lo último antes de empezar
npm run dev                  # 2. trabaja y prueba en el navegador
npm test                     # 3. pruebas rápidas (segundos)
npm run build                # 4. comprueba que compila sin errores
git add -A
git commit -m "Qué cambiaste, en una frase"
git push                     # 5. súbelo
```

Opcional, pero recomendado antes de cambios grandes: `npm run test:e2e`. Abre Chrome y juega solo para comprobar el menú, la partida, la tienda y el Altar.

## 3. Qué pasa al subir

1. GitHub ejecuta el **CI**: pruebas unitarias, compilación y pruebas de punta a punta. Tarda unos 2-3 minutos.
2. Si todo sale bien, el juego se **publica solo** en <https://jdmahecha1.github.io/umbral/>.
3. Si algo falla, **la web no cambia**: se queda con la última versión que funcionaba. Lo ves en la pestaña **Actions** del repositorio; abre la ejecución en rojo para ver qué prueba falló, corrígelo y vuelve a subir.

## 4. Trabajar entre dos sin pisarse

- Avisa a tu compañero de qué parte vas a tocar.
- Si `git push` dice que hay cambios nuevos, ejecuta `git pull --rebase`, revisa que el juego siga funcionando y vuelve a hacer `git push`.
- Para algo grande o experimental, trabaja en una rama (`git switch -c mi-idea`), súbela y abre un Pull Request: así el otro puede verlo antes de que llegue a la web.

## 5. Mapa del proyecto

| Carpeta | Qué hay |
|---|---|
| `src/logic/` | Las reglas del juego: armas, mejoras, enemigos, oleadas, tienda, Altar y guardado. No dependen de Phaser y tienen pruebas en `tests/`. **Aquí se ajustan los números.** |
| `src/art/` | Todo el arte. Los sprites son mapas de caracteres: cada letra es un color de `paleta.ts` y `.` es transparente. |
| `src/game/` | Las piezas de la partida: jugador, horda de enemigos, armas, objetos, controles y oscuridad. |
| `src/scenes/` | Las pantallas: menú, partida, interfaz (HUD, mejoras, tienda, pausa y final). |
| `src/audio/` | Efectos y música, sintetizados con Web Audio (no hay archivos de sonido). |
| `tests/`, `e2e/` | Pruebas unitarias (Vitest) y de punta a punta (Playwright). |
| `scripts/` | Herramientas: `simular.mjs` (un bot juega noches completas para medir la dificultad) y `capturas.mjs`. |

Atajos útiles en el servidor local:

- `/?galeria` muestra todo el arte ampliado, para revisar sprites nuevos.
- `/?jugar&desde=290&monedas=100` empieza una partida en el segundo 290 con 100 monedas, para probar jefes o la tienda.
- `/?jugar&bot&rapido=6` deja jugar al bot a 6 veces la velocidad.

Ejemplos de cambios típicos:

- **Ajustar la dificultad:** vida y velocidad de los enemigos en `src/logic/enemigos.ts`; daño de las armas en `src/logic/armas.ts`. Después, `node scripts/simular.mjs 3 6` muestra hasta dónde llega el bot.
- **Un enemigo nuevo:** dibuja su sprite en `src/art/sprites.ts`, añádelo a `SPRITES` y define sus números en `ENEMIGOS` (`src/logic/enemigos.ts`).
- **Un objeto nuevo para el mercader:** añádelo en `ARTICULOS` (`src/logic/tienda.ts`) y aplica su efecto en `comprar()` de `src/scenes/Juego.ts`.

## 6. Reglas del proyecto

- **Nunca subas contraseñas, claves, tokens ni archivos `.env`.**
- **Nada con derechos de autor:** ni imágenes, ni sonidos, ni personajes de otros juegos o animes. El arte se dibuja en el código y el sonido se sintetiza.
- **Textos en español claro**, que los entienda cualquier persona (también quien nunca ha jugado). Si una mejora cambia números, la tarjeta debe mostrarlo.
- **Deja las pruebas en verde.** Si cambias una regla a propósito, actualiza su prueba.
- **No cambies la configuración de despliegue** (`.github/workflows/`) sin hablarlo antes.
