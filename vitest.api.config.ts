import { defineConfig } from 'vitest/config';
export default defineConfig({test:{include:['tests/api/**/*.test.ts'],environment:'node',fileParallelism:false,hookTimeout:120000,testTimeout:30000}});
