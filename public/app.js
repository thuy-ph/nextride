import { getPublicParkSnapshot } from "./shared/browser-data.js";
import { createRecommendation } from "./shared/optimizer.js";

const app = document.querySelector("#app");
const partySheet = document.querySelector("#party-sheet");
const partyForm = document.querySelector("#party-form");
const partyButton = document.querySelector("#party-button");
const installButton = document.querySelector("#install-button");
const toast = document.querySelector("#toast");
const adultsInput = document.querySelector("#adult-count");
const childrenInput = document.querySelector("#child-heights");
const parentSwapInput = document.querySelector("#parent-swap");

const defaultState = {
  parkId: "movieworld",
  party: { adults: 2, children: [118, 96], parentSwap: false },
  completedIds: [],
  rejectedIds: [],
  currentLocation: null,
  currentIntent: "ride",
  remainingMinutes: 180
};

let state = loadState();
let currentPlan = null;
let installPrompt = null;
const isLocalServer = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
const useBrowserLiveFeed = !isLocalServer || new URLSearchParams(window.location.search).has("direct");

const icons = {
  family: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 20v-1.1A4.9 4.9 0 0 0 11.1 14H6.9A4.9 4.9 0 0 0 2 18.9V20M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm11.2 10v-1.1a4.9 4.9 0 0 0-3.7-4.75M15 2.15a4 4 0 0 1 0 7.7"/></svg>',
  walk: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="4" r="2"/><path d="m10 22 1-7-3-3 2-4 2 2 3-1M13 15l4 4"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  ride: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18M5 18V9m14 9V7M5 9c2-5 4 5 7 0s5 5 7-2M5 13c2-5 4 5 7 0s5 5 7-2"/></svg>',
  food: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3v8M2 3v5a2 2 0 0 0 4 0V3m7 0v18m0-18c4 2 4 8 0 10"/></svg>',
  break: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V7m0 7h11l3 5M8 7h5v7M5 19h14"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8v.01"/></svg>'
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem("nextride-state"));
    return { ...defaultState, ...saved, party: { ...defaultState.party, ...saved?.party } };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem("nextride-state", JSON.stringify(state));
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function formatTime(iso) {
  return new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "Australia/Brisbane" }).format(new Date(iso));
}

function groupSummary(party) {
  const children = party.children.length ? `${party.children.length} child${party.children.length === 1 ? "" : "ren"} (${party.children.join(" / ")} cm)` : "adults only";
  return `${party.adults} adult${party.adults === 1 ? "" : "s"} · ${children}`;
}

function kindIcon(kind) {
  return icons[kind === "food" ? "food" : kind === "break" ? "break" : "ride"];
}

function actionLabel(recommendation) {
  if (recommendation.kind === "food") return "We’ve eaten";
  if (recommendation.kind === "break") return "We’re ready to continue";
  return "Mark as done";
}

function renderEmpty(plan) {
  app.innerHTML = `
    <section class="page-top"><p class="eyebrow">Live at Movie World</p><h1>Let’s reset your plan.</h1><p class="time-line">${escapeHtml(plan.summary)}</p></section>
    <button class="primary-action" type="button" data-refresh>Refresh live waits</button>`;
}

