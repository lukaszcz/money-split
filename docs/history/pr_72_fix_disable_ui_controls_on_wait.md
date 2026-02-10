# fix: disable UI controls on wait

## Summary

This PR standardizes frontend behavior so UI controls are disabled while user-triggered async operations are in flight, with special handling to keep controls disabled through successful navigation transitions.

Key updates:

- Locked auth controls during sign-in/sign-up and recovery submission flows.
- Extended password update flows to disable all form inputs/buttons while submitting.
- Added shared disabled-state support to reusable form components:
  - `components/PasswordUpdateForm.tsx`
  - `components/KnownUserSuggestionInput.tsx`
  - `components/ExpenseFormScreen.tsx`
- Applied consistent in-flight control locking across group/member/payment screens:
  - group creation
  - add/edit member
  - add/edit expense and transfer
  - group leave flows
  - settle transfer recording actions
  - settings actions (save name, sign out, delete account)
- Updated success-path loading handling to avoid brief re-enabled UI flashes before route transitions.

## Rationale

Several screens allowed at least part of the UI to remain interactive during async waits, which could lead to duplicate actions, conflicting interactions, and short but visible re-enable windows before navigation completed. This PR removes those gaps and makes the async UX behavior consistent across the app.

## Impact

- Users now get immediate, consistent feedback that an action is in progress.
- Duplicate submissions and accidental repeated taps are prevented during async operations.
- UI state transitions are smoother, especially in auth and navigation-heavy flows.
- No backend/API contract changes are introduced.
