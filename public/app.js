import { getPublicParkSnapshot } from "./shared/browser-data.js";
import { getWalkingDirectionsUrl } from "./shared/directions.js";
import { createRecommendation } from "./shared/optimizer.js";

const app = document.querySelector("#app");
const partySheet = document.querySelector("#party-sheet");
const partyForm = document.querySelector("#party-form");
const partyButton = document.querySelector("#party-button");
const toast = document.querySelector("#toast");
const planStatus = document.querySelector("#plan-status");
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
const isLocalServer = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
const useBrowserLiveFeed = !isLocalServer || new URLSearchParams(window.location.search).has("direct");

const icons = {
  family: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 20v-1.1A4.9 4.9 0 0 0 11.1 14H6.9A4.9 4.9 0 0 0 2 18.9V20M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm11.2 10v-1.1a4.9 4.9 0 0 0-3.7-4.75M15 2.15a4 4 0 0 1 0 7.7"/></svg>',
  route: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5m-7 0h7v7"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>'
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem("nextride-state"));
    return {
      ...defaultState,
      ...saved,
      party: { ...defaultState.party, ...saved?.party },
      // The distilled interface no longer has a reject/skip action. Clear any
      // exclusions left behind by the earlier interface.
      rejectedIds: [],
      currentIntent: "ride"
    };
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

function sourceLabel(plan) {
  if (plan.source === "live") return `Live waits · updated ${formatTime(plan.fetchedAt)}`;
  return `${plan.sourceLabel} · ${formatTime(plan.fetchedAt)}`;
}

function rideDetails(recommendation, hasDirections) {
  const wait = Number.isFinite(recommendation.waitTime) ? recommendation.waitTime : "—";
  const walk = Number.isFinite(recommendation.walkMinutes) ? recommendation.walkMinutes : "—";
  const eligibility = recommendation.eligibility?.state === "everyone"
    ? "Suitable for your group"
    : recommendation.eligibility?.label ?? "Check rider requirements";

  return `
    <div class="ride-heading">
      <div>
        <h1 id="ride-name">${escapeHtml(recommendation.name)}</h1>
        <p class="zone">${escapeHtml(recommendation.zone)}</p>
      </div>
      ${hasDirections ? `<span class="route-arrow">${icons.route}</span>` : ""}
    </div>
    <div class="ride-stats" aria-label="Ride timing">
      <span class="ride-stat"><strong>${escapeHtml(wait)} min</strong><small>wait</small></span>
      <span class="ride-stat"><strong>${escapeHtml(walk)} min</strong><small>walk</small></span>
    </div>
    <p class="eligibility">${escapeHtml(eligibility)}</p>
    ${hasDirections ? '<p class="directions-prompt">Tap for walking directions</p>' : '<p class="directions-unavailable">Follow park signs to this ride</p>'}`;
}

function renderEmpty(plan) {
  app.innerHTML = `
    <section class="empty-state">
      <p class="live-row" data-source="${escapeHtml(plan.source)}"><span class="live-dot"></span>${escapeHtml(sourceLabel(plan))}</p>
      <h1>No suitable ride right now</h1>
      <p>${escapeHtml(plan.summary)}</p>
      <div class="empty-actions">
        <button class="primary-action" type="button" data-refresh>Check again</button>
        <button class="text-action" type="button" data-open-party>Adjust family</button>
      </div>
    </section>`;
  planStatus.textContent = "No suitable next ride right now.";
}

function renderPlan(plan) {
  if (!plan.recommendation) return renderEmpty(plan);
  const recommendation = plan.recommendation;
  const directionsUrl = getWalkingDirectionsUrl(recommendation);
  const destination = directionsUrl
    ? `<a class="ride-destination" href="${escapeHtml(directionsUrl)}" target="_blank" rel="noopener" aria-label="Open walking directions to ${escapeHtml(recommendation.name)}">${rideDetails(recommendation, true)}</a>`
    : `<article class="ride-destination">${rideDetails(recommendation, false)}</article>`;

  app.innerHTML = `
    <section class="plan-screen" aria-labelledby="ride-name">
      <p class="live-row" data-source="${escapeHtml(plan.source)}"><span class="live-dot"></span>${escapeHtml(sourceLabel(plan))}</p>
      <p class="next-label">Next ride</p>
      ${destination}
      <div class="completion-area">
        <button class="primary-action" type="button" data-complete>${icons.check}<span>Mark ride as done</span></button>
        <p class="safety-note">Confirm rider requirements and follow official park signs.</p>
      </div>
    </section>`;

  const wait = Number.isFinite(recommendation.waitTime) ? `${recommendation.waitTime} minute wait` : "wait unavailable";
  planStatus.textContent = `Next ride: ${recommendation.name}. ${wait}. ${recommendation.walkMinutes} minute walk.`;
}

function renderError(message) {
  app.innerHTML = `
    <section class="empty-state">
      <h1>Couldn’t update waits</h1>
      <p>${escapeHtml(message)}</p>
      <button class="primary-action" type="button" data-refresh>Try again</button>
    </section>`;
  planStatus.textContent = "NextRide could not update the live waits.";
}

function showLoading() {
  app.innerHTML = `
    <section class="loading-state" aria-hidden="true">
      <div class="skeleton skeleton-status"></div>
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-ride"></div>
      <div class="skeleton skeleton-button"></div>
    </section>`;
  planStatus.textContent = "Updating your next ride.";
}

async function getPlan() {
  state.currentIntent = "ride";
  saveState();
  showLoading();
  try {
    const request = {
      parkId: state.parkId,
      party: state.party,
      completedIds: state.completedIds,
      rejectedIds: [],
      currentLocation: state.currentLocation,
      intent: "ride",
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
  showToast.timeout = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
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

function completeCurrentRide() {
  const recommendation = currentPlan?.recommendation;
  if (!recommendation) return;
  state.completedIds = [...new Set([...state.completedIds, recommendation.id])];
  state.remainingMinutes = Math.max(30, state.remainingMinutes - recommendation.totalMinutes);
  state.currentLocation = recommendation.location ?? state.currentLocation;
  state.rejectedIds = [];
  saveState();
  showToast("Ride done. Finding what’s next…");
  getPlan();
}

app.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.matches("[data-complete]")) completeCurrentRide();
  if (button.matches("[data-open-party]")) openPartySheet();
  if (button.matches("[data-refresh]")) getPlan();
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
  showToast("Family updated.");
  getPlan();
});

document.querySelector("#reset-day").addEventListener("click", () => {
  state = structuredClone(defaultState);
  saveState();
  closePartySheet();
  showToast("Today’s rides reset.");
  getPlan();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

getPlan();
