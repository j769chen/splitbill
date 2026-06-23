set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_contact_group_breakdown(p_contact_user_id uuid)
 RETURNS TABLE(group_id uuid, group_name text, balance numeric)
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

  if p_contact_user_id is null or p_contact_user_id = v_uid then
    return;
  end if;

  return query
  with shared_groups as (
    select gm.group_id from public.group_members gm where gm.user_id = v_uid
    intersect
    select gm.group_id from public.group_members gm where gm.user_id = p_contact_user_id
  ),
  expense_bal as (
    select e.group_id as gid, sum(
      case
        when e.paid_by = v_uid and es.user_id = p_contact_user_id then es.amount
        when e.paid_by = p_contact_user_id and es.user_id = v_uid then -es.amount
        else 0
      end
    ) as bal
    from public.expenses e
    join public.expense_splits es on es.expense_id = e.id
    where e.group_id in (select group_id from shared_groups)
      and (
        (e.paid_by = v_uid and es.user_id = p_contact_user_id)
        or (e.paid_by = p_contact_user_id and es.user_id = v_uid)
      )
    group by e.group_id
  ),
  payment_bal as (
    select pmt.group_id as gid, sum(
      case
        when pmt.paid_by = v_uid and pmt.paid_to = p_contact_user_id then pmt.amount
        when pmt.paid_by = p_contact_user_id and pmt.paid_to = v_uid then -pmt.amount
        else 0
      end
    ) as bal
    from public.payments pmt
    where pmt.group_id in (select group_id from shared_groups)
      and (
        (pmt.paid_by = v_uid and pmt.paid_to = p_contact_user_id)
        or (pmt.paid_by = p_contact_user_id and pmt.paid_to = v_uid)
      )
    group by pmt.group_id
  ),
  combined as (
    select gid, bal from expense_bal
    union all
    select gid, bal from payment_bal
  ),
  per_group as (
    select c.gid, sum(c.bal) as balance
    from combined c
    group by c.gid
  )
  select pg.gid, g.name, pg.balance
  from per_group pg
  join public.groups g on g.id = pg.gid
  order by g.name;
end;
$function$
;


