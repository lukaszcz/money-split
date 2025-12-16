/*
  # Comprehensive fix for users table permissions
  
  ## Summary
  Ensures all necessary permissions and policies are properly configured for
  the users table to allow authenticated users to delete their own accounts.
  
  ## Changes
  - Revoke and regrant all permissions to ensure clean state
  - Recreate DELETE policy with explicit configuration
  - Add policy for anon role as fallback
  
  ## Security
  - Users can only delete their own account (auth.uid() = id)
  - All operations remain restricted by RLS
*/

-- Ensure clean permission state
REVOKE ALL ON TABLE public.users FROM authenticated;
REVOKE ALL ON TABLE public.users FROM anon;

-- Grant necessary permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO authenticated;

-- Grant read-only to anon (in case needed for signup flow)
GRANT SELECT ON TABLE public.users TO anon;

-- Drop and recreate all policies to ensure they're correct
DROP POLICY IF EXISTS "Users can delete their own account" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can read all users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can insert their own user" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

-- Recreate all policies
CREATE POLICY "Authenticated users can read all users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert their own user"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete their own account"
  ON public.users
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);
