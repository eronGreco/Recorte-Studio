import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {repoRoot, python} from './test-paths.mjs';

const group = process.argv[2] || 'unit';
if (!['unit', 'ui', 'all'].includes(group)) throw new Error('Use unit, ui or all.');
const files = [...readdirSync(repoRoot).filter(name => name.endsWith('-tests.mjs')),
  ...readdirSync(path.join(repoRoot, 'hardware')).filter(name => name.endsWith('-tests.mjs')).map(name => 'hardware/' + name)];
let suites = 0;
for (const file of files.sort()) {
  const ui = /from ['"]playwright['"]/.test(readFileSync(path.join(repoRoot, file), 'utf8'));
  if (group !== 'all' && ui !== (group === 'ui')) continue;
  console.log('\nRunning ' + file);
  const result = spawnSync(process.execPath, [file], {cwd: repoRoot, stdio: 'inherit',
    env: {...process.env, RECORTE_CAMEO_REPLAY: '1', RECORTE_TEST_HIDDEN: '1'}, windowsHide: true,
    timeout: ui ? 300000 : 60000});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
  suites++;
}
if (group !== 'ui') {
  const result = spawnSync(python, ['hardware/cameo_worker_tests.py'], {cwd: repoRoot, stdio: 'inherit', windowsHide: true});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
  suites++;
}
console.log(`\n${suites} suites passed (${group}). Hardware operations use test doubles.`);
