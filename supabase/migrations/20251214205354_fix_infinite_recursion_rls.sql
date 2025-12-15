/*
  # Fix Infinite Recursion in RLS Policies

  1. Problem
    - The group_members SELECT policy checks group_members table, causing infinite recursion
    - The groups SELECT policy also checks group_members, triggering the recursive check
  
  2. Solution
    - Create a security definer function that bypasses RLS to check membership
    - Update all policies to use this function instead of direct EXISTS queries
  
  3. Changes
    - Drop existing problematic policies
    - Create `is_group_member` security definer function
    - Recreate policies using the new function
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can read groups they are members of" ON groups;
DROP POLICY IF EXISTS "Group members can update their group" ON groups;
DROP POLICY IF EXISTS "Users can read members of their groups" ON group_members;
DROP POLICY IF EXISTS "Group members can add new members" ON group_members;
DROP POLICY IF EXISTS "Group members can remove members" ON group_members;
DROP POLICY IF EXISTS "Users can read expenses in their groups" ON expenses;
DROP POLICY IF EXISTS "Group members can create expenses" ON expenses;

-- Create a security definer function to check group membership (bypasses RLS)
CREATE OR REPLACE FUNCTION is_group_member(group_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = $1
    AND group_members.user_id = $2
  );
$$;

-- Recreate policies using the security definer function

-- Groups policies
CREATE POLICY "Users can read groups they are members of"
  ON groups FOR SELECT
  TO authenticated
  USING (is_group_member(id, auth.uid()));

CREATE POLICY "Group members can update their group"
  ON groups FOR UPDATE
  TO authenticated
  USING (is_group_member(id, auth.uid()))
  WITH CHECK (is_group_member(id, auth.uid()));

-- Group members policies
CREATE POLICY "Users can read members of their groups"
  ON group_members FOR SELECT
  TO authenticated
  USING (is_group_member(group_id, auth.uid()));

CREATE POLICY "Group members can add new members"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (is_group_member(group_id, auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Group members can remove members"
  ON group_members FOR DELETE
  TO authenticated
  USING (is_group_member(group_id, auth.uid()));

-- Expenses policies
CREATE POLICY "Users can read expenses in their groups"
  ON expenses FOR SELECT
  TO authenticated
  USING (is_group_member(group_id, auth.uid()));

CREATE POLICY "Group members can create expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (is_group_member(group_id, auth.uid()));
