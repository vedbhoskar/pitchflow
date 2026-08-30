import test from "node:test";
import assert from "node:assert/strict";
import { completePitch, createInitialState, DEFAULT_COMPETITION_NAME, makeReady, moveTeamInTray, moveToAttention, moveToWaiting, restoreFromAttention, returnPitchToReady, startPitch, viewModel } from "../src/queue.js";

const teams = [{ number: "01", name: "Alpha" }, { number: "02", name: "Beta" }, { number: "03", name: "Gamma" }, { number: "04", name: "Nova" }];

test("the first imported team is ready before the event begins", () => {
  const state = createInitialState(teams);
  assert.equal(state.competitionName, DEFAULT_COMPETITION_NAME);
  assert.equal(viewModel(state).current, null);
  assert.equal(viewModel(state).ready.name, "Alpha");
});

test("starting a pitch assigns current, ready, and two upcoming teams", () => {
  const state = startPitch(createInitialState(teams));
  const view = viewModel(state);
  assert.equal(view.current.name, "Alpha");
  assert.equal(view.ready.name, "Beta");
  assert.deepEqual(view.upcoming.map((team) => team.name), ["Gamma", "Nova"]);
  assert.equal(state.teams.filter((team) => team.status === "ready").length, 1);
});

test("a team can be moved backward or forward in the tray without changing its status", () => {
  const initial = createInitialState(teams);
  const movedBack = moveTeamInTray(initial, initial.teams[2].id, -1);
  assert.deepEqual(movedBack.teams.map((team) => team.name), ["Alpha", "Gamma", "Beta", "Nova"]);
  assert.equal(movedBack.teams[1].status, "waiting");
  const movedForward = moveTeamInTray(movedBack, movedBack.teams[1].id, 1);
  assert.deepEqual(movedForward.teams.map((team) => team.name), ["Alpha", "Beta", "Gamma", "Nova"]);
});

test("completing a pitch records the team and leaves the next one ready", () => {
  const state = completePitch(startPitch(createInitialState(teams)));
  assert.equal(state.teams.find((team) => team.name === "Alpha").status, "completed");
  assert.equal(viewModel(state).current, null);
  assert.equal(viewModel(state).ready.name, "Beta");
});

test("a skipped team moves to attention and can be restored", () => {
  const initial = createInitialState(teams);
  const skipped = moveToAttention(initial, initial.teams[1].id, "absent");
  assert.equal(skipped.teams[1].status, "attention");
  const restored = restoreFromAttention(skipped, initial.teams[1].id);
  assert.equal(restored.teams.find((team) => team.name === "Beta").status, "waiting");
});

test("an admin can manually make any waiting team the ready team", () => {
  const initial = createInitialState(teams);
  const updated = makeReady(initial, initial.teams[2].id);
  assert.equal(viewModel(updated).ready.name, "Gamma");
  assert.equal(updated.teams.find((team) => team.name === "Alpha").status, "waiting");
});

test("the coordinator can move a ready team back to waiting", () => {
  const initial = createInitialState(teams);
  const updated = moveToWaiting(initial, initial.teams[0].id);
  assert.equal(updated.teams.find((team) => team.name === "Alpha").status, "waiting");
  assert.equal(viewModel(updated).ready.name, "Beta");
});

test("the coordinator can return a pitching team to ready", () => {
  const pitching = startPitch(createInitialState(teams));
  const updated = returnPitchToReady(pitching);
  assert.equal(viewModel(updated).current, null);
  assert.equal(viewModel(updated).ready.name, "Alpha");
});
