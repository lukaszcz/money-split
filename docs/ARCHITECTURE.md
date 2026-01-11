# MoneySplit Architecture

This document describes the architecture of the MoneySplit application (React Native + Expo + Supabase), including client and server responsibilities, data flow, database schema and RLS policies, edge functions, and screen-level behavior.

## High-level structure

- Mobile client: Expo Router app under `app/` with shared UI and domain logic in `components/`, `services/`, `utils/`, `hooks/`, and `contexts/`.
- Backend: Supabase Postgres (tables + RLS), Supabase Auth, and Edge Functions in `supabase/functions/`.
- External services: Exchange rate API (`https://api.exchangerate-api.com`) and Resend email API for invitations.

## Runtime split: device vs server

### Runs on the device

- Navigation, screens, and UI logic (`app/*.tsx`).
- Authentication state handling (`contexts/AuthContext.tsx`).
- Client-side money math and settlement logic (`utils/money.ts`, `services/settlementService.ts`).
- Exchange rate fetch + caching logic (API call + Supabase write) (`services/exchangeRateService.ts`).
- Data access via Supabase JS SDK (`lib/supabase.ts`, `services/*.ts`).
- Preference ordering and UX state (group order, currency order) (`services/groupPreferenceService.ts`, `services/currencyPreferenceService.ts`, `hooks/useCurrencyOrder.ts`).

### Runs on the server (Supabase)

- Auth: user identity and sessions (Supabase Auth).
- Database: persistence, constraints, and RLS (migrations in `supabase/migrations/*.sql`).
- Row-level security policies enforce membership-based access.
- Edge Functions for delete-user, cleanup, invitations, and known users tracking (Deno runtime):
  - `supabase/functions/delete-user/index.ts`
  - `supabase/functions/cleanup-orphaned-groups/index.ts`
  - `supabase/functions/send-invitation/index.ts`
  - `supabase/functions/update-known-users/index.ts`

## App initialization and auth flow

- The app bootstraps in `app/_layout.tsx`. `AuthProvider` from `contexts/AuthContext.tsx` wraps the app and subscribes to Supabase auth events.
- On startup, `AuthProvider` calls `supabase.auth.getSession()` and, if signed in, calls `ensureUserProfile()` to provision a local user record in the public `users` table (`services/groupRepository.ts`).
- Routing is guarded by `useSegments()` in `app/_layout.tsx`: unauthenticated users are forced to `app/auth.tsx`, authenticated users are redirected to the Groups tab.
- Sign in and sign up are handled in `app/auth.tsx` by `useAuth().signIn()` / `signUp()`. On successful sign-in, the app updates `users.last_login` in `contexts/AuthContext.tsx`.

## Client-server communication

- Data access uses the Supabase JS client (`lib/supabase.ts`) from service modules in `services/`.
- All CRUD operations are executed on the device via Supabase REST endpoints with RLS enforcement on the server.
- Edge function calls are direct `fetch()` requests to the Supabase Functions endpoint:
  - `services/groupRepository.ts` calls `/functions/v1/cleanup-orphaned-groups` when a user leaves a group.
  - `services/groupRepository.ts` calls `/functions/v1/delete-user` when deleting an account.
  - `services/groupRepository.ts` calls `/functions/v1/send-invitation` when inviting members by email.
- Exchange rates are fetched from `https://api.exchangerate-api.com` in `services/exchangeRateService.ts` and cached in Supabase.

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
- Connection and reconnection logic is handled in `ensureUserProfile()` and `reconnectGroupMembers()` (`services/groupRepository.ts`).

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
- Cached rates are read/written in `services/exchangeRateService.ts`.

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

## Row-level security (RLS) summary

The RLS policies have evolved through multiple migrations. The most recent policies enforce membership-based access using helper functions `user_is_group_member()` and `group_has_connected_members()` with immutable search paths. The intent of the latest policies is:

- `users`
  - Authenticated users can read all users.
  - Insert/update/delete is restricted to the authenticated user (`auth.uid() = id`).

- `groups`
  - Select/update: only members can view/update their groups (`user_is_group_member(auth.uid(), id)`).
  - Insert: any authenticated user can create a group.
  - Delete: only allowed when no connected members remain (`NOT group_has_connected_members(id)`).
  - Policies established or refined in `supabase/migrations/20251225175535_fix_groups_insert_policy.sql` and `supabase/migrations/20251225180300_fix_groups_insert_select_policy.sql`.

- `group_members`
  - Select: members can view members of their groups; users can also view unconnected members with matching email (needed for reconnection).
  - Insert: user can add themselves (`connected_user_id = auth.uid()`) or existing members can add others.
  - Update: members can update member details within groups they belong to; updates are also used for connect/disconnect flows.
  - Delete: disconnected members can be deleted (used by cleanup logic).

- `expenses` and `expense_shares`
  - All CRUD access is scoped to group membership (member of the group that owns the expense).

- `exchange_rates`
  - Policies allow read access to cached rates; writes occur from the client and are subject to RLS.

- `user_currency_preferences` and `user_group_preferences`
  - User can read/insert/update their own preferences.

For the exact SQL definitions and helper functions, see:

- `supabase/migrations/20251225090146_remove_unused_indexes_and_fix_function.sql`
- `supabase/migrations/20251225132228_remove_group_ownership_implement_soft_delete.sql`
- `supabase/migrations/20251225181452_fix_group_members_insert_allow_self.sql`
- `supabase/migrations/20251225180300_fix_groups_insert_select_policy.sql`

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

