# The exchange_rates Table

The `exchange_rates` table caches currency conversion rates used for multi-currency expenses.

## Purpose and Role

**Primary Function:** Provide cached FX rates so the app can:

- Convert expenses into a group's main currency
- Avoid repeated API calls
- Support offline or low-connectivity scenarios

## Table Structure

The table contains these key columns:

- **id** - Unique identifier for the cached rate
- **base_currency_code** - The base currency
- **quote_currency_code** - The target currency
- **rate_scaled** - Conversion rate (scaled integer)
- **fetched_at** - Timestamp when the rate was retrieved

## RLS Policies

Row-level security allows authenticated clients to read and refresh cached rates:

- **SELECT** is allowed for authenticated users so rates can be reused across groups.
- **INSERT** is allowed for authenticated users to cache newly fetched rates.
- **UPDATE** is allowed for authenticated users to refresh stale rates.
- **DELETE** is not enabled by policy in the current migrations.

## How It Works in Practice

**Example scenario:**

1. A user adds an expense in USD to a EUR group
2. The app checks the cache for USD -> EUR
3. If stale or missing, it fetches from the external API
4. The new rate is stored and used to compute the expense total

## Relationship to Other Tables

```
exchange_rates (standalone cache)
```

See also: [expenses](expenses.md), [groups](groups.md)

## Key Implementation Details

**Cache Duration:** Rates are treated as valid for 12 hours.

**Scaled Integers:** Rates are stored as scaled integers for precise math.

**Client-Side Fetch:** The client calls the external API and upserts into Supabase.

## Usage in Code

The application uses this table in the function

- Fetching and caching rates (`getExchangeRate()` in `services/exchangeRateService.ts`)
- Listing cached rates (`getCachedRates()` in `services/exchangeRateService.ts`)
- Determining last refresh time (`getLastRefreshTime()` in `services/exchangeRateService.ts`)
