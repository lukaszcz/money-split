-- Use select auth.uid() in all user_known_users RLS policies
ALTER POLICY "Users can read their own known users"
  ON user_known_users
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can insert their own known users"
  ON user_known_users
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can update their own known users"
  ON user_known_users
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can delete their own known users"
  ON user_known_users
  USING ((select auth.uid()) = user_id);
