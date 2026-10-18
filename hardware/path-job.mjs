import { getDeviceProfile } from './device-profiles.mjs';
import {normalizeOvercut,overcutMotions} from './overcut.mjs';
import { registrationPlan, registrationShapesMm, registrationWhiteBackdropsMm, registrationGeometry, REGISTRATION_KEYS } from './registration.mjs';

const EPS = 1e-9;
function object(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error(label + ': objeto inválido.');
  if (Object.keys(value).some(k => !keys.includes(k))) throw new Error(label + ': campo não permitido.');
}
function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(label + ': número finito obrigatório.');
  return value;
}
function integer(value, range, label) {
  if (!Number.isInteger(finite(value, label)) || value < range[0] || value > range[1]) throw new Error(label + ': fora da faixa permitida.');
  return value;
}

import {quantizeSu} from './machine-units.mjs';
export {quantizeSu};

const equal = (a, b) => a[0] === b[0] && a[1] === b[1];
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function onSegment(a, b, p) {
  return Math.abs(cross(a, b, p)) <= EPS && p[0] >= Math.min(a[0], b[0]) - EPS &&
    p[0] <= Math.max(a[0], b[0]) + EPS && p[1] >= Math.min(a[1], b[1]) - EPS && p[1] <= Math.max(a[1], b[1]) + EPS;
}
function intersects(a, b, c, d) {
  const x = cross(a, b, c), y = cross(a, b, d), z = cross(c, d, a), w = cross(c, d, b);
  return ((x > EPS && y < -EPS || x < -EPS && y > EPS) &&
    (z > EPS && w < -EPS || z < -EPS && w > EPS)) ||
    onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}
function pointInPolygon(p, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j], b = polygon[i];
    if (onSegment(a, b, p)) return true;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function edges(points, closed) {
  return points.slice(closed ? 0 : 1).map((_, i) => closed ? [points[i], points[(i + 1) % points.length]] : [points[i], points[i + 1]]);
}
export function assertNoMarkCollision(points, closed, reserved) {
  for (const [a, b] of edges(points, closed)) for (const shape of reserved) {
    if (pointInPolygon(a, shape) || pointInPolygon(b, shape) || edges(shape, true).some(([c, d]) => intersects(a, b, c, d))) {
      throw new Error('O trajeto toca uma marca de registro ou seu fundo branco reservado.');
    }
  }
}
function assertTopology(points, closed) {
  if (!closed) return;
  let area2 = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], c = points[(i + 2) % points.length];
    area2 += a[0] * b[1] - b[0] * a[1];
    if (Math.abs(cross(a, b, c)) <= EPS && (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) < 0) {
      throw new Error('Contorno fechado com segmento que retorna sobre si.');
    }
  }
  if (Math.abs(area2) <= EPS) throw new Error('Contorno fechado degenerado ou sem área.');
  const lines = edges(points, true);
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    if (j === i + 1 || i === 0 && j === lines.length - 1) continue;
    if (intersects(...lines[i], ...lines[j])) throw new Error('Contorno fechado com cruzamento ou contato consigo mesmo.');
  }
}

/**
 * Validates and compiles one physical sheet, offline only.
 * Input: {version:2, deviceProfileId, sheet:{number,widthMm,heightMm},
 * settings:{depth,force,speed,passes}, registration?:{whiteBorderMm},
 * paths:[{id,closed,pointsMm:[[x,y],...]}]}.
 * Output contains per-path ASCII M/D bodies and a descriptive registration/mock plan.
 * It contains no live transport, AutoBlade writes or cancellation command.
 * Collision means the cut trajectory touches a reserved polygon; interiors alone do
 * not collide. This preserves concavities and independent nested contours/holes.
 */
