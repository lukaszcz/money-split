/*
  # Fix Security and Performance Issues

  ## Changes Made

  ### 1. Add Missing Index
    - Add index on `groups.created_by` foreign key for better query performance

  ### 2. Fix RLS Performance Issues
    - Replace `auth.uid()` with `(select auth.uid())` in all RLS policies
    - This prevents re-evaluation of auth functions for each row, improving performance at scale

  ### 3. Remove Duplicate Policies
    - Remove redundant policies that overlap with existing ones:
      - `expenses`: Keep "Users can read expenses in their groups", remove "Users can view expenses for groups they belong to"
      - `group_members`: Consolidate SELECT and UPDATE policies
      - `groups`: Remove duplicate INSERT policy

  ### 4. Fix Function Search Paths
    - Add `SET search_path = public, auth` to functions for security

  ### 5. Recreate Optimized Policies
    - All policies now use `(select auth.uid())` for better performance
*/

-- =====================================================
-- 1. ADD MISSING INDEX
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_groups_created_by ON groups(created_by);

-- =====================================================
-- 2. DROP ALL EXISTING POLICIES TO RECREATE THEM
-- =====================================================

-- Drop users policies
DROP POLICY IF EXISTS "Authenticated users can insert their own user" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can delete their own account" ON users;

-- Drop groups policies
DROP POLICY IF EXISTS "Users can view their groups" ON groups;
DROP POLICY IF EXISTS "Authenticated users can create groups" ON groups;
DROP POLICY IF EXISTS "Allow authenticated users to insert groups" ON groups;
DROP POLICY IF EXISTS "Group owners can delete their groups" ON groups;

-- Drop group_members policies
DROP POLICY IF EXISTS "Users can view members of groups they belong to" ON group_members;
DROP POLICY IF EXISTS "Users can view members matching their email" ON group_members;
DROP POLICY IF EXISTS "Group members can add new members" ON group_members;
DROP POLICY IF EXISTS "Users can connect to members with their email" ON group_members;
DROP POLICY IF EXISTS "Users can disconnect themselves from members" ON group_members;
DROP POLICY IF EXISTS "Group members can update member details" ON group_members;
DROP POLICY IF EXISTS "Group creators can delete members" ON group_members;

-- Drop expenses policies
DROP POLICY IF EXISTS "Users can read expenses in their groups" ON expenses;
DROP POLICY IF EXISTS "Users can view expenses for groups they belong to" ON expenses;
DROP POLICY IF EXISTS "Users can insert expenses for groups they belong to" ON expenses;
DROP POLICY IF EXISTS "Users can update expenses in their groups" ON expenses;
DROP POLICY IF EXISTS "Users can delete expenses in their groups" ON expenses;

-- Drop expense_shares policies
DROP POLICY IF EXISTS "Users can view expense shares for groups they belong to" ON expense_shares;
DROP POLICY IF EXISTS "Users can insert expense shares for groups they belong to" ON expense_shares;
DROP POLICY IF EXISTS "Users can update expense shares in their groups" ON expense_shares;
DROP POLICY IF EXISTS "Users can delete expense shares in their groups" ON expense_shares;

-- Drop user_currency_preferences policies
DROP POLICY IF EXISTS "Users can read own currency preferences" ON user_currency_preferences;
DROP POLICY IF EXISTS "Users can insert own currency preferences" ON user_currency_preferences;
DROP POLICY IF EXISTS "Users can update own currency preferences" ON user_currency_preferences;

-- Drop user_group_preferences policies
DROP POLICY IF EXISTS "Users can read own group preferences" ON user_group_preferences;
DROP POLICY IF EXISTS "Users can insert own group preferences" ON user_group_preferences;
DROP POLICY IF EXISTS "Users can update own group preferences" ON user_group_preferences;

-- =====================================================
-- 3. FIX FUNCTION SEARCH PATHS (DROP AND RECREATE)
-- =====================================================

DROP FUNCTION IF EXISTS get_user_email_by_id(uuid);
DROP FUNCTION IF EXISTS user_is_group_member(uuid, uuid);
DROP FUNCTION IF EXISTS is_group_member(uuid);

