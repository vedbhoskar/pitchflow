import { createInitialState } from "../src/queue.js";
import teams from "../data/teams.json" with { type: "json" };

const tableUrl = () => `${process.env.SUPABASE_URL}/rest/v1/pitchflow_state?id=eq.live`;
const headers = () => ({
  apikey: process.env.SUPABASE_SECRET_KEY,
  "content-type": "application/json",
});

function configured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

export async function readState() {
  if (!configured()) return createInitialState(teams, "PitchFlow Demo Competition");
  const response = await fetch(`${tableUrl()}&select=state` , { headers: headers() });
  if (!response.ok) throw new Error("Could not read the live state.");
  const rows = await response.json();
  return rows[0]?.state ?? createInitialState(teams);
}

export async function saveState(state) {
  if (!configured()) throw new Error("Database is not configured yet.");
  const response = await fetch(tableUrl(), {
    method: "POST",
    headers: { ...headers(), Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ id: "live", state }),
  });
  if (!response.ok) throw new Error("Could not save the live state.");
  return (await response.json())[0].state;
}
