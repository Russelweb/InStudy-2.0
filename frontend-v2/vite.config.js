import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    host: '0.0.0.0',   // Bind to all interfaces so phones on the same WiFi can connect
    port: 5173,
    allowedHosts: ['jenelle-coleopterous-doreen.ngrok-free.dev'],
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  },

  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':   ['react', 'react-dom', 'react-router-dom'],
          'vendor-framer':  ['framer-motion'],
          'vendor-recharts':['recharts'],
        }
      }
    }
  }
})