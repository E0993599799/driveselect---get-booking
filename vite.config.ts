import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';

function forceEnvFromDotEnv() {
  const envPath = path.resolve(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, 'utf8');
  const rows = raw.split(/\r?\n/);

  for (const row of rows) {
    const line = row.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;

    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key.startsWith('VITE_')) {
      process.env[key] = value;
    }
  }
}

forceEnvFromDotEnv();

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // framer-motion@12 ships broken ESM exports (dist/es/index.mjs missing).
      // Force Vite to use the CJS build which is intact.
      'framer-motion': path.resolve(__dirname, 'node_modules/framer-motion/dist/cjs/index.js'),
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    // Proxy /api requests to Express dev server (local dev only)
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
  },
});
