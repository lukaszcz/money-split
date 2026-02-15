# Repository Guidelines

MoneySplit is a React Native/Expo mobile app for tracking shared expenses and debts among groups of friends.

## Architecture

**IMPORTANT**: Read @docs/ARCHITECTURE.md to understand application architecture. Update docs/ARCHITECTURE.md whenever architecture changes – always keep it up-to-date with the codebase.

## Build, Test, and Development Commands

- `npm run dev` starts the Expo development server.
- `npm run lint` runs Expo lint rules.
- `npm run typecheck` runs TypeScript type checking.
- `npm run format` format TypeScript code.
- `npm run test` runs Jest.
- `npm run check` runs type checking, linting, formatting, and tests.

## Coding Style & Naming Conventions

- Use TypeScript and React Native conventions; prefer descriptive names like `getGroupExpenses`.
- Indentation: 2 spaces in JSON/JS/TS (match existing files).
- Keep file names and routes consistent with Expo Router patterns (`app/group/[id]/...`).
- Linting: `eslint.config.js` uses `eslint-config-expo`.
- Make sure code is properly formatted by running `npm run format`.

## Testing Guidelines

- Framework: Jest (configured in `package.json`).
- Tests should follow `__tests__/name.test.ts` or co-locate with features if you introduce a test folder.
- Run locally with `npm run test`.
- Avoid brittle tests. Test user workflows, not implementation details.
- Every major new feature should have associated unit tests.
- Read `__tests__/README.md` before you update or add tests. Update `__tests__/README.md` after updating or adding tests.
- Test coverage targets: lines 80%, functions 80%, branches 70%, statements 80%
- Don't leak expected error output into test run output

## Commit & Pull Request Guidelines

- Commit format: `type: subject` in imperative lowercase (e.g., `feat: add transfer flow`).
- PR title format same as commit format (`type: subject`).
- PR descriptions should summarize changes, rationale and impact. Do not summarize validation or testing. Unless the PR updates documentation only, do not describe documentation changes.
- Keep commits focused; avoid mixing unrelated changes.

## Security Guidelines

- RLS and schema changes live in `supabase/migrations/`.
- Edge functions run under `supabase/functions/` and should be referenced in `docs/ARCHITECTURE.md` when changed.
- Each edge function should check user authorization.
- Never expose internal server error information to clients. Return a generic error message to clients while keeping detailed logging server-side.

## Instructions

- **IMPORTANT**: Keep docs/ARCHITECTURE.md in sync with the codebase. Update it after any application architecture changes, addition of major new features, database schema updates, or significant RLS policy changes.
- Avoid code duplication. Abstract common logic into parameterized functions.
- Always include current date _and_ time in the names of new supabase migration files.
- In database migrations, always use `(select auth.<function>())` instead of bare `auth.<function>()` to avoid re-evaluating `auth.<function>()` for each row.
- While waiting on an async operation, UI controls should **ALWAYS** be disabled.
- When finished, verify with `npm run check` that there are no compilation, formatting or test errors.
