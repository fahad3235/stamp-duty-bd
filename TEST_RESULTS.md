# TEST_RESULTS &#x2014; Stamp Duty BD

Run: 2026-11-10, 13:00 slot (run #294). All tests run for real; nothing invented.

## Unit tests &#x2014; `node tests/logic.test.js`

**108/108 passed.**

Coverage:
- Sale deed: city/other LG tax (2%/3%), new-flat VAT at 2% (&#x2264; 1,600 sq ft) and 4.5% (> 1,600), the 1,600 sq ft boundary, affidavit on/off, source tax as amount and as percent, the &#x9f3;2 crore stamp-duty cap at a &#x9f3;200 crore deed, the just-under-cap boundary (&#x9f3;133,333,333 &#x2192; stamp rounds to exactly &#x9f3;2,000,000, not flagged capped), and per-Taka rounding (&#x9f3;1,234,567 &#x2192; stamp &#x9f3;18,519, reg &#x9f3;12,346, LG &#x9f3;24,691, total &#x9f3;55,856). Hand-verified totals: &#x9f3;5,000,000 city land &#x2192; &#x9f3;225,300 (4.51%); &#x9f3;10,000,000 new flat 1,200 sq ft &#x2192; &#x9f3;650,300; 2,000 sq ft &#x2192; &#x9f3;900,300.
- Validation errors: zero/negative/fractional value, bad area, bad kind, missing sq ft for new flats, source-tax percent > 100, negative source-tax amount.
- All 17 other-deed instruments with boundary cases: mortgage-bank tiers at &#x9f3;50 lac / &#x9f3;1 crore boundaries, mortgage-general cap at &#x9f3;5 crore, lease term bands at 5/25 years + premium 0.4% + cap, exchange cap at &#x9f3;1 crore, dower nil at &#x9f3;20,000 and &#x9f3;100 at &#x9f3;20,001, title-deposit 0.5%/0.3% with both caps, PoA all five cases including (e) min &#x9f3;10,000 and max &#x9f3;1 lac, partnership &#x9f3;1 lac boundary, award &#x9f3;5 lac boundary + &#x9f3;40,000 cap, bill of exchange 0.2%/1%, promissory-note tiers at &#x9f3;3,000/&#x9f3;20,000, debenture cap, further-charge cap.
- Lookup: EN query, Bengali query (&#x9b9;&#x9b2;&#x9ab;&#x9a8;&#x9be;&#x9ae;&#x9be;), article-number query (47), empty query returns all 56 rows, no-match returns 0.
- History import validation: good file accepted; wrong app, wrong version, non-array entries, malformed entry, and null all rejected.
- Formatting: 1,234,567 &#x2192; `1,234,567` (EN) / `&#x9e7;,&#x9e8;&#x9e9;&#x9ea;,&#x9eb;&#x9ec;&#x9ed;` (BN).

One test expectation was corrected during the run (not an app bug): the lookup query "lease" matches both "Lease" and "Release" by substring, so the expected count is 2, not 1.

## Headless-Chrome smoke tests &#x2014; `node tests/smoke.js`

**36/36 passed** (Playwright `headless_shell`, raw CDP, `file://`).

Real UI flows verified in the browser:
- Page loads with 4 tabs, 56 lookup rows, 17 instrument options, no console/page errors.
- Sale deed form: &#x9f3;5,000,000 city land &#x2192; total **&#x9f3;225,300**, 4 breakdown lines, "4.51%" line.
- EN&#x2192;BN toggle: total becomes **&#x9f3;&#x9e8;&#x9e8;&#x9eb;,&#x9e9;&#x9e6;&#x9e6;**, tab label becomes &#x9ac;&#x9bf;&#x995;&#x9cd;&#x9b0;&#x9af;&#x9bc; &#x9a6;&#x9b2;&#x9bf;&#x9b2;; toggling back restores &#x9f3;225,300.
- New flat: sq ft field appears only for new flats; &#x9f3;10,000,000 / 2,000 sq ft &#x2192; **&#x9f3;900,300**.
- Validation: value 0 shows the inline error and hides the result.
- Stamp cap: &#x9f3;200 crore deed shows the cap note and total **&#x9f3;80,000,300**.
- History: save &#x2192; 1 entry in the History tab &#x2192; still 1 entry after a full page reload (localStorage persistence).
- Other deeds: mortgage-bank &#x9f3;15,000,000 &#x2192; **&#x9f3;10,000** (Art. 39); PoA (e) &#x9f3;5,000,000 &#x2192; **&#x9f3;75,000** (value field appears only for type (e)); lease 10 yr / &#x9f3;120,000 rent &#x2192; **&#x9f3;240** (generic value field hidden for leases).
- Lookup: searching "affidavit" &#x2192; 1 row showing &#x9f3;300; searching "zzz" shows the empty message.
- Mobile 390px: no horizontal overflow (`scrollWidth <= 390`), form still usable.

Two smoke-test fixes during the run (both test-side except one real bug):
1. **Real bug found and fixed**: the "% of deed value" line used `formatMoney`, which rounds to whole numbers &#x2014; 4.51% displayed as 5%. Fixed in `js/app.js` to format the percentage with two decimals (and Bengali digits in BN mode). Re-ran: 36/36.
2. Test-side: the sale-deed line count is 4 (not 5 &#x2014; no source tax or VAT on a plain land deed), and visibility checks for class-toggled fields now read `classList` instead of the `.hidden` property.

## Not tested

- GitHub Pages serving (pending push; verified after publication per factory rules).
- Import/export file download in a real browser file picker (export/import logic is unit-tested via `validateHistoryImport`; the download uses a standard Blob URL).
