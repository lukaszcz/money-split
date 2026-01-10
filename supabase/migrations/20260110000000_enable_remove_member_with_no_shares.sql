/*
  # Enable Removing Group Members with No Expense Shares

  ## Changes Made

  ### 1. Add Helper Function
    - Create function to check if a member has non-zero shares in any expense
    - Used by RLS policy to determine if member can be deleted

  ### 2. Update RLS Policy for group_members DELETE
    - Members can be deleted only if they have no non-zero shares
    - Any group member can delete another member meeting this criteria

  ## Security
    - Ensures members involved in expenses cannot be deleted
    - Maintains data integrity for expense tracking
*/

-- =====================================================
-- 1. CREATE HELPER FUNCTION
-- =====================================================

-- Function to check if a member has any non-zero shares in expenses
CREATE OR REPLACE FUNCTION member_has_nonzero_shares(member_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.expense_shares
    WHERE member_id = member_uuid
    AND share_amount_scaled != 0
  );
END;
$$;

-- =====================================================
-- 2. UPDATE GROUP_MEMBERS DELETE POLICY
-- =====================================================

-- Drop the old policy that only allows deleting disconnected members
DROP POLICY IF EXISTS "Members can delete disconnected members" ON group_members;

-- Create new policy allowing deletion of members with no non-zero shares
-- Any member of the group can delete another member if they have no non-zero shares
CREATE POLICY "Members can delete members with no non-zero shares"
  ON group_members
  FOR DELETE
  TO authenticated
  USING (
    public.user_is_group_member(auth.uid(), group_id)
    AND NOT public.member_has_nonzero_shares(id)
  );
