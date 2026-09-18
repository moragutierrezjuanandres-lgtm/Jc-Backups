import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const defaultDataDirectory = () => path.join(process.platform === 'win32'
  ? (process.env.ProgramData || 'C:/ProgramData') : path.join(os.homedir(), '.local', 'share'), 'JCEnterprise', 'data');

export function dataDirectory() {
  const directory = process.env.JC_DATA_DIR || defaultDataDirectory();
  if (!path.isAbsolute(directory)) throw new Error('JC_DATA_DIR debe ser una ruta absoluta fuera del repositorio.');
  const relative = path.relative(projectRoot, directory);
  if (!relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) {
    throw new Error('JC_DATA_DIR debe quedar fuera del repositorio. Ejecuta npm run migrate:data.');
  }
  if (!fs.existsSync(path.join(directory, 'portal.sqlite')) && fs.existsSync(path.join(projectRoot, 'data', 'portal.sqlite'))) {
    throw new Error('Hay datos anteriores sin migrar. Detén el servidor y ejecuta npm run migrate:data.');
  }
  return directory;
}
