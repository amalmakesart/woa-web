-- ============================================================
-- WOA Migration — Fix admin pin policy for posts
-- Keeps the pin policy aligned with the shared admin helper.
-- ============================================================

drop policy if exists "posts_admin_pin" on public.posts;

create policy "posts_admin_pin"
on public.posts
for update
using (public.is_woa_admin())
with check (public.is_woa_admin());
