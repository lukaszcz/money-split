/*
  # Enforce member-only SELECT policy on group_members

  ## Problem
  - Some environments may still allow users to select `group_members` rows by
    email match, even when they are not connected members of the group.
  - Current reconnect flow is handled by the `connect-user-to-groups` edge
    function using service role, so client-side email SELECT is no longer needed.

  ## Solution
  - Recreate SELECT policy so only existing connected group members can read
    `group_members` rows.
  - Use `(select auth.uid())` in the predicate to avoid per-row re-evaluation.
*/

DROP POLICY IF EXISTS "Users can view group members" ON public.group_members
DROP POLICY IF EXISTS "Users can view members matching their email" ON public.group_members
DROP POLICY IF EXISTS "Users can view members of groups they belong to" ON public.group_members
DROP POLICY IF EXISTS "Users can view members of their groups" ON public.group_members
DROP POLICY IF EXISTS "Users can read members of their groups" ON public.group_members
DROP POLICY IF EXISTS "Allow public read on group_members" ON public.group_members
CREATE POLICY "Users can view group members"
  ON public.group_members
  FOR SELECT
  TO authenticated
  USING (
    public.user_is_group_member((select auth.uid()), group_id)
  )
