import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        privacy: './privacy-policy.html'
      }
    }
  }
})
