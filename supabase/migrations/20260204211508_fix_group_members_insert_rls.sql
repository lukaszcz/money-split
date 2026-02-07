/*
  # Fix group_members INSERT RLS policy - restrict to existing members only

  ## Problem
  - The current INSERT policy allows ANY authenticated user to add themselves
    to ANY group by setting connected_user_id = auth.uid()
  - This is a security vulnerability allowing unauthorized group access

  ## Solution
  - Remove the self-insertion clause from the INSERT policy
  - Only existing group members should be able to add new members
  - Group creation (including adding the first member) is now handled by
    the create-group edge function which uses the service role key to
    bypass RLS

  ## Changes
  - Drop the existing INSERT policy that allows self-insertion
  - Create a new stricter policy that only allows existing members to add members
*/

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Users can add themselves or members can add others" ON group_members;

-- Create new strict policy - only existing members can add new members
-- The first member is added by the create-group edge function using service role
CREATE POLICY "Group members can add new members"
  ON group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_is_group_member(auth.uid(), group_id)
  );
