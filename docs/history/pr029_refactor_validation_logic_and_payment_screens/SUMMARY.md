## Summary

- Refactored share calculations into utils and aligned split helpers, adding calculateSharesForSplit with scaled inputs and shared SplitMethod type.
- Centralized input validation helpers in utils/validation.ts (decimal, integer, percentage, exact amount) and updated UI callers to use them; added related unit tests.
- Added components/ExpenseFormScreen.tsx to consolidate add/edit expense and edit transfer UI, rewiring the three screens to use the shared component.
- Updated docs/ARCHITECTURE.md to reflect shared UI components, unified share calculations, and validation helpers.

## Key files changed

- utils/money.ts
- utils/validation.ts
- components/ExpenseFormScreen.tsx
- app/group/[id]/add-expense.tsx
- app/group/[id]/edit-expense.tsx
- app/group/[id]/edit-transfer.tsx
- **tests**/money.test.ts
- **tests**/validation.test.ts
- **tests**/README.md
- package.json
- package-lock.json
- docs/ARCHITECTURE.md
