// Automated test: location manager search, inline edit, add, delete
// Setup: npm i -D playwright --no-save && npx webpack --target web --output-path dist-test
// Run:   node test_location_manager.js
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

  await page.goto(APP_URL);
  await page.waitForSelector('h2:has-text("1. Select Month and Year")');

  // Open location manager
  await page.locator('button', { hasText: 'Manage Locations' }).click();
  await page.waitForSelector('.lm-table');

  // --- 1. Table loads with locations ---
  const rowCount = await page.locator('.lm-table tbody tr').count();
  check('Location table loads with rows', rowCount > 0, `${rowCount} rows`);

  // --- 2. Search filters rows ---
  const searchInput = page.locator('.lm-search');
  await searchInput.fill('Abyss');
  const filteredCount = await page.locator('.lm-table tbody tr').count();
  check('Search filters to matching rows', filteredCount >= 1 && filteredCount < rowCount, `${filteredCount} rows`);
  const firstFilteredName = await page.locator('.lm-td-name').first().textContent();
  check('Search result matches query', firstFilteredName.toLowerCase().includes('abyss'), firstFilteredName);
  await searchInput.fill('');
  const restoredCount = await page.locator('.lm-table tbody tr').count();
  check('Clearing search restores all rows', restoredCount === rowCount, `${restoredCount} rows`);

  // --- 3. Inline edit ---
  const firstRow = page.locator('.lm-table tbody tr').first();
  await firstRow.locator('button', { hasText: 'Edit' }).click();
  check('Edit mode shows inline inputs', (await firstRow.locator('.lm-inline-input').count()) > 0);
  const nameInput = firstRow.locator('.lm-inline-input').first();
  const originalName = await nameInput.inputValue();
  await nameInput.fill(originalName + ' TEST');
  await firstRow.locator('.lm-btn-save').click();
  const editedName = await page.locator('.lm-td-name').first().textContent();
  check('Inline edit saves changes', editedName.includes('TEST'), editedName);
  // Revert the edit
  await firstRow.locator('button', { hasText: 'Edit' }).click();
  const revertInput = firstRow.locator('.lm-inline-input').first();
  await revertInput.fill(originalName);
  await firstRow.locator('.lm-btn-save').click();

  // --- 4. Cancel edit ---
  await firstRow.locator('button', { hasText: 'Edit' }).click();
  await firstRow.locator('.lm-inline-input').first().fill('SHOULD NOT SAVE');
  await firstRow.locator('.lm-btn-cancel').click();
  const afterCancel = await page.locator('.lm-td-name').first().textContent();
  check('Cancel reverts inline edits', !afterCancel.includes('SHOULD NOT SAVE'), afterCancel);

  // --- 5. Add location via form ---
  await page.locator('.lm-add-btn').click();
  check('Add form opens', (await page.locator('.lm-add-form').count()) === 1);
  await page.locator('.lm-add-form input[placeholder="Location Name *"]').fill('Test Location Alpha');
  await page.locator('.lm-add-form input[placeholder="Street Address"]').fill('123 Main St');
  await page.locator('.lm-add-form input[placeholder="Town"]').fill('Testville');
  await page.locator('.lm-add-form button', { hasText: 'Add Location' }).click();
  check('Add form closes after save', (await page.locator('.lm-add-form').count()) === 0);
  await searchInput.fill('Test Location Alpha');
  const newLocCount = await page.locator('.lm-table tbody tr').count();
  check('New location appears in search', newLocCount === 1, `${newLocCount} rows`);
  await searchInput.fill('');

  // --- 6. Delete location ---
  await searchInput.fill('Test Location Alpha');
  await page.locator('.lm-table tbody tr').first().locator('.delete-btn').click();
  await page.waitForTimeout(200);
  const afterDeleteCount = await page.locator('.lm-table tbody tr').count();
  check('Deleted location removed from list', afterDeleteCount === 0, `${afterDeleteCount} rows`);
  await searchInput.fill('');

  // --- 7. Close location manager returns to main view ---
  await page.locator('button', { hasText: 'Close' }).click();
  check('Closing returns to main schedule view',
    (await page.locator('h2:has-text("1. Select Month and Year")').count()) === 1);

  // Clean up
  await page.evaluate(() => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('olliSchedule_')) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  });

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
