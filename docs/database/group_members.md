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

## RLS Policies

Row-level security balances membership control and invitation/reconnection flows:

- **SELECT** is allowed when:
  - the user is already a connected member of the group, or
  - the row email matches the authenticated user email (`email = get_user_email_by_id((select auth.uid()))`), so invited users can reconnect.
- **INSERT** is allowed when:
  - `connected_user_id = (select auth.uid())` (user adds themselves), or
  - the user is already a group member.
- **UPDATE** is allowed for group members (`USING` + `WITH CHECK` on group membership).
- **DELETE** is allowed only for group members and only if `NOT member_is_involved_in_expenses(id)` (member has no non-zero shares and is not an expense payer).

## How It Works in Practice

**Example scenario:**

1. A user creates a group and adds a friend by email
2. A member row is created with `email` set and `connected_user_id` empty
3. An invitation email is sent
4. When the friend signs up, `connectUserToGroups()` links their account

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

**Email Reconnection:** Policies allow users to view and connect records that match their email.

**Disconnect Flow:** Leaving a group sets `connected_user_id` to null while keeping historical expense/share data.

**RLS:** Access is based on membership plus email-based reconnection support.

## Usage in Code

The application uses this table for:

- Creating members (`createGroupMember()` in `services/groupRepository.ts`)
- Listing members (`getGroupMembers()` in `services/groupRepository.ts`)
- Connecting members on signup (`ensureUserProfile()` and `connectUserToGroups()` in `services/groupRepository.ts`)
- Updating members (`updateGroupMember()` in `services/groupRepository.ts`)
- Leaving groups (`leaveGroup()` sets `connected_user_id` to null)
- Guarding member deletion (`canDeleteGroupMember()` / `deleteGroupMember()` in `services/groupRepository.ts`)
