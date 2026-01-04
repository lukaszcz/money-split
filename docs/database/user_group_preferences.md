# The user_group_preferences Table

The `user_group_preferences` table stores a per-user ordering of groups based on recent activity.

## Purpose and Role

**Primary Function:** Personalize group listing so the app can:

- Show most recently visited groups first
- Maintain consistent ordering across devices
- Clean up references to deleted groups

## Table Structure

The table contains these key columns:

- **user_id** - Links to the owning user
- **group_order** - Ordered list of group IDs
- **updated_at** - Last update timestamp

## RLS Policies

Row-level security limits access to the owning user only:

- **SELECT** is allowed only when `auth.uid()` matches `user_id`.
- **INSERT** is allowed only when `auth.uid()` matches `user_id`.
- **UPDATE** is allowed only when `auth.uid()` matches `user_id`.
- **DELETE** is not enabled by policy in the current migrations.

## How It Works in Practice

**Example scenario:**

1. A user opens a group
2. That group ID is moved to the front of `group_order`
3. When listing groups, the order is applied to the fetched group list

## Relationship to Other Tables

```
users
  |
  |-- user_group_preferences
          |
          |-- groups (ordered by IDs)
```

See also: [users](users.md), [groups](groups.md)

## Key Implementation Details

**Recency Ordering:** Group visits are recorded and reordered on each open.

**Cleanup:** Missing group IDs are pruned to avoid stale ordering.

**RLS:** Users can only read and write their own preferences.

## Usage in Code

The application uses this table for:

- Recording group visits (`recordGroupVisit()` in `services/groupPreferenceService.ts`)
- Ordering group lists (`getOrderedGroups()` in `services/groupPreferenceService.ts`)
- Cleaning up stale entries (`cleanupGroupPreferences()`)
