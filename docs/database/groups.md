# The groups Table

The `groups` table represents a shared expense group with a main currency and associated members.

## Purpose and Role

**Primary Function:** Store group metadata so the app can:

- Organize expenses by group
- Define a main currency for balance calculations
- Support group-level navigation and preferences

## Table Structure

The table contains these key columns:

- **id** - Unique identifier for the group
- **name** - Group display name
- **main_currency_code** - ISO currency code used for balances
- **created_at** - Group creation timestamp

## RLS Policies

Row-level security scopes access to group membership and allows safe creation:

- **SELECT** is allowed when the authenticated user is a member of the group via `user_is_group_member((select auth.uid()), id)`. A special case also allows selecting groups with no connected members yet (`NOT group_has_connected_members(id)`), which is required during create/cleanup windows.
- **INSERT** is allowed for any authenticated user (`WITH CHECK (true)`).
- **UPDATE** is allowed only for group members (`user_is_group_member((select auth.uid()), id)`).
- **DELETE** is allowed only when the group has no connected members (`NOT group_has_connected_members(id)`), enabling cleanup of orphaned groups.

## How It Works in Practice

**Example scenario:**

1. A user creates a group and selects a main currency
2. A group row is inserted
3. The creator is added as a `group_members` row
4. Expenses and shares are linked to the group

## Relationship to Other Tables

```
groups
  |
  |-- group_members (members of the group)
  |-- expenses (payments in the group)
```

See also: [group_members](group_members.md), [expenses](expenses.md)

## Key Implementation Details

**No Ownership:** The schema removes a hard owner; group membership controls access.

**Soft Delete:** Groups are deleted only when no members remain connected. Cleanup is handled by an edge function.

**RLS:** Policies allow read/update for members and delete only when there are no connected members.

## Usage in Code

The application uses this table for:

- Creating groups (`createGroup()` in `services/groupRepository.ts`)
- Listing groups (`getAllGroups()` in `services/groupRepository.ts`)
- Ordering by recent activity (`services/groupPreferenceService.ts`)
- Loading group context (`getGroup()` in `services/groupRepository.ts`)
- Cleanup of orphaned groups (`supabase/functions/cleanup-orphaned-groups/index.ts`)
