// Build a public demo and real screenshots using only synthetic artwork.
import {_electron as electron} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {repoRoot, workRoot, fixtureRoot} from './test-paths.mjs';
const profile = path.join(workRoot, 'showcase-' + Date.now());
const screenshots = path.join(repoRoot, 'docs/screenshots');
await fs.mkdir(screenshots, {recursive: true});
const app = await electron.launch({args: [repoRoot], env: {...process.env,
  RECORTE_TEST_DATA: profile, RECORTE_CAMEO_REPLAY: '1', RECORTE_TEST_HIDDEN: '1'}});
try {
  const page = await app.firstWindow();
  // Capture in a hidden test window; never cover the user's working application.
  await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows().forEach(window => window.hide()));
  page.setDefaultTimeout(45000);
  page.on('pageerror', error => console.error(error.message));
  await page.waitForSelector('#canvas[data-tool]');
  await page.waitForFunction(() => window.recorteReady);
  await page.locator('#project-name').fill('Etiquetas · frente e verso');
  await page.locator('#project-name').press('Tab');
  await page.locator('#registration-open').click();
  await page.locator('#reg-orientation').selectOption('landscape');
  await page.locator('#reg-enabled').check();
  await page.locator('#registration-close').click();
  await page.locator('#file-input').setInputFiles(path.join(fixtureRoot, 'demo-front.png'));
  const ready = () => page.waitForFunction(() => paper.project.layers.find(l => l.name === 'art').children
    .every(r => r.data.kind !== 'png' || r.data.traceInfo && !r.data.pending));
  await ready();
  await page.locator('#obj-w').fill('78'); await page.locator('#obj-w').press('Tab'); await ready();
  await page.locator('#cut-offset').fill('-0.6'); await page.locator('#cut-offset').press('Tab'); await ready();
  await page.locator('#piece-back-tab').click();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#assign-back').click();
  await (await chooser).setFiles(path.join(fixtureRoot, 'demo-back.png'));
  await page.waitForFunction(() => paper.project.layers.find(l => l.name === 'art').firstChild.data.piece.backSource);
  await page.locator('#piece-front-tab').click();
  await page.locator('#bleed-details summary').click();
  await page.locator('#bleed-enabled').check();
  await page.waitForFunction(() => paper.project.layers.find(l => l.name === 'art').firstChild.data.piece.bleedStatus?.includes('pronta'));
  if (!await page.locator('#repeat-btn').isVisible()) await page.locator('#arrange-panel summary').click();
  await page.locator('#repeat-btn').click();
  await page.locator('#repeat-cols').fill('3'); await page.locator('#repeat-rows').fill('3');
  await page.locator('#apply-repeat').click();
  await page.locator('#nest-open').click(); await page.locator('#nest-run').click();
  await page.waitForFunction(() => !document.getElementById('nest-run').disabled);
  if (await page.locator('#nest-dialog').evaluate(element => element.open)) await page.locator('#nest-dialog').evaluate(element => element.close());
  await ready();
  await page.waitForFunction(()=>paper.project.layers.find(l=>l.name==='art').children.every(r=>r.data.piece?.backBleed));
  await page.locator('#fit').click();
  await page.evaluate(() => window.recorteFlush());
  await fs.copyFile(path.join(profile, 'project-autosave.recorte'), path.join(fixtureRoot, 'demo.recorte'));
  await page.locator('#layers .layer-name').first().click();
  await page.evaluate(() => {document.querySelector('.inspector-scroll').scrollTop = 0;});
  const capture = async name => {
    await page.evaluate(() => document.getElementById('toast').classList.remove('visible'));
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const png = await page.screenshot();
    await sharp(png).webp({quality: 88}).toFile(path.join(screenshots, name + '.webp'));
  };
  await capture('editor');
  await page.locator('#side-back').click();
  await page.waitForFunction(() => paper.project.layers.find(l => l.name === 'back-preview').children.length === 9);
  await capture('verso');
  await page.locator('#side-front').click();
  await page.locator('#cut-settings-open').click();
  await capture('ajustes-de-corte');
  console.log('Public demo and screenshots created from synthetic artwork.');
} finally {
  await app.evaluate(({app})=>app.exit()).catch(()=>{});await app.close().catch(()=>{});
}
