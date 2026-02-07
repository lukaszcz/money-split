# The user_currency_preferences Table

The `user_currency_preferences` table stores each user's preferred currency order for pickers.

## Purpose and Role

**Primary Function:** Personalize currency selection so the app can:

- Show the most recently used currency first
- Default to a locale-based currency order on first use
- Sync preferences across devices

## Table Structure

The table contains these key columns:

- **id** - Unique identifier for the preference record
- **user_id** - Links to the owning user
- **currency_order** - Ordered list of currency codes
- **created_at** - Record creation timestamp
- **updated_at** - Last update timestamp

## RLS Policies

Row-level security limits access to the owning user only:

- **SELECT** is allowed only when `(select auth.uid())` matches `user_id`.
- **INSERT** is allowed only when `(select auth.uid())` matches `user_id`.
- **UPDATE** is allowed only when `(select auth.uid())` matches `user_id`.
- **DELETE** is not enabled by policy in the current migrations.

## How It Works in Practice

**Example scenario:**

1. The user opens a currency picker
2. If no preference exists, the app seeds it from locale
3. When a currency is selected, it is moved to the front
4. The updated order is saved for next time

## Relationship to Other Tables

```
users
  |
  |-- user_currency_preferences
```

See also: [users](users.md)

## Key Implementation Details

**Locale Default:** The first preference is seeded from the device locale.

**Single Record:** Each user has a single preference row updated in place.

**RLS:** Users can only read and write their own preference row.

**Client Cache:** Values are also cached locally in AsyncStorage (`services/userPreferenceCache.ts`) and refreshed on auth events (`services/userPreferenceSync.ts`).

## Usage in Code

The application uses this table for:

- Loading currency order (`getUserCurrencyOrder()` in `services/currencyPreferenceService.ts`)
- Updating the order when a currency is chosen (`updateCurrencyOrder()`)
- Ensuring group currency appears first (`ensureGroupCurrencyInOrder()`)
- Displaying ordered currency lists (`useCurrencyOrder()` in `hooks/useCurrencyOrder.ts`)
