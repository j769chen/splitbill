-- Make debt simplification authoritative on every per-counterparty surface.
-- 1) get_group_simplified_edges: single deterministic simplification source.
-- 2) get_contact_group_breakdown: simplify-aware per shared group.
-- 3) get_contacts_with_combined_balances: include group-mates (Splitwise-style).

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
    where e.group_id in (select sg.gid from shared_groups sg where not simplify_debts)
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
    where pmt.group_id in (select sg.gid from shared_groups sg where not simplify_debts)
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
