create table public.practice_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  practice_milliseconds bigint not null default 0 check (practice_milliseconds >= 0),
  updated_at timestamptz not null default now()
);

alter table public.practice_progress enable row level security;

create policy "Users can read their own practice progress"
  on public.practice_progress
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.practice_progress from anon, authenticated;
grant select on public.practice_progress to authenticated;
