/*
  # Add Extensions Schema To Function Search Path

  ## Security Fix
    - Include `extensions` in immutable search_path for role-sensitive public functions
    - Ensure functions using extension-provided types (for example `citext`) resolve at runtime
*/

DO $$
DECLARE
  target_fn regprocedure;
BEGIN
  FOR target_fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc AS p
    JOIN pg_namespace AS n
      ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'event_trigger_fn',
        'cleanup_expired_recovery_passwords',
        'normalize_email_before_write',
        'is_group_member'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path = pg_catalog, public, extensions',
      target_fn
    );
  END LOOP;
END;
$$;
