-- Repair remote drift: the currency-aware create_group_with_members(3-arg)
-- never landed on the remote DB even though 20260624034715_add_currency_support
-- is recorded as applied. The remote still exposes the old 2-arg signature, so
-- the client's call with p_currency fails with PGRST202 ("could not find
-- function ... in the schema cache"). Re-apply the intended definition here.

drop function if exists "public"."create_group_with_members"(p_name text, p_member_ids uuid[]);

CREATE OR REPLACE FUNCTION public.create_group_with_members(p_name text, p_member_ids uuid[] DEFAULT '{}'::uuid[], p_currency text DEFAULT 'USD'::text)
 RETURNS groups
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
