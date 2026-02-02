/*
  # Fix Group Members Delete Policy Performance

  ## Problem
  The "Members can delete members with no expenses" policy uses auth.uid()
  directly, which gets re-evaluated for each row. This produces suboptimal
  query performance at scale.

  ## Solution
  Replace auth.uid() with (select auth.uid()) to ensure the function is
  evaluated once per query rather than once per row.
*/

-- Drop and recreate the policy with optimized auth.uid() call
DROP POLICY IF EXISTS "Members can delete members with no expenses" ON group_members;

CREATE POLICY "Members can delete members with no expenses"
  ON group_members
  FOR DELETE
  TO authenticated
  USING (
    public.user_is_group_member((select auth.uid()), group_id)
    AND NOT public.member_is_involved_in_expenses(id)
  );
