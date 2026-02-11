# MoneySplit Architecture

This document describes the architecture of the MoneySplit application (React Native + Expo + Supabase), including client and server responsibilities, data flow, database schema and RLS policies, edge functions, and screen-level behavior.

## High-level structure

- Mobile client: Expo Router app under `app/` with shared UI and domain logic in `components/`, `services/`, `utils/`, `hooks/`, and `contexts/`.
- Backend: Supabase Postgres (tables + RLS), Supabase Auth, and Edge Functions in `supabase/functions/`.
- External services: Exchange rate API (`https://api.exchangerate-api.com/v4/latest/{base}`) and Resend email API for invitations.

### Project & Module Organization

- `app/`: Expo Router screens and navigation (e.g., `app/(tabs)/groups.tsx`).
- `components/`: UI components.
- `services/`: data access and business logic (Supabase queries, settlements).
- `utils/`: money math and currency definitions.
- `contexts/`: shared providers (auth state).
- `hooks/`: client hooks (currency ordering, framework ready).
- `supabase/`: migrations and edge functions.
- `assets/`: icons and branding images.
- `docs/`: architecture and database documentation.

## Runtime split: device vs server

### Runs on the device

- Navigation, screens, and UI logic (`app/*.tsx`).
- Authentication state handling (`contexts/AuthContext.tsx`) with Supabase auth session persistence backed by AsyncStorage on native devices (`lib/supabase.ts`).
- Client-side money math and settlement logic (`utils/money.ts`, `services/settlementService.ts`).
- Exchange rate caching and lookup in AsyncStorage + in-memory map, with edge-function fallback (`services/exchangeRateService.ts`).
- Data access via Supabase JS SDK (`lib/supabase.ts`, `services/*.ts`).
- Preference ordering and UX state (group order, currency order, settle defaults) stored in Supabase and cached in AsyncStorage (`services/groupPreferenceService.ts`, `services/currencyPreferenceService.ts`, `services/settlePreferenceService.ts`).

### Runs on the server (Supabase)

- Auth: user identity and sessions (Supabase Auth).
- Database: persistence, constraints, and RLS (migrations in `supabase/migrations/*.sql`).
- Row-level security policies enforce membership-based access.
- Edge Functions for group creation, delete-user, cleanup, invitations, user connection, exchange rates, known users tracking, and password recovery (Deno runtime):
  - `supabase/functions/create-group/index.ts`
  - `supabase/functions/delete-user/index.ts`
  - `supabase/functions/cleanup-orphaned-groups/index.ts`
  - `supabase/functions/send-invitation/index.ts`
  - `supabase/functions/connect-user-to-groups/index.ts`
  - `supabase/functions/get-exchange-rate/index.ts`
  - `supabase/functions/update-known-users/index.ts`
  - `supabase/functions/password-recovery/index.ts`
  - `supabase/functions/verify-recovery-password/index.ts`

## App initialization and auth flow

