-- Бакет для логотипов заведений: публичное чтение, загрузка — только
-- залогиненным (админка).

insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do update set public = true;

drop policy if exists "public read logos" on storage.objects;
create policy "public read logos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'logos');

drop policy if exists "auth upload logos" on storage.objects;
create policy "auth upload logos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'logos');

drop policy if exists "auth update logos" on storage.objects;
create policy "auth update logos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'logos')
  with check (bucket_id = 'logos');

drop policy if exists "auth delete logos" on storage.objects;
create policy "auth delete logos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'logos');
