set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.leave_group(p_group_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_other_count int;
  v_created_by uuid;
  v_new_owner uuid;
  v_balance numeric(12, 2);
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = v_uid
  ) then
    raise exception 'You are not a member of this group';
  end if;

  select count(*) into v_other_count
  from public.group_members
  where group_id = p_group_id and user_id <> v_uid;

  if v_other_count = 0 then
    delete from public.groups where id = p_group_id;
    return;
  end if;

  -- While other members remain, an outstanding balance must be settled first.
  -- Enforced here as well as in the UI: the client guard reads a balance query
  -- that may not have resolved yet, and leaving with debts drops the caller's
  -- splits out of get_group_balances, silently moving everyone else's numbers.
  select balance into v_balance
  from public.get_group_balances(p_group_id)
  where user_id = v_uid;

  if abs(coalesce(v_balance, 0)) >= 0.01 then
    raise exception 'Settle your outstanding balance before leaving this group';
  end if;

  select created_by into v_created_by from public.groups where id = p_group_id;

  if v_created_by = v_uid then
    select user_id into v_new_owner
    from public.group_members
    where group_id = p_group_id and user_id <> v_uid
    order by joined_at asc
    limit 1;

    update public.groups set created_by = v_new_owner where id = p_group_id;
  end if;

  delete from public.group_members
  where group_id = p_group_id and user_id = v_uid;
end;
$function$
;


