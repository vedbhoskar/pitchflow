import { createInitialState } from "../src/queue.js";
import teams from "../data/teams.json" with { type: "json" };

const ROSTER_VERSION = "sih-2026-day-2";
const tableUrl = () => `${process.env.SUPABASE_URL}/rest/v1/pitchflow_state?id=eq.live`;
const headers = () => ({
  apikey: process.env.SUPABASE_SECRET_KEY,
  "content-type": "application/json",
});

function configured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

function freshState() {
  return { ...createInitialState(teams), rosterVersion: ROSTER_VERSION };
}

export async function readState() {
  if (!configured()) return { ...createInitialState(teams, "PitchFlow Demo Competition"), rosterVersion: ROSTER_VERSION };
  const response = await fetch(`${tableUrl()}&select=state` , { headers: headers() });
  if (!response.ok) {
    console.error("Supabase read failed", response.status, await response.text());
    throw new Error(`Could not read the live state (Supabase HTTP ${response.status}).`);
  }
  const rows = await response.json();
  const saved = rows[0]?.state;
  // A new published roster starts a fresh event once, while later admin edits
  // keep the same version and are never overwritten.
  if (saved?.rosterVersion !== ROSTER_VERSION) return saveState(freshState());
  return saved;
}

export async function saveState(state) {
  if (!configured()) throw new Error("Database is not configured yet.");
  const versionedState = { ...state, rosterVersion: ROSTER_VERSION };
  const response = await fetch(tableUrl(), {
    method: "POST",
    headers: { ...headers(), Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ id: "live", state: versionedState }),
  });
  if (!response.ok) {
    console.error("Supabase save failed", response.status, await response.text());
    throw new Error(`Could not save the live state (Supabase HTTP ${response.status}).`);
  }
  return (await response.json())[0].state;
}
