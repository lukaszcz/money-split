/*
  # Allow group members to update group members

  1. Changes
    - Add UPDATE policy for group_members table
    - Allows any group member to update member details (name, email, connected_user_id)
    - Members can only update members within groups they belong to
  
  2. Security
    - Uses user_is_group_member() helper to verify membership
    - Also allows group creators to update members
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'group_members' 
    AND policyname = 'Group members can update member details'
  ) THEN
    CREATE POLICY "Group members can update member details"
      ON group_members
      FOR UPDATE
      TO authenticated
      USING (
        user_is_group_member(auth.uid(), group_id)
        OR EXISTS (
          SELECT 1 FROM groups g
          WHERE g.id = group_members.group_id
          AND g.created_by = auth.uid()
        )
      )
      WITH CHECK (
        user_is_group_member(auth.uid(), group_id)
        OR EXISTS (
          SELECT 1 FROM groups g
          WHERE g.id = group_members.group_id
          AND g.created_by = auth.uid()
        )
      );
  END IF;
END $$;
