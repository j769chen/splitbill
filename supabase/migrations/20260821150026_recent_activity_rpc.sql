set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_recent_activity(p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, description text, amount numeric, currency text, date timestamp with time zone, paid_by uuid, group_id uuid, payer jsonb, groups jsonb, expense_splits jsonb)
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

  return query
  select
    e.id,
    e.description,
    e.amount,
    e.currency,
    e.date,
    e.paid_by,
    e.group_id,
    to_jsonb(pr.*) as payer,
    jsonb_build_object('name', g.name) as groups,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('user_id', es.user_id, 'amount', es.amount)
        )
        from public.expense_splits es
        where es.expense_id = e.id
      ),
      '[]'::jsonb
    ) as expense_splits
  from public.expenses e
  join public.groups g on g.id = e.group_id
  join public.profiles pr on pr.id = e.paid_by
  where public.is_group_member(e.group_id, v_uid)
    and (
      e.paid_by = v_uid
      or exists (
        select 1 from public.expense_splits es
        where es.expense_id = e.id
          and es.user_id = v_uid
          and es.amount > 0
      )
    )
  order by e.date desc
  limit greatest(coalesce(p_limit, 50), 1);
end;
$function$
;


