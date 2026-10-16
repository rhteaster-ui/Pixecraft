// Production screenshots with actual project assets. Run npm run build first.
import { preview } from 'vite';
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';
const server = await preview({ preview: { host: '127.0.0.1', port: 5194, strictPort: true } });
const executablePath = process.env.PIXCRAFT_TEST_CHROMIUM || await (await import('@sparticuz/chromium')).default.executablePath();
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--no-zygote', '--single-process', '--disable-dev-shm-usage'] });
const folder = 'docs/qa/screenshots'; mkdirSync(folder, { recursive: true });
try {
 const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
 const shot = async (name, fullPage = false) => { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(250); await page.screenshot({ path: folder + '/' + name + '.png', animations: 'disabled', fullPage }); };
 await page.goto('http://127.0.0.1:5194'); await page.locator('.hero-demo img').first().waitFor();
 await shot('preview-desktop'); await shot('preview-home-full', true);
 await page.setViewportSize({ width: 360, height: 800 }); await shot('preview-home-mobile', true);
 await page.goto('http://127.0.0.1:5194/studio'); await page.locator('.empty-studio').waitFor(); await shot('preview-empty-mobile');
 const photo = readFileSync('public/media/architecture.webp');
 const detail = await sharp(photo).extract({ left: 600, top: 80, width: 850, height: 850 }).webp().toBuffer();
 await page.getByLabel('Upload images', { exact: true }).setInputFiles([{ name: 'architecture.webp', mimeType: 'image/webp', buffer: photo }, { name: 'architecture-detail.webp', mimeType: 'image/webp', buffer: detail }]);
 await page.locator('.studio-shell').waitFor(); await page.setViewportSize({ width: 1440, height: 1000 });
 await page.locator('.studio-rail').getByRole('button', { name: 'Ukuran', exact: true }).click();
 await page.locator('.tool-flyout').getByRole('button', { name: /^Compress/ }).click();
 await page.getByLabel('Target KB').fill('200'); await shot('preview-editor-desktop');
 await page.setViewportSize({ width: 360, height: 800 });
 if (await page.getByRole('button', { name: 'Close settings', exact: true }).count()) await page.getByRole('button', { name: 'Close settings', exact: true }).click();
 await shot('preview-editor-mobile');
 await page.locator('.studio-rail').getByRole('button', { name: 'Ukuran', exact: true }).click(); await shot('preview-flyout-mobile');
 await page.locator('.tool-flyout').getByRole('button', { name: /^Compress/ }).click(); await shot('preview-settings-mobile');
 await page.setViewportSize({ width: 1440, height: 1000 });
 await page.locator('.document-bar').getByRole('button', { name: 'Composer', exact: true }).click();
 await page.getByRole('button', { name: /^Buat komposisi/ }).click(); await page.locator('.composer-preview').waitFor();
 await page.locator('.composer-tabs').getByRole('button', { name: 'Kanvas', exact: true }).click(); await page.getByLabel('Canvas ratio').selectOption('4:5'); await page.getByRole('button', { name: 'Selesai', exact: true }).click(); await page.waitForTimeout(800);
 await shot('preview-composer-desktop');
 for (const width of [360, 480]) {
  await page.setViewportSize({ width, height: 800 });
  if (await page.getByRole('button', { name: 'Close Composer settings', exact: true }).count()) await page.getByRole('button', { name: 'Close Composer settings', exact: true }).click();
  await shot('preview-composer-' + width);
 }
 await page.goto('http://127.0.0.1:5194/about'); await page.locator('.about-page').waitFor(); await shot('preview-about-mobile', true);
 await page.setViewportSize({ width: 1440, height: 1000 }); await shot('preview-about-desktop', true);
 console.log('PASS production screenshots: landing, empty Studio, editor, mobile flyout, Composer and About');
} finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
