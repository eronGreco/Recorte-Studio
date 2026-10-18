import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync} from 'node:fs';
import {pythonCommand} from '../hardware/python-runtime.mjs';

// Test output lives separately from the application's real data and artwork.
export const repoRoot = fileURLToPath(new URL('../', import.meta.url)).replaceAll('\\', '/').replace(/\/$/, '');
const output = path.resolve(process.env.RECORTE_TEST_ROOT || path.join(repoRoot, '.test-output'));
export const workRoot = path.join(output, 'work').replaceAll('\\', '/');
export const reportsRoot = path.join(output, 'reports').replaceAll('\\', '/');
export const fixtureRoot = path.join(repoRoot, 'test/fixtures').replaceAll('\\', '/');
export const python = pythonCommand();
for (const directory of [workRoot, reportsRoot]) mkdirSync(directory, {recursive: true});