function renderPlan(plan) {
  if (!plan.recommendation) return renderEmpty(plan);
  const recommendation = plan.recommendation;
  const alternatives = plan.alternatives ?? [];
  const sourceLabel = plan.source === "live" ? `Live at Movie World · updated ${formatTime(plan.fetchedAt)}` : `${plan.sourceLabel} · updated ${formatTime(plan.fetchedAt)}`;
  const actionLabelText = actionLabel(recommendation);
  const eligibility = recommendation.kind === "ride"
    ? `${recommendation.eligibility?.label ?? "check ride requirements"} · confirm requirements at the ride.`
    : "Your group can take this stop together.";
  const alternativeMarkup = alternatives.length
    ? alternatives.map((ride) => `
      <button class="option" type="button" data-alternative="${escapeHtml(ride.id)}" aria-label="Make ${escapeHtml(ride.name)} your next option">
        <span class="ride-symbol">${icons.ride}</span>
        <span>
          <span class="option-name">${escapeHtml(ride.name)}</span>
          <span class="option-facts"><span>${ride.walkMinutes} min walk</span><span>·</span><span>${ride.waitTime} min wait</span></span>
        </span>
        <span class="option-arrow">${icons.chevron}</span>
      </button>`).join("")
    : '<p class="time-line">No other suitable live options right now.</p>';

  app.innerHTML = `
    <svg class="route-line" viewBox="0 0 400 160" preserveAspectRatio="none" aria-hidden="true"><path d="M-20,120 C65,120 65,92 130,92 S215,110 245,65 S310,38 420,38"/><circle cx="130" cy="92" r="7"/><circle class="route-end" cx="308" cy="39" r="7"/></svg>
    <section class="page-top">
      <div class="live-row" data-source="${escapeHtml(plan.source)}"><span class="live-dot"></span><span>${escapeHtml(sourceLabel)}</span></div>
      <h1>Your day, one smart move at a time.</h1>
      <p class="time-line">${escapeHtml(plan.summary)}</p>
      <button class="party-chip" type="button" data-open-party>${icons.family}<span>${escapeHtml(groupSummary(plan.party))}</span></button>
    </section>
    <section class="recommendation-panel" aria-labelledby="next-move-title">
      <h2 class="section-label" id="next-move-title">Your best next move</h2>
      <article class="recommendation-card">
        <div class="card-top">
          <span class="ride-symbol is-${escapeHtml(recommendation.kind)}">${kindIcon(recommendation.kind)}</span>
          <div class="card-copy"><h3>${escapeHtml(recommendation.name)}</h3><p class="zone">${escapeHtml(recommendation.zone)}</p>
          <div class="ride-facts"><span>${icons.walk}${recommendation.walkMinutes} min walk</span><span class="fact-dot"></span><span>${icons.clock}${recommendation.waitTime ? `${recommendation.waitTime} min wait` : `${recommendation.durationMinutes} min stop`}</span></div></div>
        </div>
        <p class="why-now"><strong>Why now?</strong> ${escapeHtml(recommendation.why)}</p>
        <p class="eligibility-note">${icons.info}<span>${escapeHtml(eligibility)}</span></p>
      </article>
      <button class="primary-action" type="button" data-complete>${escapeHtml(actionLabelText)}</button>
      <div class="quick-actions" aria-label="Change your plan">
        <button class="quick-action" type="button" data-intent="ride">Show another</button>
        <button class="quick-action" type="button" data-intent="food">Need food</button>
        <button class="quick-action" type="button" data-intent="break">Take a break</button>
      </div>
    </section>
    <section class="secondary-section" aria-labelledby="alternatives-title">
      <div class="secondary-heading"><h2 id="alternatives-title">Other great options</h2><p>tap to prioritise</p></div>
      <div class="option-list">${alternativeMarkup}</div>
    </section>
    <aside class="confidence-note">${icons.info}<span>Queues change quickly. NextRide uses live estimates and your profile, but official ride signs and attendants always decide eligibility.</span></aside>`;
}

function renderError(message) {
  app.innerHTML = `<section class="page-top"><p class="eyebrow">Couldn’t refresh</p><h1>Your plan is still here.</h1><p class="time-line">${escapeHtml(message)}</p><button class="primary-action" type="button" data-refresh>Try again</button></section>`;
}

function showLoading() {
  app.innerHTML = `<section class="loading-state" aria-label="Updating your best next move"><span class="live-dot"></span><p>Reworking your plan…</p><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-button"></div></section>`;
}

