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

Current policies allow authenticated users to manage the cache:

- **SELECT** - Allowed (`USING (true)`)
- **INSERT** - Allowed (`WITH CHECK (true)`)
- **UPDATE** - Allowed (`USING (true) WITH CHECK (true)`)
- **DELETE** - No delete policy

## How It Works in Practice

1. The client checks for `base -> quote` in `exchange_rates`.
2. If the cached row is fresh (12-hour TTL), it is reused.
3. If stale/missing, the client fetches from `https://api.exchangerate-api.com/v4/latest/{base}`.
4. The row is upserted and then used for conversion.

## Relationship to Other Tables

`exchange_rates` is a standalone cache table. It is read when creating/updating values in [expenses](expenses.md).

## Usage in Code

- `services/exchangeRateService.ts` (`getExchangeRate`)
