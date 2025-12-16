/*
  # Add policies for account deletion and disconnection
  
  1. Changes
    - Add DELETE policy for users table allowing users to delete their own account
    - Update group_members UPDATE policy to allow users to disconnect themselves by setting connected_user_id to null
  
  2. Security
    - Users can only delete their own user record (id = auth.uid())
    - Users can disconnect themselves from group_members by setting connected_user_id to null
*/

-- Allow users to delete their own account
CREATE POLICY "Users can delete their own account"
  ON users
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- Drop the existing update policy for group_members to recreate it with better logic
DROP POLICY IF EXISTS "Allow updating member connected user" ON group_members;

-- Create a new update policy that allows users to:
-- 1. Connect themselves to a member (set connected_user_id to their own id)
-- 2. Disconnect themselves from a member (set connected_user_id to null when it's currently their id)
CREATE POLICY "Users can connect or disconnect themselves"
  ON group_members
  FOR UPDATE
  TO authenticated
  USING (
    (connected_user_id = auth.uid()) OR 
    (connected_user_id IS NULL)
  )
  WITH CHECK (
    (connected_user_id = auth.uid()) OR 
    (connected_user_id IS NULL)
  );
