# Simplify Debts Everywhere — Design

**Date:** 2026-06-24
**Status:** Approved (design); pending implementation plan

## Problem

`simplify_debts` is a per-group toggle, but simplification is applied
inconsistently across the app:

- **Group screens** (members card, per-member breakdown, Settle Up) show
  simplified edges when the toggle is ON.
- **Contact screens** (contact detail summary, per-group breakdown, Contacts
  list) always show **direct pairwise** balances and ignore the toggle.

Result: for the same pair in the same group, the group screen and the contact
screen can disagree once simplification reroutes a debt through a middleman.

Additionally, the simplification algorithm currently lives only in TypeScript
(`lib/utils.ts simplifyDebts`), while the contact surfaces are computed by
Postgres RPCs — so there is no single source of truth.

## Goal

Make simplified debts **authoritative everywhere** (Splitwise-style): when a
group has `simplify_debts` ON, every surface that shows a per-counterparty
balance for that group reflects the simplified edges — including the contact
detail page and the Contacts list, even for group-mates the user has never
directly transacted with and who may not be accepted contacts.

## Key invariant (bounds the blast radius)

For any member, the **sum of their simplified edges equals their net balance**
in the group. Therefore:

- Each member's **group net** is unchanged by simplification.
- The **dashboard total** (`get_user_total_balance`, composed of per-group nets +
  1-on-1 ledgers) is unchanged.
- Only the **per-counterparty split within a group** changes.

So the feature only needs to touch per-pair breakdowns: the group members card
and the contact-side per-group pieces. 1-on-1 ledgers are never simplified
(trivially, two parties), and contact settle-up (which only touches the 1-on-1
ledger) is unaffected. Group debts continue to be settled in the group screens.

## Architecture

### Single source of truth: `get_group_simplified_edges(p_group_id)`

New `SECURITY DEFINER` function returning `(from_user uuid, to_user uuid,
amount numeric(12,2))`.

- Source = `get_group_balances(p_group_id)` net per member (simplification-invariant).
- **Deterministic greedy:** debtors and creditors each sorted by
  `(abs(amount) DESC, user_id ASC)`; transfer `min(debtor, creditor)` per step;
  epsilon `0.005`; amounts rounded to 2 dp.
- Guarded by `is_group_member(p_group_id, auth.uid())`.

This becomes the **sole** simplification implementation. The TypeScript
`simplifyDebts` and its unit test are **removed**; the group screens consume the
RPC instead, eliminating client/server drift.

Determinism note: the minimal settlement plan is not unique. The deterministic
tie-break makes the chosen plan stable and reproducible across surfaces and
repeated calls. We accept that a per-pair "balance" derived from a plan is a
suggestion rather than a direct fact (this matches Splitwise behavior).

## Data flow changes

### `get_contact_group_breakdown(contact)` — per shared group
- If `group.simplify_debts` ON: balance = simplified edges between you and the
  contact from `get_group_simplified_edges(gid)` (`contact→you` adds,
  `you→contact` subtracts).
- If OFF: existing direct-pairwise logic (unchanged).
- Computed over **all** shared groups (a simplified edge can exist without direct
  activity); return only non-negligible rows (`abs > 0.005`).

This propagates automatically into:
- `get_contact_balance_contexts` → contact detail summary (`useContactBalance`).
- `get_contacts_with_combined_balances` → Contacts list combined balance.

No body changes needed in those two beyond the enumeration change below.

### `get_contacts_with_combined_balances()` — enumeration
Add a 4th source to `contact_ids`: group-mates from the caller's shared groups.
Final filter: **keep a person if they are an accepted contact (always, even at
$0) OR they have a non-negligible combined balance.**

Consequence (confirmed in design): this also surfaces non-contact group-mates
with any nonzero balance when simplify is OFF (direct group balance), not only
under simplification. This is the consistent "show everyone you have a balance
with" behavior.

### Group screens
`app/(tabs)/groups/[id].tsx` and `app/(tabs)/groups/settle-up.tsx` switch from
client `simplifyDebts(balances)` to `get_group_simplified_edges(groupId)`.

## Cross-cutting concerns

### Cache / realtime invalidation
- `set_group_simplify_debts` mutation must additionally invalidate: contact
  balance contexts, contact-group-breakdown, the Contacts list, and total
  balance (currently only invalidates group queries).
- Group expense / payment / member changes (`lib/realtime.ts` handlers +
  mutation `onSuccess` in `useExpenses`/`usePayments`/`useGroups`) must invalidate
  the Contacts list and contact balances, since group activity now changes who
  appears and their combined balances.

### Performance
Contacts list becomes ~O(contacts × shared-groups) simplification runs via the
lateral chain `get_contact_balance_contexts → get_contact_group_breakdown →
get_group_simplified_edges`. Acceptable at this app's scale. Future optimization
if needed: precompute each group's edges once and join, rather than per contact.

### Security
- `get_group_simplified_edges`: `SECURITY DEFINER`, `set search_path = public`,
  `is_group_member` guard. Add an `sql-security` assertion.
- `get_contact_group_breakdown` calls it only for shared groups (caller is a
  member), so the guard always passes.

### Testing
- SQL / integration: greedy determinism; the sum-of-edges = net invariant; the
  Bob→You middleman case; simplified vs direct contact breakdown; phantom
  enumeration in the Contacts list; dashboard total unchanged.
- Jest: update group detail (members card from server edges), settle-up, contact
  detail, and Contacts-list screen tests.

### Rollout
One migration that:
- creates `get_group_simplified_edges`,
- `CREATE OR REPLACE`s `get_contact_group_breakdown` and
  `get_contacts_with_combined_balances`.

Also update `supabase/schemas/04_functions.sql` and `lib/types.ts` (add the
`get_group_simplified_edges` type). Push to remote and verify with a curl probe
plus a `supabase db reset` schema diff (given prior migration-drift history).

## Edge cases & open items

- **Phantom debts to non-contacts:** intended — they appear in Contacts and on
  their detail page (viewing works via the read RPCs).
- **Non-contact actions (polish, not blocking):** the contact detail
  `DualActionBar` offers 1-on-1 "Add expense" / "Settle up", which are RLS-gated
  to accepted contacts. For non-contact group-mates these should be
  hidden/disabled. Flagged for the plan; can be a follow-up.
- **`get_contact_group_balance` (aggregate):** appears unused by current app code
  (only an archived migration and an `sql-security` test reference it). Out of
  scope here; flag for a separate dead-code cleanup.

## Non-goals

- No change to how net balances or the dashboard total are computed (invariant).
- No persistence/rewriting of underlying expenses (simplification stays a
  display transformation, now applied consistently).
- No change to 1-on-1 contact ledgers or contact settle-up semantics.
