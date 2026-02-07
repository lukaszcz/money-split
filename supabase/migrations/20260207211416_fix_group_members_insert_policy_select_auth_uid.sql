/*
  # Fix group_members INSERT RLS policy performance

  ## Problem
  - The `Group members can add new members` policy on `public.group_members`
    uses `auth.uid()` directly.
  - In RLS predicates, direct `auth.<function>()` calls can be re-evaluated per row,
    which hurts performance at scale.

  ## Solution
  - Recreate the INSERT policy and replace `auth.uid()` with `(select auth.uid())`
    so the value is evaluated once per statement.
*/

DROP POLICY IF EXISTS "Group members can add new members" ON public.group_members;

CREATE POLICY "Group members can add new members"
  ON public.group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_is_group_member((select auth.uid()), group_id)
  );
