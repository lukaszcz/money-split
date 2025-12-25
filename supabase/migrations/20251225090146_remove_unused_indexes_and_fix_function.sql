/*
  # Remove Unused Indexes and Fix Function Security

  ## Changes Made

  ### 1. Drop Unused Indexes
    - Remove `idx_group_members_connected_user_id` - not being used by queries
    - Remove `idx_group_members_email` - not being used by queries
    - Remove `idx_expenses_payer_member_id` - not being used by queries
    - Remove `idx_expense_shares_member_id` - not being used by queries
    - Remove `idx_groups_created_by` - not being used by queries
    
    Note: These indexes were created but query patterns don't utilize them.
    If performance issues arise, specific indexes can be recreated based on actual query needs.

  ### 2. Fix Function Search Path
    - Update all functions to use immutable search_path (empty string)
    - Requires dropping and recreating policies that depend on these functions
*/

-- =====================================================
-- 1. DROP UNUSED INDEXES
-- =====================================================

DROP INDEX IF EXISTS idx_group_members_connected_user_id;
DROP INDEX IF EXISTS idx_group_members_email;
DROP INDEX IF EXISTS idx_expenses_payer_member_id;
DROP INDEX IF EXISTS idx_expense_shares_member_id;
DROP INDEX IF EXISTS idx_groups_created_by;

-- =====================================================
-- 2. DROP POLICIES THAT DEPEND ON FUNCTIONS
-- =====================================================

DROP POLICY IF EXISTS "Users can view group members" ON group_members;
DROP POLICY IF EXISTS "Group members can add new members" ON group_members;
DROP POLICY IF EXISTS "Group members can update members" ON group_members;
DROP POLICY IF EXISTS "Group creators can delete members" ON group_members;
DROP POLICY IF EXISTS "Users can view their groups" ON groups;
DROP POLICY IF EXISTS "Users can read expenses in their groups" ON expenses;
DROP POLICY IF EXISTS "Users can insert expenses for groups they belong to" ON expenses;
DROP POLICY IF EXISTS "Users can update expenses in their groups" ON expenses;
DROP POLICY IF EXISTS "Users can delete expenses in their groups" ON expenses;
DROP POLICY IF EXISTS "Users can view expense shares for groups they belong to" ON expense_shares;
DROP POLICY IF EXISTS "Users can insert expense shares for groups they belong to" ON expense_shares;
DROP POLICY IF EXISTS "Users can update expense shares in their groups" ON expense_shares;
DROP POLICY IF EXISTS "Users can delete expense shares in their groups" ON expense_shares;

-- =====================================================
-- 3. DROP AND RECREATE FUNCTIONS WITH IMMUTABLE SEARCH PATH
-- =====================================================

DROP FUNCTION IF EXISTS get_user_email_by_id(uuid) CASCADE;
DROP FUNCTION IF EXISTS user_is_group_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS is_group_member(uuid) CASCADE;

CREATE FUNCTION get_user_email_by_id(user_uuid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN (SELECT email FROM public.users WHERE id = user_uuid);
END;
$$;

CREATE FUNCTION user_is_group_member(user_uuid uuid, group_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE group_id = group_uuid
    AND connected_user_id = user_uuid
  );
END;
$$;

CREATE FUNCTION is_group_member(group_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN public.user_is_group_member(auth.uid(), group_uuid);
END;
$$;

-- =====================================================
-- 4. RECREATE POLICIES
-- =====================================================

-- GROUP_MEMBERS POLICIES
CREATE POLICY "Users can view group members"
  ON group_members FOR SELECT
  TO authenticated
  USING (
    public.user_is_group_member((select auth.uid()), group_id)
    OR email = public.get_user_email_by_id((select auth.uid()))
  );

CREATE POLICY "Group members can add new members"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (public.user_is_group_member((select auth.uid()), group_id));

CREATE POLICY "Group members can update members"
  ON group_members FOR UPDATE
  TO authenticated
  USING (public.user_is_group_member((select auth.uid()), group_id))
  WITH CHECK (public.user_is_group_member((select auth.uid()), group_id));

CREATE POLICY "Group creators can delete members"
  ON group_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = group_members.group_id
      AND groups.created_by = (select auth.uid())
    )
  );

-- GROUPS POLICIES
CREATE POLICY "Users can view their groups"
  ON groups FOR SELECT
  TO authenticated
  USING (public.user_is_group_member((select auth.uid()), id));

-- EXPENSES POLICIES
CREATE POLICY "Users can read expenses in their groups"
  ON expenses FOR SELECT
  TO authenticated
  USING (public.user_is_group_member((select auth.uid()), group_id));

CREATE POLICY "Users can insert expenses for groups they belong to"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (public.user_is_group_member((select auth.uid()), group_id));

CREATE POLICY "Users can update expenses in their groups"
  ON expenses FOR UPDATE
  TO authenticated
  USING (public.user_is_group_member((select auth.uid()), group_id))
  WITH CHECK (public.user_is_group_member((select auth.uid()), group_id));

CREATE POLICY "Users can delete expenses in their groups"
  ON expenses FOR DELETE
  TO authenticated
  USING (public.user_is_group_member((select auth.uid()), group_id));

-- EXPENSE_SHARES POLICIES
CREATE POLICY "Users can view expense shares for groups they belong to"
  ON expense_shares FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses
      WHERE expenses.id = expense_shares.expense_id
      AND public.user_is_group_member((select auth.uid()), expenses.group_id)
    )
  );

CREATE POLICY "Users can insert expense shares for groups they belong to"
  ON expense_shares FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses
      WHERE expenses.id = expense_shares.expense_id
      AND public.user_is_group_member((select auth.uid()), expenses.group_id)
    )
  );

CREATE POLICY "Users can update expense shares in their groups"
  ON expense_shares FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses
      WHERE expenses.id = expense_shares.expense_id
      AND public.user_is_group_member((select auth.uid()), expenses.group_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses
      WHERE expenses.id = expense_shares.expense_id
      AND public.user_is_group_member((select auth.uid()), expenses.group_id)
    )
  );

CREATE POLICY "Users can delete expense shares in their groups"
  ON expense_shares FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses
      WHERE expenses.id = expense_shares.expense_id
      AND public.user_is_group_member((select auth.uid()), expenses.group_id)
    )
  );
