/*
  # Update Remaining Group Members Policies

  ## Summary
  Updates the remaining RLS policies for group_members to use the helper function

  ## Changes
  - Update DELETE policy to use user_is_group_member function
*/

-- Drop and recreate DELETE policy
DROP POLICY IF EXISTS "Users can delete members from groups they created" ON group_members;

CREATE POLICY "Group creators can delete members"
  ON group_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_members.group_id
      AND g.created_by = auth.uid()
    )
  );