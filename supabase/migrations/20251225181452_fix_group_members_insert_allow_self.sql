/*
  # Fix group_members INSERT policy to allow self-insertion

  ## Problem
  - When creating a group, users cannot add themselves as the first member
  - The current INSERT policy requires the user to already be a member
  - This creates a chicken-and-egg problem

  ## Solution
  - Allow users to add themselves as members (when connected_user_id = auth.uid())
  - Keep the existing logic to allow existing members to add others

  ## Changes
  - Drop existing INSERT policy
  - Create new policy that allows:
    1. User is adding themselves (connected_user_id = auth.uid())
    2. OR user is already a member of the group
*/

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Group members can add new members" ON group_members;

-- Create new policy that allows self-insertion or member insertion
CREATE POLICY "Users can add themselves or members can add others"
  ON group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow user to add themselves
    connected_user_id = auth.uid()
    OR
    -- Allow existing members to add others
    user_is_group_member(auth.uid(), group_id)
  );
