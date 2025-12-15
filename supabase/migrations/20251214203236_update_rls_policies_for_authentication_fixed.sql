/*
  # Update RLS Policies for Authentication (Fixed)

  ## Changes
  Updates RLS policies to use proper authentication with auth.uid()
  
  1. Users table:
    - Users can read all user profiles
    - Users can only update their own profile
    - New users are created during sign up
  
  2. Groups table:
    - Users can read groups they are members of
    - Users can create new groups
    - Users can update groups where they are members
  
  3. Group Members table:
    - Users can read members of groups they belong to
    - Users can add members to groups they belong to
    - Users can remove members from groups they belong to
  
  4. Expenses table:
    - Users can read expenses in groups they belong to
    - Users can create expenses in groups they belong to
    - Users can update/delete their own expenses
  
  5. Expense Shares table:
    - Users can read shares in groups they belong to
    - Shares are created when expenses are created
  
  6. Exchange Rates table:
    - Anyone can read exchange rates
    - System can update exchange rates
*/

DROP POLICY IF EXISTS "Allow public read on users" ON users;
DROP POLICY IF EXISTS "Allow public insert on users" ON users;
DROP POLICY IF EXISTS "Allow public update on users" ON users;
DROP POLICY IF EXISTS "Allow public read on groups" ON groups;
DROP POLICY IF EXISTS "Allow public insert on groups" ON groups;
DROP POLICY IF EXISTS "Allow public update on groups" ON groups;
DROP POLICY IF EXISTS "Allow public read on group_members" ON group_members;
DROP POLICY IF EXISTS "Allow public insert on group_members" ON group_members;
DROP POLICY IF EXISTS "Allow public delete on group_members" ON group_members;
DROP POLICY IF EXISTS "Allow public read on expenses" ON expenses;
DROP POLICY IF EXISTS "Allow public insert on expenses" ON expenses;
DROP POLICY IF EXISTS "Allow public update on expenses" ON expenses;
DROP POLICY IF EXISTS "Allow public delete on expenses" ON expenses;
DROP POLICY IF EXISTS "Allow public read on expense_shares" ON expense_shares;
DROP POLICY IF EXISTS "Allow public insert on expense_shares" ON expense_shares;
DROP POLICY IF EXISTS "Allow public delete on expense_shares" ON expense_shares;
DROP POLICY IF EXISTS "Allow public read on exchange_rates" ON exchange_rates;
DROP POLICY IF EXISTS "Allow public insert on exchange_rates" ON exchange_rates;
DROP POLICY IF EXISTS "Allow public update on exchange_rates" ON exchange_rates;

CREATE POLICY "Authenticated users can read all users"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert their own user"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can read groups they are members of"
  ON groups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create groups"
  ON groups FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Group members can update their group"
  ON groups FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can read members of their groups"
  ON group_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can add new members"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
    )
    OR
    user_id = auth.uid()
  );

CREATE POLICY "Group members can remove members"
  ON group_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can read expenses in their groups"
  ON expenses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = expenses.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can create expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = expenses.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING (payer_user_id = auth.uid())
  WITH CHECK (payer_user_id = auth.uid());

CREATE POLICY "Users can delete their own expenses"
  ON expenses FOR DELETE
  TO authenticated
  USING (payer_user_id = auth.uid());

CREATE POLICY "Users can read expense shares in their groups"
  ON expense_shares FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expenses
      JOIN group_members ON group_members.group_id = expenses.group_id
      WHERE expenses.id = expense_shares.expense_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can create expense shares"
  ON expense_shares FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expenses
      JOIN group_members ON group_members.group_id = expenses.group_id
      WHERE expenses.id = expense_shares.expense_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can delete expense shares"
  ON expense_shares FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expenses
      JOIN group_members ON group_members.group_id = expenses.group_id
      WHERE expenses.id = expense_shares.expense_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can read exchange rates"
  ON exchange_rates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert exchange rates"
  ON exchange_rates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update exchange rates"
  ON exchange_rates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
