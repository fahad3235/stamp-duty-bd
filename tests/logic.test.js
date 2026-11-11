// Stamp Duty BD — node unit tests for js/logic.js (pure logic only).
// Usage: node tests/logic.test.js — exits non-zero on failure.
const L = require('../js/logic.js');
const D = require('../js/data.js');

let pass = 0, fail = 0;
function eq(name, actual, expected) {
  const ok = actual === expected;
  console.log((ok ? 'ok - ' : 'FAIL - ') + name + (ok ? '' : ' :: got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected)));
  if (ok) pass++; else fail++;
}
function deepEq(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((ok ? 'ok - ' : 'FAIL - ') + name + (ok ? '' : ' :: got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected)));
  if (ok) pass++; else fail++;
}

// ---------- Sale deed ----------
let r = L.saleDeed({ value: 5000000, area: 'city', kind: 'land', sourceTaxMode: 'none', includeAffidavit: true });
eq('sale city land: no errors', r.errors.length, 0);
eq('sale city land: stamp 75,000', r.lines.find(l => l.key === 'stamp').amount, 75000);
eq('sale city land: reg 50,000', r.lines.find(l => l.key === 'reg').amount, 50000);
eq('sale city land: LG 100,000', r.lines.find(l => l.key === 'lg').amount, 100000);
eq('sale city land: affidavit 300', r.lines.find(l => l.key === 'affidavit').amount, 300);
eq('sale city land: total 225,300', r.total, 225300);
eq('sale city land: 4.51% of value', r.totalPct, 4.51);

r = L.saleDeed({ value: 5000000, area: 'other', kind: 'land', sourceTaxMode: 'none', includeAffidavit: true });
eq('sale other area: LG 150,000', r.lines.find(l => l.key === 'lg').amount, 150000);
eq('sale other area: total 275,300', r.total, 275300);

r = L.saleDeed({ value: 10000000, area: 'city', kind: 'flat-new', sqft: 1200, sourceTaxMode: 'none', includeAffidavit: true });
eq('sale new flat 1200sqft: VAT 2% = 200,000', r.lines.find(l => l.key === 'vat').amount, 200000);
eq('sale new flat 1200sqft: total 650,300', r.total, 650300);

r = L.saleDeed({ value: 10000000, area: 'city', kind: 'flat-new', sqft: 2000, sourceTaxMode: 'none', includeAffidavit: true });
eq('sale new flat 2000sqft: VAT 4.5% = 450,000', r.lines.find(l => l.key === 'vat').amount, 450000);
eq('sale new flat 2000sqft: total 900,300', r.total, 900300);

r = L.saleDeed({ value: 10000000, area: 'city', kind: 'flat-new', sqft: 1600, sourceTaxMode: 'none', includeAffidavit: false });
eq('sale new flat 1600sqft boundary: VAT 2%', r.lines.find(l => l.key === 'vat').amount, 200000);
eq('sale no affidavit: no affidavit line', r.lines.some(l => l.key === 'affidavit'), false);
eq('sale no affidavit: total 650,000', r.total, 650000);

r = L.saleDeed({ value: 2000000000, area: 'city', kind: 'land', sourceTaxMode: 'none', includeAffidavit: true });
eq('sale 200cr: stamp capped at 2cr', r.lines.find(l => l.key === 'stamp').amount, 20000000);
eq('sale 200cr: stampCapped flag', r.stampCapped, true);
eq('sale 200cr: total 80,000,300', r.total, 80000300);

r = L.saleDeed({ value: 133333333, area: 'city', kind: 'land', sourceTaxMode: 'none', includeAffidavit: false });
eq('sale just under cap: stamp 1,999,999.995 rounds 2,000,000', r.lines.find(l => l.key === 'stamp').amount, 2000000);
eq('sale just under cap: not flagged capped', r.stampCapped, false);

r = L.saleDeed({ value: 5000000, area: 'city', kind: 'land', sourceTaxMode: 'percent', sourceTaxValue: 1, includeAffidavit: false });
eq('sale source 1%: 50,000', r.lines.find(l => l.key === 'source').amount, 50000);
eq('sale source 1%: total 275,000', r.total, 275000);

r = L.saleDeed({ value: 5000000, area: 'city', kind: 'land', sourceTaxMode: 'amount', sourceTaxValue: 123456, includeAffidavit: false });
eq('sale source amount: 123,456', r.lines.find(l => l.key === 'source').amount, 123456);

r = L.saleDeed({ value: 1234567, area: 'city', kind: 'land', sourceTaxMode: 'none', includeAffidavit: true });
eq('sale rounding: stamp 18,519', r.lines.find(l => l.key === 'stamp').amount, 18519);
eq('sale rounding: reg 12,346', r.lines.find(l => l.key === 'reg').amount, 12346);
eq('sale rounding: LG 24,691', r.lines.find(l => l.key === 'lg').amount, 24691);
eq('sale rounding: total 55,856', r.total, 55856);

eq('sale err: value 0', L.saleDeed({ value: 0, area: 'city', kind: 'land' }).errors[0], 'value');
eq('sale err: value negative', L.saleDeed({ value: -5, area: 'city', kind: 'land' }).errors[0], 'value');
eq('sale err: value fractional', L.saleDeed({ value: 100.5, area: 'city', kind: 'land' }).errors[0], 'value');
eq('sale err: bad area', L.saleDeed({ value: 1000, area: 'x', kind: 'land' }).errors[0], 'area');
eq('sale err: bad kind', L.saleDeed({ value: 1000, area: 'city', kind: 'x' }).errors[0], 'kind');
eq('sale err: flat-new needs sqft', L.saleDeed({ value: 1000, area: 'city', kind: 'flat-new' }).errors[0], 'sqft');
eq('sale err: sqft 0', L.saleDeed({ value: 1000, area: 'city', kind: 'flat-new', sqft: 0 }).errors[0], 'sqft');
eq('sale err: source pct >100', L.saleDeed({ value: 1000, area: 'city', kind: 'land', sourceTaxMode: 'percent', sourceTaxValue: 101 }).errors[0], 'sourceTax');
eq('sale err: source amount negative', L.saleDeed({ value: 1000, area: 'city', kind: 'land', sourceTaxMode: 'amount', sourceTaxValue: -1 }).errors[0], 'sourceTax');

// ---------- Other deeds ----------
function duty(input) {
  const res = L.otherDeed(input);
  if (res.errors.length) return 'ERR:' + res.errors.join(',');
  return res.duty;
}
eq('gift-heba: 1,000', duty({ id: 'gift-heba' }), 1000);
eq('gift-other 2,000,000: 30,000', duty({ id: 'gift-other', value: 2000000 }), 30000);
eq('mortgage-general 10,000,000: 150,000', duty({ id: 'mortgage-general', value: 10000000 }), 150000);
eq('mortgage-general 10,000,000,000: capped 50,000,000', duty({ id: 'mortgage-general', value: 10000000000 }), 50000000);
eq('mortgage-bank 4,000,000: 2,000', duty({ id: 'mortgage-bank', value: 4000000 }), 2000);
eq('mortgage-bank 5,000,000 boundary: 2,000', duty({ id: 'mortgage-bank', value: 5000000 }), 2000);
eq('mortgage-bank 7,500,000: 5,000', duty({ id: 'mortgage-bank', value: 7500000 }), 5000);
eq('mortgage-bank 10,000,000 boundary: 5,000', duty({ id: 'mortgage-bank', value: 10000000 }), 5000);
eq('mortgage-bank 15,000,000: 10,000', duty({ id: 'mortgage-bank', value: 15000000 }), 10000);
eq('mortgage-bank 100,000,000: 95,000', duty({ id: 'mortgage-bank', value: 100000000 }), 95000);
eq('lease 3y rent 120,000: 120', duty({ id: 'lease', value: 120000, termYears: 3, annualRent: 120000 }), 120);
eq('lease 5y boundary: 0.1%', duty({ id: 'lease', value: 120000, termYears: 5, annualRent: 120000 }), 120);
eq('lease 10y rent 120,000: 240', duty({ id: 'lease', value: 120000, termYears: 10, annualRent: 120000 }), 240);
eq('lease 25y boundary: 0.2%', duty({ id: 'lease', value: 120000, termYears: 25, annualRent: 120000 }), 240);
eq('lease 30y rent 120,000: 360', duty({ id: 'lease', value: 120000, termYears: 30, annualRent: 120000 }), 360);
eq('lease premium: 0.4% = 480', duty({ id: 'lease', value: 120000, termYears: 3, annualRent: 120000, premium: true }), 480);
eq('lease cap: rent 3,000,000,000 3y -> 2,000,000', duty({ id: 'lease', value: 3000000000, termYears: 3, annualRent: 3000000000 }), 2000000);
eq('exchange 8,000,000: 80,000', duty({ id: 'exchange', value: 8000000 }), 80000);
eq('exchange 2,000,000,000: capped 10,000,000', duty({ id: 'exchange', value: 2000000000 }), 10000000);
eq('settlement 1,000,000: 15,000', duty({ id: 'settlement', value: 1000000 }), 15000);
eq('dower 20,000: 0', duty({ id: 'dower', value: 20000 }), 0);
eq('dower 20,001: 100', duty({ id: 'dower', value: 20001 }), 100);
eq('dower 1,000,000: 5,000', duty({ id: 'dower', value: 1000000 }), 5000);
eq('title-deposit long 10,000,000: 50,000', duty({ id: 'title-deposit', value: 10000000, shortTerm: false }), 50000);
eq('title-deposit short 10,000,000: 30,000', duty({ id: 'title-deposit', value: 10000000, shortTerm: true }), 30000);
eq('title-deposit long cap: 30,000,000', duty({ id: 'title-deposit', value: 10000000000, shortTerm: false }), 30000000);
eq('title-deposit short cap: 10,000,000', duty({ id: 'title-deposit', value: 10000000000, shortTerm: true }), 10000000);
eq('poa (a): 800', duty({ id: 'poa', poaType: 'a' }), 800);
eq('poa (b): 1,500', duty({ id: 'poa', poaType: 'b' }), 1500);
eq('poa (c): 2,000', duty({ id: 'poa', poaType: 'c' }), 2000);
eq('poa (d): 1,500', duty({ id: 'poa', poaType: 'd' }), 1500);
eq('poa (e) 500,000: min 10,000', duty({ id: 'poa', poaType: 'e', poaValue: 500000 }), 10000);
eq('poa (e) 5,000,000: 75,000', duty({ id: 'poa', poaType: 'e', poaValue: 5000000 }), 75000);
eq('poa (e) 100,000,000: capped 100,000', duty({ id: 'poa', poaType: 'e', poaValue: 100000000 }), 100000);
eq('partition: 100', duty({ id: 'partition' }), 100);
eq('partnership capital 100,000: 2,000', duty({ id: 'partnership', value: 100000 }), 2000);
eq('partnership capital 100,001: 4,000', duty({ id: 'partnership', value: 100001 }), 4000);
eq('award 500,000: 1,000', duty({ id: 'award', value: 500000 }), 1000);
eq('award 1,000,000: 5,000', duty({ id: 'award', value: 1000000 }), 5000);
eq('award 100,000,000: capped 40,000', duty({ id: 'award', value: 100000000 }), 40000);
eq('bill-exchange short 1,000,000: 2,000', duty({ id: 'bill-exchange', value: 1000000, shortTerm: true }), 2000);
eq('bill-exchange long 1,000,000: 10,000', duty({ id: 'bill-exchange', value: 1000000, shortTerm: false }), 10000);
eq('promissory 3,000: 20', duty({ id: 'promissory', value: 3000 }), 20);
eq('promissory 3,001: 40', duty({ id: 'promissory', value: 3001 }), 40);
eq('promissory 20,000: 40', duty({ id: 'promissory', value: 20000 }), 40);
eq('promissory 20,001: 100', duty({ id: 'promissory', value: 20001 }), 100);
eq('debenture 5,000,000: 5,000', duty({ id: 'debenture', value: 5000000 }), 5000);
eq('debenture 2,000,000,000: capped 1,000,000', duty({ id: 'debenture', value: 2000000000 }), 1000000);
eq('further-charge 1,000,000: 15,000', duty({ id: 'further-charge', value: 1000000 }), 15000);
eq('further-charge 500,000,000: capped 2,000,000', duty({ id: 'further-charge', value: 500000000 }), 2000000);
eq('other err: unknown id', L.otherDeed({ id: 'nope' }).errors[0], 'unknown');
eq('other err: missing value', L.otherDeed({ id: 'gift-other' }).errors[0], 'value');
eq('other err: lease bad term', L.otherDeed({ id: 'lease', value: 1000, termYears: 0, annualRent: 1000 }).errors[0], 'term');
eq('other err: lease bad rent', L.otherDeed({ id: 'lease', value: 1000, termYears: 5, annualRent: 0 }).errors[0], 'rent');
eq('other err: poa bad type', L.otherDeed({ id: 'poa', poaType: 'z' }).errors[0], 'poaType');
eq('other err: poa (e) needs value', L.otherDeed({ id: 'poa', poaType: 'e' }).errors[0], 'value');

// ---------- Lookup ----------
eq('lookup: affidavit finds 1', L.lookupFixed('affidavit').length, 1);
eq('lookup: art 47 finds PoA', L.lookupFixed('47').length, 1);
eq('lookup: lease finds Lease + Release', L.lookupFixed('lease').length, 2);
eq('lookup: empty query returns all', L.lookupFixed('').length, D.FIXED.length);
eq('lookup: no match returns 0', L.lookupFixed('zzzqqq').length, 0);
eq('lookup: BN query finds affidavit', L.lookupFixed('হলফনামা').length, 1);

// ---------- History import validation ----------
const good = { app: 'stamp-duty-bd', version: 1, entries: [{ label: 'Sale — Land', total: 225300, ts: 1762760000000, kind: 'sale' }] };
eq('import: good file ok', L.validateHistoryImport(good).ok, true);
eq('import: wrong app rejected', L.validateHistoryImport({ app: 'x', version: 1, entries: [] }).ok, false);
eq('import: wrong version rejected', L.validateHistoryImport({ app: 'stamp-duty-bd', version: 2, entries: [] }).ok, false);
eq('import: non-array entries rejected', L.validateHistoryImport({ app: 'stamp-duty-bd', version: 1, entries: {} }).ok, false);
eq('import: bad entry rejected', L.validateHistoryImport({ app: 'stamp-duty-bd', version: 1, entries: [{ label: 'x' }] }).ok, false);
eq('import: null rejected', L.validateHistoryImport(null).ok, false);

// ---------- Formatting ----------
eq('formatMoney EN', L.formatMoney(1234567, 'en'), '1,234,567');
eq('formatMoney BN', L.formatMoney(1234567, 'bn'), '১,২৩৪,৫৬৭');
eq('toBnDigits', L.toBnDigits('2026'), '২০২৬');

console.log('\n' + pass + '/' + (pass + fail) + ' passed');
if (fail) process.exit(1);
