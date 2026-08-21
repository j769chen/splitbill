-- Pin search_path on handle_new_user().
--
-- It was the only SECURITY DEFINER function without `set search_path`,
-- contradicting the note at the top of schemas/04_functions.sql and the other
-- 29 definer functions. Without it, the function resolves unqualified names
-- through the caller's search_path, which a definer function must never do.
--
-- Hand-written: `supabase db diff` does not track a function's SET clauses, so
-- it reports no change for this edit (see schemas/README.md).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
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
