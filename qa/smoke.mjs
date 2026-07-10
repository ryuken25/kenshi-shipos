import { chromium } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:3011';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox','--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', err => errors.push(err.message));

async function goMobile(label) {
  if (['Mission','Tasks','Focus'].includes(label)) {
    await page.getByRole('navigation', { name: /Mobile ShipOS nav/i }).getByRole('button', { name: new RegExp(label, 'i') }).click();
  } else {
    await page.getByRole('navigation', { name: /Mobile ShipOS nav/i }).getByRole('button', { name: /More/i }).click();
    await page.getByRole('button', { name: new RegExp(label, 'i') }).last().click();
  }
  await page.waitForTimeout(250);
}

await page.goto(`${base}/#tasks`, { waitUntil: 'domcontentloaded' });
await page.getByPlaceholder('New task title').fill('Smoke task done appears in ship log');
await page.getByPlaceholder('Notes / acceptance criteria').fill('Created by Playwright smoke');
await page.getByRole('button', { name: /^Add$/ }).click();
await page.waitForTimeout(250);
await page.getByRole('button', { name: /Move to today/i }).first().click();
await page.getByRole('button', { name: /Move to doing/i }).first().click();
await page.getByRole('button', { name: /Move to done/i }).first().click();
await goMobile('Ship Log');
await page.waitForSelector('text=Ship Log Generator');
const logText = await page.locator('pre').first().innerText({ timeout: 10000 });
if (!logText.includes('Smoke task done appears in ship log')) throw new Error('Done task missing from Ship Log');
await goMobile('Focus');
await page.getByRole('button', { name: /^10m$/ }).click();
await page.locator('button').filter({ hasText: '' }).nth(4).click().catch(async()=>{});
await page.waitForTimeout(300);
await page.locator('button').filter({ hasText: '' }).nth(5).click().catch(async()=>{});
await goMobile('Settings');
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: /Export JSON/i }).click(),
]);
const name = download.suggestedFilename();
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(400);
await goMobile('Ship Log');
const persisted = await page.locator('pre').first().innerText({ timeout: 10000 });
if (!persisted.includes('Smoke task done appears in ship log')) throw new Error('Reload persistence failed');
await browser.close();
if (errors.length) throw new Error(`Console errors: ${errors.join('\n')}`);
console.log(`SMOKE_PASS export=${name}`);
