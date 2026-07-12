-- Права для админки: залогиненные пользователи (Supabase Auth) управляют
-- заведениями и видят статистику. Регистрацию в Auth-настройках нужно закрыть,
-- чтобы залогиниться мог только владелец.

drop policy if exists "auth full access venues" on public.venues;
create policy "auth full access venues"
  on public.venues for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "auth read ratings" on public.ratings;
create policy "auth read ratings"
  on public.ratings for select
  to authenticated
  using (true);

drop policy if exists "auth read feedback" on public.feedback;
create policy "auth read feedback"
  on public.feedback for select
  to authenticated
  using (true);

drop policy if exists "auth read scans" on public.scans;
create policy "auth read scans"
  on public.scans for select
  to authenticated
  using (true);
