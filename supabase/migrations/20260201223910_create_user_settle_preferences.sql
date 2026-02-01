/*
  # Create user settle preferences table

  1. New Tables
    - `user_settle_preferences`
      - `user_id` (uuid, primary key, references auth.users)
      - `simplify_debts` (boolean) - whether to default to simplified settlements
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `user_settle_preferences` table
    - Add policy for users to read their own preferences
    - Add policy for users to insert their own preferences
    - Add policy for users to update their own preferences
*/

CREATE TABLE IF NOT EXISTS user_settle_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  simplify_debts boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_settle_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own settle preferences"
  ON user_settle_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settle preferences"
  ON user_settle_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settle preferences"
  ON user_settle_preferences
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_settle_preferences_user_id
  ON user_settle_preferences(user_id);
