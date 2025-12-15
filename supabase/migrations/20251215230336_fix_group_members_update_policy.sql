/*
  # Fix Group Members Update Policy

  ## Summary
  The previous UPDATE policy tried to query auth.users table directly, which
  authenticated users don't have permission to access. This migration simplifies
  the policy to not require that access.

  ## Changes
  - Drop the UPDATE policy that queries auth.users
  - Create new UPDATE policy that only checks the WITH CHECK clause
*/

-- Drop the problematic UPDATE policy
DROP POLICY IF EXISTS "Allow updating connected_user_id for matching email" ON group_members;

-- Create new UPDATE policy that doesn't query auth.users
CREATE POLICY "Allow updating member connected user"
  ON group_members FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    (connected_user_id = auth.uid() OR connected_user_id IS NULL)
  );