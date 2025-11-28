import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Legacy plugin for mobile Telegram WebView compatibility
    legacy({
      targets: ['defaults', 'not IE 11', 'iOS >= 12', 'Safari >= 12', 'Chrome >= 64'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      renderLegacyChunks: true,
      polyfills: true,
      modernPolyfills: true
    })
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2015',
    minify: 'terser',
    cssMinify: true,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
  esbuild: {
    target: 'es2015',
  },
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
})
