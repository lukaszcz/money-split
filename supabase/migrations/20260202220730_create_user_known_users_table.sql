/*
  # Add user_known_users table

  ## Purpose
  Track users that each user has interacted with (shared a group with).
  This enables autocomplete suggestions when adding group members.

  ## Table: user_known_users
  - user_id: The user who knows other users
  - known_user_id: A user they have shared a group with
  - first_shared_at: When they first shared a group
  - last_shared_at: When they most recently shared a group

  ## Security
  - Users can only read/write their own known users list
  - RLS policies enforce user-level access control
*/

-- Create the user_known_users table
CREATE TABLE IF NOT EXISTS user_known_users (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  known_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_shared_at TIMESTAMPTZ DEFAULT now(),
  last_shared_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, known_user_id),
  -- Prevent users from being in their own known users list
  CHECK (user_id != known_user_id)
);

-- Enable RLS
ALTER TABLE user_known_users ENABLE ROW LEVEL SECURITY;

-- Users can read their own known users
CREATE POLICY "Users can read their own known users"
  ON user_known_users FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own known users
CREATE POLICY "Users can insert their own known users"
  ON user_known_users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own known users
CREATE POLICY "Users can update their own known users"
  ON user_known_users FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own known users
CREATE POLICY "Users can delete their own known users"
  ON user_known_users FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for efficient lookups
CREATE INDEX idx_user_known_users_user_id ON user_known_users(user_id);
CREATE INDEX idx_user_known_users_known_user_id ON user_known_users(known_user_id);
