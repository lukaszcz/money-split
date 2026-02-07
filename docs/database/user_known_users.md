# The user_known_users Table

The `user_known_users` table tracks users that each user has previously shared a group with.

## Purpose and Role

**Primary Function:** Support member autocomplete and faster member entry flows.

- Store user-to-user "known contact" relationships
- Keep first/last shared timestamps for recency ordering
- Enable suggestions in create/edit member screens

## Table Structure

The table contains these key columns:

- **user_id** - The user who knows someone
- **known_user_id** - The user they know from shared groups
- **first_shared_at** - First time both users shared a group
- **last_shared_at** - Most recent shared-group timestamp

## Constraints and Indexes

- Composite primary key: `(user_id, known_user_id)`
- Check constraint: `user_id != known_user_id` (no self-reference)
- Indexes:
  - `idx_user_known_users_user_id`
  - `idx_user_known_users_known_user_id`

## RLS Policies

Policies are owner-scoped by `user_id`:

- **SELECT** - Allowed when `(select auth.uid()) = user_id`
- **INSERT** - Allowed when `(select auth.uid()) = user_id`
- **UPDATE** - Allowed when `(select auth.uid()) = user_id` (with `WITH CHECK`)
- **DELETE** - Allowed when `(select auth.uid()) = user_id`

## How It Works in Practice

1. A member is connected to an authenticated user in a group.
2. `update-known-users` edge function receives `groupId` + `newMemberId`.
3. The function upserts bidirectional known-user rows between the new member and existing connected group members.
4. UI loads suggestions ordered by `last_shared_at`.

## Relationship to Other Tables

```
users
  |
  |-- user_known_users.user_id
  |-- user_known_users.known_user_id
```

See also: [users](users.md), [group_members](group_members.md)

## Usage in Code

- `services/groupRepository.ts`:
  - `getKnownUsers`
  - `updateKnownUsersForMember`
  - member create/update/reconnect flows
- `supabase/functions/update-known-users/index.ts`
- `components/KnownUserSuggestionInput.tsx`
