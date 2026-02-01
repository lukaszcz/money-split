/*
  # Update Group Member Delete Policy for Expense Payers

  ## Changes Made

  ### 1. Add Helper Function
    - Create function to check if a member is involved in any expenses
    - Involvement includes non-zero shares or being the payer

  ### 2. Update RLS Policy for group_members DELETE
    - Members can be deleted only if they have no non-zero shares
      and are not the payer for any expense
    - Any group member can delete another member meeting this criteria

  ## Security
    - Prevents deleting members referenced by expenses.payer_member_id
    - Maintains data integrity for expense tracking
*/

-- =====================================================
-- 1. CREATE HELPER FUNCTION
-- =====================================================

-- Function to check if a member is involved in any expenses
CREATE OR REPLACE FUNCTION member_is_involved_in_expenses(member_uuid uuid)
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
  )
  OR EXISTS (
    SELECT 1
    FROM public.expenses
    WHERE payer_member_id = member_uuid
  );
END;
$$;

-- =====================================================
-- 2. UPDATE GROUP_MEMBERS DELETE POLICY
-- =====================================================

-- Replace policy to enforce new involvement criteria
DROP POLICY IF EXISTS "Members can delete members with no non-zero shares" ON group_members;

CREATE POLICY "Members can delete members with no expenses"
  ON group_members
  FOR DELETE
  TO authenticated
  USING (
    public.user_is_group_member(auth.uid(), group_id)
    AND NOT public.member_is_involved_in_expenses(id)
  );
