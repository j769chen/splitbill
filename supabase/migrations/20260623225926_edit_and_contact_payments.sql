
  create table "public"."contact_payments" (
    "id" uuid not null default gen_random_uuid(),
    "paid_by" uuid not null,
    "paid_to" uuid not null,
    "user_lo" uuid not null,
    "user_hi" uuid not null,
    "amount" numeric(12,2) not null,
    "note" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."contact_payments" enable row level security;

CREATE UNIQUE INDEX contact_payments_pkey ON public.contact_payments USING btree (id);

CREATE INDEX idx_contact_payments_paid_by ON public.contact_payments USING btree (paid_by);

CREATE INDEX idx_contact_payments_user_hi ON public.contact_payments USING btree (user_hi);

CREATE INDEX idx_contact_payments_user_lo ON public.contact_payments USING btree (user_lo);

alter table "public"."contact_payments" add constraint "contact_payments_pkey" PRIMARY KEY using index "contact_payments_pkey";

alter table "public"."contact_payments" add constraint "contact_payments_amount_check" CHECK ((amount > (0)::numeric)) not valid;

alter table "public"."contact_payments" validate constraint "contact_payments_amount_check";

alter table "public"."contact_payments" add constraint "contact_payments_check" CHECK ((paid_by <> paid_to)) not valid;

alter table "public"."contact_payments" validate constraint "contact_payments_check";

alter table "public"."contact_payments" add constraint "contact_payments_check1" CHECK ((user_lo < user_hi)) not valid;

alter table "public"."contact_payments" validate constraint "contact_payments_check1";

alter table "public"."contact_payments" add constraint "contact_payments_paid_by_fkey" FOREIGN KEY (paid_by) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."contact_payments" validate constraint "contact_payments_paid_by_fkey";

alter table "public"."contact_payments" add constraint "contact_payments_paid_to_fkey" FOREIGN KEY (paid_to) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."contact_payments" validate constraint "contact_payments_paid_to_fkey";

alter table "public"."contact_payments" add constraint "contact_payments_user_hi_fkey" FOREIGN KEY (user_hi) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."contact_payments" validate constraint "contact_payments_user_hi_fkey";

alter table "public"."contact_payments" add constraint "contact_payments_user_lo_fkey" FOREIGN KEY (user_lo) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."contact_payments" validate constraint "contact_payments_user_lo_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.update_contact_expense_with_splits(p_expense_id uuid, p_paid_by uuid, p_amount numeric, p_description text, p_category text, p_split_type public.split_type, p_splits jsonb, p_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS public.contact_expenses
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_lo uuid;
  v_hi uuid;
  v_expense public.contact_expenses;
  v_split jsonb;
  v_split_user uuid;
  v_split_amount numeric(12, 2);
  v_split_total numeric(12, 2) := 0;
  v_split_count int := 0;
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

  if p_paid_by <> v_lo and p_paid_by <> v_hi then
    raise exception 'Expense payer must be a participant';
  end if;

  if p_amount <= 0 then
    raise exception 'Expense amount must be greater than zero';
  end if;

  if btrim(coalesce(p_description, '')) = '' then
    raise exception 'Expense description is required';
  end if;

  for v_split in select value from jsonb_array_elements(coalesce(p_splits, '[]'::jsonb))
  loop
    v_split_user := (v_split->>'userId')::uuid;
    v_split_amount := round((v_split->>'amount')::numeric, 2);

    if v_split_amount < 0 then
      raise exception 'Split amount cannot be negative';
    end if;

    if v_split_user <> v_lo and v_split_user <> v_hi then
      raise exception 'Every split user must be a participant';
    end if;

    v_split_count := v_split_count + 1;
    v_split_total := v_split_total + v_split_amount;
  end loop;

  if v_split_count = 0 then
    raise exception 'At least one split is required';
  end if;

  if v_split_total <> round(p_amount, 2) then
    raise exception 'Split amounts must add up to the expense total';
  end if;

  update public.contact_expenses
  set
    paid_by = p_paid_by,
    amount = round(p_amount, 2),
    description = btrim(p_description),
    category = p_category,
    split_type = p_split_type,
    date = coalesce(p_date, date)
  where id = p_expense_id
  returning * into v_expense;

  delete from public.contact_expense_splits where expense_id = p_expense_id;

  for v_split in select value from jsonb_array_elements(p_splits)
  loop
    insert into public.contact_expense_splits (expense_id, user_id, amount)
    values (
      p_expense_id,
      (v_split->>'userId')::uuid,
      round((v_split->>'amount')::numeric, 2)
    );
  end loop;

  return v_expense;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_expense_with_splits(p_expense_id uuid, p_paid_by uuid, p_amount numeric, p_description text, p_category text, p_split_type public.split_type, p_splits jsonb, p_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS public.expenses
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_expense public.expenses;
  v_split jsonb;
  v_split_user uuid;
  v_split_amount numeric(12, 2);
  v_split_total numeric(12, 2) := 0;
  v_split_count int := 0;
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

  if not public.is_group_member(v_group_id, p_paid_by) then
    raise exception 'Expense payer must be a group member';
  end if;

  if p_amount <= 0 then
    raise exception 'Expense amount must be greater than zero';
  end if;

  if btrim(coalesce(p_description, '')) = '' then
    raise exception 'Expense description is required';
  end if;

  for v_split in select value from jsonb_array_elements(coalesce(p_splits, '[]'::jsonb))
  loop
    v_split_user := (v_split->>'userId')::uuid;
    v_split_amount := round((v_split->>'amount')::numeric, 2);

    if v_split_amount < 0 then
      raise exception 'Split amount cannot be negative';
    end if;

    if not public.is_group_member(v_group_id, v_split_user) then
      raise exception 'Every split user must be a group member';
    end if;

    v_split_count := v_split_count + 1;
    v_split_total := v_split_total + v_split_amount;
  end loop;

  if v_split_count = 0 then
    raise exception 'At least one split is required';
  end if;

  if v_split_total <> round(p_amount, 2) then
    raise exception 'Split amounts must add up to the expense total';
  end if;

  update public.expenses
  set
    paid_by = p_paid_by,
    amount = round(p_amount, 2),
    description = btrim(p_description),
    category = p_category,
    split_type = p_split_type,
    date = coalesce(p_date, date)
  where id = p_expense_id
  returning * into v_expense;

  delete from public.expense_splits where expense_id = p_expense_id;

  for v_split in select value from jsonb_array_elements(p_splits)
  loop
    insert into public.expense_splits (expense_id, user_id, amount)
    values (
      p_expense_id,
      (v_split->>'userId')::uuid,
      round((v_split->>'amount')::numeric, 2)
    );
  end loop;

  return v_expense;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_contact_balance(p_contact_user_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_lo uuid;
  v_hi uuid;
  v_expense_balance numeric(12, 2);
  v_payment_balance numeric(12, 2);
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_contact_user_id is null or p_contact_user_id = v_uid then
    return 0;
  end if;

  if v_uid < p_contact_user_id then
    v_lo := v_uid;
    v_hi := p_contact_user_id;
  else
    v_lo := p_contact_user_id;
    v_hi := v_uid;
  end if;

  select coalesce(sum(
    case
      when ce.paid_by = v_uid and ces.user_id = p_contact_user_id then ces.amount
      when ce.paid_by = p_contact_user_id and ces.user_id = v_uid then -ces.amount
      else 0
    end
  ), 0)
  into v_expense_balance
  from public.contact_expenses ce
  join public.contact_expense_splits ces on ces.expense_id = ce.id
  where ce.user_lo = v_lo and ce.user_hi = v_hi;

  -- A 1-on-1 payment you make to the contact settles your debt (raises the
  -- balance); a payment they make to you lowers it. Same sign rules as the
  -- shared-group payment term in get_contact_group_balance.
  select coalesce(sum(
    case
      when cp.paid_by = v_uid and cp.paid_to = p_contact_user_id then cp.amount
      when cp.paid_by = p_contact_user_id and cp.paid_to = v_uid then -cp.amount
      else 0
    end
  ), 0)
  into v_payment_balance
  from public.contact_payments cp
  where cp.user_lo = v_lo and cp.user_hi = v_hi;

  return coalesce(v_expense_balance, 0) + coalesce(v_payment_balance, 0);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_contacts_with_balances()
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
    union
    select case when cp.user_lo = v_uid then cp.user_hi else cp.user_lo end as uid
    from public.contact_payments cp
    where cp.user_lo = v_uid or cp.user_hi = v_uid
  )
  select
    ci.uid,
    p.full_name,
    p.avatar_url,
    public.get_contact_balance(ci.uid) as balance
  from contact_ids ci
  join public.profiles p on p.id = ci.uid
  where ci.uid <> v_uid
  order by p.full_name;
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
    union
    select case when cp.user_lo = v_uid then cp.user_hi else cp.user_lo end as uid
    from public.contact_payments cp
    where cp.user_lo = v_uid or cp.user_hi = v_uid
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

grant references on table "public"."contact_payments" to "anon";

grant trigger on table "public"."contact_payments" to "anon";

grant truncate on table "public"."contact_payments" to "anon";

grant references on table "public"."contact_payments" to "authenticated";

grant trigger on table "public"."contact_payments" to "authenticated";

grant truncate on table "public"."contact_payments" to "authenticated";

grant references on table "public"."contact_payments" to "service_role";

grant trigger on table "public"."contact_payments" to "service_role";

grant truncate on table "public"."contact_payments" to "service_role";


  create policy "Participants can create contact payments"
  on "public"."contact_payments"
  as permissive
  for insert
  to public
with check ((((auth.uid() = user_lo) OR (auth.uid() = user_hi)) AND ((paid_by = user_lo) OR (paid_by = user_hi)) AND ((paid_to = user_lo) OR (paid_to = user_hi))));



  create policy "Participants can delete contact payments"
  on "public"."contact_payments"
  as permissive
  for delete
  to public
using (((auth.uid() = user_lo) OR (auth.uid() = user_hi)));



  create policy "Participants can update contact payments"
  on "public"."contact_payments"
  as permissive
  for update
  to public
using (((auth.uid() = user_lo) OR (auth.uid() = user_hi)))
with check ((((auth.uid() = user_lo) OR (auth.uid() = user_hi)) AND ((paid_by = user_lo) OR (paid_by = user_hi)) AND ((paid_to = user_lo) OR (paid_to = user_hi))));



  create policy "Participants can view contact payments"
  on "public"."contact_payments"
  as permissive
  for select
  to public
using (((auth.uid() = user_lo) OR (auth.uid() = user_hi)));



  create policy "Members can update payments"
  on "public"."payments"
  as permissive
  for update
  to public
using (public.is_group_member(group_id, auth.uid()))
with check ((public.is_group_member(group_id, auth.uid()) AND public.is_group_member(group_id, paid_by) AND public.is_group_member(group_id, paid_to)));



