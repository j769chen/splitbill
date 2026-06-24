drop function if exists "public"."create_contact_expense_with_splits"(p_contact_user_id uuid, p_paid_by uuid, p_amount numeric, p_description text, p_category text, p_split_type public.split_type, p_splits jsonb, p_date timestamp with time zone);

drop function if exists "public"."create_expense_with_splits"(p_group_id uuid, p_paid_by uuid, p_amount numeric, p_description text, p_category text, p_split_type public.split_type, p_splits jsonb, p_date timestamp with time zone);

drop function if exists "public"."create_group_with_members"(p_name text, p_member_ids uuid[]);

drop function if exists "public"."get_contact_combined_balance"(p_contact_user_id uuid);

drop function if exists "public"."update_contact_expense_with_splits"(p_expense_id uuid, p_paid_by uuid, p_amount numeric, p_description text, p_category text, p_split_type public.split_type, p_splits jsonb, p_date timestamp with time zone);

drop function if exists "public"."update_expense_with_splits"(p_expense_id uuid, p_paid_by uuid, p_amount numeric, p_description text, p_category text, p_split_type public.split_type, p_splits jsonb, p_date timestamp with time zone);

drop function if exists "public"."get_contact_group_breakdown"(p_contact_user_id uuid);

drop function if exists "public"."get_contacts_with_combined_balances"();

