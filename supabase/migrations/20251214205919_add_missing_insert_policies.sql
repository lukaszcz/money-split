/*
  # Add Missing INSERT Policies

  1. Problem
    - The groups INSERT policy may have been dropped during previous migration
    - Users cannot create new groups
  
  2. Solution
    - Recreate INSERT policy for groups table allowing authenticated users to create groups
    - Ensure the policy uses proper WITH CHECK clause
*/

-- Drop existing INSERT policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "Authenticated users can create groups" ON groups;

-- Recreate INSERT policy for groups
CREATE POLICY "Authenticated users can create groups"
  ON groups FOR INSERT
  TO authenticated
  WITH CHECK (true);
