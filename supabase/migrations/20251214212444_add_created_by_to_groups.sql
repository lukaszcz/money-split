/*
  # Add created_by column to groups table

  1. Problem
    - INSERT with .select() fails because SELECT policy requires group_members
    - But group_members don't exist yet when the group is first created
    - This is a chicken-and-egg problem

  2. Solution
    - Add `created_by` column to track who created the group
    - Update SELECT policy to allow creator OR group members to read
    - This allows the creator to read immediately after INSERT

  3. Changes
    - Add `created_by` column (uuid, references auth.users)
    - Update SELECT policy to include creator check
*/

-- Add created_by column
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Allow authenticated users to select their groups" ON groups;
DROP POLICY IF EXISTS "Users can read groups they are members of" ON groups;

-- Create new SELECT policy that allows creator OR members to read
CREATE POLICY "Users can read groups they created or are members of"
  ON groups
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
    )
  );
