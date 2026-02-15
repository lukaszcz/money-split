-- Add UNIQUE constraint to connected_user_id column in group_members table
-- This prevents the same user from being added to the same group multiple times
-- NULL values are allowed (for unconnected/invited members), but all non-NULL values must be unique per group

-- First, we need to add a partial unique index that only applies to non-NULL connected_user_id values
-- and is scoped to each group (a user can be in multiple groups, just not the same group twice)
CREATE UNIQUE INDEX idx_group_members_unique_connected_user
ON public.group_members (group_id, connected_user_id)
WHERE connected_user_id IS NOT NULL;

-- Add a comment explaining the constraint
COMMENT ON INDEX public.idx_group_members_unique_connected_user IS
'Ensures each connected user can only appear once per group. NULL values (unconnected members) are allowed.';
