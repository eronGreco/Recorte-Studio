import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const icon = path.join(root, 'assets/icon.svg');
await sharp(icon).resize(512).png().toFile(path.join(root, 'assets/icon-512.png'));
await sharp(icon).resize(64).png().toFile(path.join(root, 'assets/icon-64.png'));
const sizes = [16, 32, 48, 256];
const images = await Promise.all(sizes.map(size => sharp(icon).resize(size).png().toBuffer()));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
for (let index = 0; index < sizes.length; index++) {
  const start = 6 + 16 * index, size = sizes[index];
  header[start] = header[start + 1] = size === 256 ? 0 : size;
  header.writeUInt16LE(1, start + 4); header.writeUInt16LE(32, start + 6);
  header.writeUInt32LE(images[index].length, start + 8); header.writeUInt32LE(offset, start + 12);
  offset += images[index].length;
}
await fs.writeFile(path.join(root, 'assets/icon.ico'), Buffer.concat([header, ...images]));
await sharp(path.join(root, 'assets/hero.svg')).png().toFile(path.join(root, 'assets/hero.png'));
await sharp(path.join(root, 'assets/hero.svg')).resize(1280, 640, {fit: 'contain', background: '#173f35'}).png().toFile(path.join(root, 'assets/social-preview.png'));
console.log('Brand assets generated from editable SVG sources.');
