import * as recortePaths from '../scripts/test-paths.mjs';
/** Run: node hardware/hardware-tests.mjs. All tests are offline; Python runs AST-selected pure functions only. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { getDeviceProfile, DEVICE_PROFILE_IDS } from './device-profiles.mjs';
import { registrationShapesMm, registrationWhiteBackdropsMm, registrationPlan } from './registration.mjs';
import { compilePathJob, quantizeSu } from './path-job.mjs';

const profile = getDeviceProfile();
const rectangle = [[30, 40], [87, 40], [87, 129], [30, 129]];
const job = (paths = [{ id: 'rect', closed: true, pointsMm: rectangle.map(p => p.slice()) }]) => ({
  version: 2, deviceProfileId: profile.id, sheet: { number: 1, widthMm: 297, heightMm: 210 },
  settings: { depth: 4, force: 18, speed: 2, passes: 1 }, paths,
});
let count = 0;
function test(name, fn) { fn(); count++; process.stdout.write('OK: ' + name + '\n'); }
function rejects(mutate, message) { const input = job(); mutate(input); assert.throws(() => compilePathJob(input), message); }

test('only implemented profile, deeply frozen; USB available, physical cut not claimed', () => {
  assert.deepEqual(DEVICE_PROFILE_IDS, ['cameo4-usbprint-a4']);
  assert.equal(profile.liveTransport, true);
  assert.equal(profile.provenance.currentImplementationPhysicallyValidated, false);
  assert.equal(profile.provenance.historicalValidationDeclared, true);
  assert.equal(profile.provenance.currentImplementationPhysicallyValidated, false);
  assert.ok(Object.isFrozen(profile.protocol.originMm));
  assert.throws(() => getDeviceProfile('cameo5'));
});
test('canonical registration geometry and per-arm white halos', () => {
  const shapes = registrationShapesMm();
  assert.deepEqual(shapes[0], [[10, 10], [15, 10], [15, 15], [10, 15]]);
  assert.deepEqual(shapes[1], [[277, 10], [287, 10], [287, 11], [277, 11]]);
  assert.deepEqual(shapes[2], [[286, 10], [287, 10], [287, 20], [286, 20]]);
  assert.deepEqual(shapes[3], [[10, 199], [20, 199], [20, 200], [10, 200]]);
  assert.deepEqual(shapes[4], [[10, 190], [11, 190], [11, 200], [10, 200]]);
  assert.deepEqual(registrationWhiteBackdropsMm(0), shapes);
  assert.deepEqual(registrationWhiteBackdropsMm(2)[1], [[275, 8], [289, 8], [289, 13], [275, 13]]);
  for (const bad of [-1, 11, NaN, Infinity, '2', true]) assert.throws(() => registrationWhiteBackdropsMm(bad));
  assert.deepEqual(registrationPlan().steps.filter(s => s.type === 'delay'), [{ type: 'delay', milliseconds: 108 }]);
  assert.ok(registrationPlan().steps.some(s => s.successResponse === '    0\x03'));
});
test('explicit v2 physical sheet and strict settings only', () => {
  const result = compilePathJob(job());
  assert.equal(result.mode, 'offline'); assert.equal(result.liveTransport, false);
  assert.equal(result.physicallyValidated, false);
  assert.equal(result.paths[0].body, 'M600,400\x03D600,1540\x03D2380,1540\x03D2380,400\x03D600,400\x03');
  rejects(j => { j.version = 1; }); rejects(j => { delete j.sheet; });
  rejects(j => { j.sheet.widthMm = 210; }); rejects(j => { j.sheet.heightMm = 297; });
  rejects(j => { j.sheet.widthMm = NaN; }); rejects(j => { j.sheet.number = 0; });
  rejects(j => { j.sheets = [j.sheet]; }); rejects(j => { j.usbCommands = 'D0,0'; });
  rejects(j => { j.settings.lineOvercut = false; }); rejects(j => { j.settings.overcutMm = 0; });
  for (const key of ['depth', 'force', 'speed', 'passes']) {
    for (const bad of [undefined, true, '1', NaN, Infinity, 0, 1.5, 999]) rejects(j => { j.settings[key] = bad; });
  }
  rejects(j => { j.registration = { armMm: 21 }; });
});
test('numeric geometry, field and work limits are strict', () => {
  for (const bad of [true, '30', NaN, Infinity, -Infinity]) rejects(j => { j.paths[0].pointsMm[0] = [bad, 40]; });
  rejects(j => { j.paths[0].pointsMm = [[-0.001, 40], [40, 40]]; });
  rejects(j => { j.paths[0].pointsMm = [[298, 40], [40, 40]]; });
  rejects(j => { j.paths[0].closed = 'true'; });
  rejects(j => { j.paths[0].pointsMm = [[30, 40, 7], [40, 40]]; });
  rejects(j => { j.paths[0].extra = 1; }); rejects(j => { j.paths[0].body = 'M0,0'; });
  rejects(j => { j.paths = []; }); rejects(j => { j.paths = Array(1); });
  rejects(j => { j.paths = Array.from({ length: 201 }, (_, i) => ({ id: String(i), closed: false, pointsMm: [[30, 40], [40, 40]] })); });
  rejects(j => { j.paths[0].pointsMm = Array.from({ length: 2001 }, () => [30, 40]); });
  rejects(j => { j.paths = [j.paths[0], { ...j.paths[0] }]; });
  rejects(j => { j.paths = Array.from({ length: 11 }, (_, i) => ({ id: String(i), closed: false, pointsMm: Array.from({ length: 2000 }, (_, k) => [30 + k * 0.05, 40]) })); });
});
test('closed/open subpaths, winding and separate pen-up moves', () => {
  const result = compilePathJob(job([
    { id: 'outer', closed: true, pointsMm: rectangle },
    { id: 'hole', closed: true, pointsMm: [[40, 50], [40, 60], [50, 60], [50, 50]] },
    { id: 'score', closed: false, pointsMm: [[60, 80], [80, 80], [80, 100]] },
  ]));
  assert.equal(result.paths.length, 3);
  assert.ok(result.paths.every(p => p.body.startsWith('M')));
  assert.equal(result.paths[2].commandCount, 3);
  const input = job(); input.settings.passes = 2;
  const repeated = compilePathJob(input);
  assert.equal(repeated.mockPlan.steps.filter(s => s.type === 'path-body').length, 2);
  assert.equal(repeated.summary.bodyBytes, repeated.paths[0].body.length * 2);
});
test('duplicates quantized away, degenerate and self-intersecting rings rejected', () => {
  const result = compilePathJob(job([{ id: 'dup', closed: true,
    pointsMm: [[30, 40], [30.001, 40], [50, 40], [50, 60], [30, 60], [30, 40]] }]));
  assert.equal(result.paths[0].pointsSu.length, 4);
  for (const points of [
    [[30, 40], [30.001, 40], [30.002, 40]],
    [[30, 40], [40, 40], [50, 40]],
    [[30, 40], [50, 60], [30, 60], [50, 40]],
    [[30, 40], [50, 40], [40, 40], [40, 60], [30, 60]],
    [[30, 40], [60, 40], [60, 60], [45, 30], [30, 60]],
  ]) assert.throws(() => compilePathJob(job([{ id: 'bad', closed: true, pointsMm: points }])));
  assert.throws(() => compilePathJob(job([{ id: 'zero', closed: false, pointsMm: [[40, 40], [40.001, 40]] }])));
});
test('true segment/mark collisions and halos; no concavity bounding-box false positive', () => {
  const line = pointsMm => job([{ id: 'line', closed: false, pointsMm }]);
  assert.throws(() => compilePathJob(line([[9, 12], [16, 12]])), /marca/);
  assert.throws(() => compilePathJob(line([[15, 15], [20, 20]])), /marca/);
  assert.throws(() => compilePathJob(line([[285.98, 12], [285.98, 19]])), /marca/); // rounds onto vertical arm
  const halo = line([[274, 12], [280, 12]]); halo.registration = { whiteBorderMm: 2 };
  assert.throws(() => compilePathJob(halo), /marca/);
  compilePathJob(line([[277.5, 12], [285, 19]])); // empty inside the L's enclosing rectangle
  compilePathJob(line([[8, 20], [8, 8], [20, 8]])); // enclosing bounds hit TL, actual bent line avoids it
  compilePathJob(job([{ id: 'concave', closed: true,
    pointsMm: [[8, 8], [20, 8], [20, 9], [9, 9], [9, 20], [8, 20]] }]));
});

test('byte equivalence to canonical pure Python functions and half-even quantization', () => {
  const python = process.env.RECORTE_TEST_PYTHON || recortePaths.python;
  const source = process.env.RECORTE_CANONICAL_BACKEND || recortePaths.repoRoot + '/hardware/vendor/cameo4_backend.py';
  const values = [-10, -2.025, -1.075, -1.025, -0.125, -0.075, -0.025, 0, 0.025, 0.075, 0.125, 1.025, 1.075, 2.025, 287];
  const script = `import ast,json,math,pathlib,sys
source=pathlib.Path(sys.argv[1]).read_text(encoding='utf-8-sig')
tree=ast.parse(source)
names={'_etx','_su','_rounded_rect_points','_path_bytes'}
nodes=[node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name in names]
assert len(nodes)==4
ns={'math':math,'REG_X_MM':10.0,'REG_Y_MM':10.0}
exec(compile(ast.Module(body=nodes,type_ignores=[]),'<canonical-pure-functions-only>','exec'),ns)
values=json.load(sys.stdin)
rect=(30.25,40.5,87.25,129.5)
fixtures=[]
for radius in (0,3):
    points=ns['_rounded_rect_points'](rect[0]-10,rect[1]-10,rect[2]-rect[0],rect[3]-rect[1],radius)
    fixtures.append({'pointsMm':[[x+10,y+10] for x,y in points],'body':ns['_path_bytes'](rect,radius).decode('ascii')})
print(json.dumps({'quantized':[round(v*20) for v in values],'fixtures':fixtures}))`;
  const expected = JSON.parse(execFileSync(python, ['-B', '-c', script, source], { input: JSON.stringify(values), encoding: 'utf8', windowsHide: true }));
  assert.deepEqual(values.map(quantizeSu), expected.quantized);
  assert.equal(quantizeSu(0.025), 0); assert.equal(quantizeSu(0.125), 2);
  assert.equal(quantizeSu(-0.025), 0); assert.equal(quantizeSu(-0.075), -2);
  for (const fixture of expected.fixtures) {
    const result = compilePathJob(job([{ id: 'canonical', closed: true, pointsMm: fixture.pointsMm }]));
    assert.equal(result.paths[0].body, fixture.body);
  }
});

process.stdout.write(`\n${count} offline hardware checks passed. No bridge or device was opened.\n`);
