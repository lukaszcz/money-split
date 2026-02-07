/*
  # Disable direct INSERT on groups for authenticated clients

  ## Context
  Group creation is handled by the `create-group` edge function, which writes
  with the service role key. Authenticated client sessions should not be able
  to insert rows into `public.groups` directly.

  ## Changes
  - Drop every existing INSERT policy on `public.groups`
  - Leave RLS in place so direct client INSERT remains denied
*/

DO $$
DECLARE
  groups_insert_policy RECORD;
BEGIN
  FOR groups_insert_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'groups'
      AND cmd = 'INSERT'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.groups',
      groups_insert_policy.policyname
    );
  END LOOP;
END
$$;
