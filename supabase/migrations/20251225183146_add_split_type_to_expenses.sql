/*
  # Add split_type to expenses table

  1. Changes
    - Add `split_type` column to `expenses` table
      - Values: 'equal', 'percentage', or 'exact'
      - Defaults to 'equal' for existing records
      - Used to preserve the original split method used when creating the expense
  
  2. Notes
    - Existing records will default to 'equal'
    - This allows the UI to properly display percentages when editing percentage-based expenses
    - The split type is preserved independently of the calculated share amounts
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'split_type'
  ) THEN
    ALTER TABLE expenses 
    ADD COLUMN split_type text DEFAULT 'equal' NOT NULL
    CHECK (split_type IN ('equal', 'percentage', 'exact'));
  END IF;
END $$;
