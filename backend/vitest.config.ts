import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tests touch a real Postgres database — must run sequentially to avoid
    // cross-test interference (no parallel forks or threads).
    pool: 'forks',
    isolate: false,
    fileParallelism: false,
    setupFiles: ['./test/setup.ts'],
    testTimeout: 15000,
    include: ['test/**/*.test.ts'],
  },
});
