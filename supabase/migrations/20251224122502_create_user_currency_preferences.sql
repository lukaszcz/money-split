/*
  # Create user currency preferences table

  1. New Tables
    - `user_currency_preferences`
      - `id` (uuid, primary key) - Unique identifier for the preference record
      - `user_id` (uuid, foreign key) - References auth.users.id
      - `currency_order` (jsonb) - Ordered array of currency codes based on usage
      - `created_at` (timestamptz) - When the preference was first created
      - `updated_at` (timestamptz) - When the preference was last updated

  2. Security
    - Enable RLS on `user_currency_preferences` table
    - Add policy for users to read their own currency preferences
    - Add policy for users to insert their own currency preferences
    - Add policy for users to update their own currency preferences

  3. Important Notes
    - Each user can have only one currency preferences record
    - The currency_order field stores an array of currency codes in order of recent usage
    - The most recently used currency appears first in the array
    - This enables cross-device synchronization of currency preferences
*/

CREATE TABLE IF NOT EXISTS user_currency_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency_order jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_currency_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own currency preferences"
  ON user_currency_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own currency preferences"
  ON user_currency_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own currency preferences"
  ON user_currency_preferences
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_currency_preferences_user_id 
  ON user_currency_preferences(user_id);