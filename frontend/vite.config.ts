/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

// 开发时把 /api、/health 反代到 Gin（默认 http://127.0.0.1:8080），
// 生产由 Gin 自己托管 dist/ 并做 SPA 兜底（见 backend/server/route.go）。
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_PROXY || 'http://127.0.0.1:8080'

  return {
    base: '/',
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      strictPort: false,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/health': { target: apiTarget, changeOrigin: true },
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      // 内容 hash 的资源由后端给长缓存；sourcemap 只在非生产构建产出
      sourcemap: mode !== 'production',
      chunkSizeWarningLimit: 900,
    },
    test: {
      environment: 'node',
      include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
      globals: false,
      // P1 起 domain/api 单测已落地；保留 passWithNoTests 以便只跑局部用例时不报错
      passWithNoTests: true,
    },
  }
})
