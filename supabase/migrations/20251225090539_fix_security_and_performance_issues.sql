/*
  # Fix Security and Performance Issues

  ## Changes Made

  ### 1. Add Indexes for Foreign Keys
    - Add index on `expense_shares.member_id` for FK `expense_shares_member_id_fkey`
    - Add index on `expenses.payer_member_id` for FK `expenses_payer_member_id_fkey`
    - Add index on `group_members.connected_user_id` for FK `group_members_new_connected_user_id_fkey`
    - Add index on `groups.created_by` for FK `groups_created_by_fkey`
    
    These indexes improve query performance for JOIN operations and foreign key constraint checks.

  ### 2. Fix Function Search Path
    - Ensure `is_group_member` function has immutable search_path
    - Set `search_path` to empty string for security

  ## Performance Impact
    - Indexes will speed up queries that join or filter by these foreign keys
    - Minimal impact on INSERT/UPDATE operations
    - Improved constraint checking performance
*/

-- =====================================================
-- 1. ADD INDEXES FOR FOREIGN KEYS
-- =====================================================

-- Index for expense_shares.member_id
CREATE INDEX IF NOT EXISTS idx_expense_shares_member_id_fk
  ON expense_shares(member_id);

-- Index for expenses.payer_member_id
CREATE INDEX IF NOT EXISTS idx_expenses_payer_member_id_fk
  ON expenses(payer_member_id);

-- Index for group_members.connected_user_id
CREATE INDEX IF NOT EXISTS idx_group_members_connected_user_id_fk
  ON group_members(connected_user_id);

-- Index for groups.created_by
CREATE INDEX IF NOT EXISTS idx_groups_created_by_fk
  ON groups(created_by);

-- =====================================================
-- 2. FIX FUNCTION SEARCH PATH (ENSURE IMMUTABLE)
-- =====================================================

-- Recreate function with explicit immutable search_path
CREATE OR REPLACE FUNCTION is_group_member(group_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
BEGIN
  RETURN public.user_is_group_member(auth.uid(), group_uuid);
END;
$$;

-- Also ensure other helper functions have immutable search paths
CREATE OR REPLACE FUNCTION get_user_email_by_id(user_uuid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
BEGIN
  RETURN (SELECT email FROM public.users WHERE id = user_uuid);
END;
$$;

CREATE OR REPLACE FUNCTION user_is_group_member(user_uuid uuid, group_uuid uuid)
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
    AND connected_user_id = user_uuid
  );
END;
$$;
