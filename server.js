import { start } from './lib/app.js';
import fs from 'node:fs';
const envFile = new URL('./.env', import.meta.url);
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
start().catch(error => { console.error(error.message); process.exitCode = 1; });
