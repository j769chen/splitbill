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
    select e.paid_by as uid, sum(e.amount) as total_paid
    from public.expenses e where e.group_id = p_group_id group by e.paid_by
  ) paid on paid.uid = gm.user_id
  left join (
    select es.user_id as uid, sum(es.amount) as total_owed
    from public.expense_splits es
    join public.expenses e on e.id = es.expense_id
    where e.group_id = p_group_id group by es.user_id
  ) owed on owed.uid = gm.user_id
  left join (
    select py.paid_to as uid, sum(py.amount) as total_received
    from public.payments py where py.group_id = p_group_id group by py.paid_to
  ) received on received.uid = gm.user_id
  left join (
    select py.paid_by as uid, sum(py.amount) as total_sent
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
  p_member_ids uuid[] default '{}'
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
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'Group name is required';
  end if;

  insert into public.groups (name, created_by)
  values (btrim(p_name), v_uid)
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

-- Per-member pairwise balance between the caller and every OTHER group member,
-- scoped to this group. Positive = that member owes you. Same sign rules as
-- get_contact_group_balance, grouped by the other party so the group view can
-- show "your balance with each member". Members with no shared activity appear
-- with a 0 balance.
create or replace function public.get_group_pairwise_balances_for_me(p_group_id uuid)
returns table (
  user_id uuid,
  full_name text,
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
      sum(case when e.paid_by = v_uid then es.amount else -es.amount end) as bal
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
      sum(case when pmt.paid_by = v_uid then pmt.amount else -pmt.amount end) as bal
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
$$;

create or replace function public.create_expense_with_splits(
  p_group_id uuid,
  p_paid_by uuid,
  p_amount numeric,
  p_description text,
  p_category text,
  p_split_type public.split_type,
  p_splits jsonb,
  p_date timestamptz default null
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
  v_split_total numeric(12, 2) := 0;
  v_split_count int := 0;
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

    if not public.is_group_member(p_group_id, v_split_user) then
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

  insert into public.expenses (
    group_id,
    paid_by,
    amount,
    description,
    category,
    split_type,
    date
  )
  values (
    p_group_id,
    p_paid_by,
    round(p_amount, 2),
    btrim(p_description),
    p_category,
    p_split_type,
    coalesce(p_date, now())
  )
  returning * into v_expense;

  for v_split in select value from jsonb_array_elements(p_splits)
  loop
    insert into public.expense_splits (expense_id, user_id, amount)
    values (
      v_expense.id,
      (v_split->>'userId')::uuid,
      round((v_split->>'amount')::numeric, 2)
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
  p_date timestamptz default null
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
  v_split_total numeric(12, 2) := 0;
  v_split_count int := 0;
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

  insert into public.contact_expenses (
    paid_by,
    user_lo,
    user_hi,
    amount,
    description,
    category,
    split_type,
    date
  )
  values (
    p_paid_by,
    v_lo,
    v_hi,
    round(p_amount, 2),
    btrim(p_description),
    p_category,
    p_split_type,
    coalesce(p_date, now())
  )
  returning * into v_expense;

  for v_split in select value from jsonb_array_elements(p_splits)
  loop
    insert into public.contact_expense_splits (expense_id, user_id, amount)
    values (
      v_expense.id,
      (v_split->>'userId')::uuid,
      round((v_split->>'amount')::numeric, 2)
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
  v_balance numeric(12, 2);
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
  into v_balance
  from public.contact_expenses ce
  join public.contact_expense_splits ces on ces.expense_id = ce.id
  where ce.user_lo = v_lo and ce.user_hi = v_hi;

  return v_balance;
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
$$;

-- Combined display balance for a contact: 1-on-1 ledger + shared-group pairwise
-- net. Display only; get_user_total_balance must NOT use this (it would
-- double-count group activity already summed via get_group_balances).
create or replace function public.get_contact_combined_balance(p_contact_user_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.get_contact_balance(p_contact_user_id)
       + public.get_contact_group_balance(p_contact_user_id);
end;
$$;

-- Same contact set as get_contacts_with_balances, but each balance folds in the
-- shared-group pairwise net for display on contact cards.
create or replace function public.get_contacts_with_combined_balances()
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
$$;

-- Per-group pairwise balance between the caller and a contact, for groups they
-- both belong to that have pairwise activity. Same sign rules as
-- get_contact_group_balance (positive = the contact owes you), but broken out
-- one row per group so the contact page can show a card per shared group.
create or replace function public.get_contact_group_breakdown(p_contact_user_id uuid)
returns table (
  group_id uuid,
  group_name text,
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
        when e.paid_by = v_uid and es.user_id = p_contact_user_id then es.amount
        when e.paid_by = p_contact_user_id and es.user_id = v_uid then -es.amount
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
        when pmt.paid_by = v_uid and pmt.paid_to = p_contact_user_id then pmt.amount
        when pmt.paid_by = p_contact_user_id and pmt.paid_to = v_uid then -pmt.amount
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
  select pg.gid, g.name, pg.bal
  from per_group pg
  join public.groups g on g.id = pg.gid
  order by g.name;
end;
$$;

-- Folds both group balances and contact balances into the overall total.
create or replace function public.get_user_total_balance(p_user_id uuid)
returns table (
  total_owed numeric(12, 2),
  total_owing numeric(12, 2)
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_user_id <> auth.uid() then
    raise exception 'You can only view your own total balance';
  end if;

  return query
  with user_groups as (
    select group_id from public.group_members where user_id = p_user_id
  ),
  group_balances as (
    select gb.balance
    from user_groups ug
    cross join lateral public.get_group_balances(ug.group_id) gb
    where gb.user_id = p_user_id
  ),
  contact_balances as (
    select cwb.balance
    from public.get_contacts_with_balances() cwb
  ),
  all_balances as (
    select balance from group_balances
    union all
    select balance from contact_balances
  )
  select
    coalesce(sum(case when balance > 0 then balance else 0 end), 0) as total_owed,
    coalesce(sum(case when balance < 0 then abs(balance) else 0 end), 0) as total_owing
  from all_balances;
end;
$$;
