import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@scde-integration': resolve(process.env.SCDE_INTEGRATED_SOURCE || 'dist/integrated-source') } },
  test: {
    environment: 'jsdom',
    include: ['src/features/admin/real-backend/components.integration.jsx'],
    testTimeout: 30000,
    env: { VITE_MOCK_API: 'false', VITE_API_URL: 'http://127.0.0.1:8000' },
  },
});
