create table public.progression_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current_level text check (current_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  total_practice_seconds bigint not null default 0 check (total_practice_seconds >= 0),
  legacy_practice_milliseconds bigint not null default 0 check (legacy_practice_milliseconds >= 0),
  updated_at timestamptz not null default now()
);

comment on column public.progression_profiles.legacy_practice_milliseconds is
  'Imported unverified client totals retained for history; never counted toward verified progression.';

insert into public.progression_profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create function public.create_progression_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.progression_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger create_progression_profile_after_signup
  after insert on auth.users
  for each row execute function public.create_progression_profile();

create table public.progression_rules (
  from_level text primary key check (from_level in ('A1', 'A2', 'B1', 'B2', 'C1')),
  to_level text not null unique check (to_level in ('A2', 'B1', 'B2', 'C1', 'C2')),
  min_hours integer not null check (min_hours > 0),
  target_hours integer not null check (target_hours >= min_hours),
  max_hours integer not null check (max_hours >= target_hours),
  criteria jsonb not null,
  updated_at timestamptz not null default now(),
  check (
    (from_level, to_level) in (
      ('A1', 'A2'), ('A2', 'B1'), ('B1', 'B2'), ('B2', 'C1'), ('C1', 'C2')
    )
  )
);

insert into public.progression_rules
  (from_level, to_level, min_hours, target_hours, max_hours, criteria)
values
  ('A1', 'A2', 80, 100, 120, '{
    "requiredConsecutiveReadyAssessments": 2,
    "requiredEvidenceSkills": ["conversation", "comprehension", "response", "pronunciation", "grammar"],
    "descriptor": "Comprende expresiones cotidianas y sostiene intercambios sencillos sobre información personal y necesidades inmediatas. Debe demostrarlo de forma comprensible y consistente, no solo repetir frases memorizadas."
  }'::jsonb),
  ('A2', 'B1', 150, 185, 220, '{
    "requiredConsecutiveReadyAssessments": 2,
    "requiredEvidenceSkills": ["conversation", "comprehension", "response", "pronunciation", "grammar"],
    "descriptor": "Se desenvuelve en situaciones habituales, narra experiencias y explica planes u opiniones brevemente con discurso conectado y comprensible."
  }'::jsonb),
  ('B1', 'B2', 200, 250, 300, '{
    "requiredConsecutiveReadyAssessments": 2,
    "requiredEvidenceSkills": ["conversation", "comprehension", "response", "pronunciation", "grammar"],
    "descriptor": "Interactúa con fluidez razonable, desarrolla argumentos y trata temas concretos y abstractos con suficiente claridad y control."
  }'::jsonb),
  ('B2', 'C1', 250, 325, 400, '{
    "requiredConsecutiveReadyAssessments": 2,
    "requiredEvidenceSkills": ["conversation", "comprehension", "response", "pronunciation", "grammar"],
    "descriptor": "Se expresa con fluidez y flexibilidad, organiza ideas complejas y usa el idioma eficazmente para propósitos sociales, académicos o profesionales."
  }'::jsonb),
  ('C1', 'C2', 300, 400, 500, '{
    "requiredConsecutiveReadyAssessments": 2,
    "requiredEvidenceSkills": ["conversation", "comprehension", "response", "pronunciation", "grammar"],
    "descriptor": "Comprende prácticamente todo y se expresa espontáneamente con precisión, matices y naturalidad en situaciones complejas."
  }'::jsonb);

create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  from_level text not null check (from_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  started_at timestamptz not null default now(),
  received_at timestamptz,
  completed_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds between 0 and 30),
  audio_fingerprint text,
  status text not null default 'started'
    check (status in ('started', 'processing', 'completed', 'cancelled', 'expired')),
  origin text not null check (origin in ('weakness', 'simulation', 'conversation')),
  created_at timestamptz not null default now(),
  check (
    (status = 'completed' and completed_at is not null and received_at is not null and duration_seconds > 0)
    or (status <> 'completed' and duration_seconds = 0)
  )
);

create index practice_sessions_user_level_completed_idx
  on public.practice_sessions (user_id, from_level, completed_at)
  where status = 'completed';

create unique index practice_sessions_unique_user_audio_idx
  on public.practice_sessions (user_id, audio_fingerprint)
  where audio_fingerprint is not null;

create unique index practice_sessions_one_active_per_user_idx
  on public.practice_sessions (user_id)
  where status in ('started', 'processing');

