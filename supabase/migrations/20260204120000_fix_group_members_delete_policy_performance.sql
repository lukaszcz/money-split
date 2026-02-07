/*
  # Fix RLS Policy Performance Across All Tables

  ## Problem
  Multiple RLS policies use auth.uid() directly, which gets re-evaluated for
  each row. This produces suboptimal query performance at scale.

  ## Solution
  Replace auth.uid() with (select auth.uid()) in all affected policies to
  ensure the function is evaluated once per query rather than once per row.

  ## Affected Tables and Policies
  - groups: "Group members can view group", "Group members can update group"
  - group_members: "Users can add themselves or members can add others",
                   "Members can update group member details",
                   "Members can delete members with no expenses"
  - user_currency_preferences: SELECT, INSERT, UPDATE policies
  - user_group_preferences: SELECT, INSERT, UPDATE policies
  - user_settle_preferences: SELECT, INSERT, UPDATE policies
*/

-- =====================================================
-- 1. GROUPS TABLE POLICIES
-- =====================================================

-- Fix SELECT policy
DROP POLICY IF EXISTS "Group members can view group" ON groups;
CREATE POLICY "Group members can view group"
  ON groups
  FOR SELECT
  TO authenticated
  USING (
    public.user_is_group_member((select auth.uid()), id)
    OR
    NOT public.group_has_connected_members(id)
  );

-- Fix UPDATE policy
DROP POLICY IF EXISTS "Group members can update group" ON groups;
CREATE POLICY "Group members can update group"
  ON groups
  FOR UPDATE
  TO authenticated
  USING (
    public.user_is_group_member((select auth.uid()), id)
  )
  WITH CHECK (
    public.user_is_group_member((select auth.uid()), id)
  );

-- =====================================================
-- 2. GROUP_MEMBERS TABLE POLICIES
-- =====================================================

-- Fix INSERT policy
DROP POLICY IF EXISTS "Users can add themselves or members can add others" ON group_members;
CREATE POLICY "Users can add themselves or members can add others"
  ON group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    connected_user_id = (select auth.uid())
    OR
    user_is_group_member((select auth.uid()), group_id)
  );

-- Fix UPDATE policy
DROP POLICY IF EXISTS "Members can update group member details" ON group_members;
CREATE POLICY "Members can update group member details"
  ON group_members
  FOR UPDATE
  TO authenticated
  USING (
    public.user_is_group_member((select auth.uid()), group_id)
  )
  WITH CHECK (
    public.user_is_group_member((select auth.uid()), group_id)
  );

-- Fix DELETE policy
DROP POLICY IF EXISTS "Members can delete members with no expenses" ON group_members;
CREATE POLICY "Members can delete members with no expenses"
  ON group_members
  FOR DELETE
  TO authenticated
  USING (
    public.user_is_group_member((select auth.uid()), group_id)
    AND NOT public.member_is_involved_in_expenses(id)
  );

-- =====================================================
-- 3. USER_CURRENCY_PREFERENCES TABLE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can read own currency preferences" ON user_currency_preferences;
CREATE POLICY "Users can read own currency preferences"
  ON user_currency_preferences
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own currency preferences" ON user_currency_preferences;
CREATE POLICY "Users can insert own currency preferences"
  ON user_currency_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own currency preferences" ON user_currency_preferences;
CREATE POLICY "Users can update own currency preferences"
  ON user_currency_preferences
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- =====================================================
-- 4. USER_GROUP_PREFERENCES TABLE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can read own group preferences" ON user_group_preferences;
CREATE POLICY "Users can read own group preferences"
  ON user_group_preferences
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own group preferences" ON user_group_preferences;
CREATE POLICY "Users can insert own group preferences"
  ON user_group_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own group preferences" ON user_group_preferences;
CREATE POLICY "Users can update own group preferences"
  ON user_group_preferences
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- =====================================================
-- 5. USER_SETTLE_PREFERENCES TABLE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can read own settle preferences" ON user_settle_preferences;
CREATE POLICY "Users can read own settle preferences"
  ON user_settle_preferences
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own settle preferences" ON user_settle_preferences;
CREATE POLICY "Users can insert own settle preferences"
  ON user_settle_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own settle preferences" ON user_settle_preferences;
CREATE POLICY "Users can update own settle preferences"
  ON user_settle_preferences
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