drop function if exists "public"."get_user_total_balance"(p_user_id uuid);


  create table "public"."contact_pair_settings" (
    "user_lo" uuid not null,
    "user_hi" uuid not null,
    "currency" text not null default 'USD'::text,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."contact_pair_settings" enable row level security;

alter table "public"."contact_expense_splits" add column "base_amount" numeric(12,2) not null default 0;

alter table "public"."contact_expenses" add column "base_amount" numeric(12,2) not null default 0;

alter table "public"."contact_expenses" add column "currency" text not null default 'USD'::text;

alter table "public"."contact_expenses" add column "exchange_rate" numeric(18,8) not null default 1;

alter table "public"."contact_payments" add column "base_amount" numeric(12,2) not null default 0;

alter table "public"."contact_payments" add column "currency" text not null default 'USD'::text;

alter table "public"."contact_payments" add column "exchange_rate" numeric(18,8) not null default 1;

alter table "public"."expense_splits" add column "base_amount" numeric(12,2) not null default 0;

alter table "public"."expenses" add column "base_amount" numeric(12,2) not null default 0;

alter table "public"."expenses" add column "currency" text not null default 'USD'::text;

alter table "public"."expenses" add column "exchange_rate" numeric(18,8) not null default 1;

alter table "public"."groups" add column "currency" text not null default 'USD'::text;

alter table "public"."payments" add column "base_amount" numeric(12,2) not null default 0;

alter table "public"."payments" add column "currency" text not null default 'USD'::text;

alter table "public"."payments" add column "exchange_rate" numeric(18,8) not null default 1;

CREATE UNIQUE INDEX contact_pair_settings_pkey ON public.contact_pair_settings USING btree (user_lo, user_hi);

alter table "public"."contact_pair_settings" add constraint "contact_pair_settings_pkey" PRIMARY KEY using index "contact_pair_settings_pkey";

alter table "public"."contact_expense_splits" add constraint "contact_expense_splits_base_amount_check" CHECK ((base_amount >= (0)::numeric)) not valid;

alter table "public"."contact_expense_splits" validate constraint "contact_expense_splits_base_amount_check";

alter table "public"."contact_expenses" add constraint "contact_expenses_base_amount_check" CHECK ((base_amount >= (0)::numeric)) not valid;

alter table "public"."contact_expenses" validate constraint "contact_expenses_base_amount_check";

alter table "public"."contact_expenses" add constraint "contact_expenses_exchange_rate_check" CHECK ((exchange_rate > (0)::numeric)) not valid;

alter table "public"."contact_expenses" validate constraint "contact_expenses_exchange_rate_check";

alter table "public"."contact_pair_settings" add constraint "contact_pair_settings_check" CHECK ((user_lo < user_hi)) not valid;

alter table "public"."contact_pair_settings" validate constraint "contact_pair_settings_check";

alter table "public"."contact_pair_settings" add constraint "contact_pair_settings_user_hi_fkey" FOREIGN KEY (user_hi) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."contact_pair_settings" validate constraint "contact_pair_settings_user_hi_fkey";

alter table "public"."contact_pair_settings" add constraint "contact_pair_settings_user_lo_fkey" FOREIGN KEY (user_lo) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."contact_pair_settings" validate constraint "contact_pair_settings_user_lo_fkey";

alter table "public"."contact_payments" add constraint "contact_payments_base_amount_check" CHECK ((base_amount >= (0)::numeric)) not valid;

alter table "public"."contact_payments" validate constraint "contact_payments_base_amount_check";

alter table "public"."contact_payments" add constraint "contact_payments_exchange_rate_check" CHECK ((exchange_rate > (0)::numeric)) not valid;

alter table "public"."contact_payments" validate constraint "contact_payments_exchange_rate_check";

alter table "public"."expense_splits" add constraint "expense_splits_base_amount_check" CHECK ((base_amount >= (0)::numeric)) not valid;

alter table "public"."expense_splits" validate constraint "expense_splits_base_amount_check";

alter table "public"."expenses" add constraint "expenses_base_amount_check" CHECK ((base_amount >= (0)::numeric)) not valid;

alter table "public"."expenses" validate constraint "expenses_base_amount_check";

alter table "public"."expenses" add constraint "expenses_exchange_rate_check" CHECK ((exchange_rate > (0)::numeric)) not valid;

alter table "public"."expenses" validate constraint "expenses_exchange_rate_check";

alter table "public"."payments" add constraint "payments_base_amount_check" CHECK ((base_amount >= (0)::numeric)) not valid;

alter table "public"."payments" validate constraint "payments_base_amount_check";

alter table "public"."payments" add constraint "payments_exchange_rate_check" CHECK ((exchange_rate > (0)::numeric)) not valid;

alter table "public"."payments" validate constraint "payments_exchange_rate_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_group_with_members(p_name text, p_member_ids uuid[] DEFAULT '{}'::uuid[], p_currency text DEFAULT 'USD'::text)
 RETURNS public.groups
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_group public.groups;
  v_member_id uuid;
  v_currency text := upper(btrim(coalesce(p_currency, 'USD')));
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'Group name is required';
  end if;

  insert into public.groups (name, created_by, currency)
  values (btrim(p_name), v_uid, v_currency)
  returning * into v_group;

  insert into public.group_members (group_id, user_id)
  values (v_group.id, v_uid);

  foreach v_member_id in array coalesce(p_member_ids, '{}'::uuid[])
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

CREATE OR REPLACE FUNCTION public.create_contact_expense_with_splits(p_contact_user_id uuid, p_paid_by uuid, p_amount numeric, p_description text, p_category text, p_split_type public.split_type, p_splits jsonb, p_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_currency text DEFAULT 'USD'::text, p_exchange_rate numeric DEFAULT 1)
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
  v_split_base numeric(12, 2);
  v_split_total numeric(12, 2) := 0;
  v_split_base_total numeric(12, 2) := 0;
  v_split_count int := 0;
  v_currency text := upper(btrim(coalesce(p_currency, 'USD')));
  v_rate numeric := coalesce(p_exchange_rate, 1);
  v_base_amount numeric(12, 2);
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
    raise exception 'You can only add expenses with accepted contacts';
  end if;

  if p_paid_by <> v_uid and p_paid_by <> p_contact_user_id then
    raise exception 'Expense payer must be you or the contact';
  end if;

  if p_amount <= 0 then
    raise exception 'Expense amount must be greater than zero';
  end if;

  if v_rate <= 0 then
    raise exception 'Exchange rate must be greater than zero';
  end if;

  if btrim(coalesce(p_description, '')) = '' then
    raise exception 'Expense description is required';
  end if;

  if v_uid < p_contact_user_id then
    v_lo := v_uid;
    v_hi := p_contact_user_id;
  else
    v_lo := p_contact_user_id;
    v_hi := v_uid;
  end if;

  v_base_amount := round(p_amount * v_rate, 2);

  for v_split in select value from jsonb_array_elements(coalesce(p_splits, '[]'::jsonb))
  loop
    v_split_user := (v_split->>'userId')::uuid;
    v_split_amount := round((v_split->>'amount')::numeric, 2);
    v_split_base := round(
      coalesce((v_split->>'baseAmount')::numeric, (v_split->>'amount')::numeric * v_rate), 2
    );

    if v_split_amount < 0 then
      raise exception 'Split amount cannot be negative';
    end if;

    if v_split_user <> v_lo and v_split_user <> v_hi then
      raise exception 'Every split user must be a participant';
    end if;

    v_split_count := v_split_count + 1;
    v_split_total := v_split_total + v_split_amount;
    v_split_base_total := v_split_base_total + v_split_base;
  end loop;

  if v_split_count = 0 then
    raise exception 'At least one split is required';
  end if;

  if v_split_total <> round(p_amount, 2) then
    raise exception 'Split amounts must add up to the expense total';
  end if;

  if v_split_base_total <> v_base_amount then
    raise exception 'Split base amounts must add up to the converted total';
  end if;

  insert into public.contact_expenses (
    paid_by,
    user_lo,
    user_hi,
    amount,
    description,
    category,
    split_type,
    date,
    currency,
    exchange_rate,
    base_amount
  )
  values (
    p_paid_by,
    v_lo,
    v_hi,
    round(p_amount, 2),
    btrim(p_description),
    p_category,
    p_split_type,
    coalesce(p_date, now()),
    v_currency,
    v_rate,
    v_base_amount
  )
  returning * into v_expense;

  for v_split in select value from jsonb_array_elements(p_splits)
  loop
    insert into public.contact_expense_splits (expense_id, user_id, amount, base_amount)
    values (
      v_expense.id,
      (v_split->>'userId')::uuid,
      round((v_split->>'amount')::numeric, 2),
      round(
        coalesce((v_split->>'baseAmount')::numeric, (v_split->>'amount')::numeric * v_rate), 2
      )
    );
  end loop;

  return v_expense;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_expense_with_splits(p_group_id uuid, p_paid_by uuid, p_amount numeric, p_description text, p_category text, p_split_type public.split_type, p_splits jsonb, p_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_currency text DEFAULT 'USD'::text, p_exchange_rate numeric DEFAULT 1)
 RETURNS public.expenses
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_expense public.expenses;
  v_split jsonb;
  v_split_user uuid;
  v_split_amount numeric(12, 2);
  v_split_base numeric(12, 2);
  v_split_total numeric(12, 2) := 0;
  v_split_base_total numeric(12, 2) := 0;
  v_split_count int := 0;
  v_currency text := upper(btrim(coalesce(p_currency, 'USD')));
  v_rate numeric := coalesce(p_exchange_rate, 1);
  v_base_amount numeric(12, 2);
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_group_member(p_group_id, v_uid) then
    raise exception 'You are not a member of this group';
  end if;

  if not public.is_group_member(p_group_id, p_paid_by) then
    raise exception 'Expense payer must be a group member';
  end if;

  if p_amount <= 0 then
    raise exception 'Expense amount must be greater than zero';
  end if;

  if v_rate <= 0 then
    raise exception 'Exchange rate must be greater than zero';
  end if;

  if btrim(coalesce(p_description, '')) = '' then
    raise exception 'Expense description is required';
  end if;

  v_base_amount := round(p_amount * v_rate, 2);

  for v_split in select value from jsonb_array_elements(coalesce(p_splits, '[]'::jsonb))
  loop
    v_split_user := (v_split->>'userId')::uuid;
    v_split_amount := round((v_split->>'amount')::numeric, 2);
    v_split_base := round(
      coalesce((v_split->>'baseAmount')::numeric, (v_split->>'amount')::numeric * v_rate), 2
    );

    if v_split_amount < 0 then
      raise exception 'Split amount cannot be negative';
    end if;

    if not public.is_group_member(p_group_id, v_split_user) then
      raise exception 'Every split user must be a group member';
    end if;

    v_split_count := v_split_count + 1;
    v_split_total := v_split_total + v_split_amount;
    v_split_base_total := v_split_base_total + v_split_base;
  end loop;

  if v_split_count = 0 then
    raise exception 'At least one split is required';
  end if;

  if v_split_total <> round(p_amount, 2) then
    raise exception 'Split amounts must add up to the expense total';
  end if;

  if v_split_base_total <> v_base_amount then
    raise exception 'Split base amounts must add up to the converted total';
  end if;

  insert into public.expenses (
    group_id,
    paid_by,
    amount,
    description,
    category,
    split_type,
    date,
    currency,
    exchange_rate,
    base_amount
  )
  values (
    p_group_id,
    p_paid_by,
    round(p_amount, 2),
    btrim(p_description),
    p_category,
    p_split_type,
    coalesce(p_date, now()),
    v_currency,
    v_rate,
    v_base_amount
  )
  returning * into v_expense;

  for v_split in select value from jsonb_array_elements(p_splits)
  loop
    insert into public.expense_splits (expense_id, user_id, amount, base_amount)
    values (
      v_expense.id,
      (v_split->>'userId')::uuid,
      round((v_split->>'amount')::numeric, 2),
      round(
        coalesce((v_split->>'baseAmount')::numeric, (v_split->>'amount')::numeric * v_rate), 2
      )
    );
  end loop;

  return v_expense;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_contact_balance_contexts(p_contact_user_id uuid)
 RETURNS TABLE(currency text, balance numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- 1-on-1 ledger piece, in the contact pair's base currency.
  return query
  select
    public.get_contact_currency(p_contact_user_id) as currency,
    public.get_contact_balance(p_contact_user_id)::numeric(12, 2) as balance;

  -- Shared-group pieces, each in its own group's base currency.
  return query
  select b.currency, b.balance
  from public.get_contact_group_breakdown(p_contact_user_id) b;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_contact_currency(p_contact_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_lo uuid;
  v_hi uuid;
  v_currency text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_contact_user_id is null or p_contact_user_id = v_uid then
    return 'USD';
  end if;

  if v_uid < p_contact_user_id then
    v_lo := v_uid;
    v_hi := p_contact_user_id;
  else
    v_lo := p_contact_user_id;
    v_hi := v_uid;
  end if;

  select currency into v_currency
  from public.contact_pair_settings
  where user_lo = v_lo and user_hi = v_hi;

  return coalesce(v_currency, 'USD');
end;
$function$
;

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
 RETURNS public.groups
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

CREATE OR REPLACE FUNCTION public.update_contact_expense_with_splits(p_expense_id uuid, p_paid_by uuid, p_amount numeric, p_description text, p_category text, p_split_type public.split_type, p_splits jsonb, p_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_currency text DEFAULT 'USD'::text, p_exchange_rate numeric DEFAULT 1)
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
  v_split_base numeric(12, 2);
  v_split_total numeric(12, 2) := 0;
  v_split_base_total numeric(12, 2) := 0;
  v_split_count int := 0;
  v_currency text := upper(btrim(coalesce(p_currency, 'USD')));
  v_rate numeric := coalesce(p_exchange_rate, 1);
  v_base_amount numeric(12, 2);
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

  if v_rate <= 0 then
    raise exception 'Exchange rate must be greater than zero';
  end if;

  if btrim(coalesce(p_description, '')) = '' then
    raise exception 'Expense description is required';
  end if;

  v_base_amount := round(p_amount * v_rate, 2);

  for v_split in select value from jsonb_array_elements(coalesce(p_splits, '[]'::jsonb))
  loop
    v_split_user := (v_split->>'userId')::uuid;
    v_split_amount := round((v_split->>'amount')::numeric, 2);
    v_split_base := round(
      coalesce((v_split->>'baseAmount')::numeric, (v_split->>'amount')::numeric * v_rate), 2
    );

    if v_split_amount < 0 then
      raise exception 'Split amount cannot be negative';
    end if;

    if v_split_user <> v_lo and v_split_user <> v_hi then
      raise exception 'Every split user must be a participant';
    end if;

    v_split_count := v_split_count + 1;
    v_split_total := v_split_total + v_split_amount;
    v_split_base_total := v_split_base_total + v_split_base;
  end loop;

  if v_split_count = 0 then
    raise exception 'At least one split is required';
  end if;

  if v_split_total <> round(p_amount, 2) then
    raise exception 'Split amounts must add up to the expense total';
  end if;

  if v_split_base_total <> v_base_amount then
    raise exception 'Split base amounts must add up to the converted total';
  end if;

  update public.contact_expenses
  set
    paid_by = p_paid_by,
    amount = round(p_amount, 2),
    description = btrim(p_description),
    category = p_category,
    split_type = p_split_type,
    date = coalesce(p_date, date),
    currency = v_currency,
    exchange_rate = v_rate,
    base_amount = v_base_amount
  where id = p_expense_id
  returning * into v_expense;

  delete from public.contact_expense_splits where expense_id = p_expense_id;

  for v_split in select value from jsonb_array_elements(p_splits)
  loop
    insert into public.contact_expense_splits (expense_id, user_id, amount, base_amount)
    values (
      p_expense_id,
      (v_split->>'userId')::uuid,
      round((v_split->>'amount')::numeric, 2),
      round(
        coalesce((v_split->>'baseAmount')::numeric, (v_split->>'amount')::numeric * v_rate), 2
      )
    );
  end loop;

  return v_expense;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_expense_with_splits(p_expense_id uuid, p_paid_by uuid, p_amount numeric, p_description text, p_category text, p_split_type public.split_type, p_splits jsonb, p_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_currency text DEFAULT 'USD'::text, p_exchange_rate numeric DEFAULT 1)
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
  v_split_base numeric(12, 2);
  v_split_total numeric(12, 2) := 0;
  v_split_base_total numeric(12, 2) := 0;
  v_split_count int := 0;
  v_currency text := upper(btrim(coalesce(p_currency, 'USD')));
  v_rate numeric := coalesce(p_exchange_rate, 1);
  v_base_amount numeric(12, 2);
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

  if v_rate <= 0 then
    raise exception 'Exchange rate must be greater than zero';
  end if;

  if btrim(coalesce(p_description, '')) = '' then
    raise exception 'Expense description is required';
  end if;

  v_base_amount := round(p_amount * v_rate, 2);

  for v_split in select value from jsonb_array_elements(coalesce(p_splits, '[]'::jsonb))
  loop
    v_split_user := (v_split->>'userId')::uuid;
    v_split_amount := round((v_split->>'amount')::numeric, 2);
    v_split_base := round(
      coalesce((v_split->>'baseAmount')::numeric, (v_split->>'amount')::numeric * v_rate), 2
    );

    if v_split_amount < 0 then
      raise exception 'Split amount cannot be negative';
    end if;

    if not public.is_group_member(v_group_id, v_split_user) then
      raise exception 'Every split user must be a group member';
    end if;

    v_split_count := v_split_count + 1;
    v_split_total := v_split_total + v_split_amount;
    v_split_base_total := v_split_base_total + v_split_base;
  end loop;

  if v_split_count = 0 then
    raise exception 'At least one split is required';
  end if;

  if v_split_total <> round(p_amount, 2) then
    raise exception 'Split amounts must add up to the expense total';
  end if;

  if v_split_base_total <> v_base_amount then
    raise exception 'Split base amounts must add up to the converted total';
  end if;

  update public.expenses
  set
    paid_by = p_paid_by,
    amount = round(p_amount, 2),
    description = btrim(p_description),
    category = p_category,
    split_type = p_split_type,
    date = coalesce(p_date, date),
    currency = v_currency,
    exchange_rate = v_rate,
    base_amount = v_base_amount
  where id = p_expense_id
  returning * into v_expense;

  delete from public.expense_splits where expense_id = p_expense_id;

  for v_split in select value from jsonb_array_elements(p_splits)
  loop
    insert into public.expense_splits (expense_id, user_id, amount, base_amount)
    values (
      p_expense_id,
      (v_split->>'userId')::uuid,
      round((v_split->>'amount')::numeric, 2),
      round(
        coalesce((v_split->>'baseAmount')::numeric, (v_split->>'amount')::numeric * v_rate), 2
      )
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
      when ce.paid_by = v_uid and ces.user_id = p_contact_user_id then ces.base_amount
      when ce.paid_by = p_contact_user_id and ces.user_id = v_uid then -ces.base_amount
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
      when cp.paid_by = v_uid and cp.paid_to = p_contact_user_id then cp.base_amount
      when cp.paid_by = p_contact_user_id and cp.paid_to = v_uid then -cp.base_amount
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
      when e.paid_by = v_uid and es.user_id = p_contact_user_id then es.base_amount
      when e.paid_by = p_contact_user_id and es.user_id = v_uid then -es.base_amount
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
      when pmt.paid_by = v_uid and pmt.paid_to = p_contact_user_id then pmt.base_amount
      when pmt.paid_by = p_contact_user_id and pmt.paid_to = v_uid then -pmt.base_amount
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

CREATE OR REPLACE FUNCTION public.get_contact_group_breakdown(p_contact_user_id uuid)
 RETURNS TABLE(group_id uuid, group_name text, balance numeric, currency text)
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
    select gm.group_id as gid from public.group_members gm where gm.user_id = v_uid
    intersect
    select gm.group_id as gid from public.group_members gm where gm.user_id = p_contact_user_id
  ),
  expense_bal as (
    select e.group_id as gid, sum(
      case
        when e.paid_by = v_uid and es.user_id = p_contact_user_id then es.base_amount
        when e.paid_by = p_contact_user_id and es.user_id = v_uid then -es.base_amount
        else 0
      end
    ) as bal
    from public.expenses e
    join public.expense_splits es on es.expense_id = e.id
    where e.group_id in (select sg.gid from shared_groups sg)
      and (
        (e.paid_by = v_uid and es.user_id = p_contact_user_id)
        or (e.paid_by = p_contact_user_id and es.user_id = v_uid)
      )
    group by e.group_id
  ),
  payment_bal as (
    select pmt.group_id as gid, sum(
      case
        when pmt.paid_by = v_uid and pmt.paid_to = p_contact_user_id then pmt.base_amount
        when pmt.paid_by = p_contact_user_id and pmt.paid_to = v_uid then -pmt.base_amount
        else 0
      end
    ) as bal
    from public.payments pmt
    where pmt.group_id in (select sg.gid from shared_groups sg)
      and (
        (pmt.paid_by = v_uid and pmt.paid_to = p_contact_user_id)
        or (pmt.paid_by = p_contact_user_id and pmt.paid_to = v_uid)
      )
    group by pmt.group_id
  ),
  combined as (
    select eb.gid, eb.bal from expense_bal eb
    union all
    select pb.gid, pb.bal from payment_bal pb
  ),
  per_group as (
    select c.gid, sum(c.bal) as bal
    from combined c
    group by c.gid
  )
  select pg.gid, g.name, pg.bal, g.currency
  from per_group pg
  join public.groups g on g.id = pg.gid
  order by g.name;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_contacts_with_combined_balances()
 RETURNS TABLE(contact_user_id uuid, full_name text, avatar_url text, currency text, balance numeric)
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
  ),
  contacts_resolved as (
    select ci.uid, p.full_name, p.avatar_url
    from contact_ids ci
    join public.profiles p on p.id = ci.uid
    where ci.uid <> v_uid
  )
  select
    cr.uid,
    cr.full_name,
    cr.avatar_url,
    ctx.currency,
    ctx.balance
  from contacts_resolved cr
  cross join lateral public.get_contact_balance_contexts(cr.uid) ctx
  order by cr.full_name;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_group_balances(p_group_id uuid)
 RETURNS TABLE(user_id uuid, full_name text, balance numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_group_member(p_group_id, auth.uid()) then
    raise exception 'You are not a member of this group';
  end if;

  -- Sum base_amount (each row converted to the group's base currency at entry
  -- time) so cross-currency expenses net out correctly within the group.
  return query
  select
    gm.user_id,
    p.full_name,
    coalesce(paid.total_paid, 0)
      - coalesce(owed.total_owed, 0)
      + coalesce(sent.total_sent, 0)
      - coalesce(received.total_received, 0)
    as balance
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  left join (
    select e.paid_by as uid, sum(e.base_amount) as total_paid
    from public.expenses e where e.group_id = p_group_id group by e.paid_by
  ) paid on paid.uid = gm.user_id
  left join (
    select es.user_id as uid, sum(es.base_amount) as total_owed
    from public.expense_splits es
    join public.expenses e on e.id = es.expense_id
    where e.group_id = p_group_id group by es.user_id
  ) owed on owed.uid = gm.user_id
  left join (
    select py.paid_to as uid, sum(py.base_amount) as total_received
    from public.payments py where py.group_id = p_group_id group by py.paid_to
  ) received on received.uid = gm.user_id
  left join (
    select py.paid_by as uid, sum(py.base_amount) as total_sent
    from public.payments py where py.group_id = p_group_id group by py.paid_by
  ) sent on sent.uid = gm.user_id
  where gm.group_id = p_group_id;
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
      sum(case when e.paid_by = v_uid then es.base_amount else -es.base_amount end) as bal
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
      sum(case when pmt.paid_by = v_uid then pmt.base_amount else -pmt.base_amount end) as bal
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

CREATE OR REPLACE FUNCTION public.get_user_total_balance(p_user_id uuid)
 RETURNS TABLE(balance numeric, currency text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null or p_user_id <> auth.uid() then
    raise exception 'You can only view your own total balance';
  end if;

  -- Group contexts: my net per group, in that group's base currency.
  return query
  with user_groups as (
    select gm.group_id as gid from public.group_members gm where gm.user_id = p_user_id
  )
  select gb.balance, g.currency
  from user_groups ug
  join public.groups g on g.id = ug.gid
  cross join lateral public.get_group_balances(ug.gid) gb
  where gb.user_id = p_user_id;

  -- One-on-one contact ledger contexts, in each pair's base currency.
  return query
  select cwb.balance, public.get_contact_currency(cwb.contact_user_id)
  from public.get_contacts_with_balances() cwb;
end;
$function$
;

grant references on table "public"."contact_pair_settings" to "anon";

grant trigger on table "public"."contact_pair_settings" to "anon";

grant truncate on table "public"."contact_pair_settings" to "anon";

grant references on table "public"."contact_pair_settings" to "authenticated";

grant trigger on table "public"."contact_pair_settings" to "authenticated";

grant truncate on table "public"."contact_pair_settings" to "authenticated";

grant references on table "public"."contact_pair_settings" to "service_role";

grant trigger on table "public"."contact_pair_settings" to "service_role";

grant truncate on table "public"."contact_pair_settings" to "service_role";


  create policy "Participants can view contact pair settings"
  on "public"."contact_pair_settings"
  as permissive
  for select
  to public
using (((auth.uid() = user_lo) OR (auth.uid() = user_hi)));

-- Backfill base_amount for rows created before currency support. They were all
-- entered in the default currency (USD) at rate 1, so base_amount = amount.
-- New rows are written with a correct base_amount by the RPCs above; the guard
-- only touches the placeholder 0 left by the column default.
update public.expenses set base_amount = amount where base_amount = 0 and amount <> 0;
update public.expense_splits set base_amount = amount where base_amount = 0 and amount <> 0;
update public.payments set base_amount = amount where base_amount = 0 and amount <> 0;
update public.contact_expenses set base_amount = amount where base_amount = 0 and amount <> 0;
update public.contact_expense_splits set base_amount = amount where base_amount = 0 and amount <> 0;
update public.contact_payments set base_amount = amount where base_amount = 0 and amount <> 0;



