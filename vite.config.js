import { defineConfig } from 'vite';
import { createApiMiddleware } from './server/api.js';

// The /api/* routes (model routing to Ollama or Claude) are mounted straight into
// Vite's dev and preview servers, so `npm run dev` is the only command needed.
const halcyonApi = () => ({
  name: 'halcyon-api',
  configureServer(server) { server.middlewares.use(createApiMiddleware()); },
  configurePreviewServer(server) { server.middlewares.use(createApiMiddleware()); },
});

export default defineConfig({
  plugins: [halcyonApi()],
  server: { port: 5180, strictPort: false },
  preview: { port: 4180 },
  build: { chunkSizeWarningLimit: 1600, target: 'es2022' },
});
