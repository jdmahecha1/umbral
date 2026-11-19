import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/jersey-10/400.css';
import Phaser from 'phaser';
import { Arranque } from './scenes/Arranque';
import { Galeria } from './scenes/Galeria';
import { Hud } from './scenes/Hud';
import { Juego } from './scenes/Juego';
import { FondoMenu, Menu } from './scenes/Menu';

const juego = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'juego',
  backgroundColor: '#07050c',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  render: {
    // Píxeles grandes y nítidos aunque la cámara use un zoom no entero.
    smoothPixelArt: true,
    antialias: true,
  },
  input: { activePointers: 3 },
  fps: { target: 60 },
  scene: [Arranque, FondoMenu, Menu, Juego, Hud, Galeria],
});

// Gancho mínimo para las pruebas automáticas: solo lectura del estado.
(window as unknown as { __umbral: Phaser.Game }).__umbral = juego;
