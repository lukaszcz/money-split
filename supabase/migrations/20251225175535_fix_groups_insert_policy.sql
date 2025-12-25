/*
  # Fix Groups INSERT Policy

  ## Changes Made
  
  1. Remove duplicate SELECT policies on groups table
  2. Fix INSERT policy to properly allow authenticated users to create groups
  
  ## Security
  
  - Authenticated users can create groups
  - Only group members can view groups
  - Only group members can update groups
  - Groups can only be deleted when no connected members remain
*/

-- Drop all existing policies on groups
DROP POLICY IF EXISTS "Authenticated users can create groups" ON groups;
DROP POLICY IF EXISTS "Group members can view group" ON groups;
DROP POLICY IF EXISTS "Users can view their groups" ON groups;
DROP POLICY IF EXISTS "Group members can update group" ON groups;
DROP POLICY IF EXISTS "Groups can be deleted when no connected members" ON groups;

-- Create INSERT policy for authenticated users
CREATE POLICY "Authenticated users can create groups"
  ON groups
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create SELECT policy - only one needed
CREATE POLICY "Group members can view group"
  ON groups
  FOR SELECT
  TO authenticated
  USING (
    public.user_is_group_member(auth.uid(), id)
  );

-- Create UPDATE policy
CREATE POLICY "Group members can update group"
  ON groups
  FOR UPDATE
  TO authenticated
  USING (
    public.user_is_group_member(auth.uid(), id)
  )
  WITH CHECK (
    public.user_is_group_member(auth.uid(), id)
  );

-- Create DELETE policy
CREATE POLICY "Groups can be deleted when no connected members"
  ON groups
  FOR DELETE
  TO authenticated
  USING (
    NOT public.group_has_connected_members(id)
  );
