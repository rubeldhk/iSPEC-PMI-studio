import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Dev-server plumbing, not application behaviour: the API client calls a
    // RELATIVE `/v1` on purpose — same-origin is what keeps the SameSite=Lax
    // session cookie attached, in dev and in production alike. In production
    // one origin serves both; in dev this proxy is that origin. Without it the
    // first UAT sign-in hit the Vite server itself and 404ed. The API's port
    // is overridable for machines where 3000 is taken (compose-file precedent).
    proxy: {
      '/v1': `http://localhost:${process.env['PMI_API_PORT'] ?? 3000}`,
    },
  },
});
