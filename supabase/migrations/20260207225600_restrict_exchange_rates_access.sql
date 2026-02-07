-- Restrict exchange_rates table access to backend only
-- Drop existing policies that allow client write access

DROP POLICY IF EXISTS "Authenticated users can insert exchange rates" ON exchange_rates;
DROP POLICY IF EXISTS "Authenticated users can update exchange rates" ON exchange_rates;

-- Keep read access for authenticated users (they can read cached rates)
-- The "Anyone can read exchange rates" policy already exists and allows SELECT
-- No write policies = clients cannot insert/update, only the edge function with service role can
