# Repository Guidelines

MoneySplit is a React Native/Expo mobile app for tracking shared expenses and debts among groups of friends.

## Project Structure & Module Organization

- `app/` contains Expo Router screens and navigation (e.g., `app/(tabs)/groups.tsx`).
- `services/` holds data access and business logic (Supabase queries, settlements).
- `utils/` includes money math and currency definitions.
- `contexts/` provides shared providers (auth state).
- `hooks/` includes client hooks (currency ordering, framework ready).
- `supabase/` contains migrations and edge functions.
- `assets/` stores icons and branding images.
- `docs/` holds architecture and database documentation.

## Architecture

**IMPORTANT**: Read @docs/ARCHITECTURE.md to understand application architecture. Update docs/ARCHITECTURE.md whenever architecture changes – always keep it up-to-date with the codebase.

## Build, Test, and Development Commands

- `npm run dev` starts the Expo development server.
- `npm run build:web` generates the web bundle via Expo export.
- `npm run lint` runs Expo lint rules.
- `npm run typecheck` runs TypeScript with `--noEmit`.
- `npm test` runs Jest (no tests are currently present in the repo).

## Coding Style & Naming Conventions

- Use TypeScript and React Native conventions; prefer descriptive names like `getGroupExpenses`.
- Indentation: 2 spaces in JSON/JS/TS (match existing files).
- Keep file names and routes consistent with Expo Router patterns (`app/group/[id]/...`).
- Linting: `eslint.config.js` uses `eslint-config-expo`.

## Testing Guidelines

- Framework: Jest (configured in `package.json`).
- Tests should follow `__tests__/name.test.ts` or co-locate with features if you introduce a test folder.
- Run locally with `npm test`.

## Commit & Pull Request Guidelines

- Commit format: `type: subject` in imperative lowercase (e.g., `feat: add transfer flow`).
- PR descriptions should summarize changes.
- Keep commits focused; avoid mixing unrelated changes.

## Security & Configuration

- RLS and schema changes live in `supabase/migrations/`.
- Edge functions run under `supabase/functions/` and should be referenced in `docs/ARCHITECTURE.md` when changed.
- NEVER read or otherwise touch `.env.local`. NEVER add it to the repository.
