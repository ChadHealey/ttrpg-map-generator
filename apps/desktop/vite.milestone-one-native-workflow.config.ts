import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(
        new URL('./test-support/milestone-one-native-workflow-bridge.ts', import.meta.url),
      ),
      fileName: () => 'bridge.mjs',
      formats: ['es'],
    },
    minify: false,
    outDir: fileURLToPath(
      new URL('./src-tauri/target/milestone-one-native-workflow', import.meta.url),
    ),
    rollupOptions: {
      external: [/^node:/u],
    },
    sourcemap: false,
    target: 'node24',
  },
});
