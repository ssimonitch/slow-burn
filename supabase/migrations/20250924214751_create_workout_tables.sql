-- Enable UUID generation for primary keys
create extension if not exists "pgcrypto";

-- Sessions aggregate per workout run
create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  started_at timestamptz not null,
  ended_at timestamptz,
  workout_type text not null,
  total_reps integer not null default 0,
  duration_sec integer not null default 0,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Individual sets nested under sessions
create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  set_index integer not null,
  exercise text not null,
  target_type text not null,
  goal_value integer,
  actual_reps integer,
  duration_sec integer,
  created_at timestamptz not null default timezone('utc', now()),
  constraint workout_sets_session_index_unique unique (session_id, set_index)
);

-- Companion progression singleton table
create table if not exists public.companion_state (
  id integer primary key default 1 check (id = 1),
  affinity_xp integer not null default 0,
  level integer not null default 1,
  updated_at timestamptz not null default timezone('utc', now()),
  last_session_id uuid references public.workout_sessions(id)
);

-- Seed singleton row for companion state
insert into public.companion_state (id)
values (1)
  on conflict (id) do nothing;

-- Helpful indexes for querying history
create index if not exists workout_sessions_user_started_idx
  on public.workout_sessions (user_id, started_at desc);

create index if not exists workout_sets_session_idx
  on public.workout_sets (session_id);

-- Trigger to keep updated_at fresh on session edits
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

create trigger set_workout_sessions_updated_at
before update on public.workout_sessions
for each row
execute function public.set_updated_at();

-- NOTE: Future migrations should introduce user_id foreign keys and RLS when auth lands.
