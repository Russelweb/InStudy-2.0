import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  },

  build: {
    // Raise the warning threshold slightly — charts libraries are inherently large
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core + routing
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Animation library (framer-motion is ~100kB)
          'vendor-framer': ['framer-motion'],
          // Chart library (recharts is ~400kB)
          'vendor-recharts': ['recharts'],
        }
      }
    }
  }
})

