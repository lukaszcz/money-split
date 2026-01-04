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

Row-level security balances group membership access with email-based invitations:

- **SELECT** is allowed for group members (`user_is_group_member(auth.uid(), group_id)`) and for rows where `email` matches the authenticated user's email (so invited users can see unconnected rows).
- **INSERT** is allowed when the authenticated user is adding themselves (`connected_user_id = auth.uid()`) or when they are already a member of the group.
- **UPDATE** is allowed for group members so they can edit member details within their group. Additional policies allow users to connect themselves when the member email matches their account.
- **DELETE** is allowed for disconnected members only (`connected_user_id IS NULL`), used by cleanup routines.

## How It Works in Practice

**Example scenario:**

1. A user creates a group and adds a friend by email
2. A member row is created with `email` set and `connected_user_id` empty
3. An invitation email is sent
4. When the friend signs up, `reconnectGroupMembers()` links their account

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

**Disconnect Flow:** Leaving a group sets `connected_user_id` to null while keeping historical data.

**RLS:** Access is based on membership and email matching for unconnected members.

## Usage in Code

The application uses this table for:

- Creating members (`createGroupMember()` in `services/groupRepository.ts`)
- Listing members (`getGroupMembers()` in `services/groupRepository.ts`)
- Connecting members on signup (`ensureUserProfile()` and `reconnectGroupMembers()` in `services/groupRepository.ts`)
- Updating members (`updateGroupMember()` in `services/groupRepository.ts`)
- Leaving groups (`leaveGroup()` sets `connected_user_id` to null)
