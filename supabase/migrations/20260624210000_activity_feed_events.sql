-- Activity feed: simplify-debts toggle audit trail.
--
-- Records each change to a group's simplify_debts setting (who + the new value)
-- so the global Activity feed can surface "X turned simplify debts on/off in
-- <group>". Recorded going forward only; existing groups start with no history.

create table "public"."group_simplify_debts_events" (
  "id" uuid not null default gen_random_uuid(),
  "group_id" uuid not null,
  "actor_id" uuid not null,
  "enabled" boolean not null,
  "created_at" timestamp with time zone not null default now()
);

alter table "public"."group_simplify_debts_events" enable row level security;

CREATE UNIQUE INDEX group_simplify_debts_events_pkey
  ON public.group_simplify_debts_events USING btree (id);

CREATE INDEX idx_group_simplify_debts_events_group
  ON public.group_simplify_debts_events USING btree (group_id);

alter table "public"."group_simplify_debts_events"
  add constraint "group_simplify_debts_events_pkey"
  PRIMARY KEY using index "group_simplify_debts_events_pkey";

alter table "public"."group_simplify_debts_events"
  add constraint "group_simplify_debts_events_group_id_fkey"
  FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE not valid;

alter table "public"."group_simplify_debts_events"
  validate constraint "group_simplify_debts_events_group_id_fkey";

alter table "public"."group_simplify_debts_events"
  add constraint "group_simplify_debts_events_actor_id_fkey"
  FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."group_simplify_debts_events"
  validate constraint "group_simplify_debts_events_actor_id_fkey";

grant references on table "public"."group_simplify_debts_events" to "anon";
grant trigger on table "public"."group_simplify_debts_events" to "anon";
grant truncate on table "public"."group_simplify_debts_events" to "anon";
grant references on table "public"."group_simplify_debts_events" to "authenticated";
grant trigger on table "public"."group_simplify_debts_events" to "authenticated";
grant truncate on table "public"."group_simplify_debts_events" to "authenticated";
grant references on table "public"."group_simplify_debts_events" to "service_role";
grant trigger on table "public"."group_simplify_debts_events" to "service_role";
grant truncate on table "public"."group_simplify_debts_events" to "service_role";

-- Read access for the app. Writes happen only inside set_group_simplify_debts
-- (SECURITY DEFINER), so no insert/update/delete grants are needed; the SELECT
-- policy above still scopes rows to group members.
grant select on table "public"."group_simplify_debts_events" to "authenticated";
grant select on table "public"."group_simplify_debts_events" to "anon";
grant select on table "public"."group_simplify_debts_events" to "service_role";

create policy "Members can view simplify debts events"
  on "public"."group_simplify_debts_events"
  as permissive
  for select
  to public
using (public.is_group_member(group_id, auth.uid()));

-- Log a toggle event whenever the setting actually changes. The insert runs as
-- the function owner (SECURITY DEFINER), so it bypasses RLS and needs no insert
-- policy.
CREATE OR REPLACE FUNCTION public.set_group_simplify_debts(p_group_id uuid, p_enabled boolean)
 RETURNS groups
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_group public.groups;
  v_new boolean := coalesce(p_enabled, true);
  v_old boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_group_member(p_group_id, v_uid) then
    raise exception 'You are not a member of this group';
  end if;

  select simplify_debts into v_old
  from public.groups
  where id = p_group_id;

  update public.groups
  set simplify_debts = v_new
  where id = p_group_id
  returning * into v_group;

  -- Record the change so the Activity feed can surface it. Only when the value
  -- actually flips, so a no-op toggle does not spam the feed.
  if v_old is distinct from v_new then
    insert into public.group_simplify_debts_events (group_id, actor_id, enabled)
    values (p_group_id, v_uid, v_new);
  end if;

  return v_group;
end;
$function$
;
