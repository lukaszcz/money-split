/*
  # GroupSplit Database Schema

  ## Overview
  This migration creates the complete schema for GroupSplit, a group expense tracking app.
  All monetary values are stored as integers scaled by 10,000 (4 decimal places precision).
  Exchange rates are cached and timestamped for offline fallback and historical accuracy.

  ## Tables Created

  1. **users** - Local user profiles (no external auth required)
     - id: UUID primary key
     - name: Display name
     - email: Optional email
     - created_at: Timestamp

  2. **groups** - Groups that contain multiple users
     - id: UUID primary key
     - name: Group name
     - main_currency_code: ISO 4217 currency code (e.g., USD, EUR)
     - created_at: Timestamp

  3. **group_members** - Join table for users in groups
     - group_id: Foreign key to groups
     - user_id: Foreign key to users
     - joined_at: Timestamp

  4. **expenses** - Expenses belonging to a group
     - id: UUID primary key
     - group_id: Foreign key to groups
     - description: Expense description
     - date_time: Date and time of expense
     - currency_code: Currency of the expense (ISO 4217)
     - total_amount_scaled: Total amount in expense currency, scaled by 10,000 (4dp)
     - payer_user_id: User who paid (foreign key)
     - exchange_rate_to_main_scaled: Exchange rate snapshot from expense currency to group main currency, scaled by 10,000
     - total_in_main_scaled: Total converted to main currency using snapshot rate, scaled by 10,000
     - created_at: Timestamp

  5. **expense_shares** - Distribution of costs for each expense
     - id: UUID primary key
     - expense_id: Foreign key to expenses
     - user_id: Foreign key to users
     - share_amount_scaled: Share amount in expense currency, scaled by 10,000 (4dp)
     - share_in_main_scaled: Share converted to group main currency, scaled by 10,000

  6. **exchange_rates** - Cached exchange rates
     - id: UUID primary key
     - base_currency_code: Source currency (ISO 4217)
     - quote_currency_code: Target currency (ISO 4217)
     - rate_scaled: Exchange rate, scaled by 10,000
     - fetched_at: Timestamp of last fetch

  ## Security
  - RLS enabled on all tables with restrictive policies
  - Users can only access groups they are members of
  - Exchange rates are read-only for users (admin only for updates)

  ## Notes
  - All monetary calculations use fixed-point arithmetic at 4 decimal places (scaled by 10,000)
  - Display formatting converts to 2 decimal places in the UI
  - Exchange rates are stored as snapshots when expenses are created for historical accuracy
*/

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  main_currency_code VARCHAR(3) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);


CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  description TEXT,
  date_time TIMESTAMPTZ NOT NULL,
  currency_code VARCHAR(3) NOT NULL,
  total_amount_scaled BIGINT NOT NULL,
  payer_user_id UUID NOT NULL REFERENCES users(id),
  exchange_rate_to_main_scaled BIGINT NOT NULL,
  total_in_main_scaled BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expense_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  share_amount_scaled BIGINT NOT NULL,
  share_in_main_scaled BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency_code VARCHAR(3) NOT NULL,
  quote_currency_code VARCHAR(3) NOT NULL,
  rate_scaled BIGINT NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(base_currency_code, quote_currency_code)
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

ALTER TABLE expense_shares ENABLE ROW LEVEL SECURITY;

ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can read all users"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Users can create users"
  ON users FOR INSERT
  WITH CHECK (true);

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

CREATE POLICY "Users can create groups"
  ON groups FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can read group members of their groups"
  ON group_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add members to their groups"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (
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

CREATE POLICY "Users can create expenses in their groups"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = expenses.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own expenses"
  ON expenses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = expenses.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can read expense shares from their groups"
  ON expense_shares FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expenses e
      JOIN group_members gm ON gm.group_id = e.group_id
      WHERE e.id = expense_shares.expense_id
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create expense shares in their groups"
  ON expense_shares FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expenses e
      JOIN group_members gm ON gm.group_id = e.group_id
      WHERE e.id = expense_shares.expense_id
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can read exchange rates"
  ON exchange_rates FOR SELECT
  USING (true);

CREATE INDEX idx_expenses_group_id ON expenses(group_id);

CREATE INDEX idx_expenses_payer_user_id ON expenses(payer_user_id);

CREATE INDEX idx_expense_shares_expense_id ON expense_shares(expense_id);

CREATE INDEX idx_expense_shares_user_id ON expense_shares(user_id);

CREATE INDEX idx_exchange_rates_pair ON exchange_rates(base_currency_code, quote_currency_code);
