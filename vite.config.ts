import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => ({
  plugins: [vue(), tailwindcss()],
  server: {
    proxy: {
      '/vps-api': {
        target: loadEnv(mode, '.', 'JOYNO_').JOYNO_API_PROXY_TARGET || loadEnv(mode, '.', 'JOYNO_').JOYNO_VPS_TUNNEL_URL || 'https://joynoadmin.tech',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/vps-api(?=\/)/, ''),
      },
    },
  },
}))
