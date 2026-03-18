import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { execSync } from 'child_process'

const gitBranch = (() => {
  try { return execSync('git rev-parse --abbrev-ref HEAD').toString().trim() } catch { return '' }
})()

export default defineConfig({
  plugins: [svelte()],
  server: { port: 5174 },
  define: { __GIT_BRANCH__: JSON.stringify(gitBranch) },
  build: { rollupOptions: { input: 'svelte.html' } },
  // Firebase modules use CDN imports — exclude them from Vite's dep optimizer
  optimizeDeps: {
    exclude: []
  },
  // Allow CDN imports from Firebase gstatic CDN
  resolve: {
    conditions: ['browser']
  }
})
