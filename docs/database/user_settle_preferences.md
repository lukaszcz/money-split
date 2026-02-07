# The user_settle_preferences Table

The `user_settle_preferences` table stores per-user defaults for the settle flow, such as whether to simplify debts by default.

## Purpose and Role

**Primary Function:** Persist settle behavior defaults across sessions/devices.

- Store whether "Simplify debts" should be enabled by default
- Keep settle behavior consistent in both embedded and dedicated settle screens

## Table Structure

The table contains these key columns:

- **user_id** - Primary key identifying the user
- **simplify_debts** - Boolean toggle (default `true`)
- **updated_at** - Last update timestamp

## RLS Policies

- **SELECT** is allowed only when `(select auth.uid()) = user_id`
- **INSERT** is allowed only when `(select auth.uid()) = user_id`
- **UPDATE** is allowed only when `(select auth.uid()) = user_id`
- **DELETE** is not enabled by policy in current migrations

## Relationship to Other Tables

```
users
  |
  |-- user_settle_preferences
```

See also: [users](users.md)

## Usage in Code

- `services/settlePreferenceService.ts` (`getSettleSimplifyPreference`, `setSettleSimplifyPreference`, `refreshSettlePreferenceForUser`)
- `services/userPreferenceSync.ts` (refresh on sign-in/app bootstrap)
- `components/SettleContent.tsx` (reads and writes toggle state)

## Related Docs

- `docs/ARCHITECTURE.md`
- `docs/database/users.md`
