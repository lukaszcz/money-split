# docs: update docs

## Summary

This PR synchronizes architecture and database documentation with the current codebase, schema migrations, and RLS behavior.

## Changes

- Updated `docs/ARCHITECTURE.md` to reflect current implementation details:
  - edge function invocation via `supabase.functions.invoke(...)`
  - current exchange-rate endpoint usage (`/v4/latest/{base}`)
  - latest RLS behavior (including `user_known_users`, group visibility nuances, and member deletion constraints)
  - updated feature/module mapping (including settle and preference-sync components)
- Updated database table docs in `docs/database/` to match current schema and policies:
  - `exchange_rates.md`
  - `expense_shares.md`
  - `expenses.md`
  - `group_members.md`
  - `groups.md`
  - `user_currency_preferences.md`
  - `user_group_preferences.md`
  - `user_settle_preferences.md`
  - `users.md`
- Added missing documentation for known users table:
  - `docs/database/user_known_users.md`
- Added docs maintenance prompt:
  - `docs/prompts/docs-update.md`
- Updated `.gitignore` with local AI-assistant artifacts:
  - `.codex/`
  - `.claude/settings.local.json`

## Why

- The docs had drifted from current behavior after recent migrations and feature updates.
- Database docs were missing the `user_known_users` table and had outdated RLS details in multiple files.

## Impact

- Documentation-only update; no application runtime behavior changes.
