import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [],
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.vite.html'),
      },
    },
    target: 'es2022',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
      format: {
        comments: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@core': resolve(__dirname, 'src/core'),
      '@api': resolve(__dirname, 'src/api'),
      '@reasoning': resolve(__dirname, 'src/reasoning'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@mytypes': resolve(__dirname, 'src/types'),
    },
  },
  server: {
    port: 8080,
    open: true,
  },
})
