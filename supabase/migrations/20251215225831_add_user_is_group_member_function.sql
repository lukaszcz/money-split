/*
  # Add Helper Function to Check Group Membership

  ## Summary
  Creates a security definer function that checks if a user is a member of a group
  without triggering RLS recursion. This function can be used in RLS policies.

  ## Changes
  - Create user_is_group_member function with security definer
  - Update group_members SELECT policy to use this function
  - Update group_members INSERT policy to allow members to add other members
*/

-- Create a security definer function to check group membership
CREATE OR REPLACE FUNCTION user_is_group_member(user_id uuid, group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_members
    WHERE group_members.group_id = user_is_group_member.group_id
    AND group_members.connected_user_id = user_is_group_member.user_id
  );
$$;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view members of their groups" ON group_members;
DROP POLICY IF EXISTS "Group creators can add members" ON group_members;

-- Create new SELECT policy using the helper function
CREATE POLICY "Users can view members of groups they belong to"
  ON group_members FOR SELECT
  TO authenticated
  USING (
    user_is_group_member(auth.uid(), group_members.group_id)
    OR
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_members.group_id
      AND g.created_by = auth.uid()
    )
  );

-- Create new INSERT policy (group creators and existing members can add members)
CREATE POLICY "Group members can add new members"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_is_group_member(auth.uid(), group_members.group_id)
    OR
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_members.group_id
      AND g.created_by = auth.uid()
    )
  );