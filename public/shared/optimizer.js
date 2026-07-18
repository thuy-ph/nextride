import { PARKS } from "./parks.js";

const EARTH_RADIUS_METRES = 6_371_000;
const WALKING_METRES_PER_MINUTE = 70;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceMetres(from, to) {
  if (!from || !to) return 420;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.sqrt(a));
}

function walkMinutes(from, to) {
  return Math.max(1, Math.round(distanceMetres(from, to) / WALKING_METRES_PER_MINUTE));
}

function normaliseParty(party = {}) {
  const adults = Math.max(1, Math.min(8, Number(party.adults) || 2));
  const children = Array.isArray(party.children)
    ? party.children.map(Number).filter((height) => Number.isFinite(height) && height > 0 && height < 230)
    : [118, 96];
  return { adults, children, parentSwap: Boolean(party.parentSwap) };
}

function eligibilityFor(attraction, party) {
  if (party.children.length === 0) return { state: "everyone", label: "all adults" };
  if (attraction.minHeightCm == null) return { state: "unknown", label: "verify at ride" };
  const shortestChild = Math.min(...party.children);
  if (attraction.minHeightCm <= shortestChild) return { state: "everyone", label: "everyone in your group" };
  if (party.parentSwap) return { state: "parent-swap", label: "parent swap may work" };
  return { state: "not-eligible", label: `needs ${attraction.minHeightCm} cm` };
}

function scoreRide(attraction, { party, currentLocation, mustDo = [] }) {
  const walk = walkMinutes(currentLocation, attraction.location);
  const wait = attraction.waitTime ?? 50;
  const eligibility = eligibilityFor(attraction, party);
  const totalMinutes = walk + wait + attraction.durationMinutes;
  const mustDoBoost = mustDo.includes(attraction.id) || mustDo.includes(attraction.name) ? 18 : 0;
  const familyPenalty = eligibility.state === "unknown" ? 13 : eligibility.state === "parent-swap" ? 22 : 0;
  const queueRisk = wait >= 35 ? 14 : wait >= 25 ? 7 : 0;
  const score = (attraction.familyScore * 13) + mustDoBoost - (totalMinutes * 2.6) - queueRisk - familyPenalty;
  return { ...attraction, walkMinutes: walk, totalMinutes, eligibility, score: Math.round(score) };
}

function buildWhy(candidate, { totalRemainingMinutes }) {
  const parts = [`${candidate.walkMinutes} min walk`, `${candidate.waitTime} min wait`];
  let decision = `${parts.join(" · ")}. ${candidate.reason[0].toUpperCase()}${candidate.reason.slice(1)}.`;
  if (candidate.eligibility.state === "everyone") decision += " It works for everyone in your group.";
  if (candidate.eligibility.state === "parent-swap") decision += " Parent Swap can keep the day moving—confirm with the ride attendant.";
  if (totalRemainingMinutes <= 90) decision += " It protects your limited time.";
  return decision;
}

function projectRideCount(candidates, minutes) {
  let used = 0;
  let count = 0;
  for (const candidate of candidates) {
    if (used + candidate.totalMinutes > minutes) continue;
    used += candidate.totalMinutes;
    count += 1;
  }
  return count;
}

function makeBreakRecommendation(park, currentLocation) {
  const restStop = park.restStop ?? { id: "rest-stop", name: "Find a shaded rest stop", subtitle: "Use a quiet space before your next ride", location: null };
  return {
    id: restStop.id,
    kind: "break",
    name: restStop.name,
    zone: "Reset",
    walkMinutes: walkMinutes(currentLocation, restStop.location),
    waitTime: 0,
    durationMinutes: 15,
    totalMinutes: 15,
    eligibility: { state: "everyone", label: "everyone in your group" },
    why: `${restStop.subtitle}. A 15-minute reset is a better move than joining a long queue now.`,
    reason: restStop.subtitle
  };
}

function makeFoodRecommendation(park, currentLocation) {
  const foodStop = park.foodStop ?? { id: "food-stop", name: "Plan a family food stop", subtitle: "Choose a meal venue before the rush", location: null };
  return {
    id: foodStop.id,
    kind: "food",
    name: foodStop.name,
    zone: "Food",
    walkMinutes: walkMinutes(currentLocation, foodStop.location),
    waitTime: 0,
    durationMinutes: 30,
    totalMinutes: 30,
    eligibility: { state: "everyone", label: "everyone in your group" },
    why: `${foodStop.subtitle}. NextRide will rerank rides once you’re ready to continue.`,
    reason: foodStop.subtitle
  };
}

export function createRecommendation({ snapshot, party: rawParty, completedIds = [], rejectedIds = [], mustDo = [], intent = "ride", currentLocation, remainingMinutes = 180 }) {
  const park = PARKS[snapshot.park.id];
  const party = normaliseParty(rawParty);
  const activeLocation = currentLocation ?? snapshot.park.entrance;
  const excluded = new Set([...completedIds, ...rejectedIds]);
  const scored = snapshot.attractions
    .filter((ride) => ride.status === "OPERATING" && Number.isFinite(ride.waitTime) && !excluded.has(ride.id))
    .map((ride) => scoreRide(ride, { party, currentLocation: activeLocation, mustDo }))
    .filter((ride) => ride.eligibility.state !== "not-eligible")
    .sort((a, b) => b.score - a.score);

  // Do not silently treat missing height data as child-friendly. Adults can
  // browse the broader live list; a family plan only ranks curated safe data.
  const ranked = party.children.length === 0
    ? scored
    : scored.filter((ride) => ride.suitabilityKnown || ride.eligibility.state === "parent-swap");
  const primaryRide = ranked[0] ?? null;
  if (!primaryRide) {
    return {
      recommendation: null,
      alternatives: [],
      summary: "There are no suitable operating rides in this live snapshot. Refresh in a few minutes or adjust your group profile.",
      party,
      generatedAt: new Date().toISOString()
    };
  }

  let recommendation = primaryRide;
  if (intent === "food") recommendation = makeFoodRecommendation(park, activeLocation);
  if (intent === "break") recommendation = makeBreakRecommendation(park, activeLocation);

  const alternatives = ranked.filter((ride) => ride.id !== primaryRide.id).slice(0, 2);
  const projectedRides = projectRideCount(ranked, remainingMinutes);
  return {
    recommendation: {
      ...recommendation,
      kind: recommendation.kind ?? "ride",
      why: recommendation.why ?? buildWhy(recommendation, { totalRemainingMinutes: remainingMinutes })
    },
    alternatives,
    summary: `At this pace, your family can fit about ${Math.max(projectedRides, 1)} more suitable rides into the next ${Math.round(remainingMinutes / 60)} hours.`,
    party,
    generatedAt: new Date().toISOString(),
    assumptions: [
      "Queue times are live estimates and can change quickly.",
      "Always confirm height, health, and rider requirements at the attraction."
    ]
  };
}
