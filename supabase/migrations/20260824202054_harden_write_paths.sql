-- Hardening pass: every client write now goes through a SECURITY DEFINER RPC.
--
-- The revoke below is hand-added. `supabase db diff` compares against a local
-- shadow database that never had the legacy INSERT/UPDATE/DELETE grants, so it
-- cannot see that the remote project still carries them from Supabase's default
-- privileges (the baseline migration granted nothing explicitly). Without it the
-- remote would keep the direct-write privileges even though the policies backing
-- them are gone.
revoke insert, update, delete, truncate, references, trigger on all tables
  in schema public from anon, authenticated;

drop policy "Participants can create contact expense splits" on "public"."contact_expense_splits";

drop policy "Participants can delete contact expense splits" on "public"."contact_expense_splits";

drop policy "Payer can update contact expense splits" on "public"."contact_expense_splits";

drop policy "Participants can create contact expenses" on "public"."contact_expenses";

drop policy "Participants can delete contact expenses" on "public"."contact_expenses";

drop policy "Payer can update contact expenses" on "public"."contact_expenses";

drop policy "Participants can create contact payments" on "public"."contact_payments";

drop policy "Participants can delete contact payments" on "public"."contact_payments";

drop policy "Participants can update contact payments" on "public"."contact_payments";

drop policy "Users can add their contacts" on "public"."contacts";

drop policy "Users can remove their contacts" on "public"."contacts";

drop policy "Expense payer can update splits" on "public"."expense_splits";

drop policy "Members can create expense splits" on "public"."expense_splits";

drop policy "Members can delete expense splits" on "public"."expense_splits";

drop policy "Expense creator can update" on "public"."expenses";

drop policy "Members can create expenses" on "public"."expenses";

drop policy "Members can delete expenses" on "public"."expenses";

drop policy "Group members can add new members" on "public"."group_members";

drop policy "Members can leave group" on "public"."group_members";

drop policy "Authenticated users can create groups" on "public"."groups";

drop policy "Group creator can delete group" on "public"."groups";

drop policy "Group creator can update group" on "public"."groups";

drop policy "Members can create payments" on "public"."payments";

drop policy "Members can delete payments" on "public"."payments";

drop policy "Members can update payments" on "public"."payments";

drop policy "Users can update own profile" on "public"."profiles";

drop policy "Users can view any profile" on "public"."profiles";

revoke references on table "public"."contact_expense_splits" from "anon";

revoke trigger on table "public"."contact_expense_splits" from "anon";

revoke truncate on table "public"."contact_expense_splits" from "anon";

revoke references on table "public"."contact_expense_splits" from "authenticated";

revoke trigger on table "public"."contact_expense_splits" from "authenticated";

revoke truncate on table "public"."contact_expense_splits" from "authenticated";

revoke references on table "public"."contact_expenses" from "anon";

revoke trigger on table "public"."contact_expenses" from "anon";

revoke truncate on table "public"."contact_expenses" from "anon";

revoke references on table "public"."contact_expenses" from "authenticated";

revoke trigger on table "public"."contact_expenses" from "authenticated";

revoke truncate on table "public"."contact_expenses" from "authenticated";

revoke references on table "public"."contact_pair_settings" from "anon";

revoke trigger on table "public"."contact_pair_settings" from "anon";

revoke truncate on table "public"."contact_pair_settings" from "anon";

revoke references on table "public"."contact_pair_settings" from "authenticated";

revoke trigger on table "public"."contact_pair_settings" from "authenticated";

revoke truncate on table "public"."contact_pair_settings" from "authenticated";

revoke references on table "public"."contact_payments" from "anon";

revoke trigger on table "public"."contact_payments" from "anon";

revoke truncate on table "public"."contact_payments" from "anon";

revoke references on table "public"."contact_payments" from "authenticated";

revoke trigger on table "public"."contact_payments" from "authenticated";

revoke truncate on table "public"."contact_payments" from "authenticated";

revoke references on table "public"."contact_requests" from "anon";

revoke trigger on table "public"."contact_requests" from "anon";

revoke truncate on table "public"."contact_requests" from "anon";

revoke references on table "public"."contact_requests" from "authenticated";

revoke trigger on table "public"."contact_requests" from "authenticated";

revoke truncate on table "public"."contact_requests" from "authenticated";

revoke references on table "public"."contacts" from "anon";

