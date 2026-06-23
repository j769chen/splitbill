drop function if exists "public"."add_contact"(p_contact_user_id uuid);


  create table "public"."contact_requests" (
    "id" uuid not null default gen_random_uuid(),
    "requester_id" uuid not null,
    "recipient_id" uuid not null,
    "status" text not null default 'pending'::text,
    "created_at" timestamp with time zone not null default now(),
    "responded_at" timestamp with time zone
      );


alter table "public"."contact_requests" enable row level security;

CREATE UNIQUE INDEX contact_requests_pkey ON public.contact_requests USING btree (id);

CREATE UNIQUE INDEX contact_requests_requester_id_recipient_id_key ON public.contact_requests USING btree (requester_id, recipient_id);

CREATE INDEX idx_contact_requests_recipient ON public.contact_requests USING btree (recipient_id);

CREATE INDEX idx_contact_requests_requester ON public.contact_requests USING btree (requester_id);

alter table "public"."contact_requests" add constraint "contact_requests_pkey" PRIMARY KEY using index "contact_requests_pkey";

alter table "public"."contact_requests" add constraint "contact_requests_check" CHECK ((requester_id <> recipient_id)) not valid;

alter table "public"."contact_requests" validate constraint "contact_requests_check";

alter table "public"."contact_requests" add constraint "contact_requests_recipient_id_fkey" FOREIGN KEY (recipient_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."contact_requests" validate constraint "contact_requests_recipient_id_fkey";

alter table "public"."contact_requests" add constraint "contact_requests_requester_id_fkey" FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."contact_requests" validate constraint "contact_requests_requester_id_fkey";

alter table "public"."contact_requests" add constraint "contact_requests_requester_id_recipient_id_key" UNIQUE using index "contact_requests_requester_id_recipient_id_key";

alter table "public"."contact_requests" add constraint "contact_requests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text]))) not valid;

alter table "public"."contact_requests" validate constraint "contact_requests_status_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.cancel_contact_request(p_request_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_contact_pair(p_user_a uuid, p_user_b uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.contacts (owner_id, contact_user_id)
  values (p_user_a, p_user_b)
  on conflict (owner_id, contact_user_id) do nothing;

  insert into public.contacts (owner_id, contact_user_id)
  values (p_user_b, p_user_a)
  on conflict (owner_id, contact_user_id) do nothing;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_contact_requests()
 RETURNS TABLE(id uuid, direction text, status text, created_at timestamp with time zone, user_id uuid, full_name text, avatar_url text)
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
$function$
;

CREATE OR REPLACE FUNCTION public.respond_contact_request(p_request_id uuid, p_accept boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.send_contact_request(p_recipient_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_contact_expense_with_splits(p_contact_user_id uuid, p_paid_by uuid, p_amount numeric, p_description text, p_category text, p_split_type public.split_type, p_splits jsonb, p_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
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
$function$
;

grant references on table "public"."contact_requests" to "anon";

grant trigger on table "public"."contact_requests" to "anon";

grant truncate on table "public"."contact_requests" to "anon";

grant references on table "public"."contact_requests" to "authenticated";

grant trigger on table "public"."contact_requests" to "authenticated";

grant truncate on table "public"."contact_requests" to "authenticated";

grant references on table "public"."contact_requests" to "service_role";

grant trigger on table "public"."contact_requests" to "service_role";

grant truncate on table "public"."contact_requests" to "service_role";


  create policy "Participants can view contact requests"
  on "public"."contact_requests"
  as permissive
  for select
  to public
using (((requester_id = auth.uid()) OR (recipient_id = auth.uid())));


-- Legacy backfill: creating a one-on-one expense now requires an accepted
-- contact. Existing 1-on-1 expense participants predate that rule, so promote
-- every existing participant pair to an accepted contact (both directions).
insert into public.contacts (owner_id, contact_user_id)
select distinct user_lo, user_hi from public.contact_expenses
on conflict (owner_id, contact_user_id) do nothing;

insert into public.contacts (owner_id, contact_user_id)
select distinct user_hi, user_lo from public.contact_expenses
on conflict (owner_id, contact_user_id) do nothing;



