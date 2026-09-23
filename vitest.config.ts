import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary'],
      include: ['lib/**/*.ts'],
      exclude: ['**/index.ts', '**/types.ts'],
    },
  },
});
