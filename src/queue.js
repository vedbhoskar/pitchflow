export const STATUS = {
  READY: "ready",
  PITCHING: "pitching",
  COMPLETED: "completed",
  ATTENTION: "attention",
};

export const DEFAULT_COMPETITION_NAME = "JNEC Internal Round of SIH";

export function createInitialState(teams, competitionName = DEFAULT_COMPETITION_NAME) {
  return {
    competitionName,
    announcement: "",
    updatedAt: new Date().toISOString(),
    teams: teams.map((team, index) => ({
      id: team.id ?? `${team.number}-${index}`,
      number: String(team.number),
      name: team.name.trim(),
      status: index === 0 ? STATUS.READY : "waiting",
    })),
    history: [],
  };
}

export function liveTeams(state) {
  return state.teams.filter((team) => team.status === STATUS.PITCHING || team.status === STATUS.READY || team.status === "waiting");
}

export function viewModel(state) {
  const live = liveTeams(state);
  const current = live.find((team) => team.status === STATUS.PITCHING) ?? null;
  const ready = current ? live.find((team) => team.status === STATUS.READY) ?? null : live[0] ?? null;
  const from = current ? live.indexOf(ready) + 1 : 1;
  return { current, ready, upcoming: live.slice(Math.max(from, 0), Math.max(from, 0) + 2) };
}

function record(state, action, team) {
  return {
    ...state,
    updatedAt: new Date().toISOString(),
    history: [{ id: crypto.randomUUID(), action, teamId: team?.id ?? null, at: new Date().toISOString() }, ...state.history],
  };
}

export function startPitch(state) {
  if (state.teams.some((team) => team.status === STATUS.PITCHING)) return state;
  const next = state.teams.find((team) => team.status === STATUS.READY) ?? state.teams.find((team) => team.status === "waiting");
  if (!next) return state;
  const teams = state.teams.map((team) => {
    if (team.id === next.id) return { ...team, status: STATUS.PITCHING };
    if (team.status === "waiting") return { ...team, status: STATUS.READY };
    return team;
  });
  return record({ ...state, teams }, "pitch_started", next);
}

export function completePitch(state) {
  const current = state.teams.find((team) => team.status === STATUS.PITCHING);
  if (!current) return state;
  const teams = state.teams.map((team) => team.id === current.id ? { ...team, status: STATUS.COMPLETED } : team);
  return record({ ...state, teams }, "pitch_completed", current);
}

export function makeReady(state, teamId) {
  const target = state.teams.find((team) => team.id === teamId);
  if (!target || ![STATUS.READY, "waiting"].includes(target.status)) return state;
  const current = state.teams.find((team) => team.status === STATUS.PITCHING);
  const remainingLive = liveTeams(state).filter((team) => team.id !== target.id && team.id !== current?.id);
  const active = current ? [current, target, ...remainingLive] : [target, ...remainingLive];
  const rest = state.teams.filter((team) => !active.some((item) => item.id === team.id));
  const teams = active.map((team, index) => ({
    ...team,
    status: team.id === current?.id ? STATUS.PITCHING : index === (current ? 1 : 0) ? STATUS.READY : "waiting",
  }));
  return record({ ...state, teams: [...teams, ...rest] }, "team_marked_ready", target);
}

export function moveToWaiting(state, teamId) {
  const team = state.teams.find((item) => item.id === teamId);
  if (!team || ![STATUS.READY, STATUS.ATTENTION].includes(team.status)) return state;
  if (team.status === STATUS.READY) {
    const active = state.teams.filter((item) => item.id !== teamId && [STATUS.PITCHING, STATUS.READY, "waiting"].includes(item.status));
    const rest = state.teams.filter((item) => item.id !== teamId && !active.some((activeTeam) => activeTeam.id === item.id));
    return normalizeQueue(record({ ...state, teams: [...active, { ...team, status: "waiting", attentionReason: undefined }, ...rest] }, "team_moved_to_waiting", team));
  }
  const teams = state.teams.map((item) => item.id === teamId ? { ...item, status: "waiting", attentionReason: undefined } : item);
  return normalizeQueue(record({ ...state, teams }, "team_moved_to_waiting", team));
}

