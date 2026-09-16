import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { viteSingleFile } = require('vite-plugin-singlefile')

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  resolve: {
    preserveSymlinks: true
  },

  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
