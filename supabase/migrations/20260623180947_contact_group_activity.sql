set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_contact_combined_balance(p_contact_user_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return public.get_contact_balance(p_contact_user_id)
       + public.get_contact_group_balance(p_contact_user_id);
end;
$function$
;

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
  where (pmt.paid_by = v_uid and pmt.paid_to = p_contact_user_id)
     or (pmt.paid_by = p_contact_user_id and pmt.paid_to = v_uid);

  return coalesce(v_expense_balance, 0) + coalesce(v_payment_balance, 0);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_contacts_with_combined_balances()
 RETURNS TABLE(contact_user_id uuid, full_name text, avatar_url text, balance numeric)
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
  with contact_ids as (
    select c.contact_user_id as uid
    from public.contacts c
    where c.owner_id = v_uid
    union
    select case when ce.user_lo = v_uid then ce.user_hi else ce.user_lo end as uid
    from public.contact_expenses ce
    where ce.user_lo = v_uid or ce.user_hi = v_uid
  )
  select
    ci.uid,
    p.full_name,
    p.avatar_url,
    public.get_contact_combined_balance(ci.uid) as balance
  from contact_ids ci
  join public.profiles p on p.id = ci.uid
  where ci.uid <> v_uid
  order by p.full_name;
end;
$function$
;