export function returnPitchToReady(state) {
  const current = state.teams.find((team) => team.status === STATUS.PITCHING);
  if (!current) return state;
  const ready = state.teams.find((team) => team.status === STATUS.READY);
  const rest = state.teams.filter((team) => team.id !== current.id && team.id !== ready?.id);
  const teams = [
    { ...current, status: STATUS.READY },
    ...(ready ? [{ ...ready, status: "waiting" }] : []),
    ...rest,
  ];
  return record({ ...state, teams }, "pitch_returned_to_ready", current);
}

export function reopenCompleted(state, teamId) {
  const team = state.teams.find((item) => item.id === teamId);
  if (!team || team.status !== STATUS.COMPLETED) return state;
  const active = state.teams.filter((item) => item.id !== teamId && [STATUS.PITCHING, STATUS.READY, "waiting"].includes(item.status));
  const rest = state.teams.filter((item) => item.id !== teamId && !active.some((activeTeam) => activeTeam.id === item.id));
  const current = active.find((item) => item.status === STATUS.PITCHING);
  const withoutCurrent = active.filter((item) => item.id !== current?.id);
  const teams = [
    ...(current ? [current] : []),
    { ...team, status: STATUS.READY },
    ...withoutCurrent.map((item) => ({ ...item, status: "waiting" })),
    ...rest,
  ];
  return record({ ...state, teams }, "completed_team_reopened", team);
}

export function moveToAttention(state, teamId, reason = "skipped") {
  const team = state.teams.find((item) => item.id === teamId);
  if (!team || team.status === STATUS.COMPLETED || team.status === STATUS.PITCHING) return state;
  const teams = state.teams.map((item) => item.id === teamId ? { ...item, status: STATUS.ATTENTION, attentionReason: reason } : item);
  const nextState = record({ ...state, teams }, reason, team);
  return normalizeQueue(nextState);
}

export function restoreFromAttention(state, teamId, insertAt = 0) {
  const team = state.teams.find((item) => item.id === teamId);
  if (!team || team.status !== STATUS.ATTENTION) return state;
  const kept = state.teams.filter((item) => item.id !== teamId);
  const firstWaiting = kept.findIndex((item) => item.status === "waiting");
  const position = Math.max(firstWaiting < 0 ? kept.length : firstWaiting, 0) + insertAt;
  kept.splice(position, 0, { ...team, status: "waiting", attentionReason: undefined });
  return normalizeQueue(record({ ...state, teams: kept }, "restored", team));
}

export function reorderLive(state, orderedIds) {
  const live = liveTeams(state);
  if (orderedIds.length !== live.length || new Set(orderedIds).size !== live.length || !live.every((team) => orderedIds.includes(team.id))) return state;
  const byId = new Map(state.teams.map((team) => [team.id, team]));
  const reordered = orderedIds.map((id, index) => ({ ...byId.get(id), status: index === 0 && !live.some((t) => t.status === STATUS.PITCHING) ? STATUS.READY : byId.get(id).status }));
  const rest = state.teams.filter((team) => !orderedIds.includes(team.id));
  return normalizeQueue(record({ ...state, teams: [...reordered, ...rest] }, "queue_reordered"));
}

export function normalizeQueue(state) {
  const hasCurrent = state.teams.some((team) => team.status === STATUS.PITCHING);
  let readyAssigned = false;
  const teams = state.teams.map((team) => {
    if (team.status === STATUS.COMPLETED || team.status === STATUS.ATTENTION || team.status === STATUS.PITCHING) return team;
    if (!readyAssigned) { readyAssigned = true; return { ...team, status: STATUS.READY }; }
    return { ...team, status: "waiting" };
  });
  if (!hasCurrent && !readyAssigned) return { ...state, teams };
  return { ...state, teams };
}
