/*
  # Fix Group Member Connection on Signup

  ## Summary
  Ensures that when a new user signs up, they are automatically connected to any
  group_members records that have their email but no connected_user_id.

  ## Problem
  The existing UPDATE policies may be conflicting or not properly allowing the
  automatic connection during signup.

  ## Solution
  1. Drop the overly broad "Users can connect or disconnect themselves" policy
  2. Keep the specific "Users can connect themselves to members with their email" policy
  3. Add a separate policy for disconnection
  4. Ensure the policies work correctly for bulk updates during signup

  ## Changes
  - Drop "Users can connect or disconnect themselves" policy
  - Update "Users can connect themselves to members with their email" policy to be clearer
  - Add new policy for disconnection
*/

-- Drop the broad policy that might be causing conflicts
DROP POLICY IF EXISTS "Users can connect or disconnect themselves" ON group_members;

-- Drop and recreate the connection policy to ensure it's correct
DROP POLICY IF EXISTS "Users can connect themselves to members with their email" ON group_members;

-- Allow users to connect themselves to group_members with their email
CREATE POLICY "Users can connect to members with their email"
  ON group_members FOR UPDATE
  TO authenticated
  USING (
    -- Can only update records that have the user's email and no current connection
    email IS NOT NULL
    AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND connected_user_id IS NULL
  )
  WITH CHECK (
    -- Can only set the connection to themselves
    email IS NOT NULL
    AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND connected_user_id = auth.uid()
  );

-- Allow users to disconnect themselves from group members
CREATE POLICY "Users can disconnect themselves from members"
  ON group_members FOR UPDATE
  TO authenticated
  USING (
    -- Can only update records where they are currently connected
    connected_user_id = auth.uid()
  )
  WITH CHECK (
    -- Can only set it to NULL (disconnect) or keep it as themselves
    connected_user_id IS NULL OR connected_user_id = auth.uid()
  );