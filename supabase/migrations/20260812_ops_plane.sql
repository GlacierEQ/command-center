-- Ops plane: non-sensitive read models for Command Center
-- Project: supabase-glaciereq
-- Does NOT open legal/court/evidence tables to anon

create or replace view public.ops_plane_connector_status as
select service, health_score, consecutive_failures, last_healthy, notes, updated_at
  from public.apex_connector_status;

create or replace view public.ops_plane_connector_health as
select connector, status, latency_ms, consecutive_failures, error_msg, checked_at, prev_status
  from public.apex_connector_health;

create or replace view public.ops_plane_gaps as
select gap_title, category, priority, state, impact_score, next_action, updated_at
  from public.apex_gap_register;

create or replace view public.ops_plane_registry as
select component, category, state, owner, notes, updated_at
  from public.apex_system_registry;

create or replace view public.ops_plane_mcp_domains as
select domain_key, display_name, mission, status, risk_level, default_safety_mode
  from public.everything_mcp_domains;

create or replace view public.ops_plane_mcp_connectors as
select connector_key, display_name, plane, role, status, risk_level, read_enabled, write_enabled, default_mode
  from public.everything_mcp_connectors;

create table if not exists public.ops_plane_heartbeats (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'command-center',
  status text not null default 'ok',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ops_plane_heartbeats_created_at_idx
  on public.ops_plane_heartbeats (created_at desc);

alter table public.ops_plane_heartbeats enable row level security;

drop policy if exists ops_plane_heartbeats_anon_insert on public.ops_plane_heartbeats;
create policy ops_plane_heartbeats_anon_insert
  on public.ops_plane_heartbeats for insert to anon, authenticated
  with check (source = 'command-center');

drop policy if exists ops_plane_heartbeats_anon_select on public.ops_plane_heartbeats;
create policy ops_plane_heartbeats_anon_select
  on public.ops_plane_heartbeats for select to anon, authenticated using (true);

do $$
declare
  t text;
  tables text[] := array[
    'apex_connector_status',
    'apex_connector_health',
    'apex_gap_register',
    'apex_system_registry',
    'everything_mcp_domains',
    'everything_mcp_connectors',
    'everything_mcp_skills',
    'everything_mcp_routes'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists ops_plane_select_anon on public.%I', t);
    execute format(
      'create policy ops_plane_select_anon on public.%I for select to anon, authenticated using (true)',
      t
    );
  end loop;
end $$;

grant select on public.ops_plane_connector_status to anon, authenticated;
grant select on public.ops_plane_connector_health to anon, authenticated;
grant select on public.ops_plane_gaps to anon, authenticated;
grant select on public.ops_plane_registry to anon, authenticated;
grant select on public.ops_plane_mcp_domains to anon, authenticated;
grant select on public.ops_plane_mcp_connectors to anon, authenticated;
grant select, insert on public.ops_plane_heartbeats to anon, authenticated;
