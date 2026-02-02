-- Ensure updates cannot reassign ownership to a different user
ALTER POLICY "Users can update their own known users"
  ON user_known_users
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
