// Automated test: schedule auto-save and resume.
// The Electron bundle in dist/ uses require(), so this tests a web-targeted build:
//   npm i -D playwright --no-save
//   npx webpack --target web --output-path dist-test
//   node test_save_resume.js
const { chromium } = require('playwright');
const path = require('path');

const APP_URL = 'file:///' + path.join(__dirname, 'dist-test', 'index.html').split(path.sep).join('/');

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('dialog', d => d.accept());

  const results = [];
  const check = (name, ok, extra = '') => {
    results.push({ name, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${extra ? ' — ' + extra : ''}`);
  };

  // --- 1. Fresh app: no saved schedules section ---
  await page.goto(APP_URL);
  await page.waitForSelector('h2:has-text("1. Select Month and Year")');
  check('Fresh app shows no Saved Schedules section',
    (await page.locator('.saved-schedules').count()) === 0);

  // --- 2. Fill in a walk ---
  const firstWalkSelect = page.locator('.entry-item select:has-text("Select Location")').first();
  await firstWalkSelect.waitFor();
  // Pick the first real location option
  const optionValue = await firstWalkSelect.locator('option').nth(1).getAttribute('value');
  await firstWalkSelect.selectOption(optionValue);
  await page.locator('.entry-item textarea').first().fill('Bring water!');

  // --- 3. Auto-save should kick in ---
  await page.waitForSelector('.saved-schedules');
  check('Saved Schedules section appears after editing', true);
  const savedKeys = await page.evaluate(() =>
    Object.keys(localStorage).filter(k => k.startsWith('olliSchedule_')));
  check('Exactly one schedule saved in localStorage', savedKeys.length === 1, savedKeys.join(','));

  // --- 4. Reload (simulates closing and reopening the app) ---
  await page.reload();
  await page.waitForSelector('.saved-schedules');
  const restoredLocation = await page.locator('.entry-item select:has-text("Select Location")').first().inputValue();
  const restoredComment = await page.locator('.entry-item textarea').first().inputValue();
  check('Walk location restored after reload', restoredLocation === optionValue, restoredLocation);
  check('Walk comment restored after reload', restoredComment === 'Bring water!', restoredComment);

  // --- 5. Switch to another month: should get a blank schedule, no extra save ---
  const monthSelect = page.locator('.dropdown-container select').first();
  const currentMonth = await monthSelect.inputValue();
  const otherMonth = currentMonth === '1' ? '2' : '1';
  await monthSelect.selectOption(otherMonth);
  await page.waitForTimeout(300);
  const blankLocation = await page.locator('.entry-item select:has-text("Select Location")').first().inputValue();
  check('Other month starts blank', blankLocation === '');
  const savedKeys2 = await page.evaluate(() =>
    Object.keys(localStorage).filter(k => k.startsWith('olliSchedule_')));
  check('Browsing an untouched month does not create a saved entry', savedKeys2.length === 1, savedKeys2.join(','));

  // --- 6. Switch back: data still there ---
  await monthSelect.selectOption(currentMonth);
  await page.waitForTimeout(300);
  const backLocation = await page.locator('.entry-item select:has-text("Select Location")').first().inputValue();
  check('Switching back restores the saved schedule', backLocation === optionValue, backLocation);

  // --- 7. Open button from saved list ---
  await monthSelect.selectOption(otherMonth);
  await page.waitForTimeout(300);
  await page.locator('.saved-schedule-actions button', { hasText: 'Open' }).first().click();
  await page.waitForTimeout(300);
  const openedLocation = await page.locator('.entry-item select:has-text("Select Location")').first().inputValue();
  check('"Open" button loads the saved schedule', openedLocation === optionValue, openedLocation);

  // --- 8. Delete removes saved entry and resets form ---
  await page.locator('.saved-schedule-actions button', { hasText: 'Delete' }).first().click();
  await page.waitForTimeout(300);
  const savedKeys3 = await page.evaluate(() =>
    Object.keys(localStorage).filter(k => k.startsWith('olliSchedule_')));
  check('Delete removes the saved schedule', savedKeys3.length === 0);
  const afterDeleteLocation = await page.locator('.entry-item select:has-text("Select Location")').first().inputValue();
  check('Form resets to blank after deleting current schedule', afterDeleteLocation === '');

  await browser.close();

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
