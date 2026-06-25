# Activity Feed — New Event Types

**Date:** 2026-06-24
**Status:** Approved (design); ready for implementation

## Problem

The global Activity feed (`app/(tabs)/activity.tsx`) shows three event kinds:
group expenses, group payments, and contact (1-on-1) expenses. Two relevant
events are missing:

1. **Contact (1-on-1) payments** — direct settle-ups between you and a contact
   outside any group. The data exists (`contact_payments`), but there is no
   "recent" query and no feed row, so these transactions never appear.
2. **Simplify-debts toggles** — when someone flips a group's `simplify_debts`
   switch, nothing is recorded. `set_group_simplify_debts` just overwrites the
   column, so there is no history to surface.

## Goal

Add both event kinds to the Activity feed:

- Contact payments appear for the participant(s), in both directions ("You paid
  Bob" / "Carol paid you").
- Simplify-debts toggle changes are recorded going forward and shown to **all
  members** of the affected group ("Bob turned on simplify debts in Trip").

## Architecture

### 1. Contact payments — `contact-payment`

- **Query:** `useRecentContactPayments()` in `lib/queries/useContacts.ts`.
  Selects from `contact_payments` joined to payer/payee profiles, `order by
  created_at desc limit 50`. RLS (`Participants can view contact payments`)
  already restricts rows to ones where the caller is `user_lo`/`user_hi`, so no
  extra filter is needed.
- **Type:** `ActivityRecentContactPayment` (id, amount, currency, created_at,
  paid_by, paid_to, note, payer, payee).
- **Feed variant:** `{ kind: "contact-payment"; ts: created_at; contactPayment }`.
- **Card:** `ContactPaymentRow` in `ActivityFeedItem.tsx`, styled like the
  existing group `PaymentRow` (secondary-container, `cash-fast` icon), label
  "You paid Bob" / "Carol paid you", optional note, no group line.
- **Invalidation:** add the new query key to `invalidateContactPaymentQueries`
  so create/edit/delete refresh it.

### 2. Simplify-debts toggles — `simplify-debts`

- **Table:** `group_simplify_debts_events`
  - `id uuid pk default gen_random_uuid()`
  - `group_id uuid not null references groups(id) on delete cascade`
  - `actor_id uuid not null references profiles(id) on delete cascade`
  - `enabled boolean not null` (the new value)
  - `created_at timestamptz not null default now()`
  - index on `group_id`; RLS enabled.
- **RLS:** `SELECT` for `is_group_member(group_id, auth.uid())`. No client
  insert policy — rows are written only inside the RPC (SECURITY DEFINER,
  bypasses RLS).
- **RPC change:** `set_group_simplify_debts` reads the current value first and
  inserts one event row **only when the value actually changes**, recording
  `auth.uid()` as `actor_id` and the new value. Signature unchanged.
- **Query:** `useRecentGroupSettingChanges()` in `lib/queries/useGroups.ts`.
  Selects events joined to actor profile + group name, `order by created_at desc
  limit 50`. RLS scopes to the caller's groups.
- **Type:** `GroupSimplifyDebtsEvent` (id, group_id, actor_id, enabled,
  created_at, actor profile, group name).
- **Feed variant:** `{ kind: "simplify-debts"; ts: created_at; event }`.
- **Card:** `SimplifyDebtsRow`, `call-split` icon, label "You/<name> turned
  on/off simplify debts in <group>", no amount.
- **Invalidation:** `useSetGroupSimplifyDebts.onSuccess` invalidates the new
  query key.

## Data flow

`activity.tsx` fetches the two new hooks, maps them into `ActivityFeedItem`s,
merges them into the existing `feed` array, sorts by `ts` desc, and extends
`keyExtractor`. Loading state ORs in the two new `isLoading` flags; pull-to
-refresh awaits the two new `refetch`es.

## Schema / types

- Migration `…_activity_feed_events.sql`: create table + index + RLS + SELECT
  policy + standard grants; `create or replace` `set_group_simplify_debts`.
- Mirror into declarative schemas: table/index/RLS in `02_tables_core.sql`,
  policy in `05_policies.sql`, function in `04_functions.sql`.
- `lib/types.ts`: add `group_simplify_debts_events` table row/insert/update.

## Testing

Extend `tests/screens/activity.test.tsx`: mock the two new hooks in `beforeEach`,
add cases for a contact payment paid/received and a simplify-debts on/off event
(own actor → "You", other actor → name). Keep existing cases green.

## Decisions / non-goals

- Contact payments shown in both directions (card text distinguishes them).
- Simplify-debts events use a focused table, not a generic event log (YAGNI).
- Toggles logged from now on only; existing groups start with no history.
- No realtime subscription on the Activity screen — it relies on pull-to-refresh
  + query invalidation, matching today's behavior.
- No change to balances, simplification math, or the dashboard total.
