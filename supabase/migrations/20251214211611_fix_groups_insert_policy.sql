/*
  # Fix Groups INSERT Policy
  
  1. Problem
    - Despite having a permissive INSERT policy with WITH CHECK (true), authenticated users still cannot create groups
    - Error: "new row violates row-level security policy for table 'groups'"
  
  2. Root Cause
    - The policy might have conflicts or the auth context isn't being properly recognized
  
  3. Solution
    - Drop all existing policies on groups table
    - Recreate them with explicit, simple checks
    - Test that authenticated users can insert with minimal restrictions
*/

-- Drop all existing policies on groups table
DROP POLICY IF EXISTS "Authenticated users can create groups" ON groups;
DROP POLICY IF EXISTS "Users can read groups they are members of" ON groups;
DROP POLICY IF EXISTS "Group members can update their group" ON groups;

-- Recreate INSERT policy - allow any authenticated user to create groups
CREATE POLICY "Allow authenticated users to insert groups"
  ON groups
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Recreate SELECT policy - users can read groups they are members of
CREATE POLICY "Allow authenticated users to select their groups"
  ON groups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
    )
  );

-- Recreate UPDATE policy - group members can update their group
CREATE POLICY "Allow group members to update groups"
  ON groups
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
    )
  );
