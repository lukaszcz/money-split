/*
  # Remove Group Ownership and Implement Soft Delete Logic

  ## Changes Made

  ### 1. Remove Group Ownership
    - Drop policies that depend on `created_by` column
    - Drop `created_by` column from `groups` table
    - Remove creator-based policies

  ### 2. Implement Soft Delete (Disconnection)
    - Users can disconnect from groups by setting `connected_user_id` to NULL on their group_member
    - Group and group_member records remain until cleanup
    - Add policy allowing users to disconnect themselves

  ### 3. Add Helper Function
    - Create function to check if a group has any connected members
    - Used by cleanup process and policies

  ### 4. Update RLS Policies
    - Remove creator-based delete policies
    - Add policy for users to disconnect from groups
    - Groups can only be deleted when no members have connected users

  ## Important Notes
    - Physical deletion is handled by the cleanup edge function
    - Groups are automatically removed when last connected user disconnects
    - User account deletion triggers disconnection from all groups
*/

-- =====================================================
-- 1. DROP POLICIES THAT DEPEND ON created_by
-- =====================================================

-- Drop policies that reference created_by column
DROP POLICY IF EXISTS "Authenticated users can create groups" ON groups;
DROP POLICY IF EXISTS "Group owners can delete their groups" ON groups;
DROP POLICY IF EXISTS "Group creators can delete members" ON group_members;
DROP POLICY IF EXISTS "Group creator can delete group" ON groups;
DROP POLICY IF EXISTS "Users can delete own group" ON groups;

-- =====================================================
-- 2. REMOVE GROUP OWNERSHIP
-- =====================================================

-- Drop the created_by column and its index
DROP INDEX IF EXISTS idx_groups_created_by_fk;
ALTER TABLE groups DROP COLUMN IF EXISTS created_by;

-- =====================================================
-- 3. ADD HELPER FUNCTION
-- =====================================================

-- Function to check if a group has any connected members
CREATE OR REPLACE FUNCTION group_has_connected_members(group_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE group_id = group_uuid
    AND connected_user_id IS NOT NULL
  );
END;
$$;

-- =====================================================
-- 4. RECREATE GROUPS TABLE POLICIES
-- =====================================================

-- Users can view groups they are members of
DROP POLICY IF EXISTS "Group members can view group" ON groups;
CREATE POLICY "Group members can view group"
  ON groups
  FOR SELECT
  TO authenticated
  USING (
    public.user_is_group_member(auth.uid(), id)
  );

-- Users can create groups
CREATE POLICY "Authenticated users can create groups"
  ON groups
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can update groups they are members of
DROP POLICY IF EXISTS "Group members can update group" ON groups;
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

-- Groups can only be deleted when they have no connected members
DROP POLICY IF EXISTS "Groups can be deleted when no connected members" ON groups;
CREATE POLICY "Groups can be deleted when no connected members"
  ON groups
  FOR DELETE
  TO authenticated
  USING (
    NOT public.group_has_connected_members(id)
  );

-- =====================================================
-- 5. UPDATE GROUP_MEMBERS POLICIES
-- =====================================================

-- Drop old policies
DROP POLICY IF EXISTS "Group members can update members" ON group_members;
DROP POLICY IF EXISTS "Members can update group member details" ON group_members;

-- Allow users to update group members (including disconnecting themselves)
CREATE POLICY "Members can update group member details"
  ON group_members
  FOR UPDATE
  TO authenticated
  USING (
    public.user_is_group_member(auth.uid(), group_id)
  )
  WITH CHECK (
    public.user_is_group_member(auth.uid(), group_id)
  );

-- Allow users to delete group members (this will be used for cleanup)
DROP POLICY IF EXISTS "Members can delete disconnected members" ON group_members;
CREATE POLICY "Members can delete disconnected members"
  ON group_members
  FOR DELETE
  TO authenticated
  USING (
    connected_user_id IS NULL
  );

-- =====================================================
-- 6. ENSURE CASCADE DELETES ARE CONFIGURED
-- =====================================================

-- Verify that group deletion cascades properly
DO $$
BEGIN
  -- Check and update group_members foreign key
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'group_members_group_id_fkey'
    AND table_name = 'group_members'
  ) THEN
    ALTER TABLE group_members
      DROP CONSTRAINT group_members_group_id_fkey,
      ADD CONSTRAINT group_members_group_id_fkey
        FOREIGN KEY (group_id)
        REFERENCES groups(id)
        ON DELETE CASCADE;
  END IF;

  -- Check and update expenses foreign key
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'expenses_group_id_fkey'
    AND table_name = 'expenses'
  ) THEN
    ALTER TABLE expenses
      DROP CONSTRAINT expenses_group_id_fkey,
      ADD CONSTRAINT expenses_group_id_fkey
        FOREIGN KEY (group_id)
        REFERENCES groups(id)
        ON DELETE CASCADE;
  END IF;

  -- Check and update expense_shares foreign key
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'expense_shares_expense_id_fkey'
    AND table_name = 'expense_shares'
  ) THEN
    ALTER TABLE expense_shares
      DROP CONSTRAINT expense_shares_expense_id_fkey,
      ADD CONSTRAINT expense_shares_expense_id_fkey
        FOREIGN KEY (expense_id)
        REFERENCES expenses(id)
        ON DELETE CASCADE;
  END IF;

  -- Check and update user_currency_preferences foreign key
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_currency_preferences_user_id_fkey'
    AND table_name = 'user_currency_preferences'
  ) THEN
    ALTER TABLE user_currency_preferences
      DROP CONSTRAINT user_currency_preferences_user_id_fkey,
      ADD CONSTRAINT user_currency_preferences_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE;
  END IF;

  -- Check and update user_group_preferences foreign key
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_group_preferences_user_id_fkey'
    AND table_name = 'user_group_preferences'
  ) THEN
    ALTER TABLE user_group_preferences
      DROP CONSTRAINT user_group_preferences_user_id_fkey,
      ADD CONSTRAINT user_group_preferences_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE;
  END IF;

  -- Check and update user_group_preferences group_id foreign key
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_group_preferences_group_id_fkey'
    AND table_name = 'user_group_preferences'
  ) THEN
    ALTER TABLE user_group_preferences
      DROP CONSTRAINT user_group_preferences_group_id_fkey,
      ADD CONSTRAINT user_group_preferences_group_id_fkey
        FOREIGN KEY (group_id)
        REFERENCES groups(id)
        ON DELETE CASCADE;
  END IF;
END $$;
