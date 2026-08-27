import { completePitch, createInitialState, moveToAttention, reorderLive, restoreFromAttention, startPitch, viewModel } from "./src/queue.js";
import { demoTeams } from "./data/demo-teams.js";

const app = document.querySelector("#app");
const isDisplay = location.pathname.includes("/waiting");
const isLocalPreview = location.protocol === "file:";
let state;
let authenticated = false;
let dragId = null;

const escape = (value) => String(value ?? "").replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
const team = (item) => item ? `<span class="team-number">#${escape(item.number)}</span><span>${escape(item.name)}</span>` : `<span class="empty">—</span>`;

async function load() {
  if (isLocalPreview) {
    state ??= createInitialState(demoTeams, "PitchFlow Demo Competition");
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
  if (!response.ok) throw new Error((await response.json()).error ?? "Could not save your change.");
  state = await response.json();
  render();
}

function publicDisplay() {
  const view = viewModel(state);
  return `
    <section class="display-shell">
      <div class="display-top"><span class="eyebrow">LIVE QUEUE</span><span class="dot">● LIVE</span></div>
      <h1>${escape(state.competitionName)}</h1>
      <article class="display-current"><p>NOW PITCHING</p><div class="display-team">${team(view.current)}</div></article>
      <section class="display-ready"><p>GET READY</p><div class="display-team">${team(view.ready)}</div></section>
      <section class="display-next"><p>UP NEXT</p>${view.upcoming.length ? view.upcoming.map((item) => `<div class="next-row">${team(item)}</div>`).join("") : `<div class="empty">No further teams</div>`}</section>
      ${state.announcement ? `<aside class="announcement">${escape(state.announcement)}</aside>` : ""}
    </section>`;
}

function login() {
  return `<section class="login-shell"><div class="login-card"><span class="brand-mark">PF</span><p class="eyebrow">ADMIN ACCESS</p><h1>PitchFlow</h1><p>Control the live competition queue.</p><form id="login-form"><label>Username<input name="username" autocomplete="username" required /></label><label>Password<input name="password" type="password" autocomplete="current-password" required /></label><button class="button primary">Log in</button><p id="login-error" class="form-error"></p></form></div></section>`;
}

function admin() {
  const view = viewModel(state);
  const live = state.teams.filter((item) => ["pitching", "ready", "waiting"].includes(item.status));
  const completed = state.teams.filter((item) => item.status === "completed");
  const attention = state.teams.filter((item) => item.status === "attention");
  const canStart = !view.current && view.ready;
  return `<header class="app-header"><a class="brand" href="/admin"><span class="brand-mark">PF</span>PitchFlow</a><a class="display-link" href="/waiting/" target="_blank">Open waiting display ↗</a></header>
  <main class="dashboard">
    <section class="live-card"><div><p class="eyebrow">${escape(state.competitionName)}</p><h1>${view.current ? "Pitch in progress" : "Ready for the next team"}</h1></div><div class="live-summary"><span>NOW</span><strong>${view.current ? `#${escape(view.current.number)} ${escape(view.current.name)}` : "No pitch in progress"}</strong><span>NEXT READY</span><strong>${view.ready ? `#${escape(view.ready.number)} ${escape(view.ready.name)}` : "No teams remaining"}</strong></div><div class="action-row">${canStart ? `<button class="button primary workflow-button" data-action="start"><span>Start #${escape(view.ready.number)} pitch</span><small>Move this team to Now Pitching</small></button>` : ""}${view.current ? `<button class="button success workflow-button" data-action="complete"><span>End #${escape(view.current.number)} pitch</span><small>${view.ready ? `Complete it · #${escape(view.ready.number)} becomes ready` : "Complete final team"}</small></button>` : ""}<button class="button secondary" data-action="announcement">Announcement</button></div></section>
    <section class="stats"><div><b>${live.length}</b><span>Live queue</span></div><div><b>${completed.length}</b><span>Completed</span></div><div><b>${attention.length}</b><span>Attention</span></div></section>
    <section class="columns">
      <section class="list-card"><div class="list-title"><div><p class="eyebrow">LIVE QUEUE</p><h2>Current & remaining</h2></div><span>${live.length}</span></div><p class="hint">Drag teams to change their upcoming order. Current team stays first.</p><div class="team-list" id="live-list">${live.map((item) => `<article class="team-card ${item.status}" draggable="${item.status !== "pitching"}" data-team-id="${item.id}"><span class="drag">⠿</span><div>${team(item)}<small>${item.status === "pitching" ? "Now pitching" : item.status === "ready" ? "Get ready" : "Waiting"}</small></div>${item.status !== "pitching" ? `<button class="icon-button" data-attention="${item.id}" title="Move to attention">⋯</button>` : ""}</article>`).join("")}</div></section>
      <section class="list-card"><div class="list-title"><div><p class="eyebrow">COMPLETED</p><h2>Done</h2></div><span>${completed.length}</span></div><div class="team-list muted-list">${completed.length ? completed.map((item) => `<article class="team-card"><div>${team(item)}<small>Completed</small></div></article>`).join("") : `<p class="empty">No teams completed yet.</p>`}</div></section>
      <section class="list-card attention-card"><div class="list-title"><div><p class="eyebrow">ACTION REQUIRED</p><h2>Skipped / absent</h2></div><span>${attention.length}</span></div><div class="team-list">${attention.length ? attention.map((item) => `<article class="team-card"><div>${team(item)}<small>${escape(item.attentionReason ?? "Needs attention")}</small></div><button class="button small" data-restore="${item.id}">Return</button></article>`).join("") : `<p class="empty">Everyone is in the queue.</p>`}</div></section>
    </section>
    <section class="history"><p class="eyebrow">EVENT HISTORY</p><h2>Latest actions</h2>${state.history.length ? `<ol>${state.history.slice(0, 8).map((entry) => `<li><span>${escape(entry.action.replaceAll("_", " "))}</span><time>${new Date(entry.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></li>`).join("")}</ol>` : `<p class="empty">Actions will be recorded here.</p>`}</section>
  </main>`;
}

function render() {
  app.innerHTML = isDisplay ? publicDisplay() : authenticated ? admin() : login();
  if (!isDisplay && authenticated) bindAdmin();
  if (!isDisplay && !authenticated) document.querySelector("#login-form").addEventListener("submit", loginSubmit);
}

async function loginSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const response = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
  if (!response.ok) return document.querySelector("#login-error").textContent = (await response.json()).error;
  authenticated = true;
  await load();
}

function bindAdmin() {
  document.querySelector("[data-action='start']")?.addEventListener("click", () => update(startPitch));
  document.querySelector("[data-action='complete']")?.addEventListener("click", () => update(completePitch));
  document.querySelector("[data-action='announcement']")?.addEventListener("click", async () => { const message = prompt("Announcement (leave blank to clear):", state.announcement); if (message !== null) await update((current) => ({ ...current, announcement: message, updatedAt: new Date().toISOString(), history: [{ id: crypto.randomUUID(), action: "announcement_updated", at: new Date().toISOString() }, ...current.history] })); });
  document.querySelectorAll("[data-attention]").forEach((button) => button.addEventListener("click", () => { const reason = confirm("OK = skipped. Cancel = absent.") ? "skipped" : "absent"; update((current) => moveToAttention(current, button.dataset.attention, reason)); }));
  document.querySelectorAll("[data-restore]").forEach((button) => button.addEventListener("click", () => update((current) => restoreFromAttention(current, button.dataset.restore))));
  document.querySelectorAll("[draggable='true']").forEach((item) => { item.addEventListener("dragstart", () => dragId = item.dataset.teamId); item.addEventListener("dragover", (event) => event.preventDefault()); item.addEventListener("drop", () => { if (!dragId || dragId === item.dataset.teamId) return; const ids = [...document.querySelectorAll("#live-list .team-card")].map((row) => row.dataset.teamId); ids.splice(ids.indexOf(dragId), 1); ids.splice(ids.indexOf(item.dataset.teamId), 0, dragId); update((current) => reorderLive(current, ids)); }); });
}

async function update(transform) { try { await save(transform(state)); } catch (error) { alert(error.message); } }

load().catch((error) => { app.innerHTML = `<p class="fatal">${escape(error.message)}</p>`; });
if (isDisplay) setInterval(() => load().catch(() => {}), 3000);
