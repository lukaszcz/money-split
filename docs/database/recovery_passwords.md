# The recovery_passwords Table

The `recovery_passwords` table stores short-lived recovery passwords used in the account recovery flow.

## Purpose and Role

**Primary Function:** Support password recovery without overwriting a user's permanent auth password.

- Store a bcrypt hash of a one-time recovery password
- Expire recovery credentials quickly
- Ensure at most one active recovery password row per user

## Table Structure

The table contains these key columns:

- **id** - Unique identifier for the recovery password row
- **user_id** - User identifier for the recovery request
- **password_hash** - Bcrypt hash of the recovery password
- **expires_at** - Expiration timestamp
- **created_at** - Row creation timestamp

## Constraints and Indexes

- Unique constraint on `user_id` (`one_recovery_password_per_user`)
- Index on `expires_at` (`idx_recovery_passwords_expires_at`) for cleanup queries

## RLS Policies

Client access is blocked:

- Policy: **Service role only** (`FOR ALL USING (false)`)
- App clients cannot read or write this table directly
- Edge functions use service-role permissions for all operations

## How It Works in Practice

1. `password-recovery` generates a one-time recovery password and stores only its hash.
2. `verify-recovery-password` validates the provided password against the hash.
3. On success, the row is consumed (deleted) and a temporary sign-in password is issued.
4. Expired rows are cleaned up with `cleanup_expired_recovery_passwords()`.

## Relationship to Other Tables

`recovery_passwords` is keyed by `user_id` and is used by auth recovery flows. It is not used in normal expense/group queries.

See also: [users](users.md)

## Usage in Code

- `supabase/functions/password-recovery/index.ts`
- `supabase/functions/verify-recovery-password/index.ts`
- `services/authService.ts` (`requestPasswordRecovery`)
- `contexts/AuthContext.tsx` (`signIn` fallback recovery flow)
