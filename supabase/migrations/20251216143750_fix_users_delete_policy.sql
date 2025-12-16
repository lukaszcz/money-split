/*
  # Fix users DELETE policy
  
  ## Summary
  Recreates the DELETE policy for the users table to ensure it's properly configured
  and users can delete their own accounts.
  
  ## Changes
  - Drop existing DELETE policy
  - Recreate DELETE policy with proper configuration
  
  ## Security
  - Users can only delete their own account (auth.uid() = id)
*/

-- Drop existing DELETE policy
DROP POLICY IF EXISTS "Users can delete their own account" ON users;

-- Recreate DELETE policy
CREATE POLICY "Users can delete their own account"
  ON users
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);
