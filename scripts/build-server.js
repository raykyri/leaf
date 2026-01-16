import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

// Ensure output directory exists
const outDir = 'dist/server';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Build the server
await esbuild.build({
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/server/index.js',
  sourcemap: true,
  external: [
    // Keep native modules external
    'better-sqlite3',
    // Keep optional peer deps external
    'fsevents',
  ],
  // Handle .ts extensions in imports
  resolveExtensions: ['.ts', '.js'],
  banner: {
    js: `
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
`.trim(),
  },
});

console.log('Server build complete!');