async function getPlan(intent = state.currentIntent) {
  state.currentIntent = intent;
  saveState();
  showLoading();
  try {
    const request = {
      parkId: state.parkId,
      party: state.party,
      completedIds: state.completedIds,
      rejectedIds: state.rejectedIds,
      currentLocation: state.currentLocation,
      intent,
      remainingMinutes: state.remainingMinutes
    };
    if (useBrowserLiveFeed) {
      const snapshot = await getPublicParkSnapshot(state.parkId);
      const plan = createRecommendation({ snapshot, ...request });
      currentPlan = { ...plan, source: snapshot.source, sourceLabel: snapshot.sourceLabel, fetchedAt: snapshot.fetchedAt };
    } else {
      const response = await fetch("./api/recommendations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request)
      });
      if (!response.ok) throw new Error("NextRide could not refresh the live plan.");
      currentPlan = await response.json();
    }
    renderPlan(currentPlan);
  } catch (error) {
    renderError(error.message);
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function openPartySheet() {
  adultsInput.value = state.party.adults;
  childrenInput.value = state.party.children.join(", ");
  parentSwapInput.checked = state.party.parentSwap;
  partySheet.showModal();
}

function closePartySheet() {
  partySheet.close();
}

function completeCurrentMove() {
  const recommendation = currentPlan?.recommendation;
  if (!recommendation) return;
  if (recommendation.kind === "ride") {
    state.completedIds = [...new Set([...state.completedIds, recommendation.id])];
    state.remainingMinutes = Math.max(30, state.remainingMinutes - recommendation.totalMinutes);
  } else {
    state.remainingMinutes = Math.max(30, state.remainingMinutes - recommendation.durationMinutes);
  }
  state.currentLocation = recommendation.location ?? state.currentLocation;
  state.rejectedIds = [];
  state.currentIntent = "ride";
  saveState();
  showToast(recommendation.kind === "ride" ? "Done — finding the next best move." : "Nice. Back to the smartest next ride.");
  getPlan("ride");
}

function chooseAlternative(id) {
  const current = currentPlan?.recommendation;
  if (current?.kind === "ride") state.rejectedIds = [...new Set([...state.rejectedIds, current.id])];
  state.rejectedIds = state.rejectedIds.filter((item) => item !== id);
  state.currentIntent = "ride";
  saveState();
  showToast("Re-ranking around that option.");
  getPlan("ride");
}

app.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.matches("[data-complete]")) completeCurrentMove();
  if (button.matches("[data-intent]")) {
    const intent = button.dataset.intent;
    if (intent === "ride" && currentPlan?.recommendation?.kind === "ride") {
      state.rejectedIds = [...new Set([...state.rejectedIds, currentPlan.recommendation.id])];
    }
    getPlan(intent);
  }
  if (button.matches("[data-alternative]")) chooseAlternative(button.dataset.alternative);
  if (button.matches("[data-open-party]")) openPartySheet();
  if (button.matches("[data-refresh]")) getPlan("ride");
});

partyButton.addEventListener("click", openPartySheet);
document.querySelector("[data-close-sheet]").addEventListener("click", closePartySheet);
partyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const heights = childrenInput.value.split(/[,\s]+/).map(Number).filter((height) => Number.isFinite(height) && height > 0 && height < 230);
  state.party = { adults: Math.max(1, Number(adultsInput.value) || 1), children: heights, parentSwap: parentSwapInput.checked };
  state.rejectedIds = [];
  state.completedIds = [];
  state.currentLocation = null;
  state.remainingMinutes = 180;
  saveState();
  closePartySheet();
  showToast("Family profile updated. Plan refreshed.");
  getPlan("ride");
});
document.querySelector("#reset-day").addEventListener("click", () => {
  state = structuredClone(defaultState);
  saveState();
  closePartySheet();
  showToast("Today’s progress has been reset.");
  getPlan("ride");
});

document.querySelector(".bottom-nav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-nav]");
  if (!button) return;
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("is-active", item === button));
  if (button.dataset.nav === "profile" || button.dataset.nav === "plan") return openPartySheet();
  if (button.dataset.nav === "rides") return showToast("Tap an alternative to make it your next priority.");
  getPlan("ride");
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.classList.remove("is-hidden");
});
installButton.addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  installButton.classList.add("is-hidden");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

getPlan("ride");
