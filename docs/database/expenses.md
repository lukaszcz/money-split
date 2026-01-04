# The expenses Table

The `expenses` table stores individual payments within a group, including shared expenses and direct transfers.

## Purpose and Role

**Primary Function:** Record payment events so the app can:

- Track who paid and for what
- Support multiple split methods (equal, percentage, exact)
- Preserve exchange rate snapshots for multi-currency accuracy
- Distinguish expenses from transfers

## Table Structure

The table contains these key columns:

- **id** - Unique identifier for the expense
- **group_id** - Links to the parent group
- **description** - Optional label for the expense
- **date_time** - When the payment occurred
- **currency_code** - Original payment currency
- **total_amount_scaled** - Total amount in the original currency (scaled integer)
- **payer_member_id** - Group member who paid
- **exchange_rate_to_main_scaled** - Snapshot rate to group main currency (scaled integer)
- **total_in_main_scaled** - Total amount converted to main currency (scaled integer)
- **payment_type** - `expense` or `transfer`
- **split_type** - `equal`, `percentage`, or `exact`
- **created_at** - Row creation timestamp

## RLS Policies

Row-level security ensures only members of a group can access its expenses:

- **SELECT** is allowed when the authenticated user is a member of the expense's group (`user_is_group_member(auth.uid(), group_id)`).
- **INSERT** is allowed only for members of the group.
- **UPDATE** is allowed only for members of the group (no owner-only restriction).
- **DELETE** is allowed only for members of the group.

## How It Works in Practice

**Example scenario:**

1. A user adds a $90 dinner in USD for a EUR group
2. The app fetches and stores the exchange rate at creation time
3. The expense is saved with a USD total and the EUR converted total
4. `expense_shares` rows describe how the total is split

## Relationship to Other Tables

```
groups
  |
  |-- expenses
        |
        |-- expense_shares (one or more shares per expense)
        |-- group_members (payer_member_id)
```

See also: [groups](groups.md), [expense_shares](expense_shares.md), [group_members](group_members.md)

## Key Implementation Details

**Snapshot FX Rate:** Each expense stores the conversion rate to preserve historical accuracy.

**Scaled Integers:** All monetary values are stored as scaled integers to avoid floating point errors.

**Transfer Support:** Transfers are modeled as expenses with a single share.

**RLS:** Only group members can read or write expenses for their groups.

## Usage in Code

The application uses this table for:

- Creating expenses and transfers (`createExpense()` in `services/groupRepository.ts`)
- Editing expenses (`updateExpense()` in `services/groupRepository.ts`)
- Deleting expenses (`deleteExpense()` in `services/groupRepository.ts`)
- Group activity feeds (`getGroupExpenses()` in `services/groupRepository.ts`)
- Settlement calculations (`services/settlementService.ts`)
