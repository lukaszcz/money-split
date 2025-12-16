# MoneySplit

A React Native/Expo mobile app for tracking shared expenses and debts among groups of friends, similar to Splitwise.

## Features

- **Multi-currency support**: Add expenses in any currency with automatic exchange rate fetching
- **Multiple split methods**: Equal splits, percentage-based, or exact amounts
- **Fixed-point arithmetic**: All calculations use 4 decimal place precision (stored as integers scaled by 10,000) with 2 decimal place display
- **Settle up**: View who owes whom with optional debt simplification to minimize transfers
- **Exchange rate caching**: Rates cached for 12 hours with offline fallback
- **Clean Material Design 3 UI**: Intuitive tab-based navigation

## Architecture

### Database (Supabase)

Tables:
- `users` - Local user profiles
- `groups` - Groups with main currency
- `group_members` - Many-to-many relationship
- `expenses` - Expense records with snapshot exchange rates
- `expense_shares` - How each expense is split among participants
- `exchange_rates` - Cached rates with timestamps

### Fixed-Point Math

All monetary values stored as `bigint` (scaled by 10,000):
- Internal: 4 decimal places
- Display: 2 decimal places
- No floating point drift
- Deterministic rounding with remainder distribution

### Settlement Algorithms

**Standard Mode (No Simplify)**:
- Tracks pairwise debts per expense
- Nets mutual debts between pairs
- Shows who owes whom based on actual expenses

**Simplified Mode**:
- Uses global net balances
- Greedy matching algorithm
- Minimizes number of transfers

## Project Structure

```
/app
  /(tabs)         - Tab navigation screens (Groups, Activity, Settings)
  /group/[id]     - Group detail and expense management
  /create-group   - Group creation form
/services
  groupRepository.ts        - Database operations
  exchangeRateService.ts    - Exchange rate fetching/caching
  settlementService.ts      - Settlement calculation logic
/utils
  money.ts                  - Fixed-point math utilities
  currencies.ts             - Currency definitions
/lib
  supabase.ts              - Supabase client
  database.types.ts        - TypeScript database types
/__tests__
  money.test.ts            - Unit tests for fixed-point math
  settlement.test.ts       - Unit tests for settlement logic
```

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

3. Run tests:
   ```bash
   npm test
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

5. Build for web:
   ```bash
   npm run build:web
   ```

## Test Vectors

The app includes comprehensive test coverage for:
- Equal split rounding (EQ-1 through EQ-4)
- Percentage split rounding (PCT-1 through PCT-4)
- Exact amount normalization (EXACT-1, EXACT-2)
- Display formatting (DISP-1 through DISP-3)

All tests validate that:
- Shares sum exactly to the total
- Remainder distribution is deterministic
- No precision is lost in calculations

## Technical Highlights

- **No floating point for money**: All calculations use `bigint` integers
- **Snapshot exchange rates**: Historical accuracy preserved even if rates change
- **Deterministic rounding**: Remainder distributed to first N participants in stable order
- **Offline support**: Uses last cached exchange rates when offline
- **Type-safe**: Full TypeScript with Supabase type generation

## Usage

1. **Create a group**: Add members and set the main currency
2. **Add expenses**: Enter amount, currency, payer, and participants
3. **Choose split method**: Equal, percentage, or exact amounts
4. **View balances**: See who owes/is owed in the group
5. **Settle up**: Get transfer instructions (optionally simplified)

## License

Built as a demonstration of fixed-point arithmetic in expense tracking applications.