revoke trigger on table "public"."contacts" from "anon";

revoke truncate on table "public"."contacts" from "anon";

revoke references on table "public"."contacts" from "authenticated";

revoke trigger on table "public"."contacts" from "authenticated";

revoke truncate on table "public"."contacts" from "authenticated";

revoke references on table "public"."expense_splits" from "anon";

revoke trigger on table "public"."expense_splits" from "anon";

revoke truncate on table "public"."expense_splits" from "anon";

revoke references on table "public"."expense_splits" from "authenticated";

revoke trigger on table "public"."expense_splits" from "authenticated";

revoke truncate on table "public"."expense_splits" from "authenticated";

revoke references on table "public"."expenses" from "anon";

revoke trigger on table "public"."expenses" from "anon";

revoke truncate on table "public"."expenses" from "anon";

revoke references on table "public"."expenses" from "authenticated";

revoke trigger on table "public"."expenses" from "authenticated";

revoke truncate on table "public"."expenses" from "authenticated";

revoke references on table "public"."group_members" from "anon";

revoke trigger on table "public"."group_members" from "anon";

revoke truncate on table "public"."group_members" from "anon";

revoke references on table "public"."group_members" from "authenticated";

revoke trigger on table "public"."group_members" from "authenticated";

revoke truncate on table "public"."group_members" from "authenticated";

revoke references on table "public"."group_simplify_debts_events" from "anon";

revoke trigger on table "public"."group_simplify_debts_events" from "anon";

revoke truncate on table "public"."group_simplify_debts_events" from "anon";

revoke references on table "public"."group_simplify_debts_events" from "authenticated";

revoke trigger on table "public"."group_simplify_debts_events" from "authenticated";

revoke truncate on table "public"."group_simplify_debts_events" from "authenticated";

revoke references on table "public"."groups" from "anon";

revoke trigger on table "public"."groups" from "anon";

revoke truncate on table "public"."groups" from "anon";

revoke references on table "public"."groups" from "authenticated";

revoke trigger on table "public"."groups" from "authenticated";

revoke truncate on table "public"."groups" from "authenticated";

revoke references on table "public"."payments" from "anon";

revoke trigger on table "public"."payments" from "anon";

revoke truncate on table "public"."payments" from "anon";

revoke references on table "public"."payments" from "authenticated";

revoke trigger on table "public"."payments" from "authenticated";

revoke truncate on table "public"."payments" from "authenticated";

revoke references on table "public"."profiles" from "anon";

revoke trigger on table "public"."profiles" from "anon";

revoke truncate on table "public"."profiles" from "anon";

revoke references on table "public"."profiles" from "authenticated";

revoke trigger on table "public"."profiles" from "authenticated";

revoke truncate on table "public"."profiles" from "authenticated";

drop function if exists "public"."add_group_members"(p_group_id uuid, p_member_ids uuid[]);

drop function if exists "public"."create_group_with_members"(p_name text, p_member_ids uuid[], p_currency text);

drop function if exists "public"."get_user_ids_by_email"(emails text[]);

