/*
  # Fix Group Members RLS Infinite Recursion

  ## Summary
  The previous RLS policy for group_members had infinite recursion because it checked
  the group_members table within its own policy. This migration fixes it by using
  only the groups table for authorization.

  ## Changes
  - Drop existing SELECT policy on group_members
  - Create new SELECT policy that only checks groups table
  - Update INSERT policy to avoid recursion
  - Update UPDATE policy to avoid recursion
*/

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view members of groups they belong to" ON group_members;
DROP POLICY IF EXISTS "Users can insert members to groups they created or belong to" ON group_members;
DROP POLICY IF EXISTS "Users can update members in groups they belong to" ON group_members;

-- Create new SELECT policy that only checks groups table (no recursion)
CREATE POLICY "Users can view members of their groups"
  ON group_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_members.group_id
      AND g.created_by = auth.uid()
    )
    OR
    group_members.connected_user_id = auth.uid()
  );

-- Create new INSERT policy (only group creators can add members)
CREATE POLICY "Group creators can add members"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_members.group_id
      AND g.created_by = auth.uid()
    )
  );

-- Create new UPDATE policy (only allow updating connected_user_id for auto-connection)
CREATE POLICY "Allow updating connected_user_id for matching email"
  ON group_members FOR UPDATE
  TO authenticated
  USING (
    group_members.email IS NOT NULL
    AND (
      SELECT email FROM auth.users WHERE id = auth.uid()
    ) = group_members.email
  )
  WITH CHECK (
    connected_user_id = auth.uid()
  );