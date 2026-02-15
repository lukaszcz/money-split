-- Convert email columns to citext and normalize stored values.
-- This enforces case-insensitive matching and per-group uniqueness for group_members.email.

CREATE EXTENSION IF NOT EXISTS citext;

DROP INDEX IF EXISTS public.idx_group_members_unique_email;

WITH normalized_emails AS (
  SELECT
    id,
    NULLIF(lower(btrim(email)), '') AS normalized_email,
    ROW_NUMBER() OVER (
      PARTITION BY group_id, NULLIF(lower(btrim(email)), '')
      ORDER BY (connected_user_id IS NOT NULL) DESC, created_at ASC, id ASC
    ) AS email_rank
  FROM public.group_members
  WHERE email IS NOT NULL
)
UPDATE public.group_members AS gm
SET email = CASE
  WHEN ne.normalized_email IS NULL THEN NULL
  WHEN ne.email_rank = 1 THEN ne.normalized_email
  ELSE NULL
END
FROM normalized_emails AS ne
WHERE gm.id = ne.id;

UPDATE public.users
SET email = NULLIF(lower(btrim(email)), '')
WHERE email IS NOT NULL;

ALTER TABLE public.users
ALTER COLUMN email TYPE citext
USING (
  CASE
    WHEN email IS NULL THEN NULL
    ELSE email::citext
  END
);

ALTER TABLE public.group_members
ALTER COLUMN email TYPE citext
USING (
  CASE
    WHEN email IS NULL THEN NULL
    ELSE email::citext
  END
);

CREATE UNIQUE INDEX idx_group_members_unique_email
ON public.group_members (group_id, email)
WHERE email IS NOT NULL;

COMMENT ON INDEX public.idx_group_members_unique_email IS
'Ensures each normalized email can only appear once per group. NULL values are allowed.';

CREATE OR REPLACE FUNCTION public.normalize_email_before_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.email := NULLIF(lower(btrim(NEW.email::text)), '')::citext;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_users_email ON public.users;
CREATE TRIGGER normalize_users_email
BEFORE INSERT OR UPDATE OF email ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.normalize_email_before_write();

DROP TRIGGER IF EXISTS normalize_group_members_email ON public.group_members;
CREATE TRIGGER normalize_group_members_email
BEFORE INSERT OR UPDATE OF email ON public.group_members
FOR EACH ROW
EXECUTE FUNCTION public.normalize_email_before_write();
