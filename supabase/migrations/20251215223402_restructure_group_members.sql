/*
  # Restructure Group Members System

  ## Summary
  This migration transforms the group members system from user-centric to member-centric.
  Group members are now distinct entities that can optionally be connected to user accounts.

  ## Changes

  ### 1. New group_members Structure
  - `id` (uuid, primary key) - unique identifier for the member
  - `group_id` (uuid) - reference to the group
  - `name` (text) - display name for the member
  - `email` (text, optional) - email for invitations
  - `connected_user_id` (uuid, optional) - link to user account if registered
  - `created_at` (timestamptz) - when the member was added

  ### 2. Updated expenses Table
  - `payer_member_id` replaces `payer_user_id` - now references group_members

  ### 3. Updated expense_shares Table
  - `member_id` replaces `user_id` - now references group_members

  ### 4. Security
  - RLS enabled on all modified tables
  - Policies updated for the new structure
*/

-- Step 0: Drop all dependent policies first
DROP POLICY IF EXISTS "Users can read expense shares in their groups" ON expense_shares;
DROP POLICY IF EXISTS "Group members can create expense shares" ON expense_shares;
DROP POLICY IF EXISTS "Group members can delete expense shares" ON expense_shares;
DROP POLICY IF EXISTS "Allow group members to update groups" ON groups;
DROP POLICY IF EXISTS "Users can read groups they created or are members of" ON groups;
DROP POLICY IF EXISTS "Group members can view their groups" ON groups;
DROP POLICY IF EXISTS "Group members can read group members" ON group_members;
DROP POLICY IF EXISTS "Group members can add new members" ON group_members;
DROP POLICY IF EXISTS "Group members can update group members" ON group_members;
DROP POLICY IF EXISTS "Group creators can delete members" ON group_members;

-- Step 1: Create new group_members table with new structure
CREATE TABLE IF NOT EXISTS group_members_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  connected_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Step 2: Migrate existing group_members data
INSERT INTO group_members_new (id, group_id, name, email, connected_user_id, created_at)
SELECT 
  gen_random_uuid() as id,
  gm.group_id,
  COALESCE(u.name, 'Unknown') as name,
  u.email,
  gm.user_id as connected_user_id,
  gm.joined_at as created_at
FROM group_members gm
LEFT JOIN users u ON gm.user_id = u.id;

-- Step 3: Create mapping table for old user_id to new member_id (per group)
CREATE TEMP TABLE member_mapping AS
SELECT 
  gm_old.group_id,
  gm_old.user_id as old_user_id,
  gm_new.id as new_member_id
FROM group_members gm_old
JOIN group_members_new gm_new ON gm_new.group_id = gm_old.group_id 
  AND gm_new.connected_user_id = gm_old.user_id;

-- Step 4: Add new columns to expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payer_member_id uuid;

-- Step 5: Migrate expenses to use member_id
UPDATE expenses e
SET payer_member_id = mm.new_member_id
FROM member_mapping mm
WHERE e.group_id = mm.group_id AND e.payer_user_id = mm.old_user_id;

-- Step 6: Add new column to expense_shares
ALTER TABLE expense_shares ADD COLUMN IF NOT EXISTS member_id uuid;

-- Step 7: Migrate expense_shares to use member_id
UPDATE expense_shares
SET member_id = mm.new_member_id
FROM expenses e, member_mapping mm
WHERE expense_shares.expense_id = e.id
  AND e.group_id = mm.group_id 
  AND expense_shares.user_id = mm.old_user_id;

-- Step 8: Drop old foreign key constraints
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_payer_user_id_fkey;
ALTER TABLE expense_shares DROP CONSTRAINT IF EXISTS expense_shares_user_id_fkey;

-- Step 9: Drop old group_members table and rename new one
DROP TABLE group_members CASCADE;
ALTER TABLE group_members_new RENAME TO group_members;

-- Step 10: Add foreign key constraints for new columns
ALTER TABLE expenses 
ADD CONSTRAINT expenses_payer_member_id_fkey 
FOREIGN KEY (payer_member_id) REFERENCES group_members(id) ON DELETE SET NULL;

ALTER TABLE expense_shares 
ADD CONSTRAINT expense_shares_member_id_fkey 
FOREIGN KEY (member_id) REFERENCES group_members(id) ON DELETE CASCADE;

