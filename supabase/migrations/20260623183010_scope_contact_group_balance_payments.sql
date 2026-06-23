set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_contact_group_balance(p_contact_user_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_expense_balance numeric(12, 2);
  v_payment_balance numeric(12, 2);
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_contact_user_id is null or p_contact_user_id = v_uid then
    return 0;
  end if;

  select coalesce(sum(
    case
      when e.paid_by = v_uid and es.user_id = p_contact_user_id then es.amount
      when e.paid_by = p_contact_user_id and es.user_id = v_uid then -es.amount
      else 0
    end
  ), 0)
  into v_expense_balance
  from public.expenses e
  join public.expense_splits es on es.expense_id = e.id
  where e.group_id in (
    select gm.group_id from public.group_members gm where gm.user_id = v_uid
    intersect
    select gm.group_id from public.group_members gm where gm.user_id = p_contact_user_id
  )
  and (
    (e.paid_by = v_uid and es.user_id = p_contact_user_id)
    or (e.paid_by = p_contact_user_id and es.user_id = v_uid)
  );

  select coalesce(sum(
    case
      when pmt.paid_by = v_uid and pmt.paid_to = p_contact_user_id then pmt.amount
      when pmt.paid_by = p_contact_user_id and pmt.paid_to = v_uid then -pmt.amount
      else 0
    end
  ), 0)
  into v_payment_balance
  from public.payments pmt
  where pmt.group_id in (
    select gm.group_id from public.group_members gm where gm.user_id = v_uid
    intersect
    select gm.group_id from public.group_members gm where gm.user_id = p_contact_user_id
  )
  and (
    (pmt.paid_by = v_uid and pmt.paid_to = p_contact_user_id)
    or (pmt.paid_by = p_contact_user_id and pmt.paid_to = v_uid)
  );

  return coalesce(v_expense_balance, 0) + coalesce(v_payment_balance, 0);
end;
$function$
;


