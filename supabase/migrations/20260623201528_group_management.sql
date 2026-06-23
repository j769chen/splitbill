set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.add_group_members(p_group_id uuid, p_member_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_member_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_group_member(p_group_id, v_uid) then
    raise exception 'You are not a member of this group';
  end if;

  foreach v_member_id in array coalesce(p_member_ids, '{}'::uuid[])
  loop
    if not exists (select 1 from public.profiles where id = v_member_id) then
      raise exception 'Member does not exist';
    end if;

    insert into public.group_members (group_id, user_id)
    values (p_group_id, v_member_id)
    on conflict (group_id, user_id) do nothing;
  end loop;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_group_pairwise_balances_for_me(p_group_id uuid)
 RETURNS TABLE(user_id uuid, full_name text, balance numeric)
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
  with members as (
    select gm.user_id as uid
    from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id <> v_uid
  ),
  expense_bal as (
    select
      (case when e.paid_by = v_uid then es.user_id else e.paid_by end) as uid,
      sum(case when e.paid_by = v_uid then es.amount else -es.amount end) as bal
    from public.expenses e
    join public.expense_splits es on es.expense_id = e.id
    where e.group_id = p_group_id
      and (
        (e.paid_by = v_uid and es.user_id <> v_uid)
        or (e.paid_by <> v_uid and es.user_id = v_uid)
      )
    group by 1
  ),
  payment_bal as (
    select
      (case when pmt.paid_by = v_uid then pmt.paid_to else pmt.paid_by end) as uid,
      sum(case when pmt.paid_by = v_uid then pmt.amount else -pmt.amount end) as bal
    from public.payments pmt
    where pmt.group_id = p_group_id
      and (pmt.paid_by = v_uid or pmt.paid_to = v_uid)
    group by 1
  ),
  per_member as (
    select c.uid, sum(c.bal) as bal
    from (
      select eb.uid, eb.bal from expense_bal eb
      union all
      select pb.uid, pb.bal from payment_bal pb
    ) c
    group by c.uid
  )
  select m.uid, p.full_name, coalesce(pm.bal, 0)::numeric(12, 2)
  from members m
  join public.profiles p on p.id = m.uid
  left join per_member pm on pm.uid = m.uid
  order by p.full_name;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rename_group(p_group_id uuid, p_name text)
 RETURNS public.groups
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

  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'Group name is required';
  end if;

  update public.groups
  set name = btrim(p_name)
  where id = p_group_id
  returning * into v_group;

  return v_group;
end;
$function$
;


