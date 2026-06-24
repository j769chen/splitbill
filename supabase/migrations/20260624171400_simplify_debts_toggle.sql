-- Per-group "simplify debts" toggle.
--
-- Adds groups.simplify_debts (default true, preserving today's always-simplified
-- behavior), a setter RPC, and an all-pairs pairwise balance RPC used when a
-- group has simplification turned OFF.

alter table "public"."groups"
  add column "simplify_debts" boolean not null default true;

CREATE OR REPLACE FUNCTION public.set_group_simplify_debts(p_group_id uuid, p_enabled boolean)
 RETURNS groups
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_group public.groups;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_group_member(p_group_id, v_uid) then
    raise exception 'You are not a member of this group';
  end if;

  update public.groups
  set simplify_debts = coalesce(p_enabled, true)
  where id = p_group_id
  returning * into v_group;

  return v_group;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_group_pairwise_balances(p_group_id uuid)
 RETURNS TABLE(from_user uuid, from_name text, to_user uuid, to_name text, amount numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_group_member(p_group_id, v_uid) then
    raise exception 'You are not a member of this group';
  end if;

  return query
  with raw_debts as (
    -- Expense: the member with a split (dr) owes the payer (cr).
    select es.user_id as dr, e.paid_by as cr, es.base_amount as amt
    from public.expenses e
    join public.expense_splits es on es.expense_id = e.id
    where e.group_id = p_group_id and es.user_id <> e.paid_by
    union all
    -- Settle-up payment from paid_by to paid_to reduces paid_by's debt, i.e.
    -- it is equivalent to paid_to owing paid_by the paid amount.
    select pmt.paid_to as dr, pmt.paid_by as cr, pmt.base_amount as amt
    from public.payments pmt
    where pmt.group_id = p_group_id
  ),
  pair_net as (
    select
      least(rd.dr, rd.cr) as u_lo,
      greatest(rd.dr, rd.cr) as u_hi,
      -- Positive net means u_lo owes u_hi.
      sum(case when rd.dr < rd.cr then rd.amt else -rd.amt end) as net_lo
    from raw_debts rd
    group by 1, 2
  ),
  edges as (
    select
      case when pn.net_lo > 0 then pn.u_lo else pn.u_hi end as from_user,
      case when pn.net_lo > 0 then pn.u_hi else pn.u_lo end as to_user,
      round(abs(pn.net_lo), 2)::numeric(12, 2) as amount
    from pair_net pn
    where abs(pn.net_lo) > 0.005
  )
  select ed.from_user, pf.full_name, ed.to_user, pt.full_name, ed.amount
  from edges ed
  join public.profiles pf on pf.id = ed.from_user
  join public.profiles pt on pt.id = ed.to_user
  order by pf.full_name, pt.full_name;
end;
$function$
;
