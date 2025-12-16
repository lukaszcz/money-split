/*
  # Allow Users to View Unconnected Members by Email

  ## Problem
  Users signing up cannot reconnect to their group_members because:
  - UPDATE policy needs to SELECT rows first
  - SELECT policy only allows viewing if user_is_group_member(auth.uid(), group_id) is true
  - But user_is_group_member checks for connected_user_id = auth.uid()
  - So unconnected members are invisible, making UPDATE impossible

  ## Solution
  Add a SELECT policy that allows users to view group_members that have their email
  address, even if connected_user_id is NULL. This allows the reconnection UPDATE
  to find and update the rows.

  ## Changes
  1. Add new SELECT policy: "Users can view members matching their email"
*/

CREATE POLICY "Users can view members matching their email"
  ON group_members FOR SELECT
  TO authenticated
  USING (
    email IS NOT NULL
    AND email = get_user_email_by_id(auth.uid())
  );
