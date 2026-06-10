// Automated test: PDF always fits on one page + per-day start times.
// Setup (same as test_save_resume.js):
//   npm i -D playwright --no-save
//   npx webpack --target web --output-path dist-test
//   node test_pdf_fit.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const APP_URL = 'file:///' + path.join(__dirname, 'dist-test', 'index.html').split(path.sep).join('/');
const LONG_COMMENT = 'Meet at the far north parking lot near the restrooms. Carpool from the church at the corner of Main and 5th. ' +
  'Bring plenty of water, sunscreen, and trekking poles. Trail can be muddy after rain so wear waterproof boots. Dogs on leash welcome.';

function pdfPageCount(buffer) {
  const text = buffer.toString('latin1');
  // jsPDF writes the page tree as "/Type /Pages ... /Count N"
  const counts = [...text.matchAll(/\/Count (\d+)/g)].map(m => parseInt(m[1], 10));
  return counts.length ? Math.max(...counts) : -1;
}

async function generateAndDownload(page) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('button', { hasText: 'Generate PDF' }).click()
  ]);
  const file = path.join(__dirname, 'test_output.pdf');
  await download.saveAs(file);
  const buf = fs.readFileSync(file);
  fs.unlinkSync(file);
  return buf;
}

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  page.on('dialog', d => d.accept());
  page.on('pageerror', e => console.log('[pageerror]', e.message));

  const results = [];
  const check = (name, ok, extra = '') => {
    results.push({ name, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${extra ? ' — ' + extra : ''}`);
  };

  await page.goto(APP_URL);
  await page.waitForSelector('h2:has-text("1. Select Month and Year")');

  // --- 1. Light schedule (defaults, empty) generates a single page ---
  let buf = await generateAndDownload(page);
  check('Empty schedule PDF is one page', pdfPageCount(buf) === 1, `pages=${pdfPageCount(buf)}`);

  // --- 2. Worst case: fill every walk, add 4 hikes, all with long comments ---
  const walkItems = page.locator('section:has(h2:has-text("3. Edit Walks")) .entry-item');
  const walkCount = await walkItems.count();
  for (let i = 0; i < walkCount; i++) {
    const item = walkItems.nth(i);
    const locSelect = item.locator('select').last();
    const optVal = await locSelect.locator('option').nth(1 + i).getAttribute('value');
    await locSelect.selectOption(optVal);
    await item.locator('textarea').first().fill(LONG_COMMENT);
    await item.locator('textarea').nth(1).fill('Extra meeting notes: look for the green OLLI flag near the trailhead kiosk.');
  }

  for (let i = 0; i < 4; i++) {
    await page.locator('button', { hasText: 'Add Hike' }).click();
  }
  const hikeItems = page.locator('section:has(h2:has-text("4. Edit Hikes")) .entry-item');
  for (let i = 0; i < 4; i++) {
    const item = hikeItems.nth(i);
    const selects = item.locator('select');
    // first select = Thursday date, last select before time row... order: date, time hour, time minute? No:
    // hike layout: date select, start-time selects (hour, minute), location select, ...
    const dateOpt = await selects.nth(0).locator('option').nth(1 + (i % 2)).getAttribute('value');
    await selects.nth(0).selectOption(dateOpt);
    const locSelect = selects.nth(3);
    const locOpt = await locSelect.locator('option').nth(10 + i).getAttribute('value');
    await locSelect.selectOption(locOpt);
    await item.locator('textarea').first().fill(LONG_COMMENT);
  }

  buf = await generateAndDownload(page);
  check('Packed schedule (4 walks + 4 hikes, long comments) fits on one page',
    pdfPageCount(buf) === 1, `pages=${pdfPageCount(buf)}`);
  check('Uniform times: header shows single start time',
    buf.toString('latin1').includes('Start Time: 8:30 am'));

  // --- 3. Change one day's time -> per-day times appear in the PDF ---
  const firstWalkTime = walkItems.first().locator('.entry-time');
  await firstWalkTime.locator('select').first().selectOption('09');
  await firstWalkTime.locator('select').nth(1).selectOption('15');

  buf = await generateAndDownload(page);
  const pdfText = buf.toString('latin1');
  check('Mixed times: PDF still one page', pdfPageCount(buf) === 1, `pages=${pdfPageCount(buf)}`);
  check('Mixed times: changed day shows 9:15 am', pdfText.includes('9:15 am'));
  check('Mixed times: other days show 8:30 am', pdfText.includes('8:30 am'));
  check('Mixed times: header switches to per-day wording', pdfText.includes('Start times are listed for each day'));

  // --- 4. Per-day time survives save/reload ---
  await page.reload();
  await page.waitForSelector('h2:has-text("1. Select Month and Year")');
  const restoredHour = await page.locator('section:has(h2:has-text("3. Edit Walks")) .entry-item').first()
    .locator('.entry-time select').first().inputValue();
  check('Per-day time restored after reload', restoredHour === '09', restoredHour);

  // --- 5. Global time change applies to every day ---
  const globalSection = page.locator('section:has(h2:has-text("2. Set Start Time"))');
  await globalSection.locator('select').first().selectOption('10');
  const firstHourAfter = await page.locator('section:has(h2:has-text("3. Edit Walks")) .entry-item').first()
    .locator('.entry-time select').first().inputValue();
  check('Global time change overrides per-day times', firstHourAfter === '10', firstHourAfter);

  // clean up saved schedule so the test is repeatable
  await page.evaluate(() => localStorage.clear());
  await browser.close();

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
