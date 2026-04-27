-- ============================================================
-- WOA Migration — Add Collab location and discipline fields
-- ============================================================

alter table public.projects
  add column if not exists location text,
  add column if not exists discipline text;
