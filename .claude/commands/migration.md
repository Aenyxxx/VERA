---
description: Create a new database migration for a schema change
argument-hint: <what should change>
---
Schema change requested: **$ARGUMENTS**

1. Read `docs/DATABASE_SCHEMA.md` and the existing files in `supabase/migrations/`.
2. Never edit an existing migration. Create `supabase/migrations/<YYYYMMDDHHMMSS>_<short_name>.sql` with the change (and safe defaults/backfill for existing rows).
3. Keep conventions: singular snake_case tables, uuid `<table>_id`, `timestamptz *_at`, enums for statuses, RLS enabled on new tables, `updated_at` trigger where rows change.
4. Update `docs/DATABASE_SCHEMA.md` (table reference, enums, §5 change log if relevant) and any affected repository SQL.
5. Add a **Database** line under Unreleased in `CHANGELOG.md`.
6. Show me the SQL and the doc diff before applying anything.
