/*
  # Add payment type to expenses table

  1. Changes
    - Add `payment_type` column to `expenses` table
      - Values: 'expense' (default) or 'transfer'
      - Used to distinguish between regular expenses and direct transfers between members
  
  2. Notes
    - Existing records will default to 'expense'
    - Transfers have one payer and one recipient (single expense_share entry)
    - Regular expenses can have multiple participants
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'payment_type'
  ) THEN
    ALTER TABLE expenses 
    ADD COLUMN payment_type text DEFAULT 'expense' NOT NULL
    CHECK (payment_type IN ('expense', 'transfer'));
  END IF;
END $$;
