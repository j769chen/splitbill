-- Repair remote drift (same root cause as 20260624181600): later edits to
-- 20260624034715_add_currency_support never reached the remote DB. The remote
-- copies of set_contact_currency and set_group_currency are older bodies that
-- are MISSING the "cannot change currency after activity exists" guards, so the
-- live app could switch a contact/group currency after expenses or payments
-- exist and silently corrupt base_amount math. Re-apply the intended bodies.

CREATE OR REPLACE FUNCTION public.set_contact_currency(p_contact_user_id uuid, p_currency text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_lo uuid;
  v_hi uuid;
  v_currency text := upper(btrim(coalesce(p_currency, 'USD')));
  v_existing_currency text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_contact_user_id is null or p_contact_user_id = v_uid then
    raise exception 'Invalid contact';
  end if;

  if not exists (
    select 1 from public.contacts
    where owner_id = v_uid and contact_user_id = p_contact_user_id
  ) then
    raise exception 'You can only set the currency for accepted contacts';
  end if;

  if v_uid < p_contact_user_id then
    v_lo := v_uid;
    v_hi := p_contact_user_id;
  else
    v_lo := p_contact_user_id;
    v_hi := v_uid;
  end if;

  select currency into v_existing_currency
  from public.contact_pair_settings
  where user_lo = v_lo and user_hi = v_hi;

  if exists (
    select 1 from public.contact_expenses ce
    where ce.user_lo = v_lo and ce.user_hi = v_hi
  ) or exists (
    select 1 from public.contact_payments cp
    where cp.user_lo = v_lo and cp.user_hi = v_hi
  ) then
    if coalesce(v_existing_currency, 'USD') <> v_currency then
      raise exception 'Cannot change contact currency after activity exists';
    end if;
    return v_currency;
  end if;

  insert into public.contact_pair_settings (user_lo, user_hi, currency, updated_at)
  values (v_lo, v_hi, v_currency, now())
  on conflict (user_lo, user_hi)
  do update set currency = excluded.currency, updated_at = now();

  return v_currency;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_group_currency(p_group_id uuid, p_currency text)
 RETURNS groups
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_group public.groups;
  v_currency text := upper(btrim(coalesce(p_currency, 'USD')));
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_group_member(p_group_id, v_uid) then
    raise exception 'You are not a member of this group';
  end if;

  select * into v_group
  from public.groups
  where id = p_group_id;

  if exists (select 1 from public.expenses e where e.group_id = p_group_id)
    or exists (select 1 from public.payments p where p.group_id = p_group_id)
  then
    if v_group.currency <> v_currency then
      raise exception 'Cannot change group currency after activity exists';
    end if;
    return v_group;
  end if;

  update public.groups
  set currency = v_currency
  where id = p_group_id
  returning * into v_group;

  return v_group;
end;
$function$
;