-- Step 11: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_connected_user_id ON group_members(connected_user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_email ON group_members(email);
CREATE INDEX IF NOT EXISTS idx_expenses_payer_member_id ON expenses(payer_member_id);
CREATE INDEX IF NOT EXISTS idx_expense_shares_member_id ON expense_shares(member_id);

-- Step 12: Enable RLS on group_members
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Step 13: Create RLS policies for group_members
CREATE POLICY "Users can view members of groups they belong to"
  ON group_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.connected_user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_members.group_id
      AND g.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert members to groups they created or belong to"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_members.group_id
      AND g.created_by = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.connected_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update members in groups they belong to"
  ON group_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.connected_user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_members.group_id
      AND g.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.connected_user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_members.group_id
      AND g.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete members from groups they created"
  ON group_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_members.group_id
      AND g.created_by = auth.uid()
    )
  );

-- Step 14: Update expenses RLS policies to use new structure
DROP POLICY IF EXISTS "Users can view expenses for groups they belong to" ON expenses;
DROP POLICY IF EXISTS "Users can insert expenses for groups they belong to" ON expenses;
DROP POLICY IF EXISTS "Users can update expenses they created" ON expenses;
DROP POLICY IF EXISTS "Users can delete expenses they created" ON expenses;
DROP POLICY IF EXISTS "Users can update expenses in their groups" ON expenses;
DROP POLICY IF EXISTS "Users can delete expenses in their groups" ON expenses;
DROP POLICY IF EXISTS "Group members can view expenses" ON expenses;
DROP POLICY IF EXISTS "Group members can create expenses" ON expenses;
DROP POLICY IF EXISTS "Group members can update expenses" ON expenses;
DROP POLICY IF EXISTS "Group members can delete expenses" ON expenses;

CREATE POLICY "Users can view expenses for groups they belong to"
  ON expenses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = expenses.group_id
      AND gm.connected_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert expenses for groups they belong to"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = expenses.group_id
      AND gm.connected_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update expenses in their groups"
  ON expenses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = expenses.group_id
      AND gm.connected_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = expenses.group_id
      AND gm.connected_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete expenses in their groups"
  ON expenses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = expenses.group_id
      AND gm.connected_user_id = auth.uid()
    )
  );

-- Step 15: Update expense_shares RLS policies
DROP POLICY IF EXISTS "Users can view expense shares for groups they belong to" ON expense_shares;
DROP POLICY IF EXISTS "Users can insert expense shares for groups they belong to" ON expense_shares;
DROP POLICY IF EXISTS "Users can update expense shares in their groups" ON expense_shares;
DROP POLICY IF EXISTS "Users can delete expense shares in their groups" ON expense_shares;

CREATE POLICY "Users can view expense shares for groups they belong to"
  ON expense_shares FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expenses e
      JOIN group_members gm ON gm.group_id = e.group_id
      WHERE e.id = expense_shares.expense_id
      AND gm.connected_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert expense shares for groups they belong to"
  ON expense_shares FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expenses e
      JOIN group_members gm ON gm.group_id = e.group_id
      WHERE e.id = expense_shares.expense_id
      AND gm.connected_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update expense shares in their groups"
  ON expense_shares FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expenses e
      JOIN group_members gm ON gm.group_id = e.group_id
      WHERE e.id = expense_shares.expense_id
      AND gm.connected_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expenses e
      JOIN group_members gm ON gm.group_id = e.group_id
      WHERE e.id = expense_shares.expense_id
      AND gm.connected_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete expense shares in their groups"
  ON expense_shares FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expenses e
      JOIN group_members gm ON gm.group_id = e.group_id
      WHERE e.id = expense_shares.expense_id
      AND gm.connected_user_id = auth.uid()
    )
  );

-- Step 16: Update groups RLS to use new member structure
DROP POLICY IF EXISTS "Users can view groups they belong to" ON groups;
DROP POLICY IF EXISTS "Authenticated users can create groups" ON groups;
DROP POLICY IF EXISTS "Users can view groups they created or belong to" ON groups;

CREATE POLICY "Users can view groups they created or belong to"
  ON groups FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = groups.id
      AND gm.connected_user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create groups"
  ON groups FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());