/*
  # Remove redundant user_id columns

  1. Changes
    - Drop redundant RLS policies that use `payer_user_id`
    - Drop `payer_user_id` column from `expenses` table (keeping only `payer_member_id`)
    - Drop `user_id` column from `expense_shares` table (keeping only `member_id`)
  
  2. Reasoning
    - The `payer_user_id` and `user_id` columns are redundant since we already have `payer_member_id` and `member_id`
    - All expense tracking should use member IDs to maintain consistency
    - The redundant policies are covered by the more general group membership policies
    - Simplifies the data model and reduces confusion
*/

-- Drop redundant policies that depend on payer_user_id
DROP POLICY IF EXISTS "Users can delete their own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update their own expenses" ON expenses;

-- Drop redundant columns
ALTER TABLE expenses DROP COLUMN IF EXISTS payer_user_id;
ALTER TABLE expense_shares DROP COLUMN IF EXISTS user_id;
