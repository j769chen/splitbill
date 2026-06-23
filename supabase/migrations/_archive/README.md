# Archived migrations (historical)

These are the original incremental migrations `001`–`014`. They have been
superseded by:

- `../000_full_setup.sql` — the single baseline migration that reproduces the
  entire current database state (it already folds in everything `001`–`014`
  did, plus the `on_auth_user_created` auth trigger and the `supabase_realtime`
  publication).
- `../../schemas/` — the declarative source of truth used by `supabase db diff`
  going forward.

They live in this subdirectory so the Supabase CLI (which only scans top-level
`*.sql` in `migrations/`) does not replay them. They are kept for git history
and reference only. Do not add new migrations here — new migrations are
generated into `migrations/` by `supabase db diff`.
