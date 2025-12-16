/*
  # Fix RLS Policy to Use Public Users Table

  ## Summary
  Fixes the group_members UPDATE policies to use the public users table instead of auth.users,
  which authenticated users don't have permission to query.

  ## Problem
  The policies were trying to SELECT from auth.users, causing "permission denied" errors.

  ## Solution
  Use the public users table instead, which has proper RLS policies.

  ## Changes
  - Update "Users can connect to members with their email" policy to use public users table
  - Update "Users can disconnect themselves from members" policy (no changes needed)
*/

-- Drop and recreate the connection policy with correct table reference
DROP POLICY IF EXISTS "Users can connect to members with their email" ON group_members;

-- Allow users to connect themselves to group_members with their email
CREATE POLICY "Users can connect to members with their email"
  ON group_members FOR UPDATE
  TO authenticated
  USING (
    -- Can only update records that have the user's email and no current connection
    email IS NOT NULL
    AND email = (SELECT email FROM users WHERE id = auth.uid())
    AND connected_user_id IS NULL
  )
  WITH CHECK (
    -- Can only set the connection to themselves
    email IS NOT NULL
    AND email = (SELECT email FROM users WHERE id = auth.uid())
    AND connected_user_id = auth.uid()
  );