export function compilePathJob(job) {
  object(job, ['version', 'deviceProfileId', 'sheet', 'settings', 'registration', 'overcut', 'paths'], 'Trabalho');
  const overcut=normalizeOvercut(job.overcut);
  if (job.version !== 2) throw new Error('Contrato de corte deve ser versão 2.');
  if (typeof job.deviceProfileId !== 'string') throw new Error('Perfil explícito obrigatório.');
  const profile = getDeviceProfile(job.deviceProfileId), r = profile.registration;
  object(job.sheet, ['number', 'widthMm', 'heightMm'], 'Folha');
  integer(job.sheet.number, [1, 1000000], 'Número da folha');
  finite(job.sheet.widthMm,'Largura');finite(job.sheet.heightMm,'Altura');
  object(job.settings, ['depth', 'force', 'speed', 'passes'], 'Lâmina');
  const settings = Object.fromEntries(['depth', 'force', 'speed', 'passes'].map(k => [k, integer(job.settings[k], profile.tools[k], k)]));
  let whiteBorderMm = 0;
  if (job.registration !== undefined) {
    object(job.registration, ['whiteBorderMm', ...REGISTRATION_KEYS], 'Marcas');
    whiteBorderMm = job.registration.whiteBorderMm===undefined?0:finite(job.registration.whiteBorderMm, 'Borda branca');
  }
  const options=Object.fromEntries(REGISTRATION_KEYS.filter(k=>job.registration?.[k]!==undefined).map(k=>[k,job.registration[k]]));
  const geometry=registrationGeometry(profile.id,{widthMm:job.sheet.widthMm,heightMm:job.sheet.heightMm,...options});
  const blackShapesMm=registrationShapesMm(profile.id,geometry.parameters),whiteShapesMm=registrationWhiteBackdropsMm(whiteBorderMm,profile.id,geometry.parameters);
  if (!Array.isArray(job.paths) || !job.paths.length || job.paths.length > profile.limits.pathsPerJob) throw new Error('Quantidade de contornos inválida.');
  const seen = new Set(); let totalInputPoints = 0, bodyBytes = 0, totalLengthMm = 0,totalMotionPoints=0,overcutCorners=0;
  const paths = Array.from(job.paths, path => {
    object(path, ['id', 'closed', 'pointsMm'], 'Contorno');
    if (typeof path.id !== 'string' || !path.id.trim() || path.id.length > 80 || seen.has(path.id)) throw new Error('Identificador de contorno inválido ou repetido.');
    seen.add(path.id);
    if (typeof path.closed !== 'boolean') throw new Error('closed deve ser verdadeiro ou falso.');
    if (!Array.isArray(path.pointsMm) || path.pointsMm.length > profile.limits.pointsPerPath) throw new Error('Quantidade de pontos inválida.');
    totalInputPoints += path.pointsMm.length;
    if (totalInputPoints > profile.limits.pointsPerJob) throw new Error('Trabalho tem pontos demais.');
    const raw = Array.from(path.pointsMm, point => {
      if (!Array.isArray(point) || point.length !== 2) throw new Error('Cada ponto deve conter exatamente X e Y.');
      const x = finite(point[0], 'X'), y = finite(point[1], 'Y');
      if (x < 0 || x > job.sheet.widthMm || y < 0 || y > job.sheet.heightMm) throw new Error('Trajeto fora da folha.');
      return [x, y];
    });
    const pointsSu = [];
    for (const [x, y] of raw) {
      const point = [quantizeSu(x - geometry.originMm[0]), quantizeSu(y - geometry.originMm[1])];
      if (!pointsSu.length || !equal(pointsSu.at(-1), point)) pointsSu.push(point);
    }
    if (path.closed && pointsSu.length > 1 && equal(pointsSu[0], pointsSu.at(-1))) pointsSu.pop();
    if (pointsSu.length < (path.closed ? 3 : 2)) throw new Error('Contorno colapsou após a quantização de 0,05 mm.');
    assertTopology(pointsSu, path.closed);
    const quantizedPointsMm = pointsSu.map(([x, y]) => [x / 20 + geometry.originMm[0], y / 20 + geometry.originMm[1]]);
    assertNoMarkCollision(raw, path.closed, whiteShapesMm);
    assertNoMarkCollision(quantizedPointsMm, path.closed, whiteShapesMm);
    const extra=overcutMotions(raw,path.closed,overcut);
    const motions=extra?extra.chunks.map(chunk=>{
      if(chunk.some(([x,y])=>x<0||x>job.sheet.widthMm||y<0||y>job.sheet.heightMm))throw Error('O sobrecorte ultrapassa a folha. Reduza a extensão ou mova a peça.');
      const su=[];for(const [x,y]of chunk){const q=[quantizeSu(x-geometry.originMm[0]),quantizeSu(y-geometry.originMm[1])];if(!su.length||!equal(su.at(-1),q))su.push(q);}
      if(su.length<2)throw Error('Segmento de sobrecorte pequeno demais para a resolução da máquina.');
      const mm=su.map(([x,y])=>[x/20+geometry.originMm[0],y/20+geometry.originMm[1]]);
      assertNoMarkCollision(chunk,false,whiteShapesMm);assertNoMarkCollision(mm,false,whiteShapesMm);
      for(const [x,y]of mm)if(x<geometry.bounds.left||x>geometry.bounds.right||y<geometry.bounds.top||y>geometry.bounds.bottom)throw Error('O sobrecorte ultrapassa a área de corte. Reduza a extensão ou afaste a peça das marcas.');
      return {closed:false,pointsSu:su,quantizedPointsMm:mm};
    }):[{closed:path.closed,pointsSu,quantizedPointsMm}];
    overcutCorners+=extra?.corners||0;totalMotionPoints+=motions.reduce((s,m)=>s+m.pointsSu.length,0);if(totalMotionPoints>profile.limits.pointsPerJob)throw Error('Sobrecorte gera pontos demais para um trabalho.');
    const commands=motions.flatMap(m=>{const c=m.pointsSu.map(([x,y],i)=>`${i===0?'M':'D'}${y},${x}\x03`);if(m.closed)c.push(`D${m.pointsSu[0][1]},${m.pointsSu[0][0]}\x03`);return c;});
    const body = commands.join(''); bodyBytes += body.length * settings.passes;
    if (bodyBytes > profile.limits.maxBodyBytes) throw new Error('Plano de corte grande demais.');
    const lengthMm = motions.reduce((sum,m)=>sum+edges(m.quantizedPointsMm,m.closed).reduce((s,[a,b])=>s+Math.hypot(b[0]-a[0],b[1]-a[1]),0),0);
    totalLengthMm += lengthMm * settings.passes;
    if (totalLengthMm > profile.limits.maxTravelMm) throw new Error('Comprimento total de corte acima do limite.');
    return { id: path.id, closed: path.closed, pointsSu, quantizedPointsMm, body, commandCount: commands.length, lengthMm,...(extra?{motions}:{} ) };
  });
  const plan = registrationPlan(profile.id,geometry.parameters);
  return { version: 2, mode: 'offline', liveTransport: false, physicallyValidated: false,
    deviceProfileId: profile.id, sheet: { ...job.sheet }, settings, registration: { whiteBorderMm, blackShapesMm, whiteShapesMm, plan, geometry },
    overcut,paths, summary: { pathCount: paths.length, inputPoints: totalInputPoints,overcutCorners,
      quantizedPoints: paths.reduce((n, p) => n + (p.motions?p.motions.reduce((s,m)=>s+m.pointsSu.length,0):p.pointsSu.length), 0), bodyBytes, totalLengthMm },
    mockPlan: { liveTransport: false, sheetNumber: job.sheet.number,
      steps: [...plan.steps, { type: 'tool-configuration-description', holder: profile.tools.holder, tool: profile.tools.type, settings: { ...settings } },
        ...paths.flatMap(path => Array.from({ length: settings.passes }, (_, i) => ({ type: 'path-body', pathId: path.id, pass: i + 1, body: path.body, after: 'expect-ready' }))),
        { type: 'end-of-sheet-description', note: 'Canonical baseline ends with M0,0 and READY; no command is emitted by this offline plan.' }],
      warning: 'Nenhum dispositivo foi acessado. Trajetos arbitrários e esta implementação ainda exigem validação física.' } };
}
