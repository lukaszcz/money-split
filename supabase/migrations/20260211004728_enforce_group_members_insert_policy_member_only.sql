/*
  # Enforce member-only INSERT policy on group_members

  ## Problem
  - Some environments may still have a permissive `group_members` INSERT policy
    that allows self-insert flows based on email or `connected_user_id`.

  ## Solution
  - Recreate the INSERT policy so only existing connected group members
    can insert new `group_members` rows.
  - Use `(select auth.uid())` in the predicate to avoid per-row re-evaluation.
*/

DROP POLICY IF EXISTS "Users can add themselves or members can add others" ON public.group_members
DROP POLICY IF EXISTS "Group members can add new members" ON public.group_members
CREATE POLICY "Group members can add new members"
  ON public.group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_is_group_member((select auth.uid()), group_id)
  )
