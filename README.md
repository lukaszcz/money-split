# MoneySplit

A React Native/Expo mobile app for tracking shared expenses and debts among groups of friends.

## Features

- **Multi-currency expenses**: Add payments in any currency
- **Flexible splits**: Equal, percentage, or exact amounts
- **Settle up**: See who owes whom with optional debt simplification to minimize transfers
- **Group invitations**: Add members by email and connect later
- **Mobile-first UI**: Clean tab-based navigation

## Architecture

See `ARCHITECTURE.md` for the full system overview, data model, and screen-level behavior.

## Setup

1. Configure Supabase credentials in `.env`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

4. Build for web:
   ```bash
   npm run build:web
   ```

## Usage

1. **Create a group**: Add members and set the main currency
2. **Add expenses**: Enter amount, currency, payer, and participants
3. **Choose split method**: Equal, percentage, or exact amounts
4. **View balances**: See who owes/is owed in the group
5. **Settle up**: Get transfer instructions (optionally simplified)
