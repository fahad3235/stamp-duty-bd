# Stamp Duty BD

Offline bilingual (English / &#x9ac;&#x9be;&#x982;&#x9b2;&#x9be;) calculator for Bangladesh stamp duty and deed registration costs &#x2014; built from the Stamp Act 1899, Schedule I (as substituted by the Finance Act 2022).

## What it does

- **Sale deed calculator** &#x2014; full registration cost for a conveyance (saf-kabala): stamp duty 1.5% of deed value (capped at &#x9f3;2 crore), registration fee 1%, local government tax 2% (city corporation / cantonment) or 3% (elsewhere), optional source tax (enter the amount or rate your sub-registry quotes &#x2014; it is area-based), VAT on new flats from developers (2% up to 1,600 sq ft, 4.5% above), and the seller's affidavit stamp paper (&#x9f3;300). Shows the total and its percentage of the deed value.
- **Other deeds calculator** &#x2014; stamp duty for 17 instruments: gift/heba, gift to others, mortgage (general and bank/FI tiers), lease by term, exchange, settlement, dower, deposit of title-deeds, power of attorney (all five Schedule I cases), partition, partnership, award, bill of exchange, promissory note, debenture, and further charge. Caps and minimums from the Schedule are applied.
- **Duty lookup** &#x2014; searchable table of 56 instruments from Schedule I with article numbers and the proper stamp duty for each.
- **History** &#x2014; save calculations locally, delete one by one, export/import JSON (validated), erase-all with typed `DELETE` confirmation.
- **Bilingual UI** &#x2014; English / &#x9ac;&#x9be;&#x982;&#x9b2;&#x9be; toggle, persisted; Bengali digits throughout in &#x9ac;&#x9be;&#x982;&#x9b2;&#x9be; mode.
- **100% offline** &#x2014; no network requests, no accounts, no data leaves the device. Works on desktop and 390px mobile.

## Rates in force (see `DATA_NOTES.md` for sources)

| Charge | Rate |
|---|---|
| Stamp duty on conveyance | 1.5% of deed value, max &#x9f3;2 crore |
| Registration fee | 1% of deed value |
| Local government tax | 2% city corporation / cantonment, 3% elsewhere |
| VAT on new flat | 2% (&#x2264; 1,600 sq ft), 4.5% (above) |
| Seller's affidavit | &#x9f3;300 stamp paper |
| Source tax | Area-based &#x2014; user-entered, never hardcoded |

A government committee proposed in October 2026 that stamp duty be halved to 0.75%. That is a **proposal, not law** &#x2014; the app uses the rates in force and says so in the UI.

## Stack

- Vanilla HTML + CSS + JavaScript, no build step, no dependencies.
- `js/data.js` &#x2014; all rates and the Schedule I table (single source of truth).
- `js/logic.js` &#x2014; pure calculation functions, Node-testable.
- `js/i18n.js` &#x2014; English / &#x9ac;&#x9be;&#x982;&#x9b2;&#x9be; strings.
- `js/app.js` &#x2014; DOM wiring and localStorage persistence.

## Run locally

Open `index.html` in any browser, or serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Tests

```sh
node tests/logic.test.js   # 108 unit tests (sale deed, 17 instruments, lookup, import validation, formatting)
node tests/smoke.js        # 36 headless-Chrome checks (real UI flows, EN/BN toggle, history persistence, 390px mobile)
```

The smoke test uses the Playwright `headless_shell` binary via raw CDP &#x2014; no Puppeteer dependency.

## Limitations

- Rates are from the Finance Act 2022 Schedule I and 2025&#x2013;26 sub-registry schedules, verified 2026-11-10. Rates change; confirm at your sub-registry office before paying.
- Source tax is deliberately user-entered: it varies by mouza and land class under the Income Tax Act 2023 (ss. 125/126) and cannot be reduced to a single rate.
- This is a planning estimate, not legal or tax advice. The app carries that disclaimer in its footer and in `DATA_NOTES.md`.
- Only the instruments listed in the calculator are computed; rarer Schedule I entries are in the lookup table only.

## Status

Complete MVP &#x2014; all features implemented and tested (see `TEST_RESULTS.md`).
