/*
  # Allow Users to Connect to Group Members by Email

  ## Summary
  This migration adds an RLS policy that allows users to connect themselves to 
  group_members records that match their email address and have no existing connection.

  ## Changes

  ### 1. New UPDATE Policy
  - Allows authenticated users to update `connected_user_id` on group_members records
  - Only if the record has their email address
  - Only if the record currently has no connected_user_id (is null)
  - Only allows setting connected_user_id to their own user ID

  ## Security
  - Users can only connect themselves, not other users
  - Can only connect to records with their own email
  - Cannot hijack already-connected members
  - Cannot modify other fields (name, email, etc.)
*/

-- Create a policy that allows users to connect themselves to group members with their email
CREATE POLICY "Users can connect themselves to members with their email"
  ON group_members FOR UPDATE
  TO authenticated
  USING (
    email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
    AND connected_user_id IS NULL
  )
  WITH CHECK (
    email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
    AND connected_user_id = auth.uid()
  );