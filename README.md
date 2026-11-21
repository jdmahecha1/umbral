# Umbral

Juego de acción por oleadas en pixel art para el navegador. Un cazador con un farol aguanta la noche en un bosque maldito: te mueves, apuntas y atacas, recoges ámbar para subir de nivel y eliges mejoras. El farol es tu visión y se va apagando; si no recoges aceite, el bosque se te viene encima a oscuras.

> En desarrollo: ya se puede jugar una noche completa, de principio a fin.

## Cómo se juega

- **Personaje:** al pulsar Jugar eliges con quién pasar la noche. Todos están disponibles desde el principio y cada uno gana en algo y lo paga en otra cosa.
- **Moverse:** WASD o flechas. En el celular, arrastra el dedo por la mitad izquierda de la pantalla.
- **Atacar:** clic izquierdo (se puede mantener presionado) o barra espaciadora; las armas apuntan al cursor. En el celular, mantén el dedo en la mitad derecha: atacas y las armas apuntan al enemigo más cercano. Ninguna arma ataca sola, salvo que actives "Ataque automático" en el menú o en la pausa.
- **Esquivar:** Shift o clic derecho (en el celular, el botón pequeño junto al de ataque). Un impulso rápido durante el que nada te hace daño; tarda un poco en recargarse.
- **Subir de nivel:** recoge el ámbar que sueltan los enemigos y elige una de tres mejoras. Cada tarjeta dice qué hace la mejora y qué números cambian. Si no te convence ninguna, puedes volver a tirar (3 veces por noche) o saltar y llevarte unas monedas.
- **Rarezas:** cada mejora y cada artículo del mercader es Común, Rara, Épica o Legendaria. Lo más raro sale menos, pero una vez que lo tienes, sus mejoras salen tan seguido como las demás.
- **El farol:** se gasta. El aceite que sueltan algunos enemigos lo rellena. Sin aceite, la luz se reduce al mínimo.
- **El mercader:** tres veces por noche el tiempo se detiene y puedes gastar las monedas de la partida en reliquias (revivir una vez, esquivar golpes, más daño…) o en objetos de un solo uso. Siempre trae el objeto propio de tu personaje.
- **Sin combinaciones rotas:** daño, velocidad, recargas y armadura tienen topes, así que ninguna mezcla de personaje, mejoras, reliquias y Altar rompe el juego (hay una prueba que revisa todas las combinaciones).
- **El Altar:** al terminar ganas brasas, que se guardan para siempre. En el menú las cambias por mejoras permanentes.
- **La noche:** dura 10 minutos. A los 5 llega el Guardián de musgo y, al amanecer, el Ciervo de Ceniza. Si lo vences, ganas.
- **Pausa:** Esc o P, o el botón II.

## Contenido

| | |
|---|---|
| Personajes | El Cazador (equilibrado), La Verduga (mucho daño, poca vida), El Leñador (aguanta mucho, pega poco), El Zorro (rápido y frágil), La Farolera (luz y experiencia) |
| Armas | Hoz de plata, Dagas de hueso, Llamarada del farol, Runas errantes, Campana de difuntos (8 niveles cada una) |
| Mejoras pasivas | Paso ligero, Corazón de roble, Musgo curativo, Ámbar imantado, Piedra de afilar, Reloj de arena, Mecha larga, Coraza de cuero, Pluma de cuervo |
| Reliquias del mercader | Amuleto del segundo aliento, Cáliz de ámbar, Capa de sombra, Cota de espinas, Linterna de plata, Colmillo de lobo, Botas de siete leguas |
| Objetos de personaje | Cuerno de caza (Cazador), Hacha del verdugo (Verduga), Savia de roble (Leñador), Cola de zorro (Zorro), Farol de vidrio soplado (Farolera) |
| Altar | Vigor, Fuerza, Agilidad, Aceite de reserva, Codicia, Saber |
| Enemigos | Fuego fatuo, Lobo hueco, Espantajo, Ánima en pena, Bruja del pantano, Raizón |
| Jefes | Guardián de musgo y El Ciervo de Ceniza |

## Lo que lo hace distinto

- **La luz como recurso.** Lo que queda fuera del farol se ve en penumbra, y el aceite se gasta con el tiempo.
- **Arte 100 % propio.** Todos los sprites están dibujados como mapas de píxeles en el código (`src/art/`) y las texturas se generan al arrancar. No se descarga ninguna imagen.
- **Sonido.** La música y algunos efectos (tajos, dagas, golpes, esquiva, monedas) son grabaciones con licencia CC0 de Kenney, Kistol y congusbongus ([créditos](public/sonidos/CREDITOS.md)); el resto se sintetiza con Web Audio. Si un archivo no carga, el juego usa el sonido sintetizado.

## Tecnología

- [Phaser 4](https://phaser.io), TypeScript y Vite.
- Vitest para la lógica del juego (`src/logic/`), que no depende de Phaser y se prueba por separado.

## Desarrollo

```bash
npm install
npm run dev        # servidor local
npm test           # pruebas unitarias
npm run test:e2e   # pruebas de extremo a extremo en Chrome (escritorio y móvil)
npm run build      # versión de producción en dist/
```

Parámetros útiles en el servidor local:

- `/?galeria` muestra todo el arte ampliado.
- `/?jugar&semilla=7&desde=290&monedas=100` empieza una partida directamente, con una semilla fija, en un segundo concreto de la noche y con monedas, para probar los jefes y al mercader.
- `/?jugar&bot&rapido=6` deja jugar a un bot a 6 veces la velocidad normal.
- `/?jugar&personaje=zorro` empieza directamente con un personaje (`cazador`, `verdugo`, `lenador`, `zorro` o `farolera`).

Herramientas de prueba:

- `node scripts/simular.mjs 3 6` simula 3 noches con el bot y resume hasta dónde llega en cada minuto. Sirve para ajustar la dificultad. Necesita el servidor en el puerto 5174 (`npx vite --port 5174`). Para probar un personaje: `PERSONAJE=zorro node scripts/simular.mjs 3 6`.
- `node scripts/capturas.mjs [escritorio|movil]` guarda capturas de las pantallas principales en `test-results/`.

## Desarrollo con IA

Este proyecto se desarrolló con ayuda de herramientas de inteligencia artificial: Claude (Anthropic) como asistente principal de programación, y Gemini y Codex para borradores, pruebas y revisiones de código. Todo lo que propusieron se revisó, se probó y se corrigió antes de integrarlo; el diseño del juego, las decisiones y la dirección del proyecto son míos.

## Créditos

Creado por **toriikarii**, con aportes de [kyotto44](https://github.com/kyotto44) (rarezas y elección de personaje).

## Licencia

**Todos los derechos reservados.** Puedes jugar y leer el código, pero no copiarlo, modificarlo, publicarlo ni venderlo sin permiso. Las contribuciones al repositorio se aceptan bajo las condiciones del archivo [LICENSE](LICENSE). Las versiones publicadas hasta el 20 de noviembre de 2026 siguen bajo la licencia MIT.
