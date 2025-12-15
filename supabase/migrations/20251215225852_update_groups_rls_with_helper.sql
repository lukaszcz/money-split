/*
  # Update Groups RLS Policy

  ## Summary
  Updates the groups SELECT policy to use the helper function for checking membership

  ## Changes
  - Update groups SELECT policy to use user_is_group_member function
*/

-- Drop and recreate groups SELECT policy
DROP POLICY IF EXISTS "Users can view groups they created or belong to" ON groups;

CREATE POLICY "Users can view their groups"
  ON groups FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR
    user_is_group_member(auth.uid(), groups.id)
  );