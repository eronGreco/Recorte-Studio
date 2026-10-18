import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import {repoRoot, fixtureRoot} from './test-paths.mjs';
await fs.mkdir(fixtureRoot, {recursive: true});
// Original, synthetic artwork: no user project or commercial artwork is used.
const notch = `<svg xmlns="http://www.w3.org/2000/svg" width="750" height="1300"><path d="M32 45 245 340 372 0 498 340 710 45C780 480 735 1050 375 1300 15 1050-30 480 32 45Z" fill="#e6d8b8"/></svg>`;
await sharp(Buffer.from(notch)).png().toFile(path.join(fixtureRoot, 'contour-notch.png'));
const shape = 'M35 35H380L565 200 380 365H35Z';
const front = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><defs><clipPath id="clip"><path d="${shape}"/></clipPath></defs><g clip-path="url(#clip)"><path d="${shape}" fill="#ecdfc7"/><circle cx="540" cy="36" r="210" fill="#d3b990" opacity=".32"/><circle cx="70" cy="390" r="140" fill="#bccfba"/><path d="M0 88h390" stroke="#173f35" stroke-width="3" opacity=".3"/><text x="72" y="155" font-family="Arial" font-size="18" letter-spacing="5" fill="#557367">FEITO À MÃO</text><text x="68" y="223" font-family="Arial" font-size="43" font-weight="700" fill="#173f35">RECORTE</text><text x="73" y="269" font-family="Arial" font-size="19" letter-spacing="7" fill="#557367">STUDIO</text><path d="M74 300h210" stroke="#ee8f79" stroke-width="5"/></g></svg>`;
const back = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#173f35"/><circle cx="235" cy="200" r="125" fill="none" stroke="#a4d3b1" stroke-width="3"/><text x="235" y="193" text-anchor="middle" font-family="Arial" font-size="31" font-weight="700" fill="#faf7ed">SEU RECORTE</text><text x="235" y="234" text-anchor="middle" font-family="Arial" font-size="18" letter-spacing="3" fill="#a4d3b1">DO SEU JEITO</text></svg>`;
await sharp(Buffer.from(front)).png().toFile(path.join(fixtureRoot, 'demo-front.png'));
await sharp(Buffer.from(back)).png().toFile(path.join(fixtureRoot, 'demo-back.png'));
console.log('Synthetic artwork generated in ' + path.relative(repoRoot, fixtureRoot));
