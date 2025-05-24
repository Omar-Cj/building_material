import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
  },
 
  // Multi-page: pick up both HTML files
  // No special config needed unless you want custom rollup settings
});