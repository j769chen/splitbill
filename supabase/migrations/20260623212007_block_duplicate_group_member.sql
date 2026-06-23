set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.add_group_members(p_group_id uuid, p_member_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;


