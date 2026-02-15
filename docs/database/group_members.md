# The group_members Table

The `group_members` table stores the members of each group, including invited members who are not yet connected to an account.

## Purpose and Role

**Primary Function:** Represent membership within groups so the app can:

- Track members independently of authentication
- Invite members by email
- Connect users to existing member records when they sign up
- Display members in group screens and settlements

## Table Structure

The table contains these key columns:

- **id** - Unique identifier for the member record
- **group_id** - Links to the parent group
- **name** - Display name within the group
- **email** - Optional email used for invitations and connection
- **connected_user_id** - Optional link to a `users` profile
- **created_at** - Timestamp when the member was added

## Constraints and Indexes

- Partial unique index `idx_group_members_unique_connected_user` enforces one non-null `connected_user_id` per group (`group_id`, `connected_user_id` where `connected_user_id IS NOT NULL`).
- Migration `20260215173237_add_unique_connected_user_id_to_group_members.sql` also defines `idx_group_members_unique_email` as a partial unique index on (`group_id`, `connected_user_id`) where `email IS NOT NULL`.

## RLS Policies

Row-level security is membership-based:

- **SELECT** is allowed only when the authenticated user is already a connected member of the group (`user_is_group_member((select auth.uid()), group_id)`).
- **INSERT** is allowed only for existing group members (`user_is_group_member((select auth.uid()), group_id)`).
- **UPDATE** is allowed only for group members (`USING` + `WITH CHECK` on group membership).
- **DELETE** is allowed only for group members and only if `NOT member_is_involved_in_expenses(id)` (member has no non-zero shares and is not an expense payer).

## How It Works in Practice

**Example scenario:**

1. A user creates a group and adds a friend by email.
2. A member row is created with `email` set and `connected_user_id` empty.
3. An invitation email is sent.
4. When the friend signs up, the `connect-user-to-groups` edge function links their account to matching unconnected member rows.

## Relationship to Other Tables

```
groups
  |
  |-- group_members
        |
        |-- expenses.payer_member_id
        |-- expense_shares.member_id
```

See also: [groups](groups.md), [expenses](expenses.md), [expense_shares](expense_shares.md), [users](users.md)

## Key Implementation Details

**Member-Centric Model:** Members are separate entities so groups can include people without accounts.

**Email Reconnection:** Reconnection is handled by the `connect-user-to-groups` edge function using service-role access.

**Disconnect Flow:** Leaving a group sets `connected_user_id` to null while keeping historical expense/share data.

**RLS:** Client reads and writes are limited to existing members of the group.

## Usage in Code

The application uses this table for:

- Creating members (`createGroupMember()` in `services/groupRepository.ts`)
- Listing members (`getGroupMembers()` in `services/groupRepository.ts`)
- Connecting members on signup (`ensureUserProfile()` and `connectUserToGroups()` in `services/groupRepository.ts`)
- Updating members (`updateGroupMember()` in `services/groupRepository.ts`)
- Leaving groups (`leaveGroup()` sets `connected_user_id` to null)
- Guarding member deletion (`canDeleteGroupMember()` / `deleteGroupMember()` in `services/groupRepository.ts`)
