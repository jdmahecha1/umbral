/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// La versión del juego sale de package.json y se muestra en el menú.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  define: { __VERSION__: JSON.stringify(version) },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    assetsInlineLimit: 0,
    rolldownOptions: {
      output: {
        // Phaser va en su propio archivo: casi nunca cambia, así que el navegador lo
        // guarda en caché y en cada publicación solo se descarga de nuevo el código del juego.
        codeSplitting: { groups: [{ name: 'phaser', test: /node_modules[\\/]phaser[\\/]/ }] },
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
