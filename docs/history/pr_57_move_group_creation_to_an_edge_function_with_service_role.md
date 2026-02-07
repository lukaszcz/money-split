# fix: move group creation to an edge function with service role

## Summary
Refactored the `createGroup()` function to delegate group creation to a new Supabase edge function (`create-group`) that uses the service role key to bypass RLS. This solves a chicken-and-egg problem where the RLS policy only allows existing group members to add new members, making it impossible to add the first member during group creation.

## Key Changes

- **New Edge Function**: Created `supabase/functions/create-group/index.ts` that:
  - Validates the user's session token
  - Creates the group using the service role key (bypasses RLS)
  - Adds the creator as the first member
  - Adds any initial members provided
  - Returns the created group with all members

- **Updated `createGroup()` in `services/groupRepository.ts`**:
  - Changed from direct database operations to calling the edge function
  - Simplified logic by removing manual member insertion code
  - Now uses `supabase.auth.getSession()` instead of `getUser()` to get the access token
  - Passes `initialMembers` directly to the edge function

- **Fixed RLS Policy**: Created migration `20260202225108_fix_group_members_insert_rls.sql` that:
  - Removed the overly permissive self-insertion clause from the `group_members` INSERT policy
  - Restricted INSERT to only existing group members via `user_is_group_member()` check
  - First member insertion is now exclusively handled by the edge function with service role

- **Updated Tests**: Refactored `groupRepository.test.ts` to:
  - Mock `supabase.functions.invoke()` instead of direct database calls
  - Simplified test setup by removing complex builder chains
  - Added tests for edge function error handling
  - Updated test count: 343 → 367 tests, 17 → 20 test suites

- **Documentation**: Updated `docs/ARCHITECTURE.md` to document the new edge function and explain the RLS policy changes

## Implementation Details

The edge function uses the service role key to bypass RLS, which is necessary because:
1. The `group_members` INSERT RLS policy only allows existing members to add new members
2. During group creation, there are no existing members yet
3. The edge function solves this by using elevated privileges to add the creator as the first member
4. Subsequent member additions through the normal UI still respect RLS

This approach maintains security by:
- Validating the user's session token before allowing group creation
- Keeping the restrictive RLS policy in place for normal operations
- Only using service role privileges in the controlled edge function context

https://claude.ai/code/session_01EAycPu8fBpDsvqG8AwpPcP
