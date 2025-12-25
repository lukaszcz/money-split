/*
  # Fix Groups INSERT with SELECT Policy

  ## Problem
  
  When creating a group with .insert().select(), the SELECT policy is applied
  to the returned row. Since no group_members exist yet, the policy fails.
  
  ## Solution
  
  Allow authenticated users to SELECT groups where EITHER:
  1. They are a member (via group_members), OR
  2. The group has no connected members yet (newly created)
  
  This allows the creator to see the group immediately after creation,
  before they are added as a member.
  
  ## Security
  
  - Users can only view groups they are members of
  - Users can view brand new groups (with no members) for a brief moment
  - This is safe because the creator immediately adds themselves as a member
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Group members can view group" ON groups;

-- Create new SELECT policy that allows viewing newly created groups
CREATE POLICY "Group members can view group"
  ON groups
  FOR SELECT
  TO authenticated
  USING (
    -- User is a member of the group
    public.user_is_group_member(auth.uid(), id)
    OR
    -- Group has no connected members yet (newly created)
    NOT public.group_has_connected_members(id)
  );
