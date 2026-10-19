import path from 'node:path';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

export function pythonCommand(env = process.env) {
  if (env.RECORTE_PYTHON) return env.RECORTE_PYTHON;
  const installed=process.resourcesPath && path.join(process.resourcesPath,'runtime/python/python.exe');
  if(process.platform==='win32' && installed && existsSync(installed))return installed;
  const root = path.dirname(fileURLToPath(import.meta.url));
  const bundled = path.resolve(root, '../runtime/python/python.exe');
  if (process.platform === 'win32' && existsSync(bundled)) return bundled;
  return process.platform === 'win32' ? 'python' : 'python3';
}
