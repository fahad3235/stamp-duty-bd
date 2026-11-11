// Stamp Duty BD — headless-Chrome smoke test via raw CDP (no puppeteer dependency).
// Usage: node tests/smoke.js
// Exits non-zero on any failed assertion; fails on page console errors.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 9348;
const FILE = 'file://' + path.resolve(__dirname, '..', 'index.html');
let failures = 0;
let count = 0;
const pageErrors = [];
function check(name, cond, extra) {
  count++;
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (cond ? '' : ' :: ' + (extra || '')));
  if (!cond) failures++;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const CHROME_BIN = process.env.CHROME_BIN ||
    require('os').homedir() + '/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
  const chrome = spawn(CHROME_BIN, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/stampduty-smoke-' + process.pid,
    'about:blank',
  ], { stdio: 'ignore' });
  let targets = [];
  for (let i = 0; i < 50 && targets.length === 0; i++) {
    await wait(200);
    try {
      targets = JSON.parse(await new Promise((res, rej) => {
        http.get('http://127.0.0.1:' + PORT + '/json/list', (r) => {
          let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d));
        }).on('error', rej);
      }));
    } catch (e) { /* retry */ }
  }
  if (!targets.length) { console.log('FAIL - chrome did not start'); process.exit(2); }
  const wsUrl = targets[0].webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  await new Promise((res) => { ws.onopen = res; });
  let seq = 0; const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      pageErrors.push(JSON.stringify(msg.params.args));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      pageErrors.push(JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
    }
  };
  const send = (method, params) => new Promise((res) => {
    const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params }));
  });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: FILE });
  await wait(1500);
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.result && r.result.exceptionDetails) return { error: JSON.stringify(r.result.exceptionDetails).slice(0, 300) };
    return r.result ? r.result.result.value : undefined;
  };
  const clickTab = (name) => ev(`document.querySelector('[data-tab="${name}"]').click()`);

  check('page title contains Stamp Duty', (await ev('document.title') || '').includes('Stamp Duty'));
  check('4 tabs present', (await ev(`document.querySelectorAll('.tab').length`)) === 4);
  check('sale panel visible', (await ev(`document.getElementById('tab-sale').hidden`)) === false);
  check('lookup table has 56 rows', (await ev(`document.querySelectorAll('#lookupBody tr').length`)) === 56);
  check('instrument select has 17 options', (await ev(`document.querySelectorAll('#instrument option').length`)) === 17);
  check('disclaimer renders', (await ev(`document.querySelector('footer p').textContent.length`)) > 40);

  // --- Sale deed: 5,000,000 city land -> 225,300 ---
  await ev(`document.getElementById('deedValue').value = '5000000'`);
  await ev(`document.querySelector('#saleForm button[type="submit"]').click()`);
  check('sale result visible', (await ev(`document.getElementById('saleResult').hidden`)) === false);
  check('sale total = ৳225,300', (await ev(`document.getElementById('saleTotal').textContent`)) === '৳225,300',
    await ev(`document.getElementById('saleTotal').textContent`));
  check('sale shows 4 breakdown lines', (await ev(`document.querySelectorAll('#saleLines > div').length`)) === 4);
  check('sale pct line shows 4.51%', (await ev(`document.getElementById('salePct').textContent`)).includes('4.51'));

  // --- BN toggle: digits switch to Bengali ---
  await ev(`document.getElementById('langBtn').click()`);
  check('BN: total shows Bengali digits', (await ev(`document.getElementById('saleTotal').textContent`)) === '৳২২৫,৩০০',
    await ev(`document.getElementById('saleTotal').textContent`));
  check('BN: tab label is Bengali', (await ev(`document.querySelector('[data-tab="sale"]').textContent`)) === 'বিক্রয় দলিল');
  await ev(`document.getElementById('langBtn').click()`);
  check('EN restored: total back to ৳225,300', (await ev(`document.getElementById('saleTotal').textContent`)) === '৳225,300');

  // --- New flat 10,000,000 / 2000 sqft city -> 900,300 ---
  await ev(`document.getElementById('deedValue').value = '10000000'`);
  await ev(`document.querySelector('input[name="kind"][value="flat-new"]').click()`);
  check('sqft field appears for new flat', (await ev(`document.getElementById('sqftWrap').classList.contains('hidden')`)) === false);
  await ev(`document.getElementById('sqft').value = '2000'`);
  await ev(`document.querySelector('#saleForm button[type="submit"]').click()`);
  check('new flat total = ৳900,300', (await ev(`document.getElementById('saleTotal').textContent`)) === '৳900,300',
    await ev(`document.getElementById('saleTotal').textContent`));

  // --- Validation: value 0 shows error, hides result ---
  await ev(`document.getElementById('deedValue').value = '0'`);
  await ev(`document.querySelector('#saleForm button[type="submit"]').click()`);
  check('error shown for value 0', (await ev(`document.getElementById('saleError').hidden`)) === false);
  check('result hidden after failed calc', (await ev(`document.getElementById('saleResult').hidden`)) === true);

  // --- Stamp cap: 200 crore -> duty capped note ---
  await ev(`document.getElementById('deedValue').value = '2000000000'`);
  await ev(`document.querySelector('input[name="kind"][value="land"]').click()`);
  await ev(`document.querySelector('#saleForm button[type="submit"]').click()`);
  check('cap note visible at 200 crore', (await ev(`document.getElementById('saleCapNote').hidden`)) === false);
  check('200cr total = ৳80,000,300', (await ev(`document.getElementById('saleTotal').textContent`)) === '৳80,000,300',
    await ev(`document.getElementById('saleTotal').textContent`));

  // --- Save to history + persistence ---
  await ev(`document.getElementById('saleSave').click()`);
  check('saved message shown', (await ev(`document.getElementById('saleSaved').hidden`)) === false);
  await clickTab('history');
  check('history has 1 entry', (await ev(`document.querySelectorAll('#histList li').length`)) === 1);
  await send('Page.navigate', { url: FILE });
  await wait(1200);
  await clickTab('history');
  check('history persists after reload', (await ev(`document.querySelectorAll('#histList li').length`)) === 1);

  // --- Other deeds: mortgage-bank 15,000,000 -> 10,000 ---
  await clickTab('other');
  await ev(`document.getElementById('instrument').value = 'mortgage-bank'; document.getElementById('instrument').dispatchEvent(new Event('change'))`);
  await ev(`document.getElementById('otherValue').value = '15000000'`);
  await ev(`document.querySelector('#otherForm button[type="submit"]').click()`);
  check('mortgage-bank duty = ৳10,000', (await ev(`document.getElementById('otherDuty').textContent`)) === '৳10,000',
    await ev(`document.getElementById('otherDuty').textContent`));
  check('mortgage-bank article 39', (await ev(`document.getElementById('otherArt').textContent`)) === '39');

  // --- PoA (e) 5,000,000 -> 75,000 ---
  await ev(`document.getElementById('instrument').value = 'poa'; document.getElementById('instrument').dispatchEvent(new Event('change'))`);
  check('PoA fields visible', (await ev(`document.getElementById('poaFields').hidden`)) === false);
  await ev(`document.querySelector('input[name="poaType"][value="e"]').click()`);
  check('PoA value field appears for (e)', (await ev(`document.getElementById('poaValueWrap').classList.contains('hidden')`)) === false);
  await ev(`document.getElementById('poaValue').value = '5000000'`);
  await ev(`document.querySelector('#otherForm button[type="submit"]').click()`);
  check('PoA (e) duty = ৳75,000', (await ev(`document.getElementById('otherDuty').textContent`)) === '৳75,000',
    await ev(`document.getElementById('otherDuty').textContent`));

  // --- Lease 10y / 120,000 rent -> 240 ---
  await ev(`document.getElementById('instrument').value = 'lease'; document.getElementById('instrument').dispatchEvent(new Event('change'))`);
  check('lease fields visible', (await ev(`document.getElementById('leaseFields').hidden`)) === false);
  check('generic value field hidden for lease', (await ev(`document.getElementById('otherValueWrap').classList.contains('hidden')`)) === true);
  await ev(`document.getElementById('termYears').value = '10'`);
  await ev(`document.getElementById('annualRent').value = '120000'`);
  await ev(`document.querySelector('#otherForm button[type="submit"]').click()`);
  check('lease duty = ৳240', (await ev(`document.getElementById('otherDuty').textContent`)) === '৳240',
    await ev(`document.getElementById('otherDuty').textContent`));

  // --- Lookup search ---
  await clickTab('lookup');
  await ev(`document.getElementById('lookupSearch').value = 'affidavit'; document.getElementById('lookupSearch').dispatchEvent(new Event('input'))`);
  check('lookup affidavit: 1 row', (await ev(`document.querySelectorAll('#lookupBody tr').length`)) === 1);
  check('lookup affidavit duty shows ৳300', (await ev(`document.querySelector('#lookupBody tr td:last-child').textContent`)).includes('300'));
  await ev(`document.getElementById('lookupSearch').value = 'zzz'; document.getElementById('lookupSearch').dispatchEvent(new Event('input'))`);
  check('lookup no-match shows empty message', (await ev(`document.getElementById('lookupEmpty').hidden`)) === false);

  // --- Mobile 390px: no horizontal overflow ---
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: FILE });
  await wait(1200);
  check('390px: no horizontal overflow', (await ev(`document.documentElement.scrollWidth <= 390`)) === true,
    await ev(`document.documentElement.scrollWidth`));
  check('390px: sale form still usable', (await ev(`document.getElementById('deedValue') !== null`)) === true);

  // --- Console / page errors ---
  check('no console/page errors', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 500));

  console.log('\n' + (count - failures) + '/' + count + ' passed');
  ws.close();
  chrome.kill();
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('smoke harness error:', e); process.exit(2); });
