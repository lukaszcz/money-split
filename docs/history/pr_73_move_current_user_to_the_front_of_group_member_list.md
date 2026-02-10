# feat: move current user to the front of group member list

## Summary

- Updated `getGroupMembers` to move the current user’s connected member to the front of the returned list while preserving the relative order of other members.
- Refactored `services/groupRepository.ts` to support explicit user context by adding optional `currentUserId` parameters to auth-dependent functions and using `getSession()` as fallback when the id is not passed.
- Propagated `currentUserId` from UI/auth call sites that already have it (`AuthContext`, group member screens, create-group flow, known-user suggestions, settings account deletion) to avoid redundant auth lookups.
- Hardened `ensureUserProfile` to prevent unsafe profile creation when session user details are unavailable and to reject mismatched `currentUserId` vs authenticated session user.

## Rationale

The repository layer was relying on `supabase.auth.getUser()` in hot paths, which can introduce unnecessary network/auth overhead and make data access depend on implicit auth resolution. Passing `currentUserId` where available and falling back to session lookup keeps behavior explicit, reduces repeated auth fetches, and improves predictability.

The profile provisioning path also needed stricter guards so a profile cannot be created with incomplete or inconsistent auth context.

## Impact

- Lower auth-resolution overhead in common repository calls when caller already has user id.
- More deterministic behavior for current-user-dependent queries.
- Member lists are now user-centric by default (current member first).
- Safer `users` profile provisioning with stronger consistency checks.

## API Changes

The following functions now accept optional `currentUserId?: string`:

- `ensureUserProfile`
- `getGroupMembers`
- `getCurrentUserMemberInGroup`
- `getGroup`
- `leaveGroup`
- `deleteUserAccount`
- `getKnownUsers`
