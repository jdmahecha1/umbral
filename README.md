# Umbral

Juego de acción por oleadas en pixel art para el navegador. Un cazador con un farol aguanta la noche en un bosque maldito: sus armas atacan solas, tú solo te mueves, recoges ámbar para subir de nivel y eliges mejoras. El farol es tu visión y se va apagando; si no recoges aceite, el bosque se te viene encima a oscuras.

> En desarrollo: ya se puede jugar una noche completa, de principio a fin.

## Cómo se juega

- **Moverse:** WASD o flechas; en el móvil, arrastra el dedo en cualquier parte de la pantalla. Las armas atacan solas.
- **Subir de nivel:** recoge el ámbar que sueltan los enemigos y elige una de tres mejoras (con el ratón, el dedo o las teclas 1, 2 y 3).
- **El farol:** se gasta. El aceite que sueltan algunos enemigos lo rellena. Sin aceite, la luz se reduce al mínimo.
- **La noche:** dura 10 minutos. A los 5 llega el Guardián de musgo y, al amanecer, el Ciervo de Ceniza. Si lo vences, ganas.
- **Pausa:** Esc o P.

## Contenido

| | |
|---|---|
| Armas | Hoz de plata, Dagas de hueso, Farol sagrado, Runas errantes, Campana de difuntos (5 niveles cada una) |
| Mejoras pasivas | Botas, Corazón de roble, Musgo, Ámbar imantado, Piedra de afilar, Reloj de arena, Mecha larga, Coraza |
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
- `/?jugar&semilla=7&desde=290` empieza una partida directamente, con una semilla fija y en un segundo concreto de la noche, para probar los jefes.

`node scripts/probar.mjs 30` juega una partida automática de 30 segundos en Chrome y guarda capturas en `test-results/`.

## Desarrollo con IA

Este proyecto se desarrolló con ayuda de herramientas de inteligencia artificial: Claude (Anthropic) como asistente principal de programación, y Gemini y Codex para borradores, pruebas y revisiones de código. Todo lo que propusieron se revisó, se probó y se corrigió antes de integrarlo; el diseño del juego, las decisiones y la dirección del proyecto son míos.

## Licencia

Código bajo licencia MIT.
