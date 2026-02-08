/*
  # Restrict SELECT on users table to own row only

  ## Summary
  Updates the RLS policy for SELECT operations on the users table to only allow
  authenticated users to read their own user record (where id = auth.uid()).

  ## Changes
  - Drops the existing "Authenticated users can read all users" policy
  - Creates a new policy that restricts SELECT to only the authenticated user's own row

  ## Security
  - Users can only SELECT their own user record (where (select auth.uid()) = id)
  - The getUserByEmail functionality is moved to the get-user-by-email edge function
    which uses service role access to fetch user data by email
  - This prevents arbitrary email enumeration by authenticated users

  ## Related
  - Edge function: supabase/functions/get-user-by-email/index.ts
*/

-- Drop the existing policy that allows reading all users
DROP POLICY IF EXISTS "Authenticated users can read all users" ON public.users;

-- Create a new policy that only allows reading own user record
CREATE POLICY "Users can read their own record"
  ON public.users
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);
