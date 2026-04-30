import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/auto.ts'],
  format: ['esm'],
  platform: 'browser',
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['html2canvas-pro'],
});
