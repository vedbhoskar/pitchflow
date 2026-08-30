import { completePitch, createInitialState, makeReady, moveToAttention, moveToWaiting, reopenCompleted, returnPitchToReady, startPitch, viewModel } from "./src/queue.js";
import { localTeams } from "./data/local-teams.js";

const app = document.querySelector("#app");
const isDisplay = location.pathname.includes("/waiting");
const isLocalPreview = location.protocol === "file:";
let state;
let authenticated = false;

const escape = (value) => String(value ?? "").replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
const teamName = (team) => `<strong>#${escape(team.number)} <span>${escape(team.name)}</span></strong>`;

async function load() {
  if (isLocalPreview) {
    state ??= createInitialState(localTeams);
    authenticated = true;
    render();
    return;
  }
  const response = await fetch("/api/state", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load the competition.");
  state = await response.json();
  render();
}

async function save(next) {
  if (isLocalPreview) {
    state = next;
    render();
    return;
  }
  const response = await fetch("/api/state", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
  if (!response.ok) throw new Error((await response.json()).error ?? "Could not save this change.");
  state = await response.json();
  render();
}

function publicDisplay() {
  const view = viewModel(state);
  const current = view.current ? `#${escape(view.current.number)} ${escape(view.current.name)}` : "Waiting for the first pitch";
  const ready = view.ready ? `#${escape(view.ready.number)} ${escape(view.ready.name)}` : "No team queued";
  return `<main class="viewer"><p class="viewer-kicker">LIVE EVENT QUEUE</p><h1>${escape(state.competitionName)}</h1><section><p>NOW PITCHING</p><strong>${current}</strong></section><section><p>READY QUEUE</p><strong>${ready}</strong></section><section><p>UP NEXT</p>${view.upcoming.length ? view.upcoming.map((team) => `<div>#${escape(team.number)} ${escape(team.name)}</div>`).join("") : `<div>—</div>`}</section>${state.announcement ? `<aside>${escape(state.announcement)}</aside>` : ""}</main>`;
}

function login() {
  return `<section class="login"><div><span>PF</span><p>ADMIN ACCESS</p><h1>PitchFlow</h1><form id="login-form"><label>Username<input name="username" autocomplete="username" required /></label><label>Password<input name="password" type="password" autocomplete="current-password" required /></label><button>Log in</button><small id="login-error"></small></form></div></section>`;
}

function focusCard(team, label, controls) {
  return `<article class="focus-card"><p>${label}</p>${team ? `${teamName(team)}<div class="focus-actions">${controls}</div>` : `<span class="empty">No team here</span>`}</article>`;
}

function rosterTile(team, hasPitching) {
  if (team.status === "waiting") return `<article class="roster-tile">${teamName(team)}<div><button class="quiet" data-ready="${team.id}">Ready</button><button class="hold" data-hold="${team.id}">Hold</button></div></article>`;
  if (team.status === "ready") return `<article class="roster-tile ready">${teamName(team)}<div>${hasPitching ? `<span class="tag">Ready</span>` : `<button class="primary" data-start="${team.id}">Pitch now</button>`}<button class="quiet" data-waiting="${team.id}">Waiting</button></div></article>`;
  if (team.status === "pitching") return `<article class="roster-tile pitching">${teamName(team)}<div><span class="tag">Pitching</span></div></article>`;
  if (team.status === "attention") return `<article class="roster-tile hold-state">${teamName(team)}<div><button class="quiet" data-return="${team.id}">Return</button><button class="primary" data-ready-hold="${team.id}">Ready</button></div></article>`;
  return `<article class="roster-tile completed">${teamName(team)}<div><span class="tag">Done</span><button class="quiet" data-reopen="${team.id}">Reopen</button></div></article>`;
}

function admin() {
  const view = viewModel(state);
  const pitching = view.current;
  const ready = view.ready;
  const onHold = state.teams.filter((team) => team.status === "attention");
  const completed = state.teams.filter((team) => team.status === "completed");
  const active = state.teams.filter((team) => team.status !== "completed");
  return `<header><a href="/admin"><span>PF</span>PitchFlow</a><a href="/waiting/" target="_blank">Open waiting display ↗</a></header><main class="admin-shell">
    <div class="title"><div><p>EVENT CONTROL</p><h1>${escape(state.competitionName)}</h1></div><div class="progress"><b>${completed.length}</b><span>completed</span><b>${active.length}</b><span>active</span></div></div>
    <section class="control-row">
      ${focusCard(pitching, "PITCHING NOW", pitching ? `<button class="primary" data-complete>End pitch</button><button class="quiet" data-back-pitch>Back to ready</button>` : "")}
      ${focusCard(ready, "READY QUEUE", ready ? `<button class="primary" data-start="${ready.id}" ${pitching ? "disabled" : ""}>Move to pitching</button><button class="quiet" data-waiting="${ready.id}">Move to waiting</button><button class="hold" data-hold="${ready.id}">Hold</button>` : "")}
      <article class="focus-card hold-box"><p>ON HOLD</p><strong>${onHold.length}</strong><span>${onHold.length === 1 ? "team needs attention" : "teams need attention"}</span></article>
    </section>
    <section class="tray-section"><div class="section-head"><div><p>TEAM TRAY</p><h2>Choose any team</h2></div><span>Ready moves a team into the ready queue. Hold removes it from the live flow.</span></div><div class="team-tray">${state.teams.map((team) => rosterTile(team, Boolean(pitching))).join("")}</div></section>
    <section class="lower-row">
      <section class="simple-list"><p>ON HOLD</p>${onHold.length ? onHold.map((team) => `<div>${teamName(team)}<button class="quiet" data-return="${team.id}">Return to waiting</button><button class="primary" data-ready-hold="${team.id}">Ready</button></div>`).join("") : `<span class="empty">No teams on hold.</span>`}</section>
      <section class="simple-list"><p>COMPLETED</p>${completed.length ? completed.map((team) => `<div>${teamName(team)}<button class="quiet" data-reopen="${team.id}">Reopen</button></div>`).join("") : `<span class="empty">No completed teams yet.</span>`}</section>
    </section>
  </main>`;
}

function render() {
  app.innerHTML = isDisplay ? publicDisplay() : authenticated ? admin() : login();
  if (!isDisplay && authenticated) bindAdmin();
  if (!isDisplay && !authenticated) document.querySelector("#login-form").addEventListener("submit", loginSubmit);
}

async function loginSubmit(event) {
  event.preventDefault();
  const response = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
  if (!response.ok) return document.querySelector("#login-error").textContent = (await response.json()).error;
  authenticated = true;
  await load();
}

function bind(selector, transform) { document.querySelectorAll(selector).forEach((button) => button.addEventListener("click", () => update(transform(button.dataset)))); }

function bindAdmin() {
  bind("[data-ready]", (data) => (current) => makeReady(current, data.ready));
  bind("[data-ready-hold]", (data) => (current) => makeReady(moveToWaiting(current, data.readyHold), data.readyHold));
  bind("[data-hold]", (data) => (current) => moveToAttention(current, data.hold, "on hold"));
  bind("[data-waiting]", (data) => (current) => moveToWaiting(current, data.waiting));
  bind("[data-return]", (data) => (current) => moveToWaiting(current, data.return));
  bind("[data-reopen]", (data) => (current) => reopenCompleted(current, data.reopen));
  bind("[data-start]", () => startPitch);
  document.querySelector("[data-complete]")?.addEventListener("click", () => update(completePitch));
  document.querySelector("[data-back-pitch]")?.addEventListener("click", () => update(returnPitchToReady));
}

async function update(transform) { try { await save(transform(state)); } catch (error) { alert(error.message); } }

load().catch((error) => { app.innerHTML = `<p class="fatal">${escape(error.message)}</p>`; });
if (isDisplay) setInterval(() => load().catch(() => {}), 3000);
