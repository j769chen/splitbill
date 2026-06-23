-- Stream contact_requests changes over Supabase Realtime so a sent request shows
-- up live in the recipient's session (and status changes in the requester's).
-- Realtime still enforces RLS, so each user only receives rows they can select.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'contact_requests'
  ) then
    alter publication supabase_realtime add table public.contact_requests;
  end if;
end $$;
