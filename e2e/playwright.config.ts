import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 16 * 60 * 1000, // one SC-001 journey may legitimately take up to 15 min
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
});
