// Stamp Duty BD \u2014 pure calculation logic (no DOM). Node-testable.
// Money is whole Taka (integer); percentage results round to the nearest Taka.
(function (root) {
  'use strict';

  var D = (typeof require === 'function')
    ? require('./data.js')
    : root.StampDutyData;

  var BN_DIGITS = ['\u09e6', '\u09e7', '\u09e8', '\u09e9', '\u09ea', '\u09eb', '\u09ec', '\u09ed', '\u09ee', '\u09ef'];

  function toBnDigits(x) {
    return String(x).replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; });
  }

  function roundTaka(x) { return Math.round(x); }

  function isPosInt(n) { return typeof n === 'number' && isFinite(n) && n > 0 && Math.floor(n) === n; }

  function pct(amount, rate) { return roundTaka(amount * rate); }

  // ---- Sale deed (conveyance) registration cost ----
  // input: { value, area: 'city'|'other', kind: 'land'|'flat-old'|'flat-new',
  //          sqft (for flat-new), sourceTaxMode: 'none'|'amount'|'percent',
  //          sourceTaxValue, includeAffidavit: bool }
  // Returns { lines: [{key, label, amount}], total, totalPct, stampCapped, errors[] }
  function saleDeed(input) {
    var errors = [];
    var S = D.SALE;
    if (!isPosInt(input.value)) errors.push('value');
    if (input.value > 100000000000) errors.push('valueTooLarge');
    if (input.area !== 'city' && input.area !== 'other') errors.push('area');
    if (['land', 'flat-old', 'flat-new'].indexOf(input.kind) < 0) errors.push('kind');
    if (input.kind === 'flat-new') {
      if (!(typeof input.sqft === 'number' && isFinite(input.sqft) && input.sqft > 0 && input.sqft <= 100000)) errors.push('sqft');
    }
    var srcMode = input.sourceTaxMode || 'none';
    var srcVal = input.sourceTaxValue || 0;
    if (srcMode === 'amount' && !(typeof srcVal === 'number' && isFinite(srcVal) && srcVal >= 0 && Math.floor(srcVal) === srcVal)) errors.push('sourceTax');
    if (srcMode === 'percent' && !(typeof srcVal === 'number' && isFinite(srcVal) && srcVal >= 0 && srcVal <= 100)) errors.push('sourceTax');
    if (errors.length) return { errors: errors, lines: [], total: 0, totalPct: 0, stampCapped: false };

    var lines = [];
    var rawStamp = input.value * S.stampRate;
    var stamp = roundTaka(rawStamp);
    var capped = false;
    if (stamp > S.stampCap) { stamp = S.stampCap; capped = true; }
    lines.push({ key: 'stamp', amount: stamp, capped: capped });
    lines.push({ key: 'reg', amount: pct(input.value, S.regRate) });
    var lgRate = input.area === 'city' ? S.lgCityRate : S.lgOtherRate;
    lines.push({ key: 'lg', amount: pct(input.value, lgRate) });

    var srcTax = 0;
    if (srcMode === 'amount') srcTax = Math.round(srcVal);
    if (srcMode === 'percent') srcTax = pct(input.value, srcVal / 100);
    if (srcTax > 0) lines.push({ key: 'source', amount: srcTax });

    if (input.kind === 'flat-new') {
      var vatRate = input.sqft <= S.vatSqftThreshold ? S.vatSmallRate : S.vatLargeRate;
      lines.push({ key: 'vat', amount: pct(input.value, vatRate), vatRate: vatRate });
    }
    if (input.includeAffidavit !== false) {
      lines.push({ key: 'affidavit', amount: S.affidavitFee });
    }

    var total = 0;
    lines.forEach(function (l) { total += l.amount; });
    return { errors: [], lines: lines, total: total,
      totalPct: Math.round((total / input.value) * 10000) / 100, stampCapped: capped };
  }

  // ---- Other deeds ----
  // input: { id, value, termYears, annualRent, poaType, poaValue, capital }
  // value: the amount the duty is charged on (property value / secured amount /
  //   settled value / dower / capital / face value, per instrument).
  // Returns { duty, lines: [{key, amount}], errors[], note }
  function otherDeed(input) {
    var spec = null;
    D.CALC.forEach(function (s) { if (s.id === input.id) spec = s; });
    if (!spec) return { errors: ['unknown'], duty: 0, lines: [] };
    var errors = [];
    var needValue = ['value', 'value-term'].indexOf(spec.input) >= 0;
    if (needValue && !isPosInt(input.value)) errors.push('value');
    if (input.value && input.value > 100000000000) errors.push('valueTooLarge');
    if (spec.input === 'rent-term') {
      if (!(typeof input.termYears === 'number' && isFinite(input.termYears) && input.termYears > 0 && input.termYears <= 99)) errors.push('term');
      if (!isPosInt(input.annualRent)) errors.push('rent');
    }
    if (spec.input === 'value-term') {
      if (typeof input.shortTerm !== 'boolean') errors.push('term');
    }
    if (spec.id === 'poa') {
      var t = input.poaType;
      if (['a', 'b', 'c', 'd', 'e'].indexOf(t) < 0) errors.push('poaType');
      if (t === 'e' && !isPosInt(input.poaValue)) errors.push('value');
    }
    if (errors.length) return { errors: errors, duty: 0, lines: [] };

    var duty = 0;
    var lines = [];
    function add(key, amount) { duty += amount; lines.push({ key: key, amount: amount }); }

    switch (spec.kind) {
      case 'fixed':
        add('duty', spec.duty);
        break;
      case 'percent': {
        var d = pct(input.value, spec.rate);
        if (spec.cap !== undefined && d > spec.cap) d = spec.cap;
        add('duty', d);
        break;
      }
      case 'tiers': {
        var v = input.value;
        var tier = null;
        for (var i = 0; i < spec.tiers.length; i++) {
          if (v <= spec.tiers[i].upTo) { tier = spec.tiers[i]; break; }
        }
        if (!tier) tier = spec.tiers[spec.tiers.length - 1];
        if (tier.duty !== undefined) add('duty', tier.duty);
        else {
          // Bank mortgage: 5,000 for the first 1 crore + 0.1% of the remainder.
          var dd = tier.base + pct(Math.max(0, v - 10000000), tier.rate);
          if (tier.cap !== undefined && dd > tier.cap) dd = tier.cap;
          add('duty', dd);
        }
        break;
      }
      case 'lease': {
        var yrs = input.termYears;
        var rent = input.annualRent;
        var rate, cap;
        if (input.premium) { rate = 0.004; cap = 30000000; }
        else if (yrs <= 5) { rate = 0.001; cap = 2000000; }
        else if (yrs <= 25) { rate = 0.002; cap = 10000000; }
        else { rate = 0.003; cap = 20000000; }
        var ld = pct(rent, rate);
        if (ld > cap) ld = cap;
        add('duty', ld);
        break;
      }
      case 'dower': {
        if (input.value <= 20000) add('duty', 0);
        else add('duty', pct(input.value, 0.005));
        break;
      }
      case 'title-deposit': {
        var trate = input.shortTerm ? 0.003 : 0.005;
        var tcap = input.shortTerm ? 10000000 : 30000000;
        var td = pct(input.value, trate);
        if (td > tcap) td = tcap;
        add('duty', td);
        break;
      }
      case 'poa': {
        var fixed = { a: 800, b: 1500, c: 2000, d: 1500 };
        if (input.poaType === 'e') {
          var pd = pct(input.poaValue, 0.015);
          if (pd < 10000) pd = 10000;
          if (pd > 100000) pd = 100000;
          add('duty', pd);
        } else add('duty', fixed[input.poaType]);
        break;
      }
      case 'partnership': {
        add('duty', input.value <= 100000 ? 2000 : 4000);
        break;
      }
      case 'award': {
        if (input.value <= 500000) add('duty', 1000);
        else {
          var ad = pct(input.value, 0.005);
          if (ad > 40000) ad = 40000;
          add('duty', ad);
        }
        break;
      }
      case 'bill-exchange': {
        add('duty', pct(input.value, input.shortTerm ? 0.002 : 0.01));
        break;
      }
      case 'promissory': {
        if (input.value <= 3000) add('duty', 20);
        else if (input.value <= 20000) add('duty', 40);
        else add('duty', 100);
        break;
      }
      default:
        return { errors: ['unknown'], duty: 0, lines: [] };
    }
    return { errors: [], duty: duty, lines: lines, note: spec.noteEn };
  }

  // ---- Fixed-duty lookup ----
  // query matches EN or BN name or article number; empty query returns all.
  function lookupFixed(query) {
    var q = (query || '').trim().toLowerCase();
    if (!q) return D.FIXED.slice();
    return D.FIXED.filter(function (row) {
      return row.en.toLowerCase().indexOf(q) >= 0 ||
        row.bn.indexOf(q) >= 0 ||
        String(row.art) === q ||
        row.dutyEn.toLowerCase().indexOf(q) >= 0;
    });
  }

  // ---- History entries (pure validation for import) ----
  function validateHistoryImport(obj) {
    if (!obj || typeof obj !== 'object') return { ok: false, error: 'not-object' };
    if (obj.app !== 'stamp-duty-bd' || obj.version !== 1) return { ok: false, error: 'bad-header' };
    if (!Array.isArray(obj.entries)) return { ok: false, error: 'bad-entries' };
    for (var i = 0; i < obj.entries.length; i++) {
      var e = obj.entries[i];
      if (!e || typeof e !== 'object') return { ok: false, error: 'bad-entry' };
      if (typeof e.label !== 'string' || typeof e.total !== 'number' || !isFinite(e.total)) return { ok: false, error: 'bad-entry' };
      if (typeof e.ts !== 'number' || typeof e.kind !== 'string') return { ok: false, error: 'bad-entry' };
    }
    if (obj.entries.length > 200) return { ok: false, error: 'too-many' };
    return { ok: true, entries: obj.entries };
  }

  function formatMoney(n, lang) {
    var s = Math.round(n).toLocaleString('en-US');
    return lang === 'bn' ? toBnDigits(s) : s;
  }

  var api = {
    saleDeed: saleDeed, otherDeed: otherDeed, lookupFixed: lookupFixed,
    validateHistoryImport: validateHistoryImport,
    formatMoney: formatMoney, toBnDigits: toBnDigits, isPosInt: isPosInt
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.StampDutyLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
