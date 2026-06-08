# Proposal: Fix Display Consistency — Importe and Fecha Pago

## Intent

UI and Excel display the *original* barcode fields (importe1, fechaEmision) instead of the *resolved* values that go into the TXT record. When vencimiento mode is '2' or 'auto' (late payment), the shown amount and date mismatch the generated file — eroding user trust and causing reconciliation errors.

## Scope

### In Scope
- Store resolved importe and effective fecha on `ParsedRecord` at build time
- Fix all display locations in `ResultsTable.js`, `CompensationReport.js`, `app.js`
- Fix Excel column to use resolved date + format as proper date
- Fix Excel summary total to use resolved importe

### Out of Scope
- Changing RAFAMR01 record builder logic or field layout
- Adding new export formats
- Refactoring component hierarchy or styling

## Capabilities

### New Capabilities
None — no new domain capabilities.

### Modified Capabilities
None — display fix only; no spec-level contract changes.

## Approach

1. Add `resolvedImporte` and `effectiveFecha` to each `ParsedRecord` in `ProcessingQueue.js:244` after `buildRecord()` returns
2. `ResultsTable.js:223` → use `resolvedImporte`
3. `CompensationReport.js:255,185` → use `resolvedImporte`
4. `CompensationReport.js:87,113,116,196` → use `effectiveFecha`
5. `app.js:316` → sum `resolvedImporte`
6. Bonus: format Excel Fecha pago column as date type

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `ProcessingQueue.js` | Modified | Store resolved values on ParsedRecord |
| `ResultsTable.js:223` | Modified | Use resolvedImporte |
| `CompensationReport.js:185,196,255,87,113,116` | Modified | Use resolved values |
| `app.js:316` | Modified | Use resolvedImporte in summary |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Backward compat if ParsedRecord shape changes | Low | Additive only — existing fields untouched |
| Display total doesn't match TXT sum | Low | Both use the same resolved value |

## Rollback Plan

Revert all changes to `ProcessingQueue.js`, `ResultsTable.js`, `CompensationReport.js`, and `app.js`.

## Dependencies

None.

## Success Criteria

- [ ] Importe column in ResultsTable matches TXT record F14 when vencimiento ≠ '1'
- [ ] "Fecha pago" in UI and Excel matches TXT record F31 when vencimiento ≠ 'auto'
- [ ] Summary totals use the same resolved importe as the TXT file
- [ ] Excel "Fecha pago" column is formatted as a proper date type
