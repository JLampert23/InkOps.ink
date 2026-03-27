import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  build: {
    rollupOptions: {
      external: [],
    },
    copyPublicDir: true,
  },
  server: {
    port: 5173,
    strictPort: false,
  }
})
