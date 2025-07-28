import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/lib/index.ts',
    'styles/viewer': 'src/styles/viewer.css',
  },
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', 'pdfjs-dist'],
  esbuildOptions: (options) => {
    options.banner = {
      js: '"use client"',
    }
  },
}) 