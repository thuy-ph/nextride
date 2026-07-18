import { getPublicParkSnapshot } from "./shared/browser-data.js";
import { createRecommendation } from "./shared/optimizer.js";
import { getParkRoute } from "./shared/park-map.js";

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
  lastCompletedName: null,
  currentIntent: "ride",
  remainingMinutes: 180
};

let state = loadState();
let currentPlan = null;
const isLocalServer = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
const useBrowserLiveFeed = !isLocalServer || new URLSearchParams(window.location.search).has("direct");

const icons = {
  family: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 20v-1.1A4.9 4.9 0 0 0 11.1 14H6.9A4.9 4.9 0 0 0 2 18.9V20M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm11.2 10v-1.1a4.9 4.9 0 0 0-3.7-4.75M15 2.15a4 4 0 0 1 0 7.7"/></svg>',
  route: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg>',
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

function rideDetails(recommendation, hasParkMap, walkMinutes = recommendation.walkMinutes) {
  const wait = Number.isFinite(recommendation.waitTime) ? recommendation.waitTime : "—";
  const walk = Number.isFinite(walkMinutes) ? walkMinutes : "—";
  const eligibility = recommendation.eligibility?.state === "everyone"
    ? "Suitable for your group"
    : recommendation.eligibility?.label ?? "Check rider requirements";

  return `
    <div class="ride-heading">
      <div>
        <h1 id="ride-name">${escapeHtml(recommendation.name)}</h1>
        <p class="zone">${escapeHtml(recommendation.zone)}</p>
      </div>
      ${hasParkMap ? `<span class="route-arrow">${icons.route}</span>` : ""}
    </div>
    <div class="ride-stats" aria-label="Ride timing">
      <span class="ride-stat"><strong>${escapeHtml(wait)} min</strong><small>wait</small></span>
      <span class="ride-stat"><strong>${escapeHtml(walk)} min</strong><small>walk</small></span>
    </div>
    <p class="eligibility">${escapeHtml(eligibility)}</p>
    ${hasParkMap ? '<p class="directions-prompt">Show on park map</p>' : '<p class="directions-unavailable">In-park route coming soon</p>'}`;
}

function pathMarkup(route) {
  const basePaths = route.edges.map(([fromId, toId]) => {
    const from = route.nodes[fromId];
    const to = route.nodes[toId];
    return `<path class="map-path" d="M ${from.x} ${from.y} L ${to.x} ${to.y}" />`;
  }).join("");
  const selectedPath = route.path.map((node, index) => `${index ? "L" : "M"} ${node.x} ${node.y}`).join(" ");
  const start = route.path[0];
  const destination = route.path.at(-1);

  return `
    <svg class="park-map-svg" viewBox="0 0 340 300" role="img" aria-labelledby="park-map-title park-map-description">
      <title id="park-map-title">Route to ${escapeHtml(route.toLabel)}</title>
      <desc id="park-map-description">Approximate in-park route from ${escapeHtml(route.fromLabel)} to ${escapeHtml(route.toLabel)}.</desc>
      <defs>
        <marker id="route-chevron" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 1 1 L 7 4 L 1 7" fill="none" stroke="#17200b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </marker>
      </defs>
      <path class="park-boundary" d="M53 25 Q26 43 34 88 L18 238 Q17 279 58 280 L199 286 Q228 279 244 249 L320 231 Q333 214 314 181 L304 91 Q295 37 245 30 Z" />
      <path class="zone-shape zone-kids" d="M48 35 Q73 23 145 34 L145 78 Q97 91 48 75 Z" />
      <path class="zone-shape zone-west" d="M30 142 Q75 128 119 155 L89 269 L27 266 Z" />
      <path class="zone-shape zone-oz" d="M139 181 L211 181 L211 276 L137 276 Z" />
      <path class="zone-shape zone-dc" d="M241 58 Q304 55 315 104 L320 218 L249 199 Z" />
      <g aria-hidden="true">${basePaths}</g>
      <path class="map-route-underlay" d="${selectedPath}" />
      <path class="map-route" d="${selectedPath}" marker-mid="url(#route-chevron)" marker-end="url(#route-chevron)" />
      <g class="map-labels" aria-hidden="true">
        <text x="55" y="46">KIDS’ WB!</text>
        <text x="130" y="138">MAIN STREET</text>
        <text x="26" y="195">WILD WEST</text>
        <text x="144" y="246">WIZARD OF OZ</text>
        <text x="264" y="73">DC ZONE</text>
        <text x="159" y="37">ENTRY</text>
      </g>
      <g class="map-start" transform="translate(${start.x} ${start.y})" aria-hidden="true">
        <circle r="11" />
        <text y="4">S</text>
      </g>
      <g class="map-destination" transform="translate(${destination.x} ${destination.y})" aria-hidden="true">
        <circle r="13" />
        <circle r="4" />
      </g>
    </svg>`;
}

function parkMapMarkup(route) {
  const walkLabel = route.routeMinutes === 0 ? "You’re already in this area" : `About ${route.routeMinutes} min walk`;
  return `
    <section class="park-route" id="park-route" aria-labelledby="map-heading" hidden>
      <button class="map-back" type="button" data-toggle-map>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        <span>Back to ride</span>
      </button>
      <div class="map-heading-row">
        <div>
          <p class="map-eyebrow">In-park route</p>
          <h1 id="map-heading">Walk to ${escapeHtml(route.toLabel)}</h1>
        </div>
        <strong class="map-walk-time">${escapeHtml(walkLabel)}</strong>
      </div>
      <div class="park-map-frame">
        ${pathMarkup(route)}
        <a class="map-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>
      </div>
      <div class="map-legend" aria-label="Route summary">
        <p><span class="legend-dot legend-start"></span><span><small>Start</small><strong>${escapeHtml(route.fromLabel)}</strong></span></p>
        <p><span class="legend-dot legend-next"></span><span><small>Next</small><strong>${escapeHtml(route.toLabel)}</strong></span></p>
      </div>
      <p class="map-note">Approximate in-park route. Follow official signs and staff directions.</p>
    </section>`;
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
  const route = getParkRoute({
    parkId: state.parkId,
    from: state.currentLocation,
    fromName: state.lastCompletedName ?? (state.currentLocation ? "Your last ride" : null),
    to: recommendation
  });
  const displayWalk = route.available ? Math.max(1, route.routeMinutes) : recommendation.walkMinutes;
  const destination = route.available
    ? `<button class="ride-destination" type="button" data-toggle-map aria-expanded="false" aria-controls="park-route" aria-label="Show ${escapeHtml(recommendation.name)} on the park map">${rideDetails(recommendation, true, displayWalk)}</button>`
    : `<article class="ride-destination">${rideDetails(recommendation, false, displayWalk)}</article>`;

  app.innerHTML = `
    <section class="plan-screen" aria-labelledby="ride-name">
      <p class="live-row" data-source="${escapeHtml(plan.source)}"><span class="live-dot"></span>${escapeHtml(sourceLabel(plan))}</p>
      <p class="next-label">Next ride</p>
      ${destination}
      ${route.available ? parkMapMarkup(route) : ""}
      <div class="completion-area">
        <button class="primary-action" type="button" data-complete>${icons.check}<span>Mark ride as done</span></button>
        <p class="safety-note">Confirm rider requirements and follow official park signs.</p>
      </div>
    </section>`;

  const wait = Number.isFinite(recommendation.waitTime) ? `${recommendation.waitTime} minute wait` : "wait unavailable";
  planStatus.textContent = `Next ride: ${recommendation.name}. ${wait}. ${displayWalk} minute walk.`;
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
  state.lastCompletedName = recommendation.name;
  state.rejectedIds = [];
  saveState();
  showToast("Ride done. Finding what’s next…");
  getPlan();
}

function toggleParkMap() {
  const destination = app.querySelector(".ride-destination[data-toggle-map]");
  const route = app.querySelector("#park-route");
  const screen = app.querySelector(".plan-screen");
  if (!destination || !route) return;
  const opening = route.hidden;
  route.hidden = !opening;
  destination.hidden = opening;
  screen?.classList.toggle("is-map-open", opening);
  destination.setAttribute("aria-expanded", String(opening));
  if (opening) {
    route.querySelector(".map-back")?.focus();
  } else {
    destination.focus();
  }
}

app.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.matches("[data-toggle-map]")) toggleParkMap();
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
  state.lastCompletedName = null;
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
