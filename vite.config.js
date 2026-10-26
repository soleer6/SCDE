import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.jsx'],
    testTimeout: 30000,
    env: { VITE_MOCK_API: 'true', VITE_MOCK_LATENCY: '0' },
  },
})
