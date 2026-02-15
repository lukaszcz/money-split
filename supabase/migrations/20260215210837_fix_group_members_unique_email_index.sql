-- Fix group_members email uniqueness constraint index definition
-- The previous idx_group_members_unique_email index incorrectly targeted
-- (group_id, connected_user_id), which did not enforce per-group email uniqueness.

DROP INDEX IF EXISTS public.idx_group_members_unique_email;

CREATE UNIQUE INDEX idx_group_members_unique_email
ON public.group_members (group_id, email)
WHERE email IS NOT NULL;

COMMENT ON INDEX public.idx_group_members_unique_email IS
'Ensures each email can only appear once per group. NULL values are allowed.';
