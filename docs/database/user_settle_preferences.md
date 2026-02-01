# The user_settle_preferences Table

The `user_settle_preferences` table stores per-user defaults for the settle flow, such as whether to simplify debts by default.

## Purpose

- Persist settle preferences across devices
- Provide a default for the Simplify debts toggle

## Columns

- **user_id** (uuid, primary key)
  - References `auth.users.id`
- **simplify_debts** (boolean, default true)
  - Whether the user prefers simplified settlements by default
- **updated_at** (timestamptz)
  - Last time the preference was updated

## RLS Policies

- Users can read their own preferences
- Users can insert their own preferences
- Users can update their own preferences

## Related Docs

- `docs/ARCHITECTURE.md`
- `docs/database/users.md`
