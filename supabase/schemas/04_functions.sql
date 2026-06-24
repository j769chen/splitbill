-- Database functions (RPCs and RLS helpers).
--
-- search_path is pinned to public on every SECURITY DEFINER function to avoid
-- search-path hijacking. SQL helpers used inside RLS policies are declared
-- first because the diff tool validates SQL function bodies at creation time.
--
-- NOTE: the `on_auth_user_created` trigger that calls handle_new_user() lives
-- on auth.users and is NOT declared here. `supabase db diff` only tracks the
-- public schema, so that trigger (and the supabase_realtime publication) are
-- kept in versioned migrations instead. See schemas/README.md.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

-- Membership check runs as SECURITY DEFINER to bypass RLS on group_members.
-- A SELECT policy on group_members that queries group_members would otherwise
-- trigger "infinite recursion detected in policy".
create or replace function public.is_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_user_id
  );
$$;

-- Mirrors is_group_member for contact-expense participation.
create or replace function public.is_contact_participant(
  p_expense_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.contact_expenses ce
    where ce.id = p_expense_id
      and (ce.user_lo = p_user_id or ce.user_hi = p_user_id)
  );
$$;

create or replace function public.get_group_balances(p_group_id uuid)
returns table (
  user_id uuid,
  full_name text,
  balance numeric(12, 2)
)
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- Only return ids that have a profile row (group_members.user_id FKs profiles).
-- The matched email is returned so the client can detect invited emails with
-- no SplitBill account. Batches are capped to prevent bulk enumeration.
create or replace function public.get_user_ids_by_email(emails text[])
returns table (id uuid, email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if array_length(emails, 1) > 20 then
    raise exception 'Too many emails requested';
  end if;

  return query
  select au.id, au.email::text
  from auth.users au
  join public.profiles p on p.id = au.id
  where au.email = any(emails);
end;
$$;

-- Leave a group atomically, reassigning ownership or deleting the group when
-- the last member leaves. Done in SECURITY DEFINER to sidestep the
-- "creator can update" policy that would block transferring created_by.
create or replace function public.leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_other_count int;
  v_created_by uuid;
  v_new_owner uuid;
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
$$;

create or replace function public.create_group_with_members(
  p_name text,
  p_member_ids uuid[] default '{}',
  p_currency text default 'USD'
)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- Adds members to an existing group. Any existing member may invite others
-- (mirrors the group_members insert RLS). Already-present members are skipped.
create or replace function public.add_group_members(
  p_group_id uuid,
  p_member_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

    if exists (
      select 1 from public.group_members
      where group_id = p_group_id and user_id = v_member_id
    ) then
      raise exception 'User is already a member of this group';
    end if;

    insert into public.group_members (group_id, user_id)
    values (p_group_id, v_member_id);
  end loop;
end;
$$;

-- Renames a group. Any member may rename (routed through this SECURITY DEFINER
-- RPC, so the creator-only UPDATE policy on groups is left untouched).
create or replace function public.rename_group(p_group_id uuid, p_name text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
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
$$;

create or replace function public.create_expense_with_splits(
  p_group_id uuid,
  p_paid_by uuid,
  p_amount numeric,
  p_description text,
  p_category text,
  p_split_type public.split_type,
  p_splits jsonb,
  p_date timestamptz default null,
  p_currency text default 'USD',
  p_exchange_rate numeric default 1
)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- Edits an existing group expense and replaces its splits atomically. Any group
-- member may edit (mirrors the relaxed delete policy); the SECURITY DEFINER
-- context bypasses the payer-only UPDATE RLS. Validations match create.
create or replace function public.update_expense_with_splits(
  p_expense_id uuid,
  p_paid_by uuid,
  p_amount numeric,
  p_description text,
  p_category text,
  p_split_type public.split_type,
  p_splits jsonb,
  p_date timestamptz default null,
  p_currency text default 'USD',
  p_exchange_rate numeric default 1
)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- Inserts the bidirectional accepted-contact pair. Helper shared by request
-- acceptance and the mutual-send auto-accept path.
create or replace function public.create_contact_pair(p_user_a uuid, p_user_b uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.contacts (owner_id, contact_user_id)
  values (p_user_a, p_user_b)
  on conflict (owner_id, contact_user_id) do nothing;

  insert into public.contacts (owner_id, contact_user_id)
  values (p_user_b, p_user_a)
  on conflict (owner_id, contact_user_id) do nothing;
end;
$$;

-- Sends a contact request. If the recipient already sent the caller a pending
-- request, the two are auto-accepted (mutual intent). A prior declined/stale
-- request for the same pair is reset to pending.
create or replace function public.send_contact_request(p_recipient_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_reverse public.contact_requests;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_recipient_user_id is null or p_recipient_user_id = v_uid then
    raise exception 'You cannot add yourself as a contact';
  end if;

  if not exists (select 1 from public.profiles where id = p_recipient_user_id) then
    raise exception 'Contact user does not exist';
  end if;

  if exists (
    select 1 from public.contacts
    where owner_id = v_uid and contact_user_id = p_recipient_user_id
  ) then
    raise exception 'This person is already a contact';
  end if;

  -- Mutual intent: if they already requested me, accept it instead.
  select * into v_reverse
  from public.contact_requests
  where requester_id = p_recipient_user_id
    and recipient_id = v_uid
    and status = 'pending';

  if found then
    update public.contact_requests
    set status = 'accepted', responded_at = now()
    where id = v_reverse.id;
    perform public.create_contact_pair(v_uid, p_recipient_user_id);
    return;
  end if;

  insert into public.contact_requests (requester_id, recipient_id, status)
  values (v_uid, p_recipient_user_id, 'pending')
  on conflict (requester_id, recipient_id)
  do update set status = 'pending', created_at = now(), responded_at = null;
end;
$$;

-- Recipient accepts or declines a pending request. Accepting creates the
-- bidirectional contact pair.
create or replace function public.respond_contact_request(
  p_request_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.contact_requests;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_request
  from public.contact_requests
  where id = p_request_id;

  if not found then
    raise exception 'Request not found';
  end if;

  if v_request.recipient_id <> v_uid then
    raise exception 'You can only respond to requests sent to you';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'This request has already been handled';
  end if;

  if p_accept then
    update public.contact_requests
    set status = 'accepted', responded_at = now()
    where id = p_request_id;
    perform public.create_contact_pair(v_request.requester_id, v_request.recipient_id);
  else
    update public.contact_requests
    set status = 'declined', responded_at = now()
    where id = p_request_id;
  end if;
end;
$$;

-- Requester withdraws a pending request they sent.
create or replace function public.cancel_contact_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.contact_requests;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_request
  from public.contact_requests
  where id = p_request_id;

  if not found then
    raise exception 'Request not found';
  end if;

  if v_request.requester_id <> v_uid then
    raise exception 'You can only cancel requests you sent';
  end if;

  delete from public.contact_requests where id = p_request_id;
end;
$$;

-- Pending requests involving the caller, with the other person's profile and a
-- direction marker ('incoming' = sent to me, 'outgoing' = sent by me).
create or replace function public.get_contact_requests()
returns table (
  id uuid,
  direction text,
  status text,
  created_at timestamptz,
  user_id uuid,
  full_name text,
  avatar_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    cr.id,
    case when cr.recipient_id = v_uid then 'incoming' else 'outgoing' end as direction,
    cr.status,
    cr.created_at,
    p.id as user_id,
    p.full_name,
    p.avatar_url
  from public.contact_requests cr
  join public.profiles p
    on p.id = case when cr.recipient_id = v_uid then cr.requester_id else cr.recipient_id end
  where cr.status = 'pending'
    and (cr.requester_id = v_uid or cr.recipient_id = v_uid)
  order by cr.created_at desc;
end;
$$;

create or replace function public.create_contact_expense_with_splits(
  p_contact_user_id uuid,
  p_paid_by uuid,
  p_amount numeric,
  p_description text,
  p_category text,
  p_split_type public.split_type,
  p_splits jsonb,
  p_date timestamptz default null,
  p_currency text default 'USD',
  p_exchange_rate numeric default 1
)
returns public.contact_expenses
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- Edits an existing one-on-one contact expense and replaces its splits. Either
-- participant may edit (SECURITY DEFINER bypasses the payer-only UPDATE RLS).
-- The participant pair (user_lo/user_hi) is immutable; only payer/amount/
-- description/category/split/date and the splits change.
create or replace function public.update_contact_expense_with_splits(
  p_expense_id uuid,
  p_paid_by uuid,
  p_amount numeric,
  p_description text,
  p_category text,
  p_split_type public.split_type,
  p_splits jsonb,
  p_date timestamptz default null,
  p_currency text default 'USD',
  p_exchange_rate numeric default 1
)
returns public.contact_expenses
language plpgsql
security definer
set search_path = public
as $$
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
$$;

create or replace function public.get_contact_balance(p_contact_user_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
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
$$;

create or replace function public.get_contacts_with_balances()
returns table (
  contact_user_id uuid,
  full_name text,
  avatar_url text,
  balance numeric(12, 2)
)
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- Pairwise net between the caller and a contact across groups they both belong
-- to (positive = the contact owes you). Mirrors the sign rules in
-- get_contact_balance and get_group_balances:
--   group expense you paid, contact in split    => + contact's split
--   group expense contact paid, you in split    => - your split
--   payment you -> contact                       => + amount
--   payment contact -> you                       => - amount
create or replace function public.get_contact_group_balance(p_contact_user_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- The base currency for a one-on-one contact ledger (defaults to 'USD' when the
-- pair has no explicit setting).
create or replace function public.get_contact_currency(p_contact_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- Per-context pieces of a contact's combined balance: the 1-on-1 ledger (in the
-- pair's base currency) plus one row per shared group (in that group's base
-- currency). Returned un-summed so the client can convert each piece into the
-- viewer's display currency before adding them up (they may be different
-- currencies). Display only; get_user_total_balance must NOT fold the group
-- rows in (they are already summed via get_group_balances).
create or replace function public.get_contact_balance_contexts(p_contact_user_id uuid)
returns table (
  currency text,
  balance numeric(12, 2)
)
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- Sets (upserts) the base currency for a one-on-one contact ledger. Either
-- participant may set it; routed through SECURITY DEFINER so the table needs no
-- direct write policy.
create or replace function public.set_contact_currency(
  p_contact_user_id uuid,
  p_currency text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- Sets a group's base currency. Any member may change it (mirrors rename_group).
create or replace function public.set_group_currency(
  p_group_id uuid,
  p_currency text
)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- Toggles a group's debt-simplification preference. Any member may change it
-- (mirrors rename_group). When true, the app shows greedy minimum-transfer
-- suggestions; when false, the raw pairwise ledger is shown instead.
create or replace function public.set_group_simplify_debts(
  p_group_id uuid,
  p_enabled boolean
)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
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

  update public.groups
  set simplify_debts = coalesce(p_enabled, true)
  where id = p_group_id
  returning * into v_group;

  return v_group;
end;
$$;

-- Raw pairwise "who owes whom" for the whole group (all member pairs, not just
-- the caller). Nets every unordered pair from expenses + settle-up payments
-- using base_amount, then emits one directed debtor->creditor edge per pair
-- with a non-trivial balance. Used when a group has debt simplification OFF.
create or replace function public.get_group_pairwise_balances(p_group_id uuid)
returns table (
  from_user uuid,
  from_name text,
  to_user uuid,
  to_name text,
  amount numeric(12, 2)
)
language plpgsql
security definer
set search_path = public
as $$
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
  with raw_debts as (
    -- Expense: the member with a split (dr) owes the payer (cr).
    select es.user_id as dr, e.paid_by as cr, es.base_amount as amt
    from public.expenses e
    join public.expense_splits es on es.expense_id = e.id
    where e.group_id = p_group_id and es.user_id <> e.paid_by
    union all
    -- Settle-up payment from paid_by to paid_to reduces paid_by's debt, i.e.
    -- it is equivalent to paid_to owing paid_by the paid amount.
    select pmt.paid_to as dr, pmt.paid_by as cr, pmt.base_amount as amt
    from public.payments pmt
    where pmt.group_id = p_group_id
  ),
  pair_net as (
    select
      least(rd.dr, rd.cr) as u_lo,
      greatest(rd.dr, rd.cr) as u_hi,
      -- Positive net means u_lo owes u_hi.
      sum(case when rd.dr < rd.cr then rd.amt else -rd.amt end) as net_lo
    from raw_debts rd
    group by 1, 2
  ),
  edges as (
    select
      case when pn.net_lo > 0 then pn.u_lo else pn.u_hi end as from_user,
      case when pn.net_lo > 0 then pn.u_hi else pn.u_lo end as to_user,
      round(abs(pn.net_lo), 2)::numeric(12, 2) as amount
    from pair_net pn
    where abs(pn.net_lo) > 0.005
  )
  select ed.from_user, pf.full_name, ed.to_user, pt.full_name, ed.amount
  from edges ed
  join public.profiles pf on pf.id = ed.from_user
  join public.profiles pt on pt.id = ed.to_user
  order by pf.full_name, pt.full_name;
end;
$$;

-- Minimal settlement plan for a group: one directed debtor->creditor edge set
-- derived from each member's net balance (get_group_balances). Deterministic so
-- every surface (group screen, contact breakdown, contacts list) agrees: debtors
-- are matched most-negative-first, creditors most-positive-first, ties broken by
-- user_id. The sum of a member's edges always equals their net balance, so this
-- is display-only and never changes anyone's overall position.
create or replace function public.get_group_simplified_edges(p_group_id uuid)
returns table (
  from_user uuid,
  from_name text,
  to_user uuid,
  to_name text,
  amount numeric(12, 2)
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_debtors uuid[];
  v_debt_amt numeric[];
  v_creditors uuid[];
  v_cred_amt numeric[];
  i int := 1;
  j int := 1;
  v_transfer numeric;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_group_member(p_group_id, v_uid) then
    raise exception 'You are not a member of this group';
  end if;

  -- Debtors (negative net) ordered most-negative first, then user_id.
  select
    array_agg(b.user_id order by b.balance asc, b.user_id asc),
    array_agg((-b.balance) order by b.balance asc, b.user_id asc)
  into v_debtors, v_debt_amt
  from public.get_group_balances(p_group_id) b
  where b.balance < -0.005;

  -- Creditors (positive net) ordered most-positive first, then user_id.
  select
    array_agg(b.user_id order by b.balance desc, b.user_id asc),
    array_agg(b.balance order by b.balance desc, b.user_id asc)
  into v_creditors, v_cred_amt
  from public.get_group_balances(p_group_id) b
  where b.balance > 0.005;

  if v_debtors is null or v_creditors is null then
    return;
  end if;

  while i <= array_length(v_debtors, 1) and j <= array_length(v_creditors, 1) loop
    v_transfer := least(v_debt_amt[i], v_cred_amt[j]);

    if v_transfer > 0.005 then
      from_user := v_debtors[i];
      to_user := v_creditors[j];
      amount := round(v_transfer, 2);
      select p.full_name into from_name from public.profiles p where p.id = v_debtors[i];
      select p.full_name into to_name from public.profiles p where p.id = v_creditors[j];
      return next;
    end if;

    v_debt_amt[i] := v_debt_amt[i] - v_transfer;
    v_cred_amt[j] := v_cred_amt[j] - v_transfer;
    if v_debt_amt[i] <= 0.005 then i := i + 1; end if;
    if v_cred_amt[j] <= 0.005 then j := j + 1; end if;
  end loop;

  return;
end;
$$;

-- Same contact set as get_contacts_with_balances, but returns the combined
-- balance broken into per-currency context rows (1-on-1 ledger + each shared
-- group), un-summed. The client converts each row into the display currency and
-- sums per contact. Contacts with no activity still get a single ledger row so
-- they appear in the list. full_name/avatar_url repeat across a contact's rows.
create or replace function public.get_contacts_with_combined_balances()
returns table (
  contact_user_id uuid,
  full_name text,
  avatar_url text,
  currency text,
  balance numeric(12, 2)
)
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- Per-group pairwise balance between the caller and a contact, for groups they
-- both belong to that have pairwise activity. Same sign rules as
-- get_contact_group_balance (positive = the contact owes you), but broken out
-- one row per group so the contact page can show a card per shared group.
create or replace function public.get_contact_group_breakdown(p_contact_user_id uuid)
returns table (
  group_id uuid,
  group_name text,
  balance numeric(12, 2),
  currency text
)
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- Returns the user's net balance in each context, un-summed: one row per group
-- (their net in that group, in the group's base currency) plus one row per
-- one-on-one contact ledger (in the pair's base currency). The client converts
-- each row into the display currency before summing into owed/owing, since the
-- contexts can be in different currencies. Group activity is counted only via
-- the group rows; contact rows are the 1-on-1 ledger only (no double counting).
create or replace function public.get_user_total_balance(p_user_id uuid)
returns table (
  balance numeric(12, 2),
  currency text
)
language plpgsql
security definer
set search_path = public
as $$
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
$$;
