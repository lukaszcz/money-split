/*
  # Create get_activity_feed RPC

  ## Purpose
  Provide a single, paginated activity feed query for the Activity tab.
  This avoids client-side N+1 queries (groups -> expenses -> payer member).

  ## Security
  - Uses SECURITY INVOKER (RLS still applies)
  - Explicitly filters by current authenticated user membership
*/

CREATE OR REPLACE FUNCTION public.get_activity_feed(
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  group_id uuid,
  group_name text,
  description text,
  date_time timestamptz,
  currency_code text,
  total_amount_scaled bigint,
  payer_member_id uuid,
  payer_name text,
  payment_type text,
  split_type text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    e.id,
    e.group_id,
    g.name AS group_name,
    e.description,
    e.date_time,
    e.currency_code,
    e.total_amount_scaled,
    e.payer_member_id,
    COALESCE(gm.name, 'Unknown') AS payer_name,
    e.payment_type,
    e.split_type,
    e.created_at
  FROM public.expenses e
  INNER JOIN public.groups g
    ON g.id = e.group_id
  LEFT JOIN public.group_members gm
    ON gm.id = e.payer_member_id
  WHERE public.user_is_group_member((select auth.uid()), e.group_id)
  ORDER BY e.date_time DESC, e.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 0), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

GRANT EXECUTE ON FUNCTION public.get_activity_feed(integer, integer) TO authenticated;
