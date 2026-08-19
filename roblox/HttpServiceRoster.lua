local HttpService = game:GetService("HttpService")

local SUPABASE_URL = "YOUR_SUPABASE_URL"
local SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY"

local rosterEndpoint = SUPABASE_URL
  .. "/rest/v1/oc_roblox_roster?select=id,name,rank,branch,avatar_url&order=sort_order.asc"

local function fetchCommandRoster()
  local response = HttpService:RequestAsync({
    Url = rosterEndpoint,
    Method = "GET",
    Headers = {
      apikey = SUPABASE_ANON_KEY,
      Authorization = "Bearer " .. SUPABASE_ANON_KEY,
      Accept = "application/json"
    }
  })

  if not response.Success then
    error("W.L.R roster request failed: " .. tostring(response.StatusCode))
  end

  return HttpService:JSONDecode(response.Body)
end

return {
  fetchCommandRoster = fetchCommandRoster
}
