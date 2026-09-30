import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
await build({ absWorkingDir: root, entryPoints: ['agent/internal/ui/web/main.js'], outfile: 'agent/internal/ui/web/assets/isabella.js', bundle: true, minify: true, format: 'iife', target: ['es2020'], legalComments: 'eof' });
console.log('Isabella UI embedded bundle ready (Three.js, offline).');
