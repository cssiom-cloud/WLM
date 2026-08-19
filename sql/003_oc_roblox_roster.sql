-- W.L.R Roblox roster view
-- GET /rest/v1/oc_roblox_roster?select=id,name,rank,branch,avatar_url&order=sort_order.asc

create or replace view public.oc_roblox_roster
with (security_invoker = true) as
select
  p.id,
  nullif(trim(concat_ws(' ', p.first_name, p.middle_name, p.last_name)), '') as name,
  p.military_rank as rank,
  p.military_branch as branch,
  p.avatar_url,
  r.sort_order
from public.oc_personnel p
left join public.oc_rank_structure r
  on r.rank_title = p.military_rank;

grant select on public.oc_roblox_roster to anon, authenticated;
