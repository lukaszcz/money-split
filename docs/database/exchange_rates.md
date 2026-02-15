# The exchange_rates Table

The `exchange_rates` table stores cached FX rates used to convert expense values into a group's main currency.

## Purpose and Role

**Primary Function:** Reduce external API calls and keep conversion behavior consistent by caching currency pairs.

## Table Structure

The table contains these key columns:

- **id** - Unique identifier for the cached rate row
- **base_currency_code** - Source currency
- **quote_currency_code** - Target currency
- **rate_scaled** - Conversion rate stored as scaled integer
- **fetched_at** - Timestamp when the rate was fetched

## RLS Policies

Current policies allow authenticated clients to read cached rates but not mutate them:

- **SELECT** - Allowed (`USING (true)` for authenticated users)
- **INSERT** - No policy (client writes denied by RLS)
- **UPDATE** - No policy (client writes denied by RLS)
- **DELETE** - No policy

Writes are performed by the `get-exchange-rate` edge function using service-role permissions.

## How It Works in Practice

1. The client checks local memory + AsyncStorage cache first (`services/exchangeRateService.ts`, 4-hour TTL).
2. If local cache is stale/missing, the client calls `get-exchange-rate`.
3. The edge function checks `exchange_rates` (12-hour TTL for DB cache).
4. If stale/missing, the edge function fetches from `https://api.exchangerate-api.com/v4/latest/{base}` and upserts the row.

## Relationship to Other Tables

`exchange_rates` is a standalone cache table. It is read when creating/updating values in [expenses](expenses.md).

## Usage in Code

- `services/exchangeRateService.ts` (`getExchangeRate`)
- `supabase/functions/get-exchange-rate/index.ts`
