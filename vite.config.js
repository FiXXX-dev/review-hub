import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // на GitHub Pages сайт раздаётся из подпапки /review-hub/ — база задаётся в workflow
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
