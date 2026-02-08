-- Create recovery_passwords table for short-lived recovery passwords
-- This prevents the security issue of overwriting user passwords on recovery request

CREATE TABLE IF NOT EXISTS public.recovery_passwords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT one_recovery_password_per_user UNIQUE (user_id)
);

-- Index for efficient cleanup of expired passwords
CREATE INDEX IF NOT EXISTS idx_recovery_passwords_expires_at ON public.recovery_passwords(expires_at);

-- RLS policies for recovery_passwords
ALTER TABLE public.recovery_passwords ENABLE ROW LEVEL SECURITY;

-- No client access to recovery passwords table
-- All operations are performed by edge functions using service role
CREATE POLICY "Service role only" ON public.recovery_passwords
  FOR ALL
  USING (false);

-- Function to clean up expired recovery passwords
CREATE OR REPLACE FUNCTION cleanup_expired_recovery_passwords()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.recovery_passwords
  WHERE expires_at < now();
END;
$$;

COMMENT ON TABLE public.recovery_passwords IS 'Stores short-lived recovery passwords separate from user passwords to prevent account lockout attacks';
COMMENT ON COLUMN public.recovery_passwords.user_id IS 'Reference to auth.users - only one recovery password per user';
COMMENT ON COLUMN public.recovery_passwords.password_hash IS 'Bcrypt hash of the recovery password';
COMMENT ON COLUMN public.recovery_passwords.expires_at IS 'When this recovery password expires (typically 5 minutes from creation)';
COMMENT ON FUNCTION cleanup_expired_recovery_passwords IS 'Removes expired recovery passwords from the table';
