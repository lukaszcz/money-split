/*
  # Fix RLS Policies for Public Access

  ## Changes
  Since this app does not use authentication (local user profiles only),
  we need to update RLS policies to allow public access to all tables.

  ## Security Note
  This configuration is appropriate for a demo/local app without auth.
  For production with real users, implement proper authentication.
*/

DROP POLICY IF EXISTS "Users can read their own profile" ON users;
DROP POLICY IF EXISTS "Users can read all users" ON users;
DROP POLICY IF EXISTS "Users can create users" ON users;
DROP POLICY IF EXISTS "Users can read groups they are members of" ON groups;
DROP POLICY IF EXISTS "Users can create groups" ON groups;
DROP POLICY IF EXISTS "Users can read group members of their groups" ON group_members;
DROP POLICY IF EXISTS "Users can add members to their groups" ON group_members;
DROP POLICY IF EXISTS "Users can read expenses in their groups" ON expenses;
DROP POLICY IF EXISTS "Users can create expenses in their groups" ON expenses;
DROP POLICY IF EXISTS "Users can delete their own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can read expense shares from their groups" ON expense_shares;
DROP POLICY IF EXISTS "Users can create expense shares in their groups" ON expense_shares;
DROP POLICY IF EXISTS "Anyone can read exchange rates" ON exchange_rates;

CREATE POLICY "Allow public read on users"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on users"
  ON users FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on users"
  ON users FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public read on groups"
  ON groups FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on groups"
  ON groups FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on groups"
  ON groups FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public read on group_members"
  ON group_members FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on group_members"
  ON group_members FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public delete on group_members"
  ON group_members FOR DELETE
  USING (true);

CREATE POLICY "Allow public read on expenses"
  ON expenses FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on expenses"
  ON expenses FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on expenses"
  ON expenses FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete on expenses"
  ON expenses FOR DELETE
  USING (true);

CREATE POLICY "Allow public read on expense_shares"
  ON expense_shares FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on expense_shares"
  ON expense_shares FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public delete on expense_shares"
  ON expense_shares FOR DELETE
  USING (true);

CREATE POLICY "Allow public read on exchange_rates"
  ON exchange_rates FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on exchange_rates"
  ON exchange_rates FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on exchange_rates"
  ON exchange_rates FOR UPDATE
  USING (true)
  WITH CHECK (true);
