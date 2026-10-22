import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* Component tests against the local Django of scde-integration (no mocks).
 *   npx vitest run --config src/features/grading/real-backend/vitest.config.mjs
 * Needs the API on http://127.0.0.1:8000 and the synthetic fixture in
 * %LOCALAPPDATA%/SCDE/integration/fixtures-claude.local.json (SCDE_FIXTURE_FILE overrides it).
 * Not part of `npm test`: it writes grades in the fixture organization. */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/features/grading/real-backend/*.integration.jsx'],
    testTimeout: 120000,
    fileParallelism: false,
    env: { VITE_MOCK_API: 'false', VITE_API_URL: 'http://127.0.0.1:8000' },
  },
});
