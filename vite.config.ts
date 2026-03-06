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
    port: 5123,
    proxy: {
      '/api-dev': {
        target: 'https://api-dev.usetalky.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-dev/, ''),
        secure: true,
      },
    },
  },
  define: {
    global: 'window',
  }
})
