/*
  # Create User Group Preferences Table

  1. New Tables
    - `user_group_preferences`
      - `user_id` (uuid, primary key, references auth.users)
      - `group_order` (text array) - Ordered list of group IDs
      - `updated_at` (timestamptz) - Last update timestamp
  
  2. Security
    - Enable RLS on `user_group_preferences` table
    - Add policy for users to read their own preferences
    - Add policy for users to insert their own preferences
    - Add policy for users to update their own preferences
  
  3. Notes
    - Each user can only have one preferences record
    - Group order is stored as an array of group IDs
    - Most recently visited groups appear first in the array
*/

CREATE TABLE IF NOT EXISTS user_group_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  group_order text[] DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_group_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own group preferences"
  ON user_group_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own group preferences"
  ON user_group_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own group preferences"
  ON user_group_preferences
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_group_preferences_user_id ON user_group_preferences(user_id);
