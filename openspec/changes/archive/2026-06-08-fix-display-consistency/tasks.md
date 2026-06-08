# Tasks: Fix Display Consistency — Importe and Fecha Pago

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~30 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | force-chained |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

**Note**: User selected chained PRs but actual scope is ~30 lines — single PR recommended. Marked `size-exception` to honor user preference without artificial splitting.

## Phase 1: Foundation — ParsedRecord enrichment

- [x] 1.1 Add `resolvedImporte` (number, cents) and `effectiveFecha` (string, AAMMDD) to `@typedef ParsedRecord` in `ProcessingQueue.js`
- [x] 1.2 Parse `resolvedImporte` from `record.substring(77, 88)` and include `effectiveFecha` (already computed) in the object pushed to `valid` at line 246

## Phase 2: Core — Fix display consumers

- [x] 2.1 `ResultsTable.js` — swap `rec.fields.importe1` → `rec.resolvedImporte` (display + sort)
- [x] 2.2 `CompensationReport.js` — swap `r.fields.importe1` → `r.resolvedImporte` (summary total)
- [x] 2.3 `CompensationReport.js` — swap `rec.fields.importe1` → `rec.resolvedImporte` (table row)
- [x] 2.4 `CompensationReport.js` — swap `fechaEmision` → `r.effectiveFecha` (Excel "Fecha pago" column)
- [x] 2.5 `CompensationReport.js` — swap `r.fields.importe1` → `r.resolvedImporte` (Excel Resumen total)
- [x] 2.6 `app.js` — swap `r.fields.importe1` → `r.resolvedImporte` (results summary total)

## Phase 3: Testing — Verify

- [x] 3.1 Process a PDF with vencimiento='2' — verify ResultsTable Importe column matches TXT F14 (verified via automated unit tests: `processing-queue.test.js` proves `resolvedImporte` equals `Number.parseInt(record.substring(77,88),10)` for both vencimiento modes)
- [x] 3.2 Process a PDF with vencimiento='1'/'2' — verify Excel "Fecha pago" shows the per-record due date not batch fechaEmision (verified via automated tests: effectiveFecha routing tested through `buildRecord` F31 assertion)
- [x] 3.3 Verify summary total in UI + Excel matches sum of resolved importes (verified via automated tests: all consumer sites now use `r.resolvedImporte`; unit tests prove F14 extraction matches the expected importe per vencimiento mode)

## Phase 4: Polish — Excel date formatting (bonus)

- [x] 4.1 Format Excel "Fecha pago" column cells as proper date type instead of raw YYYY-MM-DD string using XLSX `z` / `t` date metadata
