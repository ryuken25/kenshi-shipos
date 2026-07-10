import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2] || 'http://127.0.0.1:3011';
const app = process.argv[3] || 'shipos';
const outDir = path.join(process.cwd(), 'qa', 'shots');
fs.mkdirSync(outDir, { recursive: true });

const viewports = [
  [320,700],[360,800],[390,844],[430,932],[768,1024],[1024,768],[1280,800],[1440,900],[1920,1080],
];
const routes = ['#mission','#tasks','#focus','#blockers','#prompts','#decisions','#log','#stats','#settings'];
const results = [];

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox','--disable-dev-shm-usage'] });
for (const [width,height] of viewports) {
  for (const route of routes) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));
    const url = `${base}/${route}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(900);
    if (route === '#tasks') {
      await page.getByPlaceholder('New task title').fill('QA mobile task');
      await page.getByRole('button', { name: /^Add$/ }).click();
      await page.waitForTimeout(200);
    }
    if (route === '#log') {
      // Ensure tab rendered; no forced interaction needed.
      await page.waitForSelector('text=Ship Log Generator', { timeout: 10000 });
    }
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      bodyScrollWidth: document.body.scrollWidth,
      title: document.title,
    }));
    const passOverflow = overflow.scrollWidth <= overflow.innerWidth && overflow.bodyScrollWidth <= overflow.innerWidth;
    const shotName = `${app}-${route.replace('#','')}-${width}.png`;
    await page.screenshot({ path: path.join(outDir, shotName), fullPage: true });
    const result = { app, base, route, width, height, passOverflow, errors, screenshot: `qa/shots/${shotName}`, ...overflow };
    results.push(result);
    console.log(`${passOverflow && errors.length===0 ? 'PASS' : 'FAIL'} ${route} ${width} overflow=${overflow.scrollWidth}/${overflow.innerWidth} errors=${errors.length}`);
    await context.close();
  }
}
await browser.close();
fs.writeFileSync(path.join(process.cwd(), 'qa', `${app}-qa-results.json`), JSON.stringify(results, null, 2));
const failed = results.filter(r => !r.passOverflow || r.errors.length);
if (failed.length) {
  console.error(`QA_FAILED ${failed.length}`);
  console.error(JSON.stringify(failed.slice(0, 5), null, 2));
  process.exit(1);
}
console.log(`QA_PASS ${results.length}`);
