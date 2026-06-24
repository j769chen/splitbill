# Simplify Debts Everywhere Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the per-group `simplify_debts` toggle authoritative on every per-counterparty surface (group members card, Settle Up, contact detail, Contacts list) via a single server-side simplification function.

**Architecture:** Add one deterministic Postgres function `get_group_simplified_edges(group_id)` as the sole simplification implementation. Rewrite `get_contact_group_breakdown` to use it (when a group's `simplify_debts` is ON) and expand `get_contacts_with_combined_balances` to include group-mates. Group screens swap their client-side `simplifyDebts` call for the new RPC, and the TypeScript `simplifyDebts` is deleted.

**Tech Stack:** Expo / React Native, React Query, Supabase (Postgres + PostgREST), Jest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-24-simplify-debts-everywhere-design.md`

**Testing note:** This repo has no live-DB test harness; SQL tests are static (regex over `supabase/schemas/*.sql` in `tests/sql-security.test.ts`). SQL *behavior* is verified by a documented manual `psql` step (Task 9). Client wiring/invalidation is covered by Jest with mocked Supabase.

---

## File Structure

- `supabase/schemas/04_functions.sql` — declarative source for: new `get_group_simplified_edges`; rewritten `get_contact_group_breakdown`; rewritten `get_contacts_with_combined_balances`.
- `supabase/migrations/20260624190000_simplify_debts_everywhere.sql` — new migration applying the three function changes to the DB.
- `lib/types.ts` — add `get_group_simplified_edges` to the generated `Functions` map.
- `lib/queries/useBalances.ts` — add `useGroupSimplifiedEdges` hook.
- `app/(tabs)/groups/[id].tsx` — consume simplified edges from the server; drop `simplifyDebts`.
- `app/(tabs)/groups/settle-up.tsx` — same swap.
- `lib/utils.ts` — delete `simplifyDebts`.
- `tests/debts.test.ts` — delete (tested the removed function).
- `lib/queries/useGroups.ts` — broaden `useSetGroupSimplifyDebts` invalidations.
- `lib/realtime.ts` — broaden the `group_members` handler invalidations.
- `tests/sql-security.test.ts` — add static assertions for the new/changed SQL.
- `tests/screens/group-detail.test.tsx`, `tests/screens/settle-up.test.tsx`, `tests/screens/contact-detail.test.tsx`, `tests/queries/useContacts.test.tsx` — update mocks/assertions.

---

## Task 1: Server function `get_group_simplified_edges`

**Files:**
- Modify: `supabase/schemas/04_functions.sql` (add new function after `get_group_pairwise_balances`, which ends ~line 1501)
- Create: `supabase/migrations/20260624190000_simplify_debts_everywhere.sql`
- Test: `tests/sql-security.test.ts`

- [ ] **Step 1: Write the failing static test**

Add inside the `describe("SQL security guards", …)` block in `tests/sql-security.test.ts`:

```typescript
  it("guards the simplified-edges RPC and uses a deterministic order", () => {
    const functions = readSchema("04_functions.sql");
    const body = functionBody(functions, "get_group_simplified_edges");

    expect(body).toMatch(/v_uid uuid := auth\.uid\(\)/i);
    expect(body).toMatch(/raise exception 'Not authenticated'/i);
    expect(body).toMatch(
      /IF NOT public\.is_group_member\(p_group_id,\s*v_uid\) THEN/i
    );
    // Deterministic greedy: debtors most-negative first, creditors most-positive
    // first, ties broken by user_id.
    expect(body).toMatch(/order by b\.balance asc, b\.user_id asc/i);
    expect(body).toMatch(/order by b\.balance desc, b\.user_id asc/i);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/sql-security.test.ts -t "deterministic order"`
Expected: FAIL with "Missing get_group_simplified_edges function definition".

- [ ] **Step 3: Add the function to the declarative schema**

Insert into `supabase/schemas/04_functions.sql` immediately after the `get_group_pairwise_balances` function (after its closing `$$;` ~line 1501):

```sql

-- Minimal settlement plan for a group: one directed debtor->creditor edge set
-- derived from each member's net balance (get_group_balances). Deterministic so
-- every surface (group screen, contact breakdown, contacts list) agrees: debtors
-- are matched most-negative-first, creditors most-positive-first, ties broken by
-- user_id. The sum of a member's edges always equals their net balance, so this
-- is display-only and never changes anyone's overall position.
create or replace function public.get_group_simplified_edges(p_group_id uuid)
returns table (
  from_user uuid,
  from_name text,
  to_user uuid,
  to_name text,
  amount numeric(12, 2)
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_debtors uuid[];
  v_debt_amt numeric[];
  v_creditors uuid[];
  v_cred_amt numeric[];
  i int := 1;
  j int := 1;
  v_transfer numeric;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_group_member(p_group_id, v_uid) then
    raise exception 'You are not a member of this group';
  end if;

  -- Debtors (negative net) ordered most-negative first, then user_id.
  select
    array_agg(b.user_id order by b.balance asc, b.user_id asc),
    array_agg((-b.balance) order by b.balance asc, b.user_id asc)
  into v_debtors, v_debt_amt
  from public.get_group_balances(p_group_id) b
  where b.balance < -0.005;

  -- Creditors (positive net) ordered most-positive first, then user_id.
  select
    array_agg(b.user_id order by b.balance desc, b.user_id asc),
    array_agg(b.balance order by b.balance desc, b.user_id asc)
  into v_creditors, v_cred_amt
  from public.get_group_balances(p_group_id) b
  where b.balance > 0.005;

  if v_debtors is null or v_creditors is null then
    return;
  end if;

  while i <= array_length(v_debtors, 1) and j <= array_length(v_creditors, 1) loop
    v_transfer := least(v_debt_amt[i], v_cred_amt[j]);

    if v_transfer > 0.005 then
      from_user := v_debtors[i];
      to_user := v_creditors[j];
      amount := round(v_transfer, 2);
      select p.full_name into from_name from public.profiles p where p.id = v_debtors[i];
      select p.full_name into to_name from public.profiles p where p.id = v_creditors[j];
      return next;
    end if;

    v_debt_amt[i] := v_debt_amt[i] - v_transfer;
    v_cred_amt[j] := v_cred_amt[j] - v_transfer;
    if v_debt_amt[i] <= 0.005 then i := i + 1; end if;
    if v_cred_amt[j] <= 0.005 then j := j + 1; end if;
  end loop;

  return;
end;
$$;
```

- [ ] **Step 4: Create the migration with the same definition**

Create `supabase/migrations/20260624190000_simplify_debts_everywhere.sql` and paste the SAME `create or replace function public.get_group_simplified_edges …$$;` block as in Step 3 (the migration will get two more functions appended in Tasks 2 and 3). Start the file with:

```sql
-- Make debt simplification authoritative on every per-counterparty surface.
-- 1) get_group_simplified_edges: single deterministic simplification source.
-- 2) get_contact_group_breakdown: simplify-aware per shared group.
-- 3) get_contacts_with_combined_balances: include group-mates (Splitwise-style).
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest tests/sql-security.test.ts -t "deterministic order"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/schemas/04_functions.sql supabase/migrations/20260624190000_simplify_debts_everywhere.sql tests/sql-security.test.ts
git commit -m "feat(db): add deterministic get_group_simplified_edges"
```

---

## Task 2: Make `get_contact_group_breakdown` simplify-aware

**Files:**
- Modify: `supabase/schemas/04_functions.sql:1563-1638` (replace `get_contact_group_breakdown` body)
- Modify: `supabase/migrations/20260624190000_simplify_debts_everywhere.sql` (append)
- Test: `tests/sql-security.test.ts`

- [ ] **Step 1: Write the failing static test**

Add to `tests/sql-security.test.ts`:

```typescript
  it("routes the contact group breakdown through simplified edges when enabled", () => {
    const functions = readSchema("04_functions.sql");
    const body = functionBody(functions, "get_contact_group_breakdown");

    // Still caller-scoped.
    expect(body).toMatch(/raise exception 'Not authenticated'/i);
    expect(body).toMatch(/where gm\.user_id = v_uid/i);
    // Uses the simplified edges for groups with the toggle ON.
    expect(body).toMatch(/get_group_simplified_edges\(sg\.gid\)/i);
    expect(body).toMatch(/where sg\.simplify_debts/i);
    // Keeps direct pairwise for groups with the toggle OFF.
    expect(body).toMatch(/where .*not simplify_debts/i);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/sql-security.test.ts -t "simplified edges when enabled"`
Expected: FAIL (no `get_group_simplified_edges(sg.gid)` in the current body).

- [ ] **Step 3: Replace the function body in the schema**

Replace the entire `create or replace function public.get_contact_group_breakdown …$$;` block (`supabase/schemas/04_functions.sql:1563-1638`) with:

```sql
create or replace function public.get_contact_group_breakdown(p_contact_user_id uuid)
returns table (
  group_id uuid,
  group_name text,
  balance numeric(12, 2),
  currency text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_contact_user_id is null or p_contact_user_id = v_uid then
    return;
  end if;

  return query
  with shared_groups as (
    select g.id as gid, g.name, g.currency, g.simplify_debts
    from public.groups g
    where g.id in (
      select gm.group_id from public.group_members gm where gm.user_id = v_uid
      intersect
      select gm.group_id from public.group_members gm where gm.user_id = p_contact_user_id
    )
  ),
  -- Direct pairwise (toggle OFF): only expenses/payments between the two of us.
  direct_expense as (
    select e.group_id as gid, sum(
      case
        when e.paid_by = v_uid and es.user_id = p_contact_user_id then es.base_amount
        when e.paid_by = p_contact_user_id and es.user_id = v_uid then -es.base_amount
        else 0
      end
    ) as bal
    from public.expenses e
    join public.expense_splits es on es.expense_id = e.id
    where e.group_id in (select sg.gid from shared_groups sg where not sg.simplify_debts)
      and (
        (e.paid_by = v_uid and es.user_id = p_contact_user_id)
        or (e.paid_by = p_contact_user_id and es.user_id = v_uid)
      )
    group by e.group_id
  ),
  direct_payment as (
    select pmt.group_id as gid, sum(
      case
        when pmt.paid_by = v_uid and pmt.paid_to = p_contact_user_id then pmt.base_amount
        when pmt.paid_by = p_contact_user_id and pmt.paid_to = v_uid then -pmt.base_amount
        else 0
      end
    ) as bal
    from public.payments pmt
    where pmt.group_id in (select sg.gid from shared_groups sg where not sg.simplify_debts)
      and (
        (pmt.paid_by = v_uid and pmt.paid_to = p_contact_user_id)
        or (pmt.paid_by = p_contact_user_id and pmt.paid_to = v_uid)
      )
    group by pmt.group_id
  ),
  -- Simplified edge (toggle ON): the you<->contact edge in the minimal plan.
  simplified as (
    select sg.gid, sum(
      case
        when e.from_user = p_contact_user_id and e.to_user = v_uid then e.amount
        when e.from_user = v_uid and e.to_user = p_contact_user_id then -e.amount
        else 0
      end
    ) as bal
    from shared_groups sg
    cross join lateral public.get_group_simplified_edges(sg.gid) e
    where sg.simplify_debts
    group by sg.gid
  ),
  per_group as (
    select de.gid, de.bal from direct_expense de
    union all
    select dp.gid, dp.bal from direct_payment dp
    union all
    select s.gid, s.bal from simplified s
  ),
  totals as (
    select pg.gid, sum(pg.bal) as bal from per_group pg group by pg.gid
  )
  select sg.gid, sg.name, round(coalesce(t.bal, 0), 2)::numeric(12, 2), sg.currency
  from shared_groups sg
  left join totals t on t.gid = sg.gid
  where abs(coalesce(t.bal, 0)) > 0.005
  order by sg.name;
end;
$$;
```

- [ ] **Step 4: Append the same definition to the migration**

Append the exact block from Step 3 to `supabase/migrations/20260624190000_simplify_debts_everywhere.sql`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest tests/sql-security.test.ts -t "simplified edges when enabled"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/schemas/04_functions.sql supabase/migrations/20260624190000_simplify_debts_everywhere.sql tests/sql-security.test.ts
git commit -m "feat(db): simplify-aware contact group breakdown"
```

---

## Task 3: Expand `get_contacts_with_combined_balances` enumeration

**Files:**
- Modify: `supabase/schemas/04_functions.sql:1508-1557` (replace function body)
- Modify: `supabase/migrations/20260624190000_simplify_debts_everywhere.sql` (append)
- Test: `tests/sql-security.test.ts`

- [ ] **Step 1: Write the failing static test**

Add to `tests/sql-security.test.ts`:

```typescript
  it("includes group-mates in the combined-balance list but keeps it caller-scoped", () => {
    const functions = readSchema("04_functions.sql");
    const body = functionBody(functions, "get_contacts_with_combined_balances");

    expect(body).toMatch(/raise exception 'Not authenticated'/i);
    expect(body).toMatch(/c\.owner_id = v_uid/i);
    // Group-mates are enumerated from the caller's shared groups.
    expect(body).toMatch(/join public\.group_members gm2/i);
    // Non-contacts only appear when they carry a real balance.
    expect(body).toMatch(/cr\.is_accepted or abs\(ctx\.balance\) > 0\.005/i);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/sql-security.test.ts -t "includes group-mates"`
Expected: FAIL (current body has no `gm2` join).

- [ ] **Step 3: Replace the function body in the schema**

Replace the entire `create or replace function public.get_contacts_with_combined_balances …$$;` block (`supabase/schemas/04_functions.sql:1508-1557`) with:

```sql
create or replace function public.get_contacts_with_combined_balances()
returns table (
  contact_user_id uuid,
  full_name text,
  avatar_url text,
  currency text,
  balance numeric(12, 2)
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  return query
  with accepted as (
    select c.contact_user_id as uid
    from public.contacts c
    where c.owner_id = v_uid
  ),
  contact_ids as (
    select uid from accepted
    union
    select case when ce.user_lo = v_uid then ce.user_hi else ce.user_lo end as uid
    from public.contact_expenses ce
    where ce.user_lo = v_uid or ce.user_hi = v_uid
    union
    select case when cp.user_lo = v_uid then cp.user_hi else cp.user_lo end as uid
    from public.contact_payments cp
    where cp.user_lo = v_uid or cp.user_hi = v_uid
    union
    -- Group-mates: anyone sharing a group with the caller (covers simplified
    -- "phantom" debts and direct group balances with non-contacts).
    select gm2.user_id as uid
    from public.group_members gm1
    join public.group_members gm2 on gm2.group_id = gm1.group_id
    where gm1.user_id = v_uid and gm2.user_id <> v_uid
  ),
  contacts_resolved as (
    select
      ci.uid,
      p.full_name,
      p.avatar_url,
      (ci.uid in (select a.uid from accepted a)) as is_accepted
    from contact_ids ci
    join public.profiles p on p.id = ci.uid
    where ci.uid <> v_uid
  )
  select
    cr.uid,
    cr.full_name,
    cr.avatar_url,
    ctx.currency,
    ctx.balance
  from contacts_resolved cr
  cross join lateral public.get_contact_balance_contexts(cr.uid) ctx
  where cr.is_accepted or abs(ctx.balance) > 0.005
  order by cr.full_name;
end;
$$;
```

- [ ] **Step 4: Append the same definition to the migration**

Append the exact block from Step 3 to `supabase/migrations/20260624190000_simplify_debts_everywhere.sql`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest tests/sql-security.test.ts -t "includes group-mates"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/schemas/04_functions.sql supabase/migrations/20260624190000_simplify_debts_everywhere.sql tests/sql-security.test.ts
git commit -m "feat(db): include group-mates in combined contacts list"
```

---

## Task 4: Add the RPC type to `lib/types.ts`

**Files:**
- Modify: `lib/types.ts` (near the `get_group_pairwise_balances` entry ~line 355)

- [ ] **Step 1: Add the type**

Immediately after the `get_group_pairwise_balances: { … };` block (ends ~line 364) insert:

```typescript
      get_group_simplified_edges: {
        Args: { p_group_id: string };
        Returns: {
          from_user: string;
          from_name: string;
          to_user: string;
          to_name: string;
          amount: number;
        }[];
      };
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no new errors (existing baseline only).

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "chore(types): add get_group_simplified_edges RPC type"
```

---

## Task 5: Client hook + swap group screens to server edges

**Files:**
- Modify: `lib/queries/useBalances.ts` (add hook after `useGroupPairwiseBalances`, ~line 50)
- Modify: `app/(tabs)/groups/[id].tsx:8-14,36-37,160-164`
- Modify: `app/(tabs)/groups/settle-up.tsx:27,39-43`

- [ ] **Step 1: Add `useGroupSimplifiedEdges`**

In `lib/queries/useBalances.ts`, after `useGroupPairwiseBalances` (line 50):

```typescript
// Minimal settlement plan for the group (server-side, deterministic). Used when
// a group has debt simplification ON, as the single source of truth shared with
// the contact surfaces.
export function useGroupSimplifiedEdges(groupId: string, enabled = true) {
  return useQuery({
    queryKey: ["group-simplified", groupId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_group_simplified_edges",
        { p_group_id: groupId }
      );

      if (error) throw error;
      return (data ?? []).map(
        (row): DebtEdge => ({
          from: row.from_user,
          from_name: row.from_name,
          to: row.to_user,
          to_name: row.to_name,
          amount: Number(row.amount),
        })
      );
    },
    enabled: !!groupId && enabled,
  });
}
```

- [ ] **Step 2: Swap `app/(tabs)/groups/[id].tsx`**

Update the balances import (lines 8-11) to add the new hook:

```typescript
import {
  useGroupBalances,
  useGroupPairwiseBalances,
  useGroupSimplifiedEdges,
} from "@/lib/queries/useBalances";
```

Change the utils import (line 14) to drop `simplifyDebts`:

```typescript
import { getErrorMessage } from "@/lib/utils";
```

Replace the `rawDebts` hook (lines 36-37) with both edge sources:

```typescript
  const { data: rawDebts, refetch: refetchRawDebts } =
    useGroupPairwiseBalances(id!, !simplify);
  const { data: simplifiedDebts, refetch: refetchSimplifiedDebts } =
    useGroupSimplifiedEdges(id!, simplify);
```

Replace the `debts` derivation (lines 160-164) with:

```typescript
  const debts = simplify ? (simplifiedDebts ?? []) : (rawDebts ?? []);
```

Then add `refetchSimplifiedDebts` next to `refetchRawDebts` inside the `onRefresh` `Promise.all([...])` (search for `refetchRawDebts()` and add `refetchSimplifiedDebts()` alongside it).

- [ ] **Step 3: Swap `app/(tabs)/groups/settle-up.tsx`**

Update the imports block (lines 1-12 region) so balances come with the new hook. Replace the existing `useGroupBalances`/`useGroupPairwiseBalances` import with:

```typescript
import {
  useGroupPairwiseBalances,
  useGroupSimplifiedEdges,
} from "@/lib/queries/useBalances";
```

Change the utils import to drop `simplifyDebts`:

```typescript
import { getErrorMessage } from "@/lib/utils";
```

Replace `const { data: balances } = useGroupBalances(groupId!);` (line 27) and the raw-debts line (line 31) with:

```typescript
  const { data: rawDebts } = useGroupPairwiseBalances(groupId!, !simplify);
  const { data: simplifiedDebts } = useGroupSimplifiedEdges(groupId!, simplify);
```

(Keep the `useGroup` line that defines `group`/`simplify`.)

Replace the `debts` derivation (lines 39-43) with:

```typescript
  const debts = simplify ? (simplifiedDebts ?? []) : (rawDebts ?? []);
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. (`simplifyDebts` is still exported from `lib/utils.ts` until Task 6, so no missing-symbol errors yet.)

- [ ] **Step 5: Commit**

```bash
git add lib/queries/useBalances.ts "app/(tabs)/groups/[id].tsx" "app/(tabs)/groups/settle-up.tsx"
git commit -m "feat: consume server simplified edges in group screens"
```

---

## Task 6: Remove the client `simplifyDebts`

**Files:**
- Modify: `lib/utils.ts:40-78` (delete `simplifyDebts`)
- Delete: `tests/debts.test.ts`

- [ ] **Step 1: Delete the test file**

```bash
git rm tests/debts.test.ts
```

- [ ] **Step 2: Delete the function**

Remove the entire `export function simplifyDebts(balances: GroupBalance[]): DebtEdge[] { … }` block (`lib/utils.ts:40-78`). If `GroupBalance` and `DebtEdge` become unused in `lib/utils.ts`, update the import on line 7 to keep only the types still referenced (`SplitType` stays; check whether `DebtEdge`/`GroupBalance` are used elsewhere in the file before removing them from the import).

- [ ] **Step 3: Verify nothing else imports it**

Run: `npx tsc --noEmit`
Expected: no errors. If a `simplifyDebts` import error appears anywhere, that file was missed in Task 5 — fix it to use the hook.

- [ ] **Step 4: Run the full suite**

Run: `npx jest`
Expected: all suites pass (group-detail/settle-up suites are updated in Task 8; if they fail here it's because they still mock `simplifyDebts`/`useGroupBalances` — proceed to Task 8 and re-run).

- [ ] **Step 5: Commit**

```bash
git add lib/utils.ts tests/debts.test.ts
git commit -m "refactor: remove client-side simplifyDebts (server is source of truth)"
```

---

## Task 7: Broaden cache invalidation

**Files:**
- Modify: `lib/queries/useGroups.ts:257-263`
- Modify: `lib/realtime.ts:128-143` (the `group_members` handler) and the three group handlers' `group-simplified` key

- [ ] **Step 1: Update the simplify-toggle mutation**

Replace the `onSuccess` of `useSetGroupSimplifyDebts` (`lib/queries/useGroups.ts:257-263`) with:

```typescript
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["group", variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({
        queryKey: ["group-pairwise-all", variables.groupId],
      });
      queryClient.invalidateQueries({
        queryKey: ["group-simplified", variables.groupId],
      });
      // Simplification now drives the contact surfaces too.
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact-balance"] });
      queryClient.invalidateQueries({ queryKey: ["contact-group-breakdown"] });
      queryClient.invalidateQueries({ queryKey: ["total-balance"] });
    },
```

- [ ] **Step 2: Update the realtime handlers**

In `lib/realtime.ts`, add a `group-simplified` invalidation next to each existing `group-pairwise-all` invalidation (the `expenses`, `expense_splits`, and `payments` handlers). For each, after the existing:

```typescript
          queryClient.invalidateQueries({
            queryKey: ["group-pairwise-all", groupId],
          });
```

add:

```typescript
          queryClient.invalidateQueries({
            queryKey: ["group-simplified", groupId],
          });
```

Then update the `group_members` handler (lines 136-142) so member changes refresh balances and contact surfaces (a new member reshapes the simplified plan and the contacts list):

```typescript
        () => {
          queryClient.invalidateQueries({ queryKey: ["group", groupId] });
          queryClient.invalidateQueries({ queryKey: ["groups"] });
          queryClient.invalidateQueries({ queryKey: ["balances", groupId] });
          queryClient.invalidateQueries({
            queryKey: ["group-pairwise-all", groupId],
          });
          queryClient.invalidateQueries({
            queryKey: ["group-simplified", groupId],
          });
          queryClient.invalidateQueries({ queryKey: ["total-balance"] });
          invalidateContactQueries(queryClient);
        }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add lib/queries/useGroups.ts lib/realtime.ts
git commit -m "feat: invalidate contact + simplified caches on simplify/member changes"
```

---

## Task 8: Update Jest screen/query tests

**Files:**
- Modify: `tests/screens/group-detail.test.tsx`
- Modify: `tests/screens/settle-up.test.tsx`
- Modify: `tests/queries/useContacts.test.tsx`
- Modify: `tests/screens/contact-detail.test.tsx`

> These tests mock `@/lib/queries/useBalances`. Wherever they previously made the simplified case work by mocking `useGroupBalances` (which fed the removed `simplifyDebts`), they must now mock `useGroupSimplifiedEdges` to return `DebtEdge[]` directly.

- [ ] **Step 1: Update `group-detail.test.tsx`**

In the `jest.mock("@/lib/queries/useBalances", …)` factory, add a mock for the new hook alongside the existing ones:

```typescript
  useGroupSimplifiedEdges: jest.fn(),
```

In the test setup, import it and give it a default return. Where the "simplified" / "middleman" tests previously seeded `balances` to be simplified by `simplifyDebts`, instead return the edges directly, e.g.:

```typescript
  (useGroupSimplifiedEdges as jest.Mock).mockReturnValue({
    data: [
      { from: "vivian", from_name: "Vivian", to: "me", to_name: "Me", amount: 5 },
    ],
    refetch: jest.fn(),
  });
```

Keep `useGroupBalances` mocked (still used for `myBalance` and the net roster) and `useGroupPairwiseBalances` mocked (used when `simplify` is OFF). Ensure every render path returns an object with `data` and `refetch`.

- [ ] **Step 2: Run group-detail test**

Run: `npx jest tests/screens/group-detail.test.tsx`
Expected: PASS. Fix any assertions that referenced the old `simplifyDebts`-derived numbers so they match the directly-mocked edges.

- [ ] **Step 3: Update `settle-up.test.tsx`**

Add `useGroupSimplifiedEdges: jest.fn()` to the `useBalances` mock factory and set its return value in setup (simplified path). The screen no longer calls `useGroupBalances`, so remove or ignore that mock. Run:

Run: `npx jest tests/screens/settle-up.test.tsx`
Expected: PASS.

- [ ] **Step 4: Update `useContacts.test.tsx`**

The `get_contacts_with_combined_balances` RPC is mocked at the Supabase layer, so its return shape is unchanged (`contact_user_id, full_name, avatar_url, currency, balance`). Add/adjust a case asserting a non-contact group-mate row (one returned by the mocked RPC) renders in the list. Run:

Run: `npx jest tests/queries/useContacts.test.tsx`
Expected: PASS.

- [ ] **Step 5: Update `contact-detail.test.tsx`**

`useContactGroupBreakdown` and `useContactBalance` are mocked at the hook/RPC layer; shapes are unchanged. Confirm the existing breakdown rendering test still passes; add a comment that values now reflect simplification server-side. Run:

Run: `npx jest tests/screens/contact-detail.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run the full suite + typecheck**

Run: `npx jest && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add tests/
git commit -m "test: cover server-driven simplified edges and expanded contacts list"
```

---

## Task 9: Manual DB behavior verification

**Files:** none (verification only)

- [ ] **Step 1: Reset the local DB with the new migration**

Run: `supabase db reset`
Expected: all migrations apply cleanly, including `20260624190000_simplify_debts_everywhere.sql`.

- [ ] **Step 2: Seed the middleman scenario and check edges**

Open `psql` against the local DB (`supabase status` shows the DB URL; e.g. `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres"`). Create three profiles + a group where net balances are You +10, Alice 0, Bob -10 (You paid $10 for Alice; Alice paid $10 for Bob), then:

```sql
select from_name, to_name, amount
from public.get_group_simplified_edges('<group_id>');
```

Expected: exactly one row — `Bob | You | 10.00` (the middleman Alice drops out).

- [ ] **Step 3: Verify the invariant and determinism**

```sql
-- Sum of a member's edges equals their net.
select user_id, balance from public.get_group_balances('<group_id>') order by user_id;
-- Running the function twice returns identical ordering/amounts.
select * from public.get_group_simplified_edges('<group_id>');
select * from public.get_group_simplified_edges('<group_id>');
```

Expected: per-member edge sums match `get_group_balances`; both calls return identical rows in the same order.

- [ ] **Step 4: Verify contact breakdown + phantom enumeration**

As Bob (set the JWT/role per the local-dev pattern, or call via the app), confirm `get_contact_group_breakdown` shows the simplified `+10` toward You for the group, and that You's `get_contacts_with_combined_balances` includes Bob even if Bob is not an accepted contact.

- [ ] **Step 5: Push to remote and confirm no drift**

Run: `supabase db push`
Then probe the new RPC exists (replace URL/key from `.env`):

```bash
curl -s -X POST "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/rpc/get_group_simplified_edges" \
  -H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $EXPO_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_group_id":"00000000-0000-0000-0000-000000000000"}'
```

Expected: a 401/permission or empty result (NOT a `PGRST202` "function not found"), confirming the signature landed on remote.

---

## Task 10: Final verification

**Files:** none

- [ ] **Step 1: Full test + typecheck**

Run: `npx jest && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 2: Schema/remote diff**

Confirm `supabase/schemas/04_functions.sql` matches what was pushed (use the project's existing `db reset` + dump/diff approach used in prior drift fixes). Expected: no diff for the three changed functions.

- [ ] **Step 3: Manual smoke in the app**

Toggle simplify ON in a group with a middleman; confirm the members card, Settle Up, the middleman's contact page, and the Contacts list all agree (middleman shows settled; the rerouted debtor shows the simplified amount). Toggle OFF; confirm everything reverts to direct pairwise.

---

## Follow-up (out of scope, flagged in spec)

- Hide/disable the 1-on-1 "Add expense" / "Settle up" actions on the contact detail screen for **non-contact** group-mates (RLS-gated). Track separately.
- Remove the now-unused `get_contact_group_balance` aggregate function (dead code). Track separately.

---

## Self-Review

- **Spec coverage:** algorithm + single source (Task 1); contact breakdown simplify-aware (Task 2); contacts-list enumeration (Task 3); types (Task 4); group screens consume server edges + remove `simplifyDebts` (Tasks 5-6); invalidation for toggle/expense/payment/member (Task 7); tests (Tasks 8-9); rollout/drift check (Tasks 9-10). Dashboard-total-invariant requires no change (noted). Non-contact action gating + `get_contact_group_balance` cleanup explicitly deferred.
- **Type consistency:** hook returns `DebtEdge` (`from/from_name/to/to_name/amount`); RPC returns `from_user/from_name/to_user/to_name/amount`; mapping matches `useGroupPairwiseBalances`. Query keys: `group-simplified` used consistently in the hook, the toggle mutation, and realtime.
- **No placeholders:** every code step includes full code; SQL behavior verified via concrete psql/curl commands with expected output.
