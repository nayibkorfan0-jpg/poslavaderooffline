import { build } from 'esbuild';
import { join, dirname } from 'path';
import { rmSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Clean dist-electron directory
try {
  rmSync(join(__dirname, 'dist-electron'), { recursive: true, force: true });
} catch {}

// Create dist-electron directories
mkdirSync(join(__dirname, 'dist-electron', 'main'), { recursive: true });
mkdirSync(join(__dirname, 'dist-electron', 'preload'), { recursive: true });

// Build main process
build({
  entryPoints: [join(__dirname, 'electron', 'main.ts')],
  outfile: join(__dirname, 'dist-electron', 'main', 'index.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  minify: true,
  sourcemap: false,
}).then(() => {
  console.log('✓ Electron main process built successfully');
}).catch((error) => {
  console.error('✗ Failed to build electron main process:', error);
  process.exit(1);
});

// Build preload script
build({
  entryPoints: [join(__dirname, 'electron', 'preload.ts')],
  outfile: join(__dirname, 'dist-electron', 'preload', 'index.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  minify: true,
  sourcemap: false,
}).then(() => {
  console.log('✓ Electron preload script built successfully');
}).catch((error) => {
  console.error('✗ Failed to build electron preload script:', error);
  process.exit(1);
});