drop function if exists "public"."send_contact_request"(p_recipient_user_id uuid);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.add_group_members(p_group_id uuid, p_member_emails text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_emails text[];
  v_missing text[];
  v_existing text[];
  v_member_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_group_member(p_group_id, v_uid) then
    raise exception 'You are not a member of this group';
  end if;

  v_emails := public.normalize_invite_emails(p_member_emails);

  if coalesce(array_length(v_emails, 1), 0) = 0 then
    raise exception 'Add at least one other person''s email';
  end if;

  if array_length(v_emails, 1) > 20 then
    raise exception 'Too many emails requested';
  end if;

  select coalesce(array_agg(e), '{}'::text[])
  into v_missing
  from unnest(v_emails) as e
  where not exists (
    select 1
    from auth.users au
    join public.profiles p on p.id = au.id
    where lower(au.email) = e
  );

  if coalesce(array_length(v_missing, 1), 0) > 0 then
    raise exception 'No SplitBill account found for: %',
      array_to_string(v_missing, ', ');
  end if;

  select coalesce(array_agg(e), '{}'::text[])
  into v_existing
  from unnest(v_emails) as e
  where exists (
    select 1
    from auth.users au
    join public.group_members gm on gm.user_id = au.id
    where lower(au.email) = e and gm.group_id = p_group_id
  );

  if coalesce(array_length(v_existing, 1), 0) > 0 then
    raise exception 'Already in this group: %',
      array_to_string(v_existing, ', ');
  end if;

  for v_member_id in
    select p.id
    from auth.users au
    join public.profiles p on p.id = au.id
    where lower(au.email) = any(v_emails)
  loop
    insert into public.group_members (group_id, user_id)
    values (p_group_id, v_member_id);
  end loop;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.can_view_profile(p_profile_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    p_profile_id = auth.uid()
    or exists (
      select 1
      from public.group_members mine
      join public.group_members theirs on theirs.group_id = mine.group_id
      where mine.user_id = auth.uid() and theirs.user_id = p_profile_id
    )
    or exists (
      select 1 from public.contacts c
      where (c.owner_id = auth.uid() and c.contact_user_id = p_profile_id)
         or (c.owner_id = p_profile_id and c.contact_user_id = auth.uid())
    )
    or exists (
      select 1 from public.contact_requests cr
      where (cr.requester_id = auth.uid() and cr.recipient_id = p_profile_id)
         or (cr.requester_id = p_profile_id and cr.recipient_id = auth.uid())
    )
    or exists (
      select 1 from public.contact_expenses ce
      where (ce.user_lo = auth.uid() and ce.user_hi = p_profile_id)
         or (ce.user_lo = p_profile_id and ce.user_hi = auth.uid())
    )
    or exists (
      select 1 from public.contact_payments cp
      where (cp.user_lo = auth.uid() and cp.user_hi = p_profile_id)
         or (cp.user_lo = p_profile_id and cp.user_hi = auth.uid())
    );
$function$
;

CREATE OR REPLACE FUNCTION public.check_emails_registered(p_emails text[])
 RETURNS TABLE(email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(array_length(p_emails, 1), 0) > 20 then
    raise exception 'Too many emails requested';
  end if;

  return query
  select lower(au.email)::text
  from auth.users au
  join public.profiles p on p.id = au.id
  where lower(au.email) in (
    select lower(btrim(e)) from unnest(coalesce(p_emails, '{}'::text[])) as e
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.check_group_member_email(p_group_id uuid, p_email text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_group_member(p_group_id, v_uid) then
    raise exception 'You are not a member of this group';
  end if;

  if v_email = '' then
    raise exception 'Enter an email address';
  end if;

  select p.id into v_id
  from auth.users au
  join public.profiles p on p.id = au.id
  where lower(au.email) = v_email;

  if v_id is null then
    return 'not_registered';
  end if;

  if public.is_group_member(p_group_id, v_id) then
    return 'already_member';
  end if;

  return 'ok';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_contact_payment(p_contact_user_id uuid, p_paid_by uuid, p_paid_to uuid, p_amount numeric, p_note text DEFAULT NULL::text, p_currency text DEFAULT NULL::text)
 RETURNS public.contact_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_payment public.contact_payments;
  v_lo uuid;
  v_hi uuid;
  v_currency text;
  v_amount numeric(12, 2);
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
    raise exception 'You can only record payments with accepted contacts';
  end if;

  if p_paid_by = p_paid_to then
    raise exception 'Payer and recipient must be different people';
  end if;

  if p_paid_by not in (v_uid, p_contact_user_id)
    or p_paid_to not in (v_uid, p_contact_user_id)
  then
    raise exception 'A payment must be between you and the contact';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  if v_uid < p_contact_user_id then
    v_lo := v_uid;
    v_hi := p_contact_user_id;
  else
    v_lo := p_contact_user_id;
    v_hi := v_uid;
  end if;

  v_currency := public.get_contact_currency(p_contact_user_id);

  if p_currency is not null and upper(btrim(p_currency)) <> v_currency then
    raise exception 'Payments must be recorded in the contact currency (%)', v_currency;
  end if;

  v_amount := round(p_amount, 2);

  insert into public.contact_payments (
    paid_by, paid_to, user_lo, user_hi, amount, note,
    currency, exchange_rate, base_amount
  )
  values (
    p_paid_by, p_paid_to, v_lo, v_hi, v_amount, p_note,
    v_currency, 1, v_amount
  )
  returning * into v_payment;

  return v_payment;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_group_with_members(p_name text, p_member_emails text[] DEFAULT '{}'::text[], p_currency text DEFAULT 'USD'::text)
 RETURNS public.groups
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_group public.groups;
  v_emails text[];
  v_missing text[];
  v_member_id uuid;
  v_currency text := upper(btrim(coalesce(p_currency, 'USD')));
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'Group name is required';
  end if;

  v_emails := public.normalize_invite_emails(p_member_emails);

  if coalesce(array_length(v_emails, 1), 0) > 20 then
    raise exception 'Too many emails requested';
  end if;

  select coalesce(array_agg(e), '{}'::text[])
  into v_missing
  from unnest(v_emails) as e
  where not exists (
    select 1
    from auth.users au
    join public.profiles p on p.id = au.id
    where lower(au.email) = e
  );

  if coalesce(array_length(v_missing, 1), 0) > 0 then
    raise exception 'No SplitBill account found for: %',
      array_to_string(v_missing, ', ');
  end if;

  insert into public.groups (name, created_by, currency)
  values (btrim(p_name), v_uid, v_currency)
  returning * into v_group;

  insert into public.group_members (group_id, user_id)
  values (v_group.id, v_uid);

  for v_member_id in
    select p.id
    from auth.users au
    join public.profiles p on p.id = au.id
    where lower(au.email) = any(v_emails)
  loop
    if v_member_id <> v_uid then
      insert into public.group_members (group_id, user_id)
      values (v_group.id, v_member_id)
      on conflict (group_id, user_id) do nothing;
    end if;
  end loop;

  return v_group;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_payment(p_group_id uuid, p_paid_by uuid, p_paid_to uuid, p_amount numeric, p_note text DEFAULT NULL::text, p_currency text DEFAULT NULL::text)
 RETURNS public.payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_payment public.payments;
  v_currency text;
  v_amount numeric(12, 2);
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_group_member(p_group_id, v_uid) then
    raise exception 'You are not a member of this group';
  end if;

  if not public.is_group_member(p_group_id, p_paid_by)
    or not public.is_group_member(p_group_id, p_paid_to)
  then
    raise exception 'Both people must be group members';
  end if;

  if v_uid <> p_paid_by and v_uid <> p_paid_to then
    raise exception 'You can only record payments you are part of';
  end if;

  if p_paid_by = p_paid_to then
    raise exception 'Payer and recipient must be different people';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  select g.currency into v_currency from public.groups g where g.id = p_group_id;

  if p_currency is not null and upper(btrim(p_currency)) <> v_currency then
    raise exception 'Payments must be recorded in the group currency (%)', v_currency;
  end if;

  v_amount := round(p_amount, 2);

  insert into public.payments (
    group_id, paid_by, paid_to, amount, note, currency, exchange_rate, base_amount
  )
  values (
    p_group_id, p_paid_by, p_paid_to, v_amount, p_note, v_currency, 1, v_amount
  )
  returning * into v_payment;

  return v_payment;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_contact_expense(p_expense_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_lo uuid;
  v_hi uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select user_lo, user_hi into v_lo, v_hi
  from public.contact_expenses where id = p_expense_id;

  if v_lo is null then
    raise exception 'Expense not found';
  end if;

  if v_uid <> v_lo and v_uid <> v_hi then
    raise exception 'You are not a participant in this expense';
  end if;

  delete from public.contact_expenses where id = p_expense_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_contact_payment(p_payment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_lo uuid;
  v_hi uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select user_lo, user_hi into v_lo, v_hi
  from public.contact_payments where id = p_payment_id;

  if v_lo is null then
    raise exception 'Payment not found';
  end if;

  if v_uid <> v_lo and v_uid <> v_hi then
    raise exception 'You are not a participant in this payment';
  end if;

  delete from public.contact_payments where id = p_payment_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_expense(p_expense_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select group_id into v_group_id from public.expenses where id = p_expense_id;

  if v_group_id is null then
    raise exception 'Expense not found';
  end if;

  if not public.is_group_member(v_group_id, v_uid) then
    raise exception 'You are not a member of this group';
  end if;

  delete from public.expenses where id = p_expense_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_payment(p_payment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select group_id into v_group_id from public.payments where id = p_payment_id;

  if v_group_id is null then
    raise exception 'Payment not found';
  end if;

  if not public.is_group_member(v_group_id, v_uid) then
    raise exception 'You are not a member of this group';
  end if;

  delete from public.payments where id = p_payment_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_invite_emails(p_emails text[])
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(array_agg(distinct lower(btrim(raw))), '{}'::text[])
  from unnest(coalesce(p_emails, '{}'::text[])) as raw
  where btrim(raw) <> ''
    and lower(btrim(raw)) is distinct from (
      select lower(au.email) from auth.users au where au.id = auth.uid()
    );
$function$
;

CREATE OR REPLACE FUNCTION public.send_contact_request(p_recipient_email text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_recipient_email, '')));
  v_recipient uuid;
  v_reverse public.contact_requests;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if v_email = '' then
    raise exception 'Enter an email address';
  end if;

  select p.id into v_recipient
  from auth.users au
  join public.profiles p on p.id = au.id
  where lower(au.email) = v_email;

  if v_recipient is null then
    raise exception 'No SplitBill account found for %', v_email;
  end if;

  if v_recipient = v_uid then
    raise exception 'You cannot add yourself as a contact';
  end if;

  if exists (
    select 1 from public.contacts
    where owner_id = v_uid and contact_user_id = v_recipient
  ) then
    raise exception 'This person is already a contact';
  end if;

  -- Mutual intent: if they already requested me, accept it instead.
  select * into v_reverse
  from public.contact_requests
  where requester_id = v_recipient
    and recipient_id = v_uid
    and status = 'pending';

  if found then
    update public.contact_requests
    set status = 'accepted', responded_at = now()
    where id = v_reverse.id;
    perform public.create_contact_pair(v_uid, v_recipient);
    return;
  end if;

  insert into public.contact_requests (requester_id, recipient_id, status)
  values (v_uid, v_recipient, 'pending')
  on conflict (requester_id, recipient_id)
  do update set status = 'pending', created_at = now(), responded_at = null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_contact_payment(p_payment_id uuid, p_paid_by uuid, p_paid_to uuid, p_amount numeric, p_note text DEFAULT NULL::text)
 RETURNS public.contact_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_existing public.contact_payments;
  v_payment public.contact_payments;
  v_amount numeric(12, 2);
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_existing from public.contact_payments where id = p_payment_id;

  if not found then
    raise exception 'Payment not found';
  end if;

  if v_uid <> v_existing.user_lo and v_uid <> v_existing.user_hi then
    raise exception 'You are not a participant in this payment';
  end if;

  if p_paid_by = p_paid_to then
    raise exception 'Payer and recipient must be different people';
  end if;

  if p_paid_by not in (v_existing.user_lo, v_existing.user_hi)
    or p_paid_to not in (v_existing.user_lo, v_existing.user_hi)
  then
    raise exception 'A payment must be between the two participants';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  v_amount := round(p_amount, 2);

  update public.contact_payments
  set
    paid_by = p_paid_by,
    paid_to = p_paid_to,
    amount = v_amount,
    note = p_note,
    base_amount = round(v_amount * v_existing.exchange_rate, 2)
  where id = p_payment_id
  returning * into v_payment;

  return v_payment;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_payment(p_payment_id uuid, p_paid_by uuid, p_paid_to uuid, p_amount numeric, p_note text DEFAULT NULL::text)
 RETURNS public.payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_existing public.payments;
  v_payment public.payments;
  v_amount numeric(12, 2);
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_existing from public.payments where id = p_payment_id;

  if not found then
    raise exception 'Payment not found';
  end if;

  if v_uid <> v_existing.paid_by and v_uid <> v_existing.paid_to then
    raise exception 'You can only edit payments you are part of';
  end if;

  if v_uid <> p_paid_by and v_uid <> p_paid_to then
    raise exception 'You cannot move a payment to two other people';
  end if;

  if not public.is_group_member(v_existing.group_id, p_paid_by)
    or not public.is_group_member(v_existing.group_id, p_paid_to)
  then
    raise exception 'Both people must be group members';
  end if;

  if p_paid_by = p_paid_to then
    raise exception 'Payer and recipient must be different people';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  v_amount := round(p_amount, 2);

  update public.payments
  set
    paid_by = p_paid_by,
    paid_to = p_paid_to,
    amount = v_amount,
    note = p_note,
    base_amount = round(v_amount * v_existing.exchange_rate, 2)
  where id = p_payment_id
  returning * into v_payment;

  return v_payment;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_profile(p_full_name text, p_avatar_url text DEFAULT NULL::text)
 RETURNS public.profiles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if btrim(coalesce(p_full_name, '')) = '' then
    raise exception 'Name is required';
  end if;

  update public.profiles
  set
    full_name = btrim(p_full_name),
    avatar_url = coalesce(p_avatar_url, avatar_url)
  where id = v_uid
  returning * into v_profile;

  return v_profile;
end;
$function$
;

grant select on table "public"."contact_expense_splits" to "anon";

grant select on table "public"."contact_expense_splits" to "authenticated";

grant delete on table "public"."contact_expense_splits" to "service_role";

grant insert on table "public"."contact_expense_splits" to "service_role";

grant select on table "public"."contact_expense_splits" to "service_role";

grant update on table "public"."contact_expense_splits" to "service_role";

grant select on table "public"."contact_expenses" to "anon";

grant select on table "public"."contact_expenses" to "authenticated";

grant delete on table "public"."contact_expenses" to "service_role";

grant insert on table "public"."contact_expenses" to "service_role";

grant select on table "public"."contact_expenses" to "service_role";

grant update on table "public"."contact_expenses" to "service_role";

grant select on table "public"."contact_pair_settings" to "anon";

grant select on table "public"."contact_pair_settings" to "authenticated";

grant delete on table "public"."contact_pair_settings" to "service_role";

grant insert on table "public"."contact_pair_settings" to "service_role";

grant select on table "public"."contact_pair_settings" to "service_role";

grant update on table "public"."contact_pair_settings" to "service_role";

grant select on table "public"."contact_payments" to "anon";

grant select on table "public"."contact_payments" to "authenticated";

grant delete on table "public"."contact_payments" to "service_role";

grant insert on table "public"."contact_payments" to "service_role";

grant select on table "public"."contact_payments" to "service_role";

grant update on table "public"."contact_payments" to "service_role";

grant select on table "public"."contact_requests" to "anon";

grant select on table "public"."contact_requests" to "authenticated";

grant delete on table "public"."contact_requests" to "service_role";

grant insert on table "public"."contact_requests" to "service_role";

grant select on table "public"."contact_requests" to "service_role";

grant update on table "public"."contact_requests" to "service_role";

grant select on table "public"."contacts" to "anon";

grant select on table "public"."contacts" to "authenticated";

grant delete on table "public"."contacts" to "service_role";

grant insert on table "public"."contacts" to "service_role";

grant select on table "public"."contacts" to "service_role";

grant update on table "public"."contacts" to "service_role";

grant select on table "public"."expense_splits" to "anon";

grant select on table "public"."expense_splits" to "authenticated";

grant delete on table "public"."expense_splits" to "service_role";

grant insert on table "public"."expense_splits" to "service_role";

grant select on table "public"."expense_splits" to "service_role";

grant update on table "public"."expense_splits" to "service_role";

grant select on table "public"."expenses" to "anon";

grant select on table "public"."expenses" to "authenticated";

grant delete on table "public"."expenses" to "service_role";

grant insert on table "public"."expenses" to "service_role";

grant select on table "public"."expenses" to "service_role";

grant update on table "public"."expenses" to "service_role";

grant select on table "public"."group_members" to "anon";

grant select on table "public"."group_members" to "authenticated";

grant delete on table "public"."group_members" to "service_role";

grant insert on table "public"."group_members" to "service_role";

grant select on table "public"."group_members" to "service_role";

grant update on table "public"."group_members" to "service_role";

grant delete on table "public"."group_simplify_debts_events" to "service_role";

grant insert on table "public"."group_simplify_debts_events" to "service_role";

grant update on table "public"."group_simplify_debts_events" to "service_role";

grant select on table "public"."groups" to "anon";

grant select on table "public"."groups" to "authenticated";

grant delete on table "public"."groups" to "service_role";

grant insert on table "public"."groups" to "service_role";

grant select on table "public"."groups" to "service_role";

grant update on table "public"."groups" to "service_role";

grant select on table "public"."payments" to "anon";

grant select on table "public"."payments" to "authenticated";

grant delete on table "public"."payments" to "service_role";

grant insert on table "public"."payments" to "service_role";

grant select on table "public"."payments" to "service_role";

grant update on table "public"."payments" to "service_role";

grant select on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";


  create policy "Users can view profiles they share context with"
  on "public"."profiles"
  as permissive
  for select
  to public
using (public.can_view_profile(id));



