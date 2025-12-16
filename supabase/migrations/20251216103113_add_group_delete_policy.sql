/*
  # Add DELETE policy for groups
  
  1. Changes
    - Add policy to allow group owners to delete their groups
  
  2. Security
    - Only the user who created the group (created_by = auth.uid()) can delete it
    - This allows proper cleanup of groups and their related data
*/

CREATE POLICY "Group owners can delete their groups"
  ON groups
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());