- The app bootstraps in `app/_layout.tsx`. `AuthProvider` from `contexts/AuthContext.tsx` wraps the app and subscribes to Supabase auth events.
- Supabase client auth storage is platform-aware in `lib/supabase.ts`: native apps persist sessions in `@react-native-async-storage/async-storage`, while web uses browser storage and keeps URL session detection enabled.
- On startup, `AuthProvider` calls `supabase.auth.getSession()`, applies the session to local state immediately, then queues profile/preference sync work (`ensureUserProfile()`, `syncUserPreferences()`) so session restoration is never blocked by background sync failures.
- The `onAuthStateChange` subscription keeps the callback synchronous and queues async sync work separately for `SIGNED_IN` events to avoid Supabase auth callback deadlocks.
- Routing is guarded by `useSegments()` in `app/_layout.tsx`: unauthenticated users are forced to `app/auth.tsx` (with `app/password-recovery.tsx` available as a public route), authenticated users are redirected to the Groups tab.
- Sign in and sign up are handled in `app/auth.tsx` by `useAuth().signIn()` / `signUp()`. On successful sign-in, the app updates `users.last_login` in `contexts/AuthContext.tsx`.
- After successful sign-up, the app keeps users on `app/auth.tsx` and prompts them to confirm their email address before signing in.
- Sign-in also triggers a preference sync to refresh cached user preferences for currency order, group order, and settle defaults, and warms the exchange-rate cache for currencies seen in the user's expenses.
- Password recovery is handled by `app/password-recovery.tsx`, which requests a one-time recovery password from the `password-recovery` edge function.
- The `password-recovery` edge function stores a hashed recovery password in the `recovery_passwords` table (separate from the user's actual password) and emails the unhashed password to the user.
- When a user signs in, `contexts/AuthContext.tsx` first attempts normal authentication. If that fails, it calls the `verify-recovery-password` edge function.
- The `verify-recovery-password` edge function verifies the recovery password and, in the same request, sets a temporary internal password with service-role privileges.
- The client signs in using that temporary password returned from the edge function.
- The user is then forced to navigate to `app/recovery-password-change.tsx` to set a new permanent password before accessing the app.
- Authenticated users can also change their password from settings via `app/change-password.tsx`, which requires entering the current password before calling `supabase.auth.updateUser()`.

## Client-server communication

- Data access uses the Supabase JS client (`lib/supabase.ts`) from service modules in `services/`.
- All CRUD operations are executed on the device via Supabase REST endpoints with RLS enforcement on the server.
- Read-heavy activity feed loading uses a Postgres RPC (`public.get_activity_feed`) called via `supabase.rpc()` from `getActivityFeed()` in `services/groupRepository.ts`.
- Edge function calls are made with `supabase.functions.invoke()` from `services/groupRepository.ts`:
  - `create-group` is invoked when creating a new group (with bearer token).
  - `cleanup-orphaned-groups` is invoked when a user leaves a group.
  - `delete-user` is invoked when deleting an account (with bearer token).
  - `send-invitation` is invoked when inviting members by email.
  - `update-known-users` is invoked when a member is connected to an authenticated user (with bearer token).
  - `connect-user-to-groups` is invoked when a user signs up to connect them to existing group members with matching email.
- `services/exchangeRateService.ts` invokes `get-exchange-rate` on local cache miss/staleness and prewarms local rates at login for known currency pairs.
- `services/authService.ts` invokes `password-recovery` to issue one-time recovery passwords by email.
- `contexts/AuthContext.tsx` invokes `verify-recovery-password` during sign-in to verify recovery-password credentials and provision a temporary password in one server-side step.

## Data model (current schema + notes)

The canonical schema is defined by the SQL migrations under `supabase/migrations/`. TypeScript typings are in `lib/database.types.ts`. The schema below reflects the migrations as of the latest timestamps.

### users

- Table: `public.users`
- Columns: `id`, `name`, `email`, `created_at`, `last_login`.
- Description: Profile records for authenticated users, mirrored from Supabase Auth.
- Used by `ensureUserProfile()` and profile updates (`services/groupRepository.ts`).

### groups

- Description: Expense-sharing groups with a primary currency for totals.
- Table: `public.groups`
- Columns: `id`, `name`, `main_currency_code`, `created_at`.
- Group creation uses `createGroup()` in `services/groupRepository.ts`.

### group_members

- Description: Membership roster for each group, including invited members not yet linked to a user.
- Table: `public.group_members`
- Columns: `id`, `group_id`, `name`, `email`, `connected_user_id`, `created_at`.
- Supports members that are not yet connected to an auth user (email-based invitations).
- Connection logic is handled in `ensureUserProfile()` which calls the `connect-user-to-groups` edge function to bypass RLS policies (`services/groupRepository.ts`).

### expenses

- Description: Expense or transfer records for a group, stored in original and main currency.
- Table: `public.expenses`
- Columns: `id`, `group_id`, `description`, `date_time`, `currency_code`, `total_amount_scaled`, `payer_member_id`, `exchange_rate_to_main_scaled`, `total_in_main_scaled`, `payment_type`, `split_type`, `created_at`.
- `payment_type` distinguishes `expense` vs `transfer` (`supabase/migrations/20251224125151_add_payment_type_to_expenses.sql`).
- `split_type` preserves `equal` / `percentage` / `exact` (`supabase/migrations/20251225183146_add_split_type_to_expenses.sql`).

### expense_shares

- Description: Per-member allocation of each expense in both original and main currency.
- Table: `public.expense_shares`
- Columns: `id`, `expense_id`, `member_id`, `share_amount_scaled`, `share_in_main_scaled`.
- Shares are created when an expense is created or updated (`createExpense()` / `updateExpense()` in `services/groupRepository.ts`).

### exchange_rates

- Description: Cached FX rates used to convert expenses to a group's main currency.
- Table: `public.exchange_rates`
- Columns: `id`, `base_currency_code`, `quote_currency_code`, `rate_scaled`, `fetched_at`.
- Cached rates are managed by the `get-exchange-rate` edge function.
- Clients can read cached rates but cannot insert or update them directly (RLS policies restrict write access).

### recovery_passwords

- Description: Short-lived recovery passwords for account recovery, separate from user passwords to prevent account lockout attacks.
- Table: `public.recovery_passwords`
- Columns: `id`, `user_id`, `password_hash`, `expires_at`, `created_at`.
- One recovery password per user (enforced by unique constraint on `user_id`).
- Password is bcrypt-hashed before storage.
- Expires after 5 minutes (`expires_at`).
- Clients have no direct access (service role only via RLS).
- Created by the `password-recovery` edge function.
- Verified and consumed (one-time use) by the `verify-recovery-password` edge function before it sets a temporary sign-in password.
- Expired passwords are cleaned up automatically when verification is attempted.

### user_currency_preferences

- Description: Per-user ordering of currencies for display and selection.
- Table: `public.user_currency_preferences`
- Columns: `id`, `user_id`, `currency_order`, `created_at`, `updated_at`.
- Stored as a JSON array and managed in `services/currencyPreferenceService.ts`.

### user_group_preferences

- Description: Per-user ordering of groups for the tabs list and recency sorting.
- Table: `public.user_group_preferences`
- Columns: `user_id`, `group_order`, `updated_at`.
- Managed in `services/groupPreferenceService.ts` for recency-ordered group lists.

### user_known_users

- Description: Tracks users that each user has shared a group with, enabling autocomplete suggestions when adding group members.
- Table: `public.user_known_users`
- Columns: `user_id`, `known_user_id`, `first_shared_at`, `last_shared_at`.
- Bidirectional relationship: when user A and user B share a group, both users add each other to their known users list.
- Updated automatically via the `update-known-users` edge function when members are added or connected to groups.
- Read via `getKnownUsers()` in `services/groupRepository.ts` for autocomplete UI.

### user_settle_preferences

- Description: Per-user defaults for settle behavior (simplify debts toggle).
- Table: `public.user_settle_preferences`
- Columns: `user_id`, `simplify_debts`, `updated_at`.
- Managed in `services/settlePreferenceService.ts` with AsyncStorage caching.

## Row-level security (RLS) summary

The RLS policies have evolved through multiple migrations. The most recent policies enforce membership-based access using helper functions such as `user_is_group_member()`, `group_has_connected_members()`, and `member_is_involved_in_expenses()`, and use `(select auth.uid())` in policy predicates to avoid per-row re-evaluation. The intent of the latest policies is:

- `users`
  - Authenticated users can read all users.
  - Insert/update/delete is restricted to the authenticated user (`(select auth.uid()) = id`).

- `groups`
  - Select: users can view groups they are members of, plus groups with no connected members (required for group creation and orphan cleanup windows).
  - Update: only members can update their groups (`user_is_group_member((select auth.uid()), id)`).
  - Insert: no authenticated client insert policy exists, so direct `INSERT` from client sessions is denied by RLS.
  - Group creation is performed only via the `create-group` edge function using the service role key.
  - Delete: only allowed when no connected members remain (`NOT group_has_connected_members(id)`).
  - Policies established or refined in `supabase/migrations/20260204120000_fix_group_members_delete_policy_performance.sql` and `supabase/migrations/20260207212748_disable_direct_groups_insert.sql`.

- `group_members`
  - Select: members can view members of their groups; users can also view unconnected members with matching email (needed for reconnection).
  - Insert: only existing group members can add new members (`user_is_group_member((select auth.uid()), group_id)`). The first member is added by the `create-group` edge function using the service role key to bypass RLS.
  - Update: members can update member details within groups they belong to; updates are also used for connect/disconnect flows.
  - Delete: any group member can delete another member only if that member is not involved in expenses (no non-zero shares and not referenced as `payer_member_id`).

- `expenses` and `expense_shares`
  - All CRUD access is scoped to group membership (member of the group that owns the expense).

- `exchange_rates`
  - Policies allow read access to cached rates; writes are performed by the `get-exchange-rate` edge function using service role permissions.

- `recovery_passwords`
  - No client access allowed (service role only).
  - All operations are performed by edge functions (`password-recovery`, `verify-recovery-password`) using service role key.

- `user_currency_preferences`, `user_group_preferences`, and `user_settle_preferences`
  - User can read/insert/update their own preferences.

- `user_known_users`
  - User can read/insert/update/delete their own known-users rows only (`user_id = (select auth.uid())`).

## Money math and settlement algorithms

- All monetary amounts are stored as fixed-point integers scaled by 10,000 (4 decimal places).
  - Scaling utilities are in `utils/money.ts` (`toScaled()`, `applyExchangeRate()`, `calculateEqualSplit()`, `calculatePercentageSplit()`).
- Display formatting is always 2 decimal places via `formatNumber()` / `formatCurrency()`.
- Remainders are distributed deterministically to the first N participants in the split order to avoid rounding drift.
- Share calculations for equal/percentage/exact inputs are unified in `calculateSharesForSplit()` (`utils/money.ts`).
- Settlement logic runs entirely on the client:
  - `computeBalances()` produces per-member net balances using `expense.total_in_main_scaled`.
  - `computeSettlementsNoSimplify()` creates pairwise debts from raw shares.
  - `computeSettlementsSimplified()` uses a greedy netting algorithm to reduce transfers.
  - `computeSimplificationSteps()` powers the “Explain Debts” animation (step-by-step simplification).

Relevant files:

- `utils/money.ts`
- `services/settlementService.ts`
- `app/group/[id]/settle.tsx`

## Exchange rate workflow

- `services/exchangeRateService.ts` first checks an in-memory cache, then AsyncStorage (`exchange_rate_cache_v1`), before calling `get-exchange-rate`.
- On login, `syncUserPreferences()` calls `prefetchExchangeRatesOnLogin()` to prewarm local rates for currency pairs derived from existing expenses and group main currencies.
- The edge function first tries to read a cached rate from `exchange_rates`.
- Cached rates expire after 12 hours (`CACHE_DURATION_MS`).
- If missing or stale, the edge function fetches from `https://api.exchangerate-api.com/v4/latest/{base}`.
- The rate is scaled (4dp) and upserted into `exchange_rates` by the edge function using service role permissions.
- Clients cannot write to `exchange_rates` directly (RLS policies restrict insert/update access).
- All expenses store a snapshot of the rate in `exchange_rate_to_main_scaled` to keep historical accuracy.
- Group payments UI uses `expense.total_in_main_scaled` for conversion previews, avoiding any runtime FX fetch when opening the Payments tab.

## Edge functions

### create-group

- File: `supabase/functions/create-group/index.ts`.
- Triggered from `createGroup()` in `services/groupRepository.ts`.
- Creates a new group with the creator as the first member using service role (bypasses RLS).
- Also adds any additional initial members provided.
- This edge function is required because direct client `INSERT` into `groups` is disallowed and `group_members` INSERT RLS only allows existing members to add new members.

### send-invitation

- File: `supabase/functions/send-invitation/index.ts`.
- Triggered from `sendInvitationEmail()` in `services/groupRepository.ts`.
- Uses Resend API with HTML template to deliver invite emails.

### cleanup-orphaned-groups

- File: `supabase/functions/cleanup-orphaned-groups/index.ts`.
- Triggered after a user leaves a group (`leaveGroup()` in `services/groupRepository.ts`).
- Deletes groups with no connected members by scanning `group_members`.

### delete-user

- File: `supabase/functions/delete-user/index.ts`.
- Triggered from `deleteUserAccount()` in `services/groupRepository.ts`.
- Disconnects the user from all `group_members`, deletes the public `users` row, runs cleanup, then deletes the auth user.

### connect-user-to-groups

- File: `supabase/functions/connect-user-to-groups/index.ts`.
- Triggered from `ensureUserProfile()` in `services/groupRepository.ts` when a user signs up or signs in for the first time.
- Uses the service role key to bypass RLS policies and connect the user to all `group_members` rows with matching email and NULL `connected_user_id`.
- Calls the `update-known-users` edge function for each connected member to maintain bidirectional known user relationships.
- Returns the count of groups the user was connected to.

### update-known-users

- File: `supabase/functions/update-known-users/index.ts`.
- Triggered when a member is added to a group, when a member's connection changes, or when a user is connected to groups (`createGroupMember()`, `updateGroupMember()`, `connectUserToGroups()` in `services/groupRepository.ts`).
- Updates the `user_known_users` table bidirectionally: adds the new member to existing members' known users lists and adds existing members to the new member's known users list.
- Only processes members that are connected to authenticated users (have a `connected_user_id`).

### get-exchange-rate

- File: `supabase/functions/get-exchange-rate/index.ts`.
- Triggered from `getExchangeRate()` in `services/exchangeRateService.ts`.
- Fetches exchange rates from `https://api.exchangerate-api.com` and caches them in the `exchange_rates` table.
- First checks for cached rates (valid for 12 hours), then fetches fresh rates if needed.
- Uses service role permissions to write to `exchange_rates`, which clients cannot modify directly.

### password-recovery

- File: `supabase/functions/password-recovery/index.ts`.
- Triggered from `requestPasswordRecovery()` in `services/authService.ts`.
- Generates a one-time recovery password, bcrypt-hashes it, and stores it in the `recovery_passwords` table.
- Sends the unhashed password via Resend email.
- Prevents duplicate requests: if an unexpired recovery password already exists for the user, returns success without creating a new one.
- Returns a generic success response regardless of whether the user exists (prevents email enumeration attacks).
- If email sending fails, the recovery password is deleted from the database to maintain consistency.

### verify-recovery-password

- File: `supabase/functions/verify-recovery-password/index.ts`.
- Triggered from `signIn()` in `contexts/AuthContext.tsx` when normal authentication fails.
- Checks if the provided password matches a recovery password in the `recovery_passwords` table.
- Verifies the password using bcrypt comparison.
- Checks if the recovery password has expired; if so, deletes it and returns `expired: true`.
- If verification succeeds, consumes the recovery password (one-time use), sets a temporary internal password using the admin API, and returns `isRecoveryPassword: true` with that temporary password.
- Returns `isRecoveryPassword: false` for invalid or non-existent recovery passwords.

## UI design and screen-by-screen behavior

The UI uses a light, card-based aesthetic with consistent spacing and neutral grays, accent blue (`#2563eb`), and iconography via `lucide-react-native`. Common patterns include:

- White card surfaces over a light gray background (`#f9fafb`).
- Rounded corners and soft borders (`borderColor: #e5e7eb`).
- Icon affordances for actions (add, edit, delete, settle).

### Auth (`app/auth.tsx`)

- Email/password sign-in and sign-up.
- On success, navigates to `/(tabs)/groups` unless `useAuth()` marks `requiresRecoveryPasswordChange`, in which case routing is redirected to `app/recovery-password-change.tsx`.
- Uses `useAuth()` methods from `contexts/AuthContext.tsx`.

### Password recovery (`app/password-recovery.tsx`)

- Explains the recovery flow and requests a recovery email.
- Calls `requestPasswordRecovery()` in `services/authService.ts` to send a one-time password.
- Informs the user that they must set a permanent password after signing in with the recovery password.

### Recovery password change (`app/recovery-password-change.tsx`)

- Forced screen shown after a successful recovery-password login.
- Collects and validates a new permanent password, then calls `completeRecoveryPasswordChange()` from `contexts/AuthContext.tsx`.
- Clears recovery metadata and unblocks access to the main tabs once the permanent password is saved.

### Change password (`app/change-password.tsx`)

- Optional authenticated screen opened from Settings.
- Reuses the shared password-update form component (`components/PasswordUpdateForm.tsx`) used by recovery-password-change.
- Requires current password verification via `changePassword()` in `contexts/AuthContext.tsx`, then updates the password with Supabase Auth.

### Tabs layout (`app/(tabs)/_layout.tsx`)

- Bottom tab navigation on the main screen: Groups, Activity, Settings.

### Groups list (`app/(tabs)/groups.tsx`)

- Loads all groups (`getAllGroups()` in `services/groupRepository.ts`).
- Orders by last visit via `getOrderedGroups()` (`services/groupPreferenceService.ts`).
- Computes “settled” status by loading expenses and calling `computeBalances()`.
- Allows the user to add new groups via `app/create-group.tsx`.

### Activity (`app/(tabs)/activity.tsx`)

- Loads recent activity with a single `getActivityFeed()` call (`services/groupRepository.ts`), which invokes the `public.get_activity_feed` RPC.
- The RPC joins `expenses`, `groups`, and payer `group_members` rows server-side.
- Results are already sorted newest-first by `date_time` and filtered by membership (`user_is_group_member((select auth.uid()), group_id)`).

### Settings (`app/(tabs)/settings.tsx`)

- Displays profile (email, display name) and allows rename via `updateUserName()`.
- Includes navigation to `app/change-password.tsx` for authenticated password changes.
- Logout via `useAuth().signOut()`.
- Account deletion triggers edge function `delete-user` (`deleteUserAccount()` in `services/groupRepository.ts`).

### Create Group (`app/create-group.tsx`)

- Collects group name, main currency, and member list.
- Uses currency ordering via `useCurrencyOrder()`.
- Creates group + members via `createGroup()`.
- Sends invitations via `sendInvitationEmail()` for non-existing users.
- Shows autocomplete suggestions from known users when adding members to the initial member list.
- Suggestions are filtered as the user types in the member name field.

### Group detail (`app/group/[id].tsx`)

- Loads group, members, and expenses (`getGroup()`, `getGroupExpenses()`).
- Tabs:
  - Payments: list of expenses and transfers with conversion previews rendered from stored `total_in_main_scaled`.
  - Balances: per-member net balance via `computeBalances()`.
  - Settle: embedded settle view powered by `SettleContent`, with transfer recording and debt simplification controls.
- Group actions (overflow menu):
  - Group members: opens member management screen.
  - Leave group uses `leaveGroup()` and triggers cleanup function.

### Group members (`app/group/[id]/members.tsx`)

- Dedicated screen for viewing and editing group members.
- Shows member list, connection status, and navigates to edit.
- Adds members via `add-member` flow.

### Add Expense / Transfer (`app/group/[id]/add-expense.tsx`)

- Two modes: “Expense” (split among participants) and “Transfer” (one payer, one recipient).
- Split methods: equal, percentage, exact amounts.
- Validates totals and generates `expense_shares` based on split method.
- Fetches exchange rate with `getExchangeRate()` and stores snapshot values.
- Persists via `createExpense()`.
- UI rendering is shared via `components/ExpenseFormScreen.tsx`.

### Edit Expense (`app/group/[id]/edit-expense.tsx`)

- Loads expense and group, pre-fills form and split method.
- Preserves the original FX snapshot rate when the edited currency is unchanged; fetches a new rate only if currency changes.
- Recomputes shares on save and updates via `updateExpense()`.
- Can delete via `deleteExpense()`.
- UI rendering is shared via `components/ExpenseFormScreen.tsx`.

### Edit Transfer (`app/group/[id]/edit-transfer.tsx`)

- Specialized edit form for transfers (single recipient).
- Preserves the original FX snapshot rate when the edited currency is unchanged; fetches a new rate only if currency changes.
- Updates expense using `updateExpense()` .
- Can delete via `deleteExpense()`.
- UI rendering is shared via `components/ExpenseFormScreen.tsx`.

### Add Member (`app/group/[id]/add-member.tsx`)

- Adds a new member record via `createGroupMember()`.
- If email is provided:
  - Connects to existing user if present.
  - Sends invitation email otherwise.
- Uses `KnownUserSuggestionInput` component to show autocomplete suggestions from the user's known users list as they type.
- When a suggestion is selected, both name and email are auto-filled.
- Known users list is populated from users the current user has previously shared groups with.

### Edit Member (`app/group/[id]/edit-member.tsx`)

- Updates member name/email and optionally re-sends invitation.
- Uses `updateGroupMember()`.
- Uses `KnownUserSuggestionInput` component for autocomplete suggestions.
- When email changes and connects to a different user, the known users lists are updated via the edge function.
- Shows a delete button if the member can be removed (is not involved in expenses as payer or non-zero share), and always shows a leave action when editing the current user’s own member row.
- Uses `canDeleteGroupMember()` to check if deletion is allowed.
- Uses `deleteGroupMember()` to remove the member from the group.

### Settle Up (`app/group/[id]/settle.tsx`)

- Displays settlements with simplify toggle.
- “Transfer” button records a settlement as a transfer expense via `createExpense()`.
- “Explain Debts” visualizes simplification steps (`computeSimplificationSteps()`).

### Not Found (`app/+not-found.tsx`)

- Basic fallback route.

## General workflow (end-to-end)

1. User signs up or signs in (`app/auth.tsx` → `contexts/AuthContext.tsx`).
2. `ensureUserProfile()` creates a `users` row and calls the `connect-user-to-groups` edge function to connect the user to any existing group members with matching email.
3. The `connect-user-to-groups` edge function calls `update-known-users` for each connected member to update known users lists bidirectionally.
4. User creates a group (`app/create-group.tsx` → `createGroup()` → `create-group` edge function → `groups` + initial `group_members`).
5. When adding members, `createGroupMember()` calls `update-known-users` edge function to track user relationships bidirectionally.
6. User adds expenses or transfers (`app/group/[id]/add-expense.tsx` → `createExpense()` + `expense_shares`).
7. Balances and settlements are computed locally (`services/settlementService.ts`).
8. User can record settlement transfers (creates a transfer expense).
9. Leaving a group disconnects the user and triggers cleanup (`leaveGroup()` → edge function).
10. Deleting account calls `delete-user` edge function to disconnect and purge server-side records.

## Key file map

- App entry + routing: `app/_layout.tsx`, `app/(tabs)/_layout.tsx`.
- Password update screens: `app/change-password.tsx`, `app/recovery-password-change.tsx`.
- Auth state: `contexts/AuthContext.tsx`.
- Data access: `services/groupRepository.ts`, `services/exchangeRateService.ts`.
- Preferences: `services/currencyPreferenceService.ts`, `services/groupPreferenceService.ts`, `services/settlePreferenceService.ts`, `services/userPreferenceSync.ts`, `services/userPreferenceCache.ts`, `hooks/useCurrencyOrder.ts`.
- Money math: `utils/money.ts`, `utils/currencies.ts`.
- Input validation logic: `utils/validation.ts` (decimal, integer, percentage, and exact-amount input helpers).
- Shared expense/transfer form UI: `components/ExpenseFormScreen.tsx`.
- Shared password update form UI: `components/PasswordUpdateForm.tsx`.
- Known user autocomplete UI: `components/KnownUserSuggestionInput.tsx`.
- Shared settle UI: `components/SettleContent.tsx`.
- Settlement logic: `services/settlementService.ts`.
- Edge functions: `supabase/functions/*`.
- RLS and schema: `supabase/migrations/*.sql`.
