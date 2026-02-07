# The users Table

The `users` table stores local user profiles that mirror Supabase Auth users and provide display data for the app.

## Purpose and Role

**Primary Function:** Maintain a public profile for each authenticated user so the app can:

- Display names and emails in UI and group membership lists
- Connect invited members to real accounts by matching email
- Track last login time for activity signals
- Support account deletion workflows

## Table Structure

The table contains these key columns:

- **id** - User ID (matches `auth.users.id`)
- **name** - Display name used throughout the UI
- **email** - Email address (nullable but typically present)
- **created_at** - Profile creation timestamp
- **last_login** - Last sign-in timestamp (nullable)

## RLS Policies

Row-level security allows authenticated users to manage only their own profile while keeping profiles readable:

- **SELECT** is allowed for authenticated users across all user rows (public profiles within the app).
- **INSERT** is allowed only when `(select auth.uid())` matches the inserted `id`.
- **UPDATE** is allowed only when `(select auth.uid())` matches the updated `id`.
- **DELETE** is allowed only when `(select auth.uid())` matches the deleted `id`.

The delete-user edge function uses a service role key to bypass RLS during account removal.

## How It Works in Practice

**Example scenario:**

1. A user signs up or signs in
2. `ensureUserProfile()` checks for a matching row and inserts one if missing
3. The app uses `users.name` for display in group members and payments
4. On sign-in, `last_login` is updated for analytics and diagnostics

## Relationship to Other Tables

```
users (public profile)
  |
  |-- group_members.connected_user_id (optional link)
  |-- user_currency_preferences.user_id
  |-- user_group_preferences.user_id
  |-- user_known_users.user_id
  |-- user_known_users.known_user_id
  |-- user_settle_preferences.user_id
```

See also: [group_members](group_members.md), [user_currency_preferences](user_currency_preferences.md), [user_group_preferences](user_group_preferences.md), [user_known_users](user_known_users.md), [user_settle_preferences](user_settle_preferences.md)

## Key Implementation Details

**Auth Mirror:** The ID is identical to Supabase Auth users (`auth.users.id`).

**Email Matching:** Connection to `group_members` uses email matching for invitations and auto-reconnect.

**Account Deletion:** The delete-user edge function removes the public profile and the auth user record.

**Security:** RLS restricts updates/deletes to the authenticated user.

## Usage in Code

The application uses this table for:

- Creating profiles on sign-in (`ensureUserProfile()` in `services/groupRepository.ts`)
- Updating display name (`updateUserName()` in `services/groupRepository.ts`)
- Connecting invited members by email (`reconnectGroupMembers()` in `services/groupRepository.ts`)
- Tracking last login (`contexts/AuthContext.tsx`)
- Deleting accounts (edge function `supabase/functions/delete-user/index.ts`)
