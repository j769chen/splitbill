# SplitBill

A bill splitting app built with Expo (React Native) and Supabase.

## Tech Stack

- **Frontend**: Expo SDK 54, TypeScript, Expo Router, React Native Paper (MD3)
- **Backend**: Supabase (PostgreSQL, Auth, Realtime, RLS)
- **State Management**: TanStack Query v5
- **Forms**: React Hook Form + Zod

## Features

- Email/password authentication
- Create and manage expense groups
- Add expenses with equal, exact amount, or percentage splits
- Real-time balance tracking per group
- Debt simplification (minimize number of payments)
- Settle-up payments between members
- Pull-to-refresh and realtime updates
- Beautiful, modern UI with React Native Paper (Material Design 3)

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- A [Supabase](https://supabase.com) project

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the SQL migrations in order from `supabase/migrations/`:
   - `001_create_tables.sql` - Creates all tables and triggers
   - `002_rls_policies.sql` - Sets up Row Level Security
   - `003_balance_function.sql` - Creates balance calculation functions
   - Continue through the remaining numbered migrations to apply fixes and hardening.
3. Enable Realtime for the `expenses`, `expense_splits`, `payments`, and `group_members` tables

### 3. Configure environment

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run the app

```bash
npx expo start
```

Then press `i` for iOS simulator, `a` for Android emulator, or scan the QR code with Expo Go.

## Project Structure

```
app/                  # Expo Router file-based routes
  (auth)/             # Sign-in / Sign-up screens
  (tabs)/             # Main tab navigator
    groups/           # Group list, detail, create, add expense, settle up
    activity.tsx      # Activity feed
    account/          # Profile, edit profile, notifications, help & support
components/           # Reusable UI components
lib/                  # Core logic
  supabase.ts         # Supabase client
  auth.tsx            # Auth context provider
  queries/            # TanStack Query hooks
  types.ts            # TypeScript types
  utils.ts            # Utility functions
  realtime.ts         # Realtime subscriptions
supabase/
  migrations/         # SQL migration files
```
