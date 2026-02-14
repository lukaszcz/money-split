# fix: auth-hydration race in edit member flow

## Summary

- Fixed `EditMemberScreen` member-identity resolution so current-user membership is re-evaluated after auth hydration completes.
- Added a dedicated current-user membership resolver and wired it to auth state (`user`/`loading`) instead of relying on a one-time screen load.
- Hardened destructive action routing by resolving membership immediately before confirmation, then using that fresh result to choose between `leaveGroup()` and `deleteGroupMember()`.
- Disabled destructive controls while membership/action resolution is in progress to prevent stale-state interactions.
- Added a regression screen test covering cold-start/deep-link auth hydration timing to ensure the current user follows the leave path (and not member deletion).

## Rationale

On cold-start and deep-link entry paths, auth state can hydrate after the screen’s initial data load. If membership was computed before auth was available, the screen could permanently treat the current user as a non-member for that instance. That stale state could hide the Leave action or incorrectly route to member deletion.

## Impact

- Current users reliably see and execute **Leave Group** for their own membership.
- The leave-specific cleanup flow is preserved in delayed-auth scenarios.
- The edit-member destructive action path is now resilient to auth hydration timing.
