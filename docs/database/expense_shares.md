# Expense shares

## The expense_shares Table

The `expense_shares` table is a critical component of this group expense tracking application that implements **split payment functionality**. It stores information about how expenses are divided among group members.

### Purpose and Role

**Primary Function:** When a group has a shared expense, this table tracks which members are responsible for what portion of that expense. It enables the application to:

- Split bills among multiple people
- Track who owes what for each expense
- Calculate balances and settlements between group members
- Support both equal and unequal expense splits

### Table Structure

The table contains these key columns:

- **id** - Unique identifier for each share record
- **expense_id** - Links to the parent expense in the `expenses` table
- **member_id** - Links to a group member in the `group_members` table (who this share belongs to)
- **share_amount_scaled** - The amount this member owes in the expense's original currency (scaled/multiplied for precision)
- **share_in_main_scaled** - The amount converted to the group's main currency (scaled/multiplied for precision)

### How It Works in Practice

**Example scenario:**

1. Alice, Bob, and Charlie go to dinner (total: $90)
2. Alice pays the full bill
3. An expense record is created with Alice as the payer
4. Three `expense_shares` records are created:
    - One for Alice ($30 share)
    - One for Bob ($30 share)
    - One for Charlie ($30 share)

This allows the app to calculate that Bob and Charlie each owe Alice $30.

### Relationship to Other Tables

```
expenses (parent expense)
    |
    |-- expense_shares (multiple shares per expense)
            |
            |-- group_members (who owes this share)
```

### Key Implementation Details

**Cascade Deletion:** When an expense is deleted, all associated shares are automatically deleted (`ON DELETE CASCADE`)

**Multi-Currency Support:** The table stores amounts in both the original currency and the group's main currency for accurate balance calculations

**Scaled Integers:** Amounts are stored as scaled integers (multiplied by a factor) to avoid floating-point precision issues

**Security:** RLS policies ensure only group members can view and modify shares for their group's expenses

### Usage in Code

The application manipulates expense shares when:

- Creating a new expense (inserting multiple share records)
- Updating an expense (deleting old shares and inserting new ones)
- Deleting an expense (cascade deletion handles this)
- Viewing expense details (joining to show who owes what)
- Calculating group balances (aggregating share amounts)

This design allows flexible expense splitting where each member can owe different amounts, making it suitable for various scenarios like shared trips, household expenses, or group dining.
