import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      './runtimeConfig': './runtimeConfig.browser',
    }
  },
  server: {
    port: 5233,
    proxy: {
      '/api-dev': {
        target: 'https://api-dev.usetalky.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-dev/, ''),
        secure: true,
      },
      '/s3-dev': {
        target: 'https://talky-invoice-v2-dev-6136.s3.amazonaws.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/s3-dev/, ''),
        secure: true,
      },
      '/s3-prod': {
        target: 'https://talky-invoice-v2-prod-6136.s3.amazonaws.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/s3-prod/, ''),
        secure: true,
      },
      '/agent-api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/agent-api/, ''),
        ws: true,
      },
    },
  },
  define: {
    global: 'window',
  }
})