create table public.progress_assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  from_level text not null check (from_level in ('A1', 'A2', 'B1', 'B2', 'C1')),
  to_level text not null check (to_level in ('A2', 'B1', 'B2', 'C1', 'C2')),
  status text not null default 'active'
    check (status in ('active', 'processing', 'completed', 'cancelled')),
  turns jsonb not null default '[]'::jsonb check (jsonb_typeof(turns) = 'array'),
  processing_request_id uuid,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((from_level, to_level) in (
    ('A1', 'A2'), ('A2', 'B1'), ('B1', 'B2'), ('B2', 'C1'), ('C1', 'C2')
  ))
);

create index progress_assessment_sessions_user_status_idx
  on public.progress_assessment_sessions (user_id, from_level, status, created_at desc);

create unique index progress_assessment_sessions_one_active_per_user_idx
  on public.progress_assessment_sessions (user_id)
  where status in ('active', 'processing');

create table public.progress_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  assessment_type text not null check (assessment_type in ('initial', 'progression')),
  session_id uuid unique references public.progress_assessment_sessions (id),
  from_level text check (from_level in ('A1', 'A2', 'B1', 'B2', 'C1')),
  to_level text check (to_level in ('A2', 'B1', 'B2', 'C1', 'C2')),
  estimated_level text not null check (estimated_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  scores jsonb not null check (jsonb_typeof(scores) = 'object'),
  assessed_skills text[] not null,
  skill_evidence jsonb not null check (jsonb_typeof(skill_evidence) = 'object'),
  weaknesses text[] not null default '{}',
  recommendation text not null check (recommendation in ('promote', 'continue', 'baseline')),
  evidence_summary text not null,
  tip text not null,
  criteria_applied jsonb not null,
  created_at timestamptz not null default now(),
  check (
    (assessment_type = 'initial' and session_id is null and from_level is null and to_level is null
      and recommendation = 'baseline')
    or
    (assessment_type = 'progression' and session_id is not null and from_level is not null
      and to_level is not null and recommendation in ('promote', 'continue')
      and (from_level, to_level) in (
        ('A1', 'A2'), ('A2', 'B1'), ('B1', 'B2'), ('B2', 'C1'), ('C1', 'C2')
      ))
  )
);

create index progress_assessments_user_transition_idx
  on public.progress_assessments (user_id, from_level, to_level, created_at desc);

create table public.level_promotions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  from_level text not null check (from_level in ('A1', 'A2', 'B1', 'B2', 'C1')),
  to_level text not null check (to_level in ('A2', 'B1', 'B2', 'C1', 'C2')),
  assessment_id uuid not null references public.progress_assessments (id),
  criteria_applied jsonb not null,
  promoted_at timestamptz not null default now(),
  unique (user_id, from_level, to_level),
  check ((from_level, to_level) in (
    ('A1', 'A2'), ('A2', 'B1'), ('B1', 'B2'), ('B2', 'C1'), ('C1', 'C2')
  ))
);

comment on column public.progression_rules.criteria is
  'Server-owned configurable transition descriptor, evidence skills, and consecutive assessment requirement.';
comment on column public.practice_sessions.duration_seconds is
  'Server-derived bounded recording window; valid speech is required, but this does not measure voiced acoustic seconds.';
comment on column public.practice_sessions.audio_fingerprint is
  'SHA-256 of submitted audio to prevent reuse; original audio is not stored.';

create index level_promotions_user_promoted_idx
  on public.level_promotions (user_id, promoted_at desc);

alter table public.progression_profiles enable row level security;
alter table public.progression_rules enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.progress_assessment_sessions enable row level security;
alter table public.progress_assessments enable row level security;
alter table public.level_promotions enable row level security;

create policy "Users can read their progression profile"
  on public.progression_profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can read their own practice sessions"
  on public.practice_sessions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can read their own assessment sessions"
  on public.progress_assessment_sessions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can read their own assessments"
  on public.progress_assessments for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can read their own promotions"
  on public.level_promotions for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.progression_profiles, public.progression_rules,
  public.practice_sessions, public.progress_assessment_sessions,
  public.progress_assessments, public.level_promotions
  from anon, authenticated;
grant select on public.progression_profiles, public.practice_sessions,
  public.progress_assessment_sessions, public.progress_assessments,
  public.level_promotions to authenticated;

do $$
begin
  if to_regclass('public.practice_progress') is not null then
    execute $migrate$
      insert into public.progression_profiles
        (user_id, legacy_practice_milliseconds)
      select user_id, greatest(practice_milliseconds, 0)
      from public.practice_progress
      on conflict (user_id) do update set
        legacy_practice_milliseconds = greatest(
          progression_profiles.legacy_practice_milliseconds,
          excluded.legacy_practice_milliseconds
        )
    $migrate$;
  end if;
end;
$$;
