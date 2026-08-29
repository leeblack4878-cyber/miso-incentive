-- 미소 명예의 전당 공개 프로필
-- 로그인한 직원에게 사진 경로·직접 작성 상태만 공개하고, 수정은 본인만 허용한다.

create table if not exists public.employee_public_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  avatar_path text,
  status_message text check (char_length(coalesce(status_message, '')) <= 40),
  updated_at timestamptz not null default now()
);

alter table public.employee_public_profiles enable row level security;
grant select, insert, update on public.employee_public_profiles to authenticated;

drop policy if exists employee_public_profiles_read_authenticated on public.employee_public_profiles;
create policy employee_public_profiles_read_authenticated
on public.employee_public_profiles for select to authenticated
using (true);

drop policy if exists employee_public_profiles_insert_own on public.employee_public_profiles;
create policy employee_public_profiles_insert_own
on public.employee_public_profiles for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists employee_public_profiles_update_own on public.employee_public_profiles;
create policy employee_public_profiles_update_own
on public.employee_public_profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

insert into public.employee_public_profiles (user_id, avatar_path)
select id, avatar_path from public.profiles where avatar_path is not null
on conflict (user_id) do update set avatar_path = excluded.avatar_path;

drop policy if exists profile_avatars_select_authenticated on storage.objects;
create policy profile_avatars_select_authenticated
on storage.objects for select to authenticated
using (bucket_id = 'profile-avatars');
