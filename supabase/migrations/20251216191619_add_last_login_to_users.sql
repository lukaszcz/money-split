/*
  # Add last_login column to users table

  1. New Columns
    - `last_login` (timestamp with time zone, nullable)
      - Tracks when a user last logged in
      - Updated to current timestamp on every sign-in

  2. Changes
    - Added `last_login` column to the `users` table
    - Column is nullable to handle new users who haven't logged in yet
    - Default value is null until first login

  3. Important Notes
    - This column will be updated by the application when users authenticate
    - Useful for tracking user engagement and last activity
*/

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login timestamptz;