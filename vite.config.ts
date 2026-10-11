import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { host: true },
  preview: { host: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) return 'vendor-firebase'
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react'
            if (id.includes('@capacitor')) return 'vendor-capacitor'
            if (id.includes('qrcode')) return 'vendor-qrcode'
          }
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
})
