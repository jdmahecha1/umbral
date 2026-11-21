# Umbral

Juego de acción por oleadas en pixel art para el navegador. Un cazador con un farol aguanta la noche en un bosque maldito: te mueves, apuntas y atacas, recoges ámbar para subir de nivel y eliges mejoras. El farol es tu visión y se va apagando; si no recoges aceite, el bosque se te viene encima a oscuras.

> En desarrollo: ya se puede jugar una noche completa, de principio a fin.

## Cómo se juega

- **Moverse:** WASD o flechas. En el celular, arrastra el dedo por la mitad izquierda de la pantalla.
- **Atacar:** clic izquierdo (se puede mantener presionado) o barra espaciadora; las armas apuntan al cursor. En el celular, mantén el dedo en la mitad derecha: atacas y las armas apuntan al enemigo más cercano. Ninguna arma ataca sola, salvo que actives "Ataque automático" en el menú o en la pausa.
- **Subir de nivel:** recoge el ámbar que sueltan los enemigos y elige una de tres mejoras. Cada tarjeta dice qué hace la mejora y qué números cambian.
- **El farol:** se gasta. El aceite que sueltan algunos enemigos lo rellena. Sin aceite, la luz se reduce al mínimo.
- **El mercader:** tres veces por noche el tiempo se detiene y puedes gastar las monedas de la partida en reliquias (revivir una vez, esquivar golpes, más daño…) o en objetos de un solo uso.
- **El Altar:** al terminar ganas brasas, que se guardan para siempre. En el menú las cambias por mejoras permanentes.
- **La noche:** dura 10 minutos. A los 5 llega el Guardián de musgo y, al amanecer, el Ciervo de Ceniza. Si lo vences, ganas.
- **Pausa:** Esc o P, o el botón II.

## Contenido

| | |
|---|---|
| Armas | Hoz de plata, Dagas de hueso, Llamarada del farol, Runas errantes, Campana de difuntos (5 niveles cada una) |
| Mejoras pasivas | Paso ligero, Corazón de roble, Musgo curativo, Ámbar imantado, Piedra de afilar, Reloj de arena, Mecha larga, Coraza de cuero |
| Reliquias del mercader | Amuleto del segundo aliento, Cáliz de ámbar, Capa de sombra, Cota de espinas, Linterna de plata, Colmillo de lobo, Botas de siete leguas |
| Altar | Vigor, Fuerza, Agilidad, Aceite de reserva, Codicia, Saber |
| Enemigos | Fuego fatuo, Lobo hueco, Espantajo, Ánima en pena, Bruja del pantano, Raizón |
| Jefes | Guardián de musgo y El Ciervo de Ceniza |

## Lo que lo hace distinto

- **La luz como recurso.** Lo que queda fuera del farol se ve en penumbra, y el aceite se gasta con el tiempo.
- **Arte 100 % propio.** Todos los sprites están dibujados como mapas de píxeles en el código (`src/art/`) y las texturas se generan al arrancar. No se descarga ninguna imagen.
- **Sonido sintetizado.** Efectos y música se generan con Web Audio. No se carga ningún archivo de audio.

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

Herramientas de prueba:

- `node scripts/simular.mjs 3 6` simula 3 noches con el bot y resume hasta dónde llega en cada minuto. Sirve para ajustar la dificultad.
- `node scripts/capturas.mjs [escritorio|movil]` guarda capturas de las pantallas principales en `test-results/`.

## Desarrollo con IA

Este proyecto se desarrolló con ayuda de herramientas de inteligencia artificial: Claude (Anthropic) como asistente principal de programación, y Gemini y Codex para borradores, pruebas y revisiones de código. Todo lo que propusieron se revisó, se probó y se corrigió antes de integrarlo; el diseño del juego, las decisiones y la dirección del proyecto son míos.

## Licencia

Código bajo licencia MIT.