- `services/exchangeRateService.ts` first tries to read a cached rate from `exchange_rates`.
- Cached rates expire after 12 hours (`CACHE_DURATION_MS`).
- If missing or stale, the client fetches from `https://api.exchangerate-api.com/v4/latest/{base}`.
- The rate is scaled (4dp) and upserted into `exchange_rates`.
- All expenses store a snapshot of the rate in `exchange_rate_to_main_scaled` to keep historical accuracy.

## Edge functions

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

### update-known-users

- File: `supabase/functions/update-known-users/index.ts`.
- Triggered when a member is added to a group or when a member's connection changes (`createGroupMember()`, `updateGroupMember()`, `reconnectGroupMembers()` in `services/groupRepository.ts`).
- Updates the `user_known_users` table bidirectionally: adds the new member to existing members' known users lists and adds existing members to the new member's known users list.
- Only processes members that are connected to authenticated users (have a `connected_user_id`).

## UI design and screen-by-screen behavior

The UI uses a light, card-based aesthetic with consistent spacing and neutral grays, accent blue (`#2563eb`), and iconography via `lucide-react-native`. Common patterns include:

- White card surfaces over a light gray background (`#f9fafb`).
- Rounded corners and soft borders (`borderColor: #e5e7eb`).
- Icon affordances for actions (add, edit, delete, settle).

### Auth (`app/auth.tsx`)

- Email/password sign-in and sign-up.
- On success, navigates to `/(tabs)/groups`.
- Uses `useAuth()` methods from `contexts/AuthContext.tsx`.

### Tabs layout (`app/(tabs)/_layout.tsx`)

- Bottom tab navigation on the main screen: Groups, Activity, Settings.

### Groups list (`app/(tabs)/groups.tsx`)

- Loads all groups (`getAllGroups()` in `services/groupRepository.ts`).
- Orders by last visit via `getOrderedGroups()` (`services/groupPreferenceService.ts`).
- Computes “settled” status by loading expenses and calling `computeBalances()`.
- Allows the user to add new groups via `app/create-group.tsx`.

### Activity (`app/(tabs)/activity.tsx`)

- Fetches each group the user is a member of.
- For each fetched group, fetches its expenses.
- Displays recent expenses across all fetched groups, newest first.
- Resolves payer names via `getGroupMember()`.

### Settings (`app/(tabs)/settings.tsx`)

- Displays profile (email, display name) and allows rename via `updateUserName()`.
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
  - Payments: list of expenses and transfers with conversion previews.
  - Balances: per-member net balance via `computeBalances()`.
  - Members: list of members; route to edit.
  - Settle: opens settle screen if balances are non-zero.
- Leaving a group uses `leaveGroup()` and triggers cleanup function.

### Add Expense / Transfer (`app/group/[id]/add-expense.tsx`)

- Two modes: “Expense” (split among participants) and “Transfer” (one payer, one recipient).
- Split methods: equal, percentage, exact amounts.
- Validates totals and generates `expense_shares` based on split method.
- Fetches exchange rate with `getExchangeRate()` and stores snapshot values.
- Persists via `createExpense()`.
- UI rendering is shared via `components/ExpenseFormScreen.tsx`.

### Edit Expense (`app/group/[id]/edit-expense.tsx`)

- Loads expense and group, pre-fills form and split method.
- Recomputes shares on save and updates via `updateExpense()`.
- Can delete via `deleteExpense()`.
- UI rendering is shared via `components/ExpenseFormScreen.tsx`.

### Edit Transfer (`app/group/[id]/edit-transfer.tsx`)

- Specialized edit form for transfers (single recipient).
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


### Settle Up (`app/group/[id]/settle.tsx`)

- Displays settlements with simplify toggle.
- “Transfer” button records a settlement as a transfer expense via `createExpense()`.
- “Explain Debts” visualizes simplification steps (`computeSimplificationSteps()`).

### Not Found (`app/+not-found.tsx`)

- Basic fallback route.

## General workflow (end-to-end)

1. User signs up or signs in (`app/auth.tsx` → `contexts/AuthContext.tsx`).
2. `ensureUserProfile()` creates a `users` row and reconnects matching members.
3. When reconnecting, `reconnectGroupMembers()` calls `update-known-users` edge function to update known users lists.
4. User creates a group (`app/create-group.tsx` → `createGroup()` → `group_members`).
5. When adding members, `createGroupMember()` calls `update-known-users` edge function to track user relationships bidirectionally.
6. User adds expenses or transfers (`app/group/[id]/add-expense.tsx` → `createExpense()` + `expense_shares`).
7. Balances and settlements are computed locally (`services/settlementService.ts`).
8. User can record settlement transfers (creates a transfer expense).
9. Leaving a group disconnects the user and triggers cleanup (`leaveGroup()` → edge function).
10. Deleting account calls `delete-user` edge function to disconnect and purge server-side records.

## Key file map

- App entry + routing: `app/_layout.tsx`, `app/(tabs)/_layout.tsx`.
- Auth state: `contexts/AuthContext.tsx`.
- Data access: `services/groupRepository.ts`, `services/exchangeRateService.ts`.
- Preferences: `services/currencyPreferenceService.ts`, `services/groupPreferenceService.ts`, `hooks/useCurrencyOrder.ts`.
- Money math: `utils/money.ts`, `utils/currencies.ts`.
- Input validation logic: `utils/validation.ts` (decimal, integer, percentage, and exact-amount input helpers).
- Shared expense/transfer form UI: `components/ExpenseFormScreen.tsx`.
- Known user autocomplete UI: `components/KnownUserSuggestionInput.tsx`.
- Settlement logic: `services/settlementService.ts`.
- Edge functions: `supabase/functions/*`.
- RLS and schema: `supabase/migrations/*.sql`.
