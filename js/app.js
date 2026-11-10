// Stamp Duty BD \u2014 DOM wiring (vanilla JS, offline, localStorage only).
(function () {
  'use strict';

  var L = window.StampDutyLogic;
  var D = window.StampDutyData;
  var STR = window.StampDutyI18n;

  var LS_LANG = 'sdb-lang';
  var LS_HIST = 'sdb-history';
  var lang = 'en';
  try { lang = localStorage.getItem(LS_LANG) || 'en'; } catch (e) { lang = 'en'; }
  if (lang !== 'bn') lang = 'en';

  function t(key) { return (STR[lang] && STR[lang][key]) || STR.en[key] || key; }
  function money(n) { return '\u09f3' + L.formatMoney(n, lang); }
  function $(id) { return document.getElementById(id); }

  var lastSale = null;   // {label, total, detail}
  var lastOther = null;

  // ---------- i18n ----------
  function applyLang() {
    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    $('langBtn').textContent = t('langBtn');
    buildInstrumentSelect();
    renderLookup();
    renderHistory();
    updateOtherNote();
    if (lastSale) renderSaleResult(lastSale.res);
    if (lastOther) renderOtherResult(lastOther.res, lastOther.spec);
    try { localStorage.setItem(LS_LANG, lang); } catch (e) { /* private mode */ }
  }

  // ---------- Tabs ----------
  document.querySelectorAll('.tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (b) {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      ['sale', 'other', 'lookup', 'history'].forEach(function (name) {
        $('tab-' + name).hidden = name !== btn.getAttribute('data-tab');
      });
    });
  });

  $('langBtn').addEventListener('click', function () {
    lang = lang === 'en' ? 'bn' : 'en';
    applyLang();
  });

  // ---------- Sale deed ----------
  function saleInput() {
    var area = (document.querySelector('input[name="area"]:checked') || {}).value;
    var kind = (document.querySelector('input[name="kind"]:checked') || {}).value;
    var srcMode = (document.querySelector('input[name="srcMode"]:checked') || {}).value || 'none';
    return {
      value: parseInt($('deedValue').value, 10),
      area: area, kind: kind,
      sqft: parseInt($('sqft').value, 10),
      sourceTaxMode: srcMode,
      sourceTaxValue: parseFloat($('sourceValue').value),
      includeAffidavit: $('affidavit').checked
    };
  }

  function showSaleError(code) {
    var el = $('saleError');
    if (!code) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    el.textContent = t('err' + code.charAt(0).toUpperCase() + code.slice(1));
  }

  function renderSaleResult(res) {
    var labels = { stamp: 'lineStamp', reg: 'lineReg', lg: 'lineLg', source: 'lineSource', vat: 'lineVat', affidavit: 'lineAffidavit' };
    var dl = $('saleLines');
    dl.innerHTML = '';
    res.lines.forEach(function (line) {
      var div = document.createElement('div');
      var dt = document.createElement('dt');
      dt.textContent = t(labels[line.key] || line.key);
      if (line.key === 'vat' && line.vatRate) dt.textContent += ' (' + (line.vatRate * 100) + '%)';
      if (line.key === 'stamp' && line.capped) dt.textContent += ' *';
      var dd = document.createElement('dd');
      dd.textContent = money(line.amount);
      div.appendChild(dt); div.appendChild(dd);
      dl.appendChild(div);
    });
    $('saleTotal').textContent = money(res.total);
    var pctStr = res.totalPct.toFixed(2);
    if (lang === 'bn') pctStr = L.toBnDigits(pctStr);
    $('salePct').textContent = '(' + pctStr + '% ' + t('totalPct') + ')';
    $('saleCapNote').hidden = !res.stampCapped;
    $('saleResult').hidden = false;
    $('saleSaved').hidden = true;
  }

  $('saleForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var input = saleInput();
    var res = L.saleDeed(input);
    if (res.errors.length) { showSaleError(res.errors[0]); $('saleResult').hidden = true; return; }
    showSaleError(null);
    var kindLabel = { land: t('kindLand'), 'flat-old': t('kindFlatOld'), 'flat-new': t('kindFlatNew') }[input.kind];
    lastSale = { res: res, label: t('tabSale') + ' \u2014 ' + kindLabel + ' \u2014 ' + money(input.value) };
    renderSaleResult(res);
  });

  $('saleClear').addEventListener('click', function () {
    $('saleForm').reset();
    $('saleResult').hidden = true;
    showSaleError(null);
    syncSaleVisibility();
  });

  function syncSaleVisibility() {
    var kind = (document.querySelector('input[name="kind"]:checked') || {}).value;
    $('sqftWrap').classList.toggle('hidden', kind !== 'flat-new');
    var srcMode = (document.querySelector('input[name="srcMode"]:checked') || {}).value || 'none';
    $('sourceValue').classList.toggle('hidden', srcMode === 'none');
  }
  document.querySelectorAll('input[name="kind"]').forEach(function (r) {
    r.addEventListener('change', syncSaleVisibility);
  });
  document.querySelectorAll('input[name="srcMode"]').forEach(function (r) {
    r.addEventListener('change', syncSaleVisibility);
  });

  $('saleSave').addEventListener('click', function () {
    if (!lastSale) return;
    addHistory({ kind: 'sale', label: lastSale.label, total: lastSale.res.total, ts: Date.now() });
    $('saleSaved').hidden = false;
  });

  // ---------- Other deeds ----------
  function buildInstrumentSelect() {
    var sel = $('instrument');
    var prev = sel.value;
    sel.innerHTML = '';
    D.CALC.forEach(function (spec) {
      var opt = document.createElement('option');
      opt.value = spec.id;
      opt.textContent = (lang === 'bn' ? spec.bn : spec.en) + ' \u2014 Art. ' + spec.art;
      sel.appendChild(opt);
    });
    if (prev) sel.value = prev;
    syncOtherFields();
  }

  function currentSpec() {
    var id = $('instrument').value;
    var found = null;
    D.CALC.forEach(function (s) { if (s.id === id) found = s; });
    return found;
  }

  function updateOtherNote() {
    var spec = currentSpec();
    if (!spec) return;
    $('instNote').textContent = lang === 'bn' ? spec.noteBn : spec.noteEn;
  }

  function syncOtherFields() {
    var spec = currentSpec();
    if (!spec) return;
    $('otherValueWrap').classList.toggle('hidden', spec.id === 'poa' || spec.id === 'lease' || spec.kind === 'fixed');
    $('leaseFields').hidden = spec.id !== 'lease';
    $('termFields').hidden = !(spec.input === 'value-term');
    $('poaFields').hidden = spec.id !== 'poa';
    syncPoaValue();
    updateOtherNote();
  }

  function syncPoaValue() {
    var poaType = (document.querySelector('input[name="poaType"]:checked') || {}).value;
    $('poaValueWrap').classList.toggle('hidden', poaType !== 'e' || $('instrument').value !== 'poa');
  }
  document.querySelectorAll('input[name="poaType"]').forEach(function (r) {
    r.addEventListener('change', syncPoaValue);
  });
  $('instrument').addEventListener('change', syncOtherFields);

  function showOtherError(code) {
    var el = $('otherError');
    if (!code) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    el.textContent = t('err' + code.charAt(0).toUpperCase() + code.slice(1));
  }

  function renderOtherResult(res, spec) {
    $('otherDuty').textContent = money(res.duty);
    $('otherArt').textContent = spec.art;
    $('otherResult').hidden = false;
    $('otherSaved').hidden = true;
  }

  $('otherForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var spec = currentSpec();
    if (!spec) { showOtherError('unknown'); return; }
    var input = {
      id: spec.id,
      value: parseInt($('otherValue').value, 10),
      termYears: parseInt($('termYears').value, 10),
      annualRent: parseInt($('annualRent').value, 10),
      premium: $('premium').checked,
      shortTerm: $('shortTerm').checked,
      poaType: (document.querySelector('input[name="poaType"]:checked') || {}).value,
      poaValue: parseInt($('poaValue').value, 10)
    };
    var res = L.otherDeed(input);
    if (res.errors.length) { showOtherError(res.errors[0]); $('otherResult').hidden = true; return; }
    showOtherError(null);
    var label = (lang === 'bn' ? spec.bn : spec.en);
    lastOther = { res: res, spec: spec, label: label + ' \u2014 ' + money(res.duty) };
    renderOtherResult(res, spec);
  });

  $('otherClear').addEventListener('click', function () {
    $('otherForm').reset();
    $('otherResult').hidden = true;
    showOtherError(null);
    syncOtherFields();
  });

  $('otherSave').addEventListener('click', function () {
    if (!lastOther) return;
    addHistory({ kind: 'other', label: lastOther.label, total: lastOther.res.duty, ts: Date.now() });
    $('otherSaved').hidden = false;
  });

  // ---------- Lookup ----------
  function renderLookup() {
    var q = $('lookupSearch').value || '';
    var rows = L.lookupFixed(q);
    var body = $('lookupBody');
    body.innerHTML = '';
    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      var tdArt = document.createElement('td');
      tdArt.className = 'art';
      tdArt.textContent = row.art;
      var tdName = document.createElement('td');
      tdName.textContent = lang === 'bn' ? row.bn : row.en;
      var tdDuty = document.createElement('td');
      tdDuty.textContent = lang === 'bn' ? row.dutyBn : row.dutyEn;
      tr.appendChild(tdArt); tr.appendChild(tdName); tr.appendChild(tdDuty);
      body.appendChild(tr);
    });
    $('lookupCount').textContent = L.formatMoney(rows.length, lang) + ' / ' + L.formatMoney(D.FIXED.length, lang);
    $('lookupEmpty').hidden = rows.length > 0;
  }
  $('lookupSearch').addEventListener('input', renderLookup);

  // ---------- History ----------
  function loadHistory() {
    try {
      var raw = localStorage.getItem(LS_HIST);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function storeHistory(arr) {
    try { localStorage.setItem(LS_HIST, JSON.stringify(arr)); } catch (e) { /* private mode */ }
  }
  function addHistory(entry) {
    var arr = loadHistory();
    arr.unshift(entry);
    if (arr.length > 50) arr.length = 50;
    storeHistory(arr);
    renderHistory();
  }
  function renderHistory() {
    var arr = loadHistory();
    var list = $('histList');
    list.innerHTML = '';
    $('histEmpty').hidden = arr.length > 0;
    arr.forEach(function (entry, idx) {
      var li = document.createElement('li');
      var left = document.createElement('div');
      var lab = document.createElement('div');
      lab.className = 'h-label';
      lab.textContent = entry.label;
      var meta = document.createElement('div');
      meta.className = 'h-meta';
      meta.textContent = new Date(entry.ts).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB');
      left.appendChild(lab); left.appendChild(meta);
      var tot = document.createElement('div');
      tot.className = 'h-total';
      tot.textContent = money(entry.total);
      var del = document.createElement('button');
      del.className = 'btn';
      del.type = 'button';
      del.textContent = t('histDelete');
      del.addEventListener('click', function () {
        var a2 = loadHistory();
        a2.splice(idx, 1);
        storeHistory(a2);
        renderHistory();
      });
      li.appendChild(left); li.appendChild(tot); li.appendChild(del);
      list.appendChild(li);
    });
  }

  $('exportBtn').addEventListener('click', function () {
    var payload = { app: 'stamp-duty-bd', version: 1, entries: loadHistory() };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'stamp-duty-bd-history.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  $('importBtn').addEventListener('click', function () { $('importFile').click(); });
  $('importFile').addEventListener('change', function () {
    var file = $('importFile').files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var msg = $('histMsg');
      try {
        var parsed = JSON.parse(reader.result);
        var v = L.validateHistoryImport(parsed);
        if (!v.ok) throw new Error(v.error);
        storeHistory(v.entries.slice(0, 50));
        renderHistory();
        msg.textContent = t('importOk');
        msg.hidden = false;
      } catch (e) {
        msg.textContent = t('importBad');
        msg.hidden = false;
      }
    };
    reader.readAsText(file);
    $('importFile').value = '';
  });

  $('eraseBtn').addEventListener('click', function () {
    var answer = window.prompt(t('eraseConfirm'));
    if (answer === null) return;
    if (answer.trim().toUpperCase() === 'DELETE') {
      storeHistory([]);
      renderHistory();
      var msg = $('histMsg');
      msg.textContent = t('erasedMsg');
      msg.hidden = false;
    }
  });

  // ---------- Init ----------
  syncSaleVisibility();
  applyLang();
})();