CREATE FUNCTION get_user_email_by_id(user_uuid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN (SELECT email FROM public.users WHERE id = user_uuid);
END;
$$;

CREATE FUNCTION user_is_group_member(user_uuid uuid, group_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
SET search_path = public, auth
AS $$
BEGIN
  RETURN user_is_group_member(auth.uid(), group_uuid);
END;
$$;

-- =====================================================
-- 4. RECREATE OPTIMIZED POLICIES
-- =====================================================

-- USERS POLICIES
CREATE POLICY "Authenticated users can insert their own user"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users can delete their own account"
  ON users FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = id);

-- GROUPS POLICIES
CREATE POLICY "Users can view their groups"
  ON groups FOR SELECT
  TO authenticated
  USING (user_is_group_member((select auth.uid()), id));

CREATE POLICY "Authenticated users can create groups"
  ON groups FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = created_by);

CREATE POLICY "Group owners can delete their groups"
  ON groups FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = created_by);

-- GROUP_MEMBERS POLICIES (consolidated to remove duplicates)
CREATE POLICY "Users can view group members"
  ON group_members FOR SELECT
  TO authenticated
  USING (
    user_is_group_member((select auth.uid()), group_id)
    OR email = get_user_email_by_id((select auth.uid()))
  );

CREATE POLICY "Group members can add new members"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (user_is_group_member((select auth.uid()), group_id));

CREATE POLICY "Group members can update members"
  ON group_members FOR UPDATE
  TO authenticated
  USING (user_is_group_member((select auth.uid()), group_id))
  WITH CHECK (user_is_group_member((select auth.uid()), group_id));

CREATE POLICY "Group creators can delete members"
  ON group_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = group_members.group_id
      AND groups.created_by = (select auth.uid())
    )
  );

-- EXPENSES POLICIES (removed duplicate SELECT policy)
CREATE POLICY "Users can read expenses in their groups"
  ON expenses FOR SELECT
  TO authenticated
  USING (user_is_group_member((select auth.uid()), group_id));

CREATE POLICY "Users can insert expenses for groups they belong to"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (user_is_group_member((select auth.uid()), group_id));

CREATE POLICY "Users can update expenses in their groups"
  ON expenses FOR UPDATE
  TO authenticated
  USING (user_is_group_member((select auth.uid()), group_id))
  WITH CHECK (user_is_group_member((select auth.uid()), group_id));

CREATE POLICY "Users can delete expenses in their groups"
  ON expenses FOR DELETE
  TO authenticated
  USING (user_is_group_member((select auth.uid()), group_id));

-- EXPENSE_SHARES POLICIES
CREATE POLICY "Users can view expense shares for groups they belong to"
  ON expense_shares FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expenses
      WHERE expenses.id = expense_shares.expense_id
      AND user_is_group_member((select auth.uid()), expenses.group_id)
    )
  );

CREATE POLICY "Users can insert expense shares for groups they belong to"
  ON expense_shares FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expenses
      WHERE expenses.id = expense_shares.expense_id
      AND user_is_group_member((select auth.uid()), expenses.group_id)
    )
  );

CREATE POLICY "Users can update expense shares in their groups"
  ON expense_shares FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expenses
      WHERE expenses.id = expense_shares.expense_id
      AND user_is_group_member((select auth.uid()), expenses.group_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expenses
      WHERE expenses.id = expense_shares.expense_id
      AND user_is_group_member((select auth.uid()), expenses.group_id)
    )
  );

CREATE POLICY "Users can delete expense shares in their groups"
  ON expense_shares FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expenses
      WHERE expenses.id = expense_shares.expense_id
      AND user_is_group_member((select auth.uid()), expenses.group_id)
    )
  );

-- USER_CURRENCY_PREFERENCES POLICIES
CREATE POLICY "Users can read own currency preferences"
  ON user_currency_preferences FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own currency preferences"
  ON user_currency_preferences FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own currency preferences"
  ON user_currency_preferences FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- USER_GROUP_PREFERENCES POLICIES
CREATE POLICY "Users can read own group preferences"
  ON user_group_preferences FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own group preferences"
  ON user_group_preferences FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own group preferences"
  ON user_group_preferences FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
