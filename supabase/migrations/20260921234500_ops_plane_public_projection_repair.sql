-- Repair Command Center's public ops-plane projection without opening sensitive tables.
-- The public dashboard reads six intentionally non-sensitive projection views.
-- Keep the views as security_invoker and grant anon only the exact source columns
-- required by those projections; RLS remains enabled on every source table.

alter view public.ops_plane_connector_status set (security_invoker = true);
alter view public.ops_plane_connector_health set (security_invoker = true);
alter view public.ops_plane_gaps set (security_invoker = true);
alter view public.ops_plane_registry set (security_invoker = true);
alter view public.ops_plane_mcp_domains set (security_invoker = true);
alter view public.ops_plane_mcp_connectors set (security_invoker = true);

alter table public.apex_connector_status enable row level security;
alter table public.apex_connector_health enable row level security;
alter table public.apex_gap_register enable row level security;
alter table public.apex_system_registry enable row level security;
alter table public.everything_mcp_domains enable row level security;
alter table public.everything_mcp_connectors enable row level security;

drop policy if exists ops_plane_select_anon on public.apex_connector_status;
create policy ops_plane_select_anon on public.apex_connector_status
  for select to anon using (true);

drop policy if exists ops_plane_select_anon on public.apex_connector_health;
create policy ops_plane_select_anon on public.apex_connector_health
  for select to anon using (true);

drop policy if exists ops_plane_select_anon on public.apex_gap_register;
create policy ops_plane_select_anon on public.apex_gap_register
  for select to anon using (true);

drop policy if exists ops_plane_select_anon on public.apex_system_registry;
create policy ops_plane_select_anon on public.apex_system_registry
  for select to anon using (true);

drop policy if exists ops_plane_select_anon on public.everything_mcp_domains;
create policy ops_plane_select_anon on public.everything_mcp_domains
  for select to anon using (true);

drop policy if exists ops_plane_select_anon on public.everything_mcp_connectors;
create policy ops_plane_select_anon on public.everything_mcp_connectors
  for select to anon using (true);

revoke all on table public.apex_connector_status from anon;
revoke all on table public.apex_connector_health from anon;
revoke all on table public.apex_gap_register from anon;
revoke all on table public.apex_system_registry from anon;
revoke all on table public.everything_mcp_domains from anon;
revoke all on table public.everything_mcp_connectors from anon;

grant select (service, health_score, consecutive_failures, last_healthy, notes, updated_at)
  on table public.apex_connector_status to anon;
grant select (connector, status, latency_ms, consecutive_failures, error_msg, checked_at, prev_status)
  on table public.apex_connector_health to anon;
grant select (gap_title, category, priority, state, impact_score, next_action, updated_at)
  on table public.apex_gap_register to anon;
grant select (component, category, state, owner, notes, updated_at)
  on table public.apex_system_registry to anon;
grant select (domain_key, display_name, mission, status, risk_level, default_safety_mode)
  on table public.everything_mcp_domains to anon;
grant select (connector_key, display_name, plane, role, status, risk_level, read_enabled, write_enabled, default_mode)
  on table public.everything_mcp_connectors to anon;

grant select on public.ops_plane_connector_status to anon, authenticated;
grant select on public.ops_plane_connector_health to anon, authenticated;
grant select on public.ops_plane_gaps to anon, authenticated;
grant select on public.ops_plane_registry to anon, authenticated;
grant select on public.ops_plane_mcp_domains to anon, authenticated;
grant select on public.ops_plane_mcp_connectors to anon, authenticated;
