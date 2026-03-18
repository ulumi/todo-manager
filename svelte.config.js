import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  preprocess: vitePreprocess(),
  compilerOptions: {
    // Disable a11y warnings — this is a migration, not a greenfield project
    accessors: false,
  },
  onwarn: (warning, handler) => {
    // Suppress a11y warnings during migration
    if (warning.code.startsWith('a11y')) return
    handler(warning)
  }
}
