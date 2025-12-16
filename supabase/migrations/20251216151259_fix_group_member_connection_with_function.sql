/*
  # Fix Group Member Connection with Helper Function

  ## Summary
  Creates a helper function to get the current user's email safely, avoiding RLS evaluation issues
  when trying to SELECT from the users table within a policy check.

  ## Problem
  The RLS policy was using a subquery `(SELECT email FROM users WHERE id = auth.uid())` which
  caused "permission denied for table users" errors during policy evaluation.

  ## Solution
  Create a SECURITY DEFINER function that can safely query the users table, then use this
  function in the RLS policy instead of a direct subquery.

  ## Changes
  1. Create `get_user_email_by_id` function
  2. Update the "Users can connect to members with their email" policy to use the new function
*/

-- Create a helper function to get user email safely
CREATE OR REPLACE FUNCTION get_user_email_by_id(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT email FROM users WHERE id = user_id;
$$;

-- Drop and recreate the connection policy using the helper function
DROP POLICY IF EXISTS "Users can connect to members with their email" ON group_members;

CREATE POLICY "Users can connect to members with their email"
  ON group_members FOR UPDATE
  TO authenticated
  USING (
    email IS NOT NULL
    AND email = get_user_email_by_id(auth.uid())
    AND connected_user_id IS NULL
  )
  WITH CHECK (
    email IS NOT NULL
    AND email = get_user_email_by_id(auth.uid())
    AND connected_user_id = auth.uid()
  );