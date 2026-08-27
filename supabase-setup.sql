create table if not exists public.pitchflow_state (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.pitchflow_state enable row level security;

grant usage on schema public to service_role;
grant select, insert, update on public.pitchflow_state to service_role;
