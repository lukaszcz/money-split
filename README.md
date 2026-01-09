# MoneySplit

A React Native/Expo mobile app for tracking shared expenses and debts among groups of friends.

## Features

- **Multi-currency expenses**: Add payments in any currency
- **Flexible splits**: Equal, percentage, or exact amounts
- **Settle up**: See who owes whom with optional debt simplification to minimize transfers
- **Group invitations**: Add members by email and connect later
- **Mobile-first UI**: Clean tab-based navigation

## Architecture

See `docs/ARCHITECTURE.md` for the full system overview, data model, and screen-level behavior.

## Configuring the database

Initializing and configuring the database is not necessary if you use the public supabase keys provided in `.env`.

### Starting local database

```
npx supabase start
```

### Connecting cloud database

```
npx supabase login
npx supabase link --project-ref <your_project_ref>
```

### Updating the database

- Applying new migrations: `npx supabase db push`.
- Deploying edge functions: `npx supabase functions deploy`.

For each deployed edge function, you need to turn off "Verify JWT with legacy secret" in the Supabase dashboard.

### Configuring database credentials

To override the public credentials from `.env`, configure Supabase credentials in `.env.local`:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

For a local Supabase instance, the URL and key can be obtained by running
```
npx supabase status
```
When running the app on a mobile device, you need to replace `127.0.0.1` in the Supabase URL with the IP of the computer running the local Supabase server (shown by Expo when executing `npm run dev`).

The local database can be inspected with Supabase Studio accessible at `http://localhost:54323`.

## Setup

0. Initialize the database and configure Supabase credentials (optional).

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

## Usage

1. **Create a group**: Add members and set the main currency
2. **Add expenses**: Enter amount, currency, payer, and participants
3. **Choose split method**: Equal, percentage, or exact amounts
4. **View balances**: See who owes/is owed in the group
5. **Settle up**: Get transfer instructions (optionally simplified)
