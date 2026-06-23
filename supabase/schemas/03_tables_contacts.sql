-- One-on-one contact tables (friends outside a group), indexes, and RLS.

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  contact_user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (owner_id, contact_user_id),
  check (owner_id <> contact_user_id)
);

-- user_lo/user_hi store the participant pair in sorted order so a pair maps to
-- a single canonical row regardless of who created the expense.
create table public.contact_expenses (
  id uuid primary key default gen_random_uuid(),
  paid_by uuid not null references public.profiles (id) on delete cascade,
  user_lo uuid not null references public.profiles (id) on delete cascade,
  user_hi uuid not null references public.profiles (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  description text not null,
  category text,
  split_type public.split_type not null default 'equal',
  date timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (user_lo < user_hi)
);

create table public.contact_expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.contact_expenses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0),
  unique (expense_id, user_id)
);

-- A contact only becomes a `contacts` row pair once the recipient accepts a
-- request. The unique pair lets a re-sent request reuse (reset) the prior row.
create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> recipient_id),
  unique (requester_id, recipient_id)
);

create index idx_contacts_owner on public.contacts (owner_id);
create index idx_contacts_contact_user on public.contacts (contact_user_id);
create index idx_contact_expenses_paid_by on public.contact_expenses (paid_by);
create index idx_contact_expenses_user_lo on public.contact_expenses (user_lo);
create index idx_contact_expenses_user_hi on public.contact_expenses (user_hi);
create index idx_contact_expense_splits_expense on public.contact_expense_splits (expense_id);
create index idx_contact_expense_splits_user on public.contact_expense_splits (user_id);
create index idx_contact_requests_recipient on public.contact_requests (recipient_id);
create index idx_contact_requests_requester on public.contact_requests (requester_id);

alter table public.contacts enable row level security;
alter table public.contact_expenses enable row level security;
alter table public.contact_expense_splits enable row level security;
alter table public.contact_requests enable row level security;
