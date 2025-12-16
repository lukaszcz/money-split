/*
  # Grant DELETE permission on users table
  
  ## Summary
  Explicitly grants DELETE permission to the authenticated role on the users table
  to ensure users can delete their own accounts.
  
  ## Changes
  - Grant DELETE permission to authenticated role on users table
  - Ensure all necessary permissions are in place
  
  ## Security
  - DELETE is still restricted by RLS policy (users can only delete their own account)
  - This just ensures the role has the base permission to attempt deletion
*/

-- Ensure authenticated role has all necessary permissions
GRANT DELETE ON TABLE public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO authenticated;
