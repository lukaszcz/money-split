# The expense_shares Table

The `expense_shares` table stores per-member allocations for each expense.

## Purpose and Role

**Primary Function:** Represent who owes how much for a single expense or transfer.

## Table Structure

The table contains these key columns:

- **id** - Unique identifier for the share row
- **expense_id** - Parent expense (`expenses.id`)
- **member_id** - Member assigned to this share (`group_members.id`)
- **share_amount_scaled** - Share in expense currency (scaled integer)
- **share_in_main_scaled** - Share converted to group main currency (scaled integer)

## RLS Policies

Access is scoped to membership in the group that owns the parent expense:

- **SELECT** - Allowed when the user is a member of `expenses.group_id`
- **INSERT** - Allowed when the user is a member of `expenses.group_id`
- **UPDATE** - Allowed when the user is a member of `expenses.group_id`
- **DELETE** - Allowed when the user is a member of `expenses.group_id`

All checks rely on `user_is_group_member((select auth.uid()), ...)` through the parent expense.

## How It Works in Practice

1. A payment is created in `expenses`.
2. One or more `expense_shares` rows are inserted.
3. Settlement logic aggregates share values and payer values to compute balances.

## Relationship to Other Tables

`expense_shares` belongs to [expenses](expenses.md) and references [group_members](group_members.md).

## Key Implementation Details

- **Cascade delete:** Removing an expense removes its shares.
- **Precision:** Values are stored as scaled integers to avoid floating point drift.
- **Member deletion safety:** `group_members` delete policy prevents removing members still involved in expenses.

## Usage in Code

- `services/groupRepository.ts` (`createExpense`, `updateExpense`, `getGroupExpenses`, `getExpense`, `deleteExpense`)
- `services/settlementService.ts